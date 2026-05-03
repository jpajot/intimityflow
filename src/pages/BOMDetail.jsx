import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, GitBranch, FileText, ClipboardList, Info, Search, X } from "lucide-react";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { useRegisterSubNav } from "../hooks/useRegisterSubNav";
import BOMMatrixEditor from "../components/bom/BOMMatrixEditor.jsx";
import BOMLineAddDialog from "../components/bom/BOMLineAddDialog";
import BOLEditorTab from "../components/bom/BOLEditorTab";
import BOMChangeLogTab from "../components/bom/BOMChangeLogTab";
import BOMInfoPanel from "../components/bom/BOMInfoPanel";
import BOMOptionsContent from "../components/bom/BOMOptionsContent";
import BOMLinePickerDialog from "../components/bom/BOMLinePickerDialog";
import BOMAutoResolveDialog from "../components/bom/BOMAutoResolveDialog";
import BOMBulkLineActionDialog from "../components/bom/BOMBulkLineActionDialog";
import BOMCreateRevisionDialog from "../components/bom/BOMCreateRevisionDialog";
import BOMExportDialog from "../components/bom/BOMExportDialog";
import { DEFAULT_FILTER_CONFIG, isFilterActive, applyFilterConfig } from "../components/bom/BOMQuickFilterGroup";

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
  const [allSizes, setAllSizes] = useState([]);
  const [lovValues, setLovValues] = useState([]);
  const [changeLog, setChangeLog] = useState([]);
  const [bol, setBol] = useState(null);
  const [bolOperations, setBolOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddLine, setShowAddLine] = useState(false);
  const [activeTab, setActiveTab] = useState("matrix");
  const [matrixColumnAxis, setMatrixColumnAxis] = useState("color");
  const [matrixSecondaryAxis, setMatrixSecondaryAxis] = useState(null);
  const [showSourcing, setShowSourcing] = useState(true);
  const [viewStateId, setViewStateId] = useState(null);
  const [user, setUser] = useState(null);
  const [groupsExpanded, setGroupsExpanded] = useState({ view: false, quick_filter: false, lines: false, bom: false, export: false });
  const [filterConfig, setFilterConfig] = useState(DEFAULT_FILTER_CONFIG);
  const [projects, setProjects] = useState([]);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchRef = useRef(null);

  // Dialog state
  const [linePicker, setLinePicker] = useState(null); // { mode: "tcx"|"name"|"size"|"clear"|"markNA"|"copy" }
  const [autoResolve, setAutoResolve] = useState(null); // { mode, line }
  const [bulkAction, setBulkAction] = useState(null);   // { action, targetLine }
  const [showCreateRevision, setShowCreateRevision] = useState(false);
  const [showExport, setShowExport] = useState(false);

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
    // Sequential loading to avoid rate limits
    const boms = await base44.entities.BOM.filter({ id });
    const b = boms[0];
    if (!b) return;
    setBom(b);

    // Load lines
    const lines = await base44.entities.BOMLine.filter({ bom_id: id });
    const sortedLines = lines.sort((a, z) => (a.position || 0) - (z.position || 0));
    setBomLines(sortedLines);

    // Load variants for this BOM only (filtered query, not bulk)
    let variants = [];
    if (sortedLines.length > 0) {
      const lineIds = sortedLines.map((l) => l.id);
      // Fetch variants filtered by BOM line IDs (more efficient than loading all)
      variants = await base44.entities.BOMLineVariant.filter({ bom_line_id: { $in: lineIds } });
    }
    setBomLineVariants(variants);

    // Load change log
    const log = await base44.entities.BOMChangeLog.filter({ bom_id: id });
    setChangeLog(log.sort((a, z) => new Date(z.triggered_at) - new Date(a.triggered_at)));

    // Load product
    const prods = await base44.entities.Product.filter({ id: b.product_id });
    const prod = prods[0] || null;
    setProduct(prod);

    // Product-centric: show all active colorways for this product (not project-filtered)
    if (prod) {
      const ACTIVE_STATUSES = ["approved", "in_progress", "submitted_for_approval", "requested"];
      const allCws = await base44.entities.ProductColor.filter({ product_id: b.product_id });
      const activeCws = allCws.filter((c) => ACTIVE_STATUSES.includes(c.colorway_status || "approved"));
      setColorVariants(activeCws);

      const ss = await base44.entities.StyleSize.filter({ product_id: b.product_id });
      setStyleSizes(ss.filter((s) => s.active !== false));

      // Filter ColorAndMore by active colorways (limit to 500 to reduce rate limit pressure)
       const cams = await base44.entities.ProductColorAndMore.list("-created_date", 500);
       setColorAndMores(cams.filter((c) => activeCws.some((cw) => cw.id === c.product_color_id)));
    }

    // Load BOL if production BOM
    if (b.bom_type === "production") {
      const bols = await base44.entities.BOL.filter({ bom_id: id });
      if (bols[0]) {
        setBol(bols[0]);
        const ops = await base44.entities.BOLOperation.filter({ bol_id: bols[0].id });
        setBolOperations(ops.sort((a, z) => a.sequence - z.sequence));
      }
    }
  }, [id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // Load user first
      const u = await base44.auth.me();
      setUser(u);

      // Load lightweight LOVs and sizes in parallel
      const [lovs, sizes] = await Promise.all([
        base44.entities.ListOfValues.list("name", 2000),
        base44.entities.Size.list("size_code", 500),
      ]);
      setLovValues(lovs);
      setAllSizes(sizes);

      // Load product data in parallel
      const [prods, projs] = await Promise.all([
        base44.entities.Product.list("-created_date", 2000),
        base44.entities.Project.list("name", 500),
      ]);
      setAllProducts(prods);
      setProjects(projs);

      // Load color data in parallel
      const [allPCs, tcs, ccs] = await Promise.all([
        base44.entities.ProductColor.list("-created_date", 3000),
        base44.entities.TechnicalColor.list("code", 2000),
        base44.entities.CommercialColor.list("code", 2000),
      ]);
      setAllProductColors(allPCs);
      setTechColors(tcs);
      setCommColors(ccs);

      // Finally, load BOM-specific data
      await reload();

      // Load or create BOMMatrixViewState for this user+BOM
      if (u && id) {
        const existing = await base44.entities.BOMMatrixViewState.filter({ bom_id: id, user_id: u.id });
        if (existing[0]) {
          setViewStateId(existing[0].id);
          setMatrixColumnAxis(existing[0].column_axis || "color");
          setMatrixSecondaryAxis(existing[0].secondary_column_axis || null);
          const storedFilter = existing[0].filter_config;
          const uiOpts = storedFilter?.ui_options;
          if (uiOpts && typeof uiOpts.show_sourcing_chain === "boolean") {
            setShowSourcing(uiOpts.show_sourcing_chain);
          }
          // Load persisted filter config (exclude ui_options key)
          if (storedFilter) {
            const { ui_options, ...filterPart } = storedFilter;
            if (Object.keys(filterPart).length > 0) {
              setFilterConfig({ ...DEFAULT_FILTER_CONFIG, ...filterPart });
            }
          }
          if (existing[0].options_sidebar_groups_state) {
            setGroupsExpanded({ view: false, quick_filter: false, lines: false, bom: false, export: false, ...existing[0].options_sidebar_groups_state });
          }
        } else {
          const created = await base44.entities.BOMMatrixViewState.create({
            bom_id: id,
            user_id: u.id,
            row_axis: "bom_line",
            column_axis: "color",
            secondary_column_axis: null,
            filter_config: { ui_options: { show_sourcing_chain: true }, ...DEFAULT_FILTER_CONFIG },
            options_sidebar_groups_state: { view: false, quick_filter: false, lines: false, bom: false, export: false },
            last_used_at: new Date().toISOString(),
          });
          setViewStateId(created.id);
        }
      }
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

  const handleReorderLines = (reorderedLines) => {
    setBomLines(reorderedLines);
  };

  const persistViewState = async (updates) => {
    if (!viewStateId) return;
    await base44.entities.BOMMatrixViewState.update(viewStateId, {
      ...updates,
      last_used_at: new Date().toISOString(),
    });
  };

  const handleColumnAxisChange = (axis) => {
    setMatrixColumnAxis(axis);
    if (matrixSecondaryAxis === axis) {
      setMatrixSecondaryAxis(null);
      persistViewState({ column_axis: axis, secondary_column_axis: null });
    } else {
      persistViewState({ column_axis: axis });
    }
  };

  const handleSecondaryAxisChange = (axis) => {
    setMatrixSecondaryAxis(axis);
    persistViewState({ secondary_column_axis: axis });
  };

  const handleShowSourcingChange = (val) => {
    setShowSourcing(val);
    if (viewStateId) {
      base44.entities.BOMMatrixViewState.update(viewStateId, {
        filter_config: { ui_options: { show_sourcing_chain: val } },
        last_used_at: new Date().toISOString(),
      });
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilterConfig(newFilter);
    if (viewStateId) {
      // Persist: merge with existing ui_options
      base44.entities.BOMMatrixViewState.update(viewStateId, {
        filter_config: { ui_options: { show_sourcing_chain: showSourcing }, ...newFilter },
        last_used_at: new Date().toISOString(),
      });
    }
  };

  const handleGroupToggle = (group) => {
    setGroupsExpanded((prev) => {
      const next = { ...prev, [group]: !prev[group] };
      if (viewStateId) {
        base44.entities.BOMMatrixViewState.update(viewStateId, {
          options_sidebar_groups_state: next,
          last_used_at: new Date().toISOString(),
        });
      }
      return next;
    });
  };

  // Line-picker helpers — pick target line then open the real dialog
  const openLinePicker = (mode) => {
    if (bomLines.length === 1) {
      openActionForLine(mode, bomLines[0]);
    } else {
      setLinePicker({ mode });
    }
  };

  const openActionForLine = (mode, line) => {
    setLinePicker(null);
    if (mode === "tcx" || mode === "name" || mode === "size") {
      setAutoResolve({ mode, line });
    } else {
      setBulkAction({ action: mode, targetLine: line });
    }
  };

  const handleDeleteVariant = async (variantId) => {
    await base44.entities.BOMLineVariant.delete(variantId);
    setBomLineVariants((prev) => prev.filter((v) => v.id !== variantId));
  };

  const handleUpsertVariant = async (variantData) => {
    const existing = bomLineVariants.find(
      (v) => v.bom_line_id === variantData.bom_line_id &&
        v.product_color_id === variantData.product_color_id &&
        v.size_id === variantData.size_id &&
        v.product_color_and_more_id === variantData.product_color_and_more_id &&
        v.parent_approved_supplier_id === variantData.parent_approved_supplier_id
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

  const filtersActive = isFilterActive(filterConfig);

  useEffect(() => {
    if (!bom) return;
    const transitions = STATUS_TRANSITIONS[bom.status] || [];
    setOptions({
      items: transitions.map((t) => ({
        label: t.label,
        onClick: () => handleStatusTransition(t.to),
      })),
      filterBadge: filtersActive,
      customContent: ({ close } = {}) => (
        <BOMOptionsContent
          matrixColumnAxis={matrixColumnAxis}
          matrixSecondaryAxis={matrixSecondaryAxis}
          showSourcing={showSourcing}
          onColumnAxisChange={handleColumnAxisChange}
          onSecondaryAxisChange={handleSecondaryAxisChange}
          onShowSourcingChange={handleShowSourcingChange}
          bom={bom}
          bomLines={bomLines}
          isReadOnly={isReadOnly}
          groupsExpanded={groupsExpanded}
          onGroupToggle={handleGroupToggle}
          onAddLine={() => setShowAddLine(true)}
          onAutoResolveTCX={() => openLinePicker("tcx")}
          onAutoResolveNameMatch={() => openLinePicker("name")}
          onAutoResolveSizes={() => openLinePicker("size")}
          onClearResolutions={() => openLinePicker("clear")}
          onCopyResolutions={() => openLinePicker("copy")}
          onMarkAllNA={() => openLinePicker("markNA")}
          onCreateRevision={() => setShowCreateRevision(true)}
          onMarkObsolete={() => handleStatusTransition("obsolete")}
          onRefreshSourcing={() => {/* deferred */}}
          onExportMatrix={() => setShowExport(true)}
          onClose={close}
          filterConfig={filterConfig}
          onFilterChange={handleFilterChange}
          colorVariants={colorVariants}
          styleSizes={styleSizes}
          colorAndMores={colorAndMores}
          techColors={techColors}
          commColors={commColors}
          projects={projects}
          allSizes={allSizes}
        />
      ),
    });
  }, [bom, isReadOnly, bomLines, setOptions, matrixColumnAxis, matrixSecondaryAxis, showSourcing, groupsExpanded, filterConfig, colorVariants, styleSizes, colorAndMores, techColors, commColors, projects, allSizes, filtersActive]);

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

  const hasNoColorwaysAtAll = !loading && colorVariants.length === 0;

  // Apply quick filters to axis members
  const { filteredColors, filteredSizes, filteredCam } = applyFilterConfig(filterConfig, {
    colorVariants,
    styleSizes,
    colorAndMores,
    allSizes,
    techColors,
    commColors,
    approvedSuppliers: [],
  });

  // pass search value down into BOMMatrixEditor via a prop-drilled approach
  // (BOMMatrixEditor already has its own search state; we sync from header)
  const handleSearchKey = (e) => {
    if (e.key === "Escape") { setSearchValue(""); setSearchOpen(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] overflow-hidden">

      {/* FIXED HEADER ROW */}
      <div className="flex items-center gap-2 px-2 pt-2 pb-2 shrink-0 border-b border-border bg-background z-10">
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => navigate("/boms")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {/* Title + badges */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          <h1 className="font-display text-base font-semibold truncate shrink-0 max-w-[180px] sm:max-w-xs">
            {product ? `${product.code || ""} ${product.name}`.trim() : "BOM"}
          </h1>
          <span className="text-muted-foreground text-xs shrink-0">Rev {bom.revision_code} v{bom.version}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${STATUS_COLORS[bom.status] || ""}`}>
            {bom.status}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0">
            {bom.bom_type}
          </Badge>
          {bom.source_change_pending && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-300 shrink-0">
              ⚠ Source changed
            </Badge>
          )}
        </div>

        {/* Info + Search icons */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {/* Inline search */}
          {searchOpen ? (
            <div className="flex items-center gap-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchRef}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleSearchKey}
                  onBlur={() => { if (!searchValue) setSearchOpen(false); }}
                  placeholder="Search lines…"
                  className="h-7 pl-7 pr-6 text-xs w-44"
                  autoFocus
                />
                {searchValue && (
                  <button type="button" onClick={() => { setSearchValue(""); searchRef.current?.focus(); }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setSearchOpen(true)}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Search className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={() => setShowInfoPanel((v) => !v)}
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
              showInfoPanel ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
            title="BOM details & revision history">
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Diagnostic banner */}
      {hasNoColorwaysAtAll && product && (
        <div className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs shrink-0">
          <span className="text-amber-500">⚠</span>
          <span className="text-amber-800">
            <strong>{product.code || product.name}</strong> has no colorways. The matrix is empty.
          </span>
          <button type="button" className="ml-auto text-primary hover:underline" onClick={() => navigate(`/products/${product.id}`)}>
            Manage colorways →
          </button>
        </div>
      )}

      {/* SCROLLABLE CONTENT */}
      {activeTab === "matrix" ? (
        /* Matrix tab: flex column, min-height:0 so table wrapper can own the scroll */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <BOMMatrixEditor
            bom={bom}
            bomLines={bomLines}
            bomLineVariants={bomLineVariants}
            colorVariants={filteredColors}
            styleSizes={filteredSizes}
            colorAndMores={filteredCam}
            allProducts={allProducts}
            allProductColors={allProductColors}
            techColors={techColors}
            commColors={commColors}
            lovValues={lovValues}
            allSizes={allSizes}
            isReadOnly={isReadOnly}
            columnAxis={matrixColumnAxis}
            onColumnAxisChange={handleColumnAxisChange}
            secondaryAxis={matrixSecondaryAxis}
            onSecondaryAxisChange={handleSecondaryAxisChange}
            showSourcing={showSourcing}
            onUpdateLine={handleUpdateLine}
            onDeleteLine={handleDeleteLine}
            onUpsertVariant={handleUpsertVariant}
            onDeleteVariant={handleDeleteVariant}
            getUom={getUom}
            onAddLine={() => setShowAddLine(true)}
            onReorderLines={handleReorderLines}
            user={user}
            externalSearch={searchValue}
            onEditLineSaved={(lineId, deletedIds) => {
              if (deletedIds?.length > 0) {
                setBomLineVariants((prev) => prev.filter((v) => !deletedIds.includes(v.id)));
              }
              base44.entities.BOMLine.filter({ bom_id: id }).then((lines) => {
                setBomLines(lines.sort((a, z) => (a.position || 0) - (z.position || 0)));
              });
            }}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 py-3">
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
        </div>
      )}

      {/* Right-side info panel */}
      <BOMInfoPanel
        open={showInfoPanel}
        onClose={() => setShowInfoPanel(false)}
        bom={bom}
        product={product}
        onBomUpdated={setBom}
        onOpenChangelog={() => setActiveTab("changelog")}
      />

      <BOMLineAddDialog
        open={showAddLine}
        onClose={() => setShowAddLine(false)}
        onSave={handleAddLine}
        allProducts={allProducts}
        lovValues={lovValues}
      />

      {/* Line picker — selects target line before bulk actions */}
      {linePicker && (
        <BOMLinePickerDialog
          open={true}
          onClose={() => setLinePicker(null)}
          onSelect={(line) => openActionForLine(linePicker.mode, line)}
          bomLines={bomLines}
          allProducts={allProducts}
          title={
            linePicker.mode === "copy" ? "Select target line to copy INTO" :
            "Select component line"
          }
        />
      )}

      {/* Auto-resolve dialogs */}
      {autoResolve && (
        <BOMAutoResolveDialog
          open={true}
          onClose={() => setAutoResolve(null)}
          mode={autoResolve.mode}
          line={autoResolve.line}
          colorVariants={colorVariants}
          allProductColors={allProductColors}
          techColors={techColors}
          allSizes={allSizes}
          styleSizes={styleSizes}
          bomLineVariants={bomLineVariants}
          onUpsertVariant={handleUpsertVariant}
          onDone={() => setAutoResolve(null)}
        />
      )}

      {/* Bulk line action dialogs (clear, markNA, copy) */}
      {bulkAction && (
        <BOMBulkLineActionDialog
          open={true}
          onClose={() => setBulkAction(null)}
          action={bulkAction.action}
          targetLine={bulkAction.targetLine}
          bomLines={bomLines}
          allProducts={allProducts}
          colorVariants={colorVariants}
          styleSizes={styleSizes}
          bomLineVariants={bomLineVariants}
          onUpsertVariant={handleUpsertVariant}
          onVariantsDeleted={(ids) => setBomLineVariants((prev) => prev.filter((v) => !ids.includes(v.id)))}
          onDone={() => setBulkAction(null)}
        />
      )}

      {/* Create revision */}
      {showCreateRevision && (
        <BOMCreateRevisionDialog
          open={true}
          onClose={() => setShowCreateRevision(false)}
          bom={bom}
          bomLines={bomLines}
          bomLineVariants={bomLineVariants}
          user={user}
        />
      )}

      {/* Export */}
      {showExport && (
        <BOMExportDialog
          open={true}
          onClose={() => setShowExport(false)}
          bom={bom}
          bomLines={bomLines}
          bomLineVariants={bomLineVariants}
          colorVariants={colorVariants}
          styleSizes={styleSizes}
          allProducts={allProducts}
          allSizes={allSizes}
          columnAxis={matrixColumnAxis}
          showSourcing={showSourcing}
        />
      )}
    </div>
  );
}