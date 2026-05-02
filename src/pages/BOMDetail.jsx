import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Plus, GitBranch, FileText, Settings2, ClipboardList } from "lucide-react";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { useRegisterSubNav } from "../hooks/useRegisterSubNav";
import BOMMatrixEditor from "../components/bom/BOMMatrixEditor.jsx";
import BOMLineAddDialog from "../components/bom/BOMLineAddDialog";
import BOLEditorTab from "../components/bom/BOLEditorTab";
import BOMChangeLogTab from "../components/bom/BOMChangeLogTab";
import BOMHeaderCard from "../components/bom/BOMHeaderCard";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  in_review: "bg-amber-100 text-amber-700 border-amber-300",
  released: "bg-green-100 text-green-700 border-green-300",
  superseded: "bg-purple-100 text-purple-700 border-purple-300",
  obsolete: "bg-red-100 text-red-700 border-red-300",
};

const STATUS_TRANSITIONS = {
  draft: [{ to: "in_review", label: "Submit for Review" }],
  in_review: [
    { to: "draft", label: "Send Back to Draft" },
    { to: "released", label: "Approve & Release" },
  ],
  released: [{ to: "obsolete", label: "Mark Obsolete" }],
};

export default function BOMDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setOptions } = usePageOptions();

  const [bom, setBom] = useState(null);
  const [product, setProduct] = useState(null);
  const [bomLines, setBomLines] = useState([]);
  const [bomLineVariants, setBomLineVariants] = useState([]);
  const [colorVariants, setColorVariants] = useState([]);
  const [styleSizes, setStyleSizes] = useState([]);
  const [colorAndMores, setColorAndMores] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [allProductColors, setAllProductColors] = useState([]);
  const [techColors, setTechColors] = useState([]);
  const [commColors, setCommColors] = useState([]);
  const [lovValues, setLovValues] = useState([]);
  const [changeLog, setChangeLog] = useState([]);
  const [bol, setBol] = useState(null);
  const [bolOperations, setBolOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddLine, setShowAddLine] = useState(false);
  const [activeTab, setActiveTab] = useState("matrix");
  const [showMatrixConfig, setShowMatrixConfig] = useState(false);
  const [matrixColumnAxis, setMatrixColumnAxis] = useState("color");
  const [user, setUser] = useState(null);

  const isReadOnly = bom && !["draft", "in_review"].includes(bom.status);
  const isProduction = bom?.bom_type === "production";

  const subNavItems = bom ? [
    { id: "matrix", label: "Materials", icon: ClipboardList },
    ...(isProduction ? [{ id: "bol", label: "Operations (BOL)", icon: GitBranch }] : []),
    { id: "changelog", label: "Change Log", icon: FileText },
  ] : [];

  useRegisterSubNav(subNavItems, activeTab, setActiveTab, bom ? `BOM ${bom.revision_code}` : "BOM");

  const reload = useCallback(async () => {
    if (!id) return;
    const [boms, lines, variants, log] = await Promise.all([
      base44.entities.BOM.filter({ id }),
      base44.entities.BOMLine.filter({ bom_id: id }),
      base44.entities.BOMLineVariant.list("-created_date", 5000),
      base44.entities.BOMChangeLog.filter({ bom_id: id }),
    ]);
    const b = boms[0];
    setBom(b);
    setBomLines(lines.sort((a, z) => (a.position || 0) - (z.position || 0)));
    const lineIds = new Set(lines.map((l) => l.id));
    setBomLineVariants(variants.filter((v) => lineIds.has(v.bom_line_id)));
    setChangeLog(log.sort((a, z) => new Date(z.triggered_at) - new Date(a.triggered_at)));
    if (b) {
      const [prod] = await Promise.all([
        base44.entities.Product.filter({ id: b.product_id }),
      ]);
      setProduct(prod[0] || null);
      // Product-centric: show all active colorways for this product (not project-filtered)
      const ACTIVE_STATUSES = ["approved", "in_progress", "submitted_for_approval", "requested"];
      const [allCws, ss, cams] = await Promise.all([
        base44.entities.ProductColor.filter({ product_id: b.product_id }),
        base44.entities.StyleSize.filter({ product_id: b.product_id }),
        base44.entities.ProductColorAndMore.list("-created_date", 2000),
      ]);
      const activeCws = allCws.filter((c) => ACTIVE_STATUSES.includes(c.colorway_status || "approved"));
      setColorVariants(activeCws);
      setStyleSizes(ss.filter((s) => s.active !== false));
      setColorAndMores(cams.filter((c) => activeCws.some((cw) => cw.id === c.product_color_id)));
      if (b.bom_type === "production") {
        const bols = await base44.entities.BOL.filter({ bom_id: id });
        if (bols[0]) {
          setBol(bols[0]);
          const ops = await base44.entities.BOLOperation.filter({ bol_id: bols[0].id });
          setBolOperations(ops.sort((a, z) => a.sequence - z.sequence));
        }
      }
    }
  }, [id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const [prods, lovs, u, allPCs, tcs, ccs] = await Promise.all([
        base44.entities.Product.list("-created_date", 2000),
        base44.entities.ListOfValues.list("name", 5000),
        base44.auth.me(),
        base44.entities.ProductColor.list("-created_date", 5000),
        base44.entities.TechnicalColor.list("code", 2000),
        base44.entities.CommercialColor.list("code", 2000),
      ]);
      setAllProducts(prods);
      setLovValues(lovs);
      setUser(u);
      setAllProductColors(allPCs);
      setTechColors(tcs);
      setCommColors(ccs);
      await reload();
      setLoading(false);
    };
    init();
  }, [id]);

  const handleStatusTransition = async (toStatus) => {
    const now = new Date().toISOString();
    const updates = { status: toStatus };
    if (toStatus === "released") {
      updates.released_at = now;
      updates.released_by = user?.email || "";
      // Default valid_from to today on release
      if (!bom.valid_from) updates.valid_from = now.slice(0, 10);
    }
    await base44.entities.BOM.update(id, updates);
    await base44.entities.BOMChangeLog.create({
      bom_id: id,
      change_type: "status_transition",
      payload: { from: bom.status, to: toStatus },
      triggered_by: user?.email || "",
      triggered_at: now,
    });
    await reload();
  };

  const handleAddLine = async (lineData) => {
    const position = bomLines.length;
    const created = await base44.entities.BOMLine.create({ ...lineData, bom_id: id, position });
    await base44.entities.BOMChangeLog.create({
      bom_id: id,
      change_type: "line_added",
      payload: { component_product_id: lineData.component_product_id, role: lineData.component_role },
      triggered_by: user?.email || "",
      triggered_at: new Date().toISOString(),
    });
    setBomLines((prev) => [...prev, created]);
    setShowAddLine(false);
  };

  const handleDeleteLine = async (lineId) => {
    await base44.entities.BOMLine.delete(lineId);
    await base44.entities.BOMChangeLog.create({
      bom_id: id,
      change_type: "line_removed",
      payload: { bom_line_id: lineId },
      triggered_by: user?.email || "",
      triggered_at: new Date().toISOString(),
    });
    setBomLines((prev) => prev.filter((l) => l.id !== lineId));
    setBomLineVariants((prev) => prev.filter((v) => v.bom_line_id !== lineId));
  };

  const handleUpdateLine = async (lineId, updates) => {
    await base44.entities.BOMLine.update(lineId, updates);
    setBomLines((prev) => prev.map((l) => l.id === lineId ? { ...l, ...updates } : l));
  };

  const handleUpsertVariant = async (variantData) => {
    const existing = bomLineVariants.find(
      (v) => v.bom_line_id === variantData.bom_line_id &&
        v.product_color_id === variantData.product_color_id &&
        v.size_id === variantData.size_id &&
        v.product_color_and_more_id === variantData.product_color_and_more_id
    );
    if (existing) {
      await base44.entities.BOMLineVariant.update(existing.id, variantData);
      setBomLineVariants((prev) => prev.map((v) => v.id === existing.id ? { ...v, ...variantData } : v));
    } else {
      const created = await base44.entities.BOMLineVariant.create(variantData);
      setBomLineVariants((prev) => [...prev, created]);
    }
    await base44.entities.BOMChangeLog.create({
      bom_id: id,
      change_type: "variant_modified",
      payload: variantData,
      triggered_by: user?.email || "",
      triggered_at: new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (!bom) return;
    const transitions = STATUS_TRANSITIONS[bom.status] || [];
    setOptions({
      items: [
        ...(!isReadOnly ? [
          { label: "Add Component Line", icon: Plus, onClick: () => setShowAddLine(true), className: "text-primary hover:bg-primary/10" },
          { divider: true },
        ] : []),
        { label: "Axis Configuration", icon: Settings2, onClick: () => setShowMatrixConfig((v) => !v), custom: true },
        { divider: true },
        ...transitions.map((t) => ({
          label: t.label,
          onClick: () => handleStatusTransition(t.to),
        })),
      ],
    });
  }, [bom, isReadOnly, setOptions]);

  const getUom = (line) => {
    if (line.uom) return line.uom;
    const comp = allProducts.find((p) => p.id === line.component_product_id);
    return comp?.default_uom || "—";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!bom) {
    return <div className="text-center py-20 text-muted-foreground">BOM not found</div>;
  }

  // Diagnostic: parent product has no colorways at all
  const hasNoColorwaysAtAll = !loading && colorVariants.length === 0;

  return (
    <div className="px-2 py-2 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/boms")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-xl font-semibold truncate">
              {product ? `${product.code || ""} ${product.name}`.trim() : "BOM"}
            </h1>
            <span className="text-muted-foreground text-sm">Rev {bom.revision_code} v{bom.version}</span>
            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[bom.status] || ""}`}>
              {bom.status}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {bom.bom_type}
            </Badge>
            {bom.source_change_pending && (
              <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                ⚠ Source changed
              </Badge>
            )}
          </div>
        </div>
      </div>

      <BOMHeaderCard
        bom={bom}
        product={product}
        isReadOnly={isReadOnly}
        onBomUpdated={setBom}
      />

      {/* Diagnostic banner */}
      {hasNoColorwaysAtAll && product && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs">
          <span className="text-amber-500">⚠</span>
          <span className="text-amber-800">
            <strong>{product.code || product.name}</strong> has no colorways defined. The colorway matrix is empty.
          </span>
          <button
            type="button"
            className="ml-auto text-primary hover:underline"
            onClick={() => navigate(`/products/${product.id}`)}
          >
            Manage colorways →
          </button>
        </div>
      )}

      {activeTab === "matrix" && (
        <BOMMatrixEditor
          bom={bom}
          bomLines={bomLines}
          bomLineVariants={bomLineVariants}
          colorVariants={colorVariants}
          styleSizes={styleSizes}
          colorAndMores={colorAndMores}
          allProducts={allProducts}
          allProductColors={allProductColors}
          techColors={techColors}
          commColors={commColors}
          lovValues={lovValues}
          isReadOnly={isReadOnly}
          columnAxis={matrixColumnAxis}
          onColumnAxisChange={setMatrixColumnAxis}
          showAxisConfig={showMatrixConfig}
          onUpdateLine={handleUpdateLine}
          onDeleteLine={handleDeleteLine}
          onUpsertVariant={handleUpsertVariant}
          getUom={getUom}
          onAddLine={() => setShowAddLine(true)}
        />
      )}

      {activeTab === "bol" && isProduction && (
        <BOLEditorTab
          bol={bol}
          operations={bolOperations}
          bom={bom}
          isReadOnly={isReadOnly}
          onReload={reload}
        />
      )}

      {activeTab === "changelog" && (
        <BOMChangeLogTab changeLog={changeLog} allProducts={allProducts} />
      )}

      <BOMLineAddDialog
        open={showAddLine}
        onClose={() => setShowAddLine(false)}
        onSave={handleAddLine}
        allProducts={allProducts}
        lovValues={lovValues}
      />
    </div>
  );
}