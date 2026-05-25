import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { Plus, FlaskConical, LayoutGrid, List, Filter, Pencil, Loader2 } from "lucide-react";
import { applyQuickFilters } from "@/components/QuickFiltersPanel";
import QuickFiltersPanel from "@/components/QuickFiltersPanel";
import ViewDrawerContent from "@/components/ViewDrawerContent";
import SamplesDataTable from "@/components/sample/SamplesDataTable";
import SampleCreateDialog from "@/components/sample/SampleCreateDialog";
import GalleryView from "@/components/GalleryView";
import WorkflowStatusBadge from "@/components/sample/WorkflowStatusBadge";
import { CONFORMITY_OPTIONS, SAMPLE_TYPE_OPTIONS } from "@/components/sample/sampleUtils";
import { toast } from "sonner";

const DISPLAY_MODE_KEY = (projectId) => `project_samples_display_mode_${projectId}`;

// ── Samples Tracking placeholder ──────────────────────────────────────────────
function SamplesTrackingPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
      <FlaskConical className="w-12 h-12 opacity-20" />
      <p className="text-base font-semibold text-foreground/70">Samples Tracking</p>
      <p className="text-sm text-center max-w-xs">A consolidated tracking view of all samples in this project. Coming soon.</p>
    </div>
  );
}

// ── Gallery card fields ───────────────────────────────────────────────────────
function buildGalleryAllFields(productsMap, colorsMap, rfqsMap) {
  return [
    {
      id: "code",
      label: "Code",
      getValue: (s) => s.code || "—",
      render: (s) => <span className="font-mono text-[11px] text-muted-foreground">{s.code || "—"}</span>,
    },
    {
      id: "product_name",
      label: "Product",
      getValue: (s) => productsMap[s.product_id]?.name || "—",
      render: (s) => {
        const prod = productsMap[s.product_id];
        return <span className="text-xs font-medium truncate block">{prod?.name || "—"}</span>;
      },
    },
    {
      id: "sample_type",
      label: "Sample Type",
      getValue: (s) => s.sample_type || "—",
      render: (s) => {
        const opt = SAMPLE_TYPE_OPTIONS.find((o) => o.value === s.sample_type);
        return <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">{opt?.label || s.sample_type || "—"}</span>;
      },
    },
    {
      id: "phase",
      label: "Phase",
      getValue: (s) => s.phase || "—",
      render: (s) => {
        if (!s.phase) return null;
        return (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
            style={s.phase === "production"
              ? { color: "#059669", backgroundColor: "#d1fae5", borderColor: "#6ee7b7" }
              : { color: "#6B7280", backgroundColor: "#f3f4f6", borderColor: "#d1d5db" }}
          >
            {s.phase === "production" ? "Production" : "Development"}
          </span>
        );
      },
    },
    {
      id: "color",
      label: "Color",
      getValue: (s) => colorsMap[s.product_color_id]?.color_name || "—",
      render: (s) => {
        const c = colorsMap[s.product_color_id];
        if (!c) return <span className="text-xs text-muted-foreground/40">—</span>;
        return (
          <span className="flex items-center gap-1.5 text-xs">
            {c.color_hex && <span className="w-3 h-3 rounded-full border border-border shrink-0" style={{ backgroundColor: c.color_hex }} />}
            {c.colorway_code || c.color_name}
          </span>
        );
      },
    },
    {
      id: "size",
      label: "Size",
      getValue: (s) => s.size_id || "—",
      render: (s) => <span className="text-xs text-muted-foreground">{s.size_id ? s.size_id.slice(0, 8) : "—"}</span>,
    },
    {
      id: "workflow_status",
      label: "Workflow",
      getValue: (s) => s.workflow_status || "—",
      render: (s) => <WorkflowStatusBadge status={s.workflow_status} />,
    },
    {
      id: "conformity_status",
      label: "Conformity",
      getValue: (s) => s.conformity_status || "—",
      render: (s) => {
        const opt = CONFORMITY_OPTIONS.find((o) => o.value === s.conformity_status);
        return opt
          ? <span className={`text-[10px] px-1.5 py-0.5 rounded border ${opt.style}`}>{opt.label}</span>
          : <span className="text-xs text-muted-foreground/40">—</span>;
      },
    },
  ];
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ProjectSamplesTab({ projectId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setOptions } = usePageOptions();

  const [activeTab, setActiveTab] = useState("samples");
  const [displayMode, setDisplayMode] = useState(() => localStorage.getItem(DISPLAY_MODE_KEY(projectId)) || "gallery");

  // View management
  const [activeViewId, setActiveViewId] = useState("default");
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showQF, setShowQF] = useState(false);
  const [quickFilters, setQuickFilters] = useState([]);

  // Data
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Reference maps
  const [productsMap, setProductsMap] = useState({});
  const [colorsMap, setColorsMap] = useState({});
  const [pcamsMap, setPcamsMap] = useState({});
  const [sizesMap, setSizesMap] = useState({});
  const [rfqsMap, setRfqsMap] = useState({});
  const [suppliersArray, setSuppliersArray] = useState([]);
  const [colorsByProduct, setColorsByProduct] = useState({});
  const [pcamsByColor, setPcamsByColor] = useState({});
  const [sizesByProduct, setSizesByProduct] = useState({});

  // Products scoped to project (for create dialog)
  const [projectProducts, setProjectProducts] = useState([]);

  const loadSamples = useCallback(async () => {
    setLoading(true);
    const results = await base44.entities.Sample.filter({ project_id: projectId }, "-created_date", 500);
    setSamples(results);

    if (results.length > 0) {
      const productIds = [...new Set(results.map((s) => s.product_id).filter(Boolean))];
      const sizeIds = [...new Set(results.map((s) => s.size_id).filter(Boolean))];
      const rfqIds = [...new Set(results.map((s) => s.rfq_id).filter(Boolean))];

      const [allProds, allColors, allSizes, allRfqs] = await Promise.all([
        base44.entities.Product.list("code", 2000),
        base44.entities.ProductColor.list("colorway_code", 2000),
        sizeIds.length ? base44.entities.Size.list("name", 500) : Promise.resolve([]),
        rfqIds.length ? base44.entities.RFQ.filter({ id: { $in: rfqIds } }) : Promise.resolve([]),
      ]);

      const pMap = {};
      allProds.filter((p) => productIds.includes(p.id)).forEach((p) => { pMap[p.id] = p; });
      setProductsMap(pMap);

      const productIdSet = new Set(productIds);
      const relevantColors = allColors.filter((c) => productIdSet.has(c.product_id));
      const cMap = {};
      const byProduct = {};
      relevantColors.forEach((c) => {
        cMap[c.id] = c;
        byProduct[c.product_id] = byProduct[c.product_id] || [];
        byProduct[c.product_id].push(c);
      });
      setColorsMap(cMap);
      setColorsByProduct(byProduct);

      const allColorIds = relevantColors.map((c) => c.id);
      const allPcams = allColorIds.length ? await base44.entities.ProductColorAndMore.list("-created_date", 2000) : [];
      const pcMap = {};
      const byColor = {};
      allPcams.filter((pc) => allColorIds.includes(pc.product_color_id)).forEach((pc) => {
        pcMap[pc.id] = pc;
        byColor[pc.product_color_id] = byColor[pc.product_color_id] || [];
        byColor[pc.product_color_id].push(pc);
      });
      setPcamsMap(pcMap);
      setPcamsByColor(byColor);

      const sMap = {};
      allSizes.filter((s) => sizeIds.includes(s.id)).forEach((s) => { sMap[s.id] = s; });
      setSizesMap(sMap);

      const rMap = {};
      allRfqs.forEach((r) => { rMap[r.id] = r; });
      setRfqsMap(rMap);

      // Sizes per product
      const prodWithGrids = allProds.filter((p) => productIds.includes(p.id) && p.size_grid_id);
      if (prodWithGrids.length > 0) {
        const gridResults = await Promise.all(
          prodWithGrids.map((p) =>
            base44.entities.SizeGridSize.filter({ size_grid_id: p.size_grid_id })
              .then((gss) => ({ productId: p.id, sizeIds: gss.map((gs) => gs.size_id) }))
          )
        );
        const gridSizeRecords = await base44.entities.Size.list("name", 500);
        const byProd = {};
        gridResults.forEach(({ productId, sizeIds: pSizeIds }) => {
          byProd[productId] = gridSizeRecords.filter((s) => pSizeIds.includes(s.id));
        });
        setSizesByProduct(byProd);
      }

      // Products scoped to project for create dialog
      const scopedProds = allProds.filter((p) => (p.project_ids || []).includes(projectId));
      setProjectProducts(scopedProds);
    }

    const suppliers = await base44.entities.Supplier.list("name", 500);
    setSuppliersArray(suppliers);

    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadSamples(); }, [loadSamples]);

  // ── Toggle display mode ───────────────────────────────────────────────────────
  const toggleDisplayMode = useCallback(() => {
    const next = displayMode === "list" ? "gallery" : "list";
    setDisplayMode(next);
    localStorage.setItem(DISPLAY_MODE_KEY(projectId), next);
    setActiveViewId("default");
    setShowViewMenu(false);
    setShowQF(false);
  }, [displayMode, projectId]);

  // ── View id change ────────────────────────────────────────────────────────────
  const handleSelectView = useCallback((id) => { setActiveViewId(id); }, []);

  // ── Quick filter fields ───────────────────────────────────────────────────────
  const qfFields = useMemo(() => [
    { id: "sample_type", label: "Sample Type", getValue: (s) => s.sample_type || "" },
    { id: "phase", label: "Phase", getValue: (s) => s.phase || "" },
    { id: "conformity_status", label: "Conformity", getValue: (s) => s.conformity_status || "" },
    { id: "rfq", label: "RFQ", getValue: (s) => rfqsMap[s.rfq_id]?.code || "Standalone" },
    { id: "product", label: "Product", getValue: (s) => productsMap[s.product_id]?.name || "" },
    { id: "color", label: "Color", getValue: (s) => colorsMap[s.product_color_id]?.color_name || "" },
    { id: "has_routing", label: "Has Routing", getValue: (s) => s.linked_routing_id ? "Yes" : "No" },
  ], [rfqsMap, productsMap, colorsMap]);

  // ── Register options menu ─────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "samples") {
      setOptions({ items: [] });
      return;
    }
    setOptions({
      items: [
        {
          label: "+ Add Sample",
          icon: Plus,
          onClick: () => setShowCreate(true),
          className: "text-primary hover:bg-primary/10",
        },
        { divider: true },
        {
          label: displayMode === "gallery" ? "View: List" : "View: Gallery",
          icon: displayMode === "gallery" ? List : LayoutGrid,
          onClick: toggleDisplayMode,
        },
        { divider: true },
        {
          label: "Quick Filters",
          icon: Filter,
          onClick: () => { setShowQF((v) => !v); setShowViewMenu(false); },
          custom: true,
          badge: quickFilters.length > 0 ? quickFilters.length : null,
        },
        {
          label: "Manage Views",
          icon: Pencil,
          onClick: () => { setShowViewMenu((v) => !v); setShowQF(false); },
          custom: true,
        },
      ],
      customContent: showQF
        ? () => (
            <QuickFiltersPanel
              fields={qfFields}
              activeFilters={quickFilters}
              onApply={(f) => { setQuickFilters(f); }}
            />
          )
        : showViewMenu
        ? () => (
            <ViewDrawerContent
              pageKey="samples_list"
              activeViewId={activeViewId}
              onSelectView={handleSelectView}
              currentViewType={displayMode === "gallery" ? "grid" : null}
              allFields={[
                { id: "code", label: "Code" },
                { id: "product", label: "Product" },
                { id: "rfq", label: "RFQ" },
                { id: "sample_type", label: "Sample Type" },
                { id: "phase", label: "Phase" },
                { id: "color", label: "Color" },
                { id: "variation", label: "Variation" },
                { id: "size", label: "Size" },
                { id: "qty", label: "Req. Qty" },
                { id: "conformity", label: "Conformity" },
                { id: "workflow_status", label: "Workflow Status" },
                { id: "created_date", label: "Created" },
              ]}
            />
          )
        : null,
    });
    return () => setOptions(null);
  }, [activeTab, displayMode, showQF, showViewMenu, quickFilters, activeViewId, qfFields, handleSelectView, toggleDisplayMode, setOptions]);

  // ── Apply quick filters to list ───────────────────────────────────────────────
  const filteredSamples = useMemo(() => applyQuickFilters(samples, quickFilters), [samples, quickFilters]);

  // ── Gallery fields ────────────────────────────────────────────────────────────
  const galleryAllFields = useMemo(() => buildGalleryAllFields(productsMap, colorsMap, rfqsMap), [productsMap, colorsMap, rfqsMap]);
  const galleryFilterableFields = useMemo(() => [
    { id: "sample_type", label: "Sample Type", getValue: (s) => s.sample_type || "—" },
    { id: "phase", label: "Phase", getValue: (s) => s.phase || "—" },
    { id: "conformity_status", label: "Conformity", getValue: (s) => s.conformity_status || "—" },
  ], []);

  const handleCreated = useCallback(async (newSample) => {
    await loadSamples();
    toast.success(`Sample ${newSample.code} created`);
  }, [loadSamples]);

  const handleUpdate = useCallback(async (sampleId, updates) => {
    await base44.entities.Sample.update(sampleId, updates);
    await loadSamples();
  }, [loadSamples]);

  const handleRoutingGenerated = useCallback(() => { loadSamples(); }, [loadSamples]);
  const handleStepUpdate = useCallback(async (stepId, updates) => {
    await base44.entities.SampleStep.update(stepId, updates);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Internal tab bar ── */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("samples")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "samples" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Samples
          {samples.length > 0 && (
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-normal">{samples.length}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("tracking")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "tracking" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Samples Tracking
        </button>
      </div>

      {/* ── Tracking placeholder ── */}
      {activeTab === "tracking" && <SamplesTrackingPlaceholder />}

      {/* ── Samples tab ── */}
      {activeTab === "samples" && (
        <>
          {samples.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
              <FlaskConical className="w-10 h-10 opacity-25" />
              <p className="text-sm font-semibold text-foreground/70">No samples yet for this project</p>
              <p className="text-xs text-center max-w-xs">Create the first sample to start tracking your product development workflow.</p>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-1 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
              >
                + Add First Sample
              </button>
            </div>
          ) : displayMode === "gallery" ? (
            <GalleryView
              pageKey="samples_list"
              rows={filteredSamples}
              allFields={galleryAllFields}
              filterableFields={galleryFilterableFields}
              renderThumbnail={(s) => {
                const prod = productsMap[s.product_id];
                const img = prod?.images?.[0];
                return img ? (
                  <img src={img} alt={prod?.name || ""} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <FlaskConical className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                );
              }}
              onClickItem={(s) => navigate(`/samples/${s.id}`)}
              activeViewId={activeViewId}
              onSelectView={handleSelectView}
            />
          ) : (
            <SamplesDataTable
              samples={filteredSamples}
              columnSet="project_context"
              onRowUpdate={handleUpdate}
              onRoutingGenerated={handleRoutingGenerated}
              onStepUpdate={handleStepUpdate}
              suppliersArray={suppliersArray}
              currentUser={user}
              productsMap={productsMap}
              colorsMap={colorsMap}
              pcamsMap={pcamsMap}
              sizesMap={sizesMap}
              rfqsMap={rfqsMap}
              colorsByProduct={colorsByProduct}
              pcamsByColor={pcamsByColor}
              sizesByProduct={sizesByProduct}
              emptyState={{
                icon: FlaskConical,
                title: "No samples match filters",
              }}
            />
          )}
        </>
      )}

      {/* ── Create dialog ── */}
      <SampleCreateDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
        preset={{ project_id: projectId, product_id: null, rfq_id: null }}
        productOptions={projectProducts.length > 0 ? projectProducts : undefined}
      />
    </div>
  );
}