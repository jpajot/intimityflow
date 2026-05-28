import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft, FlaskConical, Loader2, ExternalLink, Wand2, Trash2,
  ChevronRight, Package, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { computeParentWorkflowStatus, getWorkflowStatusStyle, getWorkflowStatusLabel } from "@/components/sample/sampleStepUtils";
import { SAMPLE_TYPE_LABELS, CONFORMITY_OPTIONS, CONFORMITY_LABEL_MAP, CONFORMITY_STYLE_MAP } from "@/components/sample/sampleUtils";
import WorkflowStatusBadge from "@/components/sample/WorkflowStatusBadge";
import SampleQRLabel from "@/components/sample/SampleQRLabel";
import {
  SampleTypeField, ColorField, PcamField, SizeField, QtyField, ConformityField, NotesField,
} from "@/components/sample/SampleHeaderFields";
import SampleStepsPanel from "@/components/sample/SampleStepsPanel";
import GenerateSampleRoutingDialog from "@/components/sample/GenerateSampleRoutingDialog";
import SampleDeleteDialog from "@/components/sample/SampleDeleteDialog";

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionCard({ title, children, actions }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b border-border">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function PhaseChip({ phase }) {
  if (phase === "production")
    return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">Production</span>;
  return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">Development</span>;
}

function RoutingStatusBadge({ status }) {
  const map = {
    draft:      "bg-slate-100 text-slate-600 border-slate-200",
    in_review:  "bg-amber-100 text-amber-700 border-amber-200",
    released:   "bg-green-100 text-green-700 border-green-200",
    superseded: "bg-orange-100 text-orange-700 border-orange-200",
    obsolete:   "bg-red-100 text-red-600 border-red-200",
  };
  const cls = map[status] || map.draft;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>
      {status ? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SampleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setOptions } = usePageOptions();

  // ── Core data ──────────────────────────────────────────────────────────────
  const [sample, setSample] = useState(null);
  const [product, setProduct] = useState(null);
  const [color, setColor] = useState(null);
  const [variation, setVariation] = useState(null);
  const [size, setSize] = useState(null);
  const [project, setProject] = useState(null);
  const [supplierRequest, setSupplierRequest] = useState(null);
  const [routing, setRouting] = useState(null);
  const [steps, setSteps] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Color/PCAM/size options for inline editing
  const [colorOptions, setColorOptions] = useState([]);
  const [pcamOptions, setPcamOptions] = useState([]);
  const [sizeOptions, setSizeOptions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [generateRoutingOpen, setGenerateRoutingOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    let s;
    try {
      const results = await base44.entities.Sample.filter({ id });
      s = results[0];
    } catch { s = null; }

    if (!s) { setNotFound(true); setLoading(false); return; }
    setSample(s);

    const [
      prodResults, allSuppliers,
    ] = await Promise.all([
      s.product_id ? base44.entities.Product.filter({ id: s.product_id }) : Promise.resolve([]),
      base44.entities.Supplier.list("name", 2000),
    ]);

    const prod = prodResults[0] || null;
    setProduct(prod);
    setSuppliers(allSuppliers);

    // Load colors for this product (for inline editing options)
    const [colorResults, projectResults] = await Promise.all([
      s.product_id ? base44.entities.ProductColor.filter({ product_id: s.product_id }, "colorway_code", 200) : Promise.resolve([]),
      s.project_id ? base44.entities.Project.filter({ id: s.project_id }) : Promise.resolve([]),
    ]);
    setColorOptions(colorResults);
    setProject(projectResults[0] || null);

    // Resolve current color
    const currentColor = colorResults.find((c) => c.id === s.product_color_id) || null;
    setColor(currentColor);

    // Load PCAMs for current color
    let pcams = [];
    if (s.product_color_id) {
      pcams = await base44.entities.ProductColorAndMore.filter({ product_color_id: s.product_color_id }, "name", 200);
    }
    setPcamOptions(pcams);
    setVariation(pcams.find((p) => p.id === s.product_color_and_more_id) || null);

    // Load sizes (via product's size grid)
    let sizes = [];
    if (prod?.size_grid_id) {
      const sizeGridSizes = await base44.entities.SizeGridSize.filter({ size_grid_id: prod.size_grid_id }, "sequence", 100);
      const sizeIds = sizeGridSizes.map((sg) => sg.size_id).filter(Boolean);
      if (sizeIds.length > 0) {
        sizes = await base44.entities.Size.filter({ id: { $in: sizeIds } }, "name", 200);
      }
    }
    setSizeOptions(sizes);
    setSize(sizes.find((sz) => sz.id === s.size_id) || null);

    // SR
    if (s.supplier_request_id) {
      const srResults = await base44.entities.SupplierRequest.filter({ id: s.supplier_request_id });
      setSupplierRequest(srResults[0] || null);
    } else {
      setSupplierRequest(null);
    }

    // Routing + steps
    if (s.linked_routing_id) {
      const [routingResults, stepsResults] = await Promise.all([
        base44.entities.SupplierRouting.filter({ id: s.linked_routing_id }),
        base44.entities.SampleStep.filter({ sample_id: s.id }, "sequence", 200),
      ]);
      setRouting(routingResults[0] || null);
      setSteps(stepsResults);
    } else {
      setRouting(null);
      setSteps([]);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Page options (actions menu) ────────────────────────────────────────────
  useEffect(() => {
    if (!sample) { setOptions(null); return; }
    const items = [
      !sample.linked_routing_id && {
        label: "Generate Sample Routing",
        icon: <Wand2 className="w-4 h-4" />,
        onClick: () => setGenerateRoutingOpen(true),
      },
      {
        label: "Delete Sample",
        icon: <Trash2 className="w-4 h-4" />,
        variant: "destructive",
        onClick: () => setDeleteOpen(true),
      },
    ].filter(Boolean);
    setOptions({ items });
  }, [sample, setOptions]);

  // ── Inline save helper ─────────────────────────────────────────────────────
  const patchSample = useCallback(async (updates) => {
    const prev = { ...sample };
    setSample((s) => ({ ...s, ...updates }));

    // Cascade color change: clear PCAM + size when color changes
    if ("product_color_id" in updates) {
      setSample((s) => ({ ...s, ...updates, product_color_and_more_id: null, size_id: null }));
      setVariation(null);
      setSize(null);
      const newColor = colorOptions.find((c) => c.id === updates.product_color_id) || null;
      setColor(newColor);
      // Reload PCAMs
      const pcams = updates.product_color_id
        ? await base44.entities.ProductColorAndMore.filter({ product_color_id: updates.product_color_id }, "name", 200)
        : [];
      setPcamOptions(pcams);
      updates = { ...updates, product_color_and_more_id: null, size_id: null };
    }
    if ("product_color_and_more_id" in updates) {
      const v = pcamOptions.find((p) => p.id === updates.product_color_and_more_id) || null;
      setVariation(v);
    }
    if ("size_id" in updates) {
      const sz = sizeOptions.find((s) => s.id === updates.size_id) || null;
      setSize(sz);
    }
    if ("sample_type" in updates && updates.phase) {
      // phase is passed alongside sample_type
    }

    try {
      await base44.entities.Sample.update(sample.id, updates);
    } catch {
      setSample(prev);
      toast.error("Failed to save change.");
    }
  }, [sample, colorOptions, pcamOptions, sizeOptions]);

  // ── Steps stepsCache adapter (SampleStepsPanel expects stepsCache obj) ─────
  const stepsCache = { [id]: steps };

  const handleFetchSteps = useCallback(async (sampleId) => {
    const fresh = await base44.entities.SampleStep.filter({ sample_id: sampleId }, "sequence", 200);
    setSteps(fresh);
  }, []);

  const handleStepUpdate = useCallback(async (stepId, updates) => {
    await base44.entities.SampleStep.update(stepId, updates);
    setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, ...updates } : s));
  }, []);

  // ── Derived rollup ─────────────────────────────────────────────────────────
  const rollupStatus = computeParentWorkflowStatus(steps);

  // ── Empty / loading states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !sample) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <FlaskConical className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-lg font-semibold text-foreground/70">Sample not found</p>
        <p className="text-sm text-muted-foreground">This sample may have been deleted or the ID is invalid.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
          Go back
        </Button>
      </div>
    );
  }

  const conformityOpt = CONFORMITY_OPTIONS.find((o) => o.value === sample.conformity_status);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {project ? (
          <>
            <Link to="/projects" className="hover:text-foreground transition-colors">Projects</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to={`/projects/${project.id}`} className="hover:text-foreground transition-colors">{project.name || "Project"}</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to={`/projects/${project.id}?tab=samples`} className="hover:text-foreground transition-colors">Samples</Link>
          </>
        ) : (
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        )}
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-mono font-medium">{sample.code}</span>
      </nav>

      {/* ── HEADER BLOCK ───────────────────────────────────────────────────── */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="flex flex-col md:flex-row gap-6 p-6">
          {/* Left: Identity */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* 1. Sample Code */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Sample Code</p>
              <span className="font-mono text-2xl font-bold tracking-wider text-foreground">{sample.code}</span>
            </div>

            {/* 2. Product */}
            {product && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Product</p>
                <Link
                  to={`/products/${product.id}`}
                  className="flex items-center gap-1.5 group hover:text-primary transition-colors"
                >
                  <span className="font-mono text-sm text-muted-foreground">{product.code}</span>
                  <span className="text-sm font-medium">{product.name}</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60" />
                </Link>
              </div>
            )}

            {/* 3. Color (always shown) */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Color</p>
              <ColorField
                value={sample.product_color_id}
                colors={colorOptions}
                onChange={(v) => patchSample({ product_color_id: v })}
              />
            </div>

            {/* 4. Variation (only if set OR if options exist) */}
            {(sample.product_color_and_more_id || pcamOptions.length > 0) && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Variation</p>
                <PcamField
                  value={sample.product_color_and_more_id}
                  pcams={pcamOptions}
                  onChange={(v) => patchSample({ product_color_and_more_id: v })}
                />
              </div>
            )}

            {/* 5. Size (only if set OR options exist) */}
            {(sample.size_id || sizeOptions.length > 0) && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Size</p>
                <SizeField
                  value={sample.size_id}
                  sizes={sizeOptions}
                  onChange={(v) => patchSample({ size_id: v })}
                />
              </div>
            )}

            {/* Secondary context */}
            <div className="pt-2 border-t border-border/60 space-y-2.5">
              {/* Type + Phase */}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider w-28 shrink-0">Type / Phase</p>
                <div className="flex items-center gap-2">
                  <SampleTypeField
                    value={sample.sample_type}
                    onChange={(type, phase) => patchSample({ sample_type: type, phase })}
                  />
                  <PhaseChip phase={sample.phase} />
                </div>
              </div>

              {/* Conformity */}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider w-28 shrink-0">Conformity</p>
                <ConformityField
                  value={sample.conformity_status}
                  onChange={(v) => patchSample({ conformity_status: v })}
                />
              </div>

              {/* Workflow Rollup */}
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider w-28 shrink-0">Workflow</p>
                <WorkflowStatusBadge status={rollupStatus} />
              </div>

              {/* Requested Qty */}
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider w-28 shrink-0">Req. Qty</p>
                <QtyField
                  value={sample.requested_quantity}
                  onChange={(v) => patchSample({ requested_quantity: v })}
                />
              </div>

              {/* Project */}
              {project && (
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider w-28 shrink-0">Project</p>
                  <Link
                    to={`/projects/${project.id}`}
                    className="text-sm flex items-center gap-1 hover:text-primary transition-colors group"
                  >
                    {project.name}
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60" />
                  </Link>
                </div>
              )}

              {/* Supplier Request */}
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider w-28 shrink-0">Supplier Req.</p>
                {supplierRequest ? (
                  <Link
                    to={`/projects/${sample.project_id}/rfqs/${supplierRequest.id}`}
                    className="text-sm font-mono flex items-center gap-1 hover:text-primary transition-colors group"
                  >
                    {supplierRequest.code}
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60" />
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground/50 italic">Standalone (not linked to a Supplier Request)</span>
                )}
              </div>

              {/* Created */}
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider w-28 shrink-0">Created</p>
                <span className="text-xs text-muted-foreground">
                  {sample.created_date ? format(new Date(sample.created_date), "dd MMM yyyy") : "—"}
                  {sample.created_by ? ` · ${sample.created_by}` : ""}
                </span>
              </div>

              {/* Notes */}
              <div className="flex items-start gap-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider w-28 shrink-0 pt-0.5">Notes</p>
                <div className="flex-1 min-w-0">
                  <NotesField
                    value={sample.notes}
                    onChange={(v) => patchSample({ notes: v })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: QR Label */}
          <div className="flex flex-col items-center justify-start pt-2 shrink-0">
            <SampleQRLabel
              sample={sample}
              product={product}
              color={color}
              variation={variation}
              size={size}
            />
          </div>
        </div>
      </div>

      {/* ── SAMPLE ROUTING SECTION ─────────────────────────────────────────── */}
      <SectionCard
        title="Sample Routing"
        actions={
          routing && (
            <Link
              to={`/products/${sample.product_id}?tab=suppliers`}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              Open in Product → Suppliers <ExternalLink className="w-3 h-3" />
            </Link>
          )
        }
      >
        {!sample.linked_routing_id ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <Package className="w-10 h-10 text-muted-foreground/25" />
            <p className="text-sm text-muted-foreground">No sample routing generated yet.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGenerateRoutingOpen(true)}
              className="gap-1.5"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Generate Sample Routing
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Routing header */}
            {routing && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{routing.name}</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                  SAMPLE
                </span>
                <span className="text-xs text-muted-foreground">
                  Rev {routing.revision_code || "?"} v{routing.version || 1}
                </span>
                <RoutingStatusBadge status={routing.status} />
              </div>
            )}

            {/* Steps table via SampleStepsPanel */}
            <SampleStepsPanel
              sample={sample}
              suppliersArray={suppliers}
              stepsCache={stepsCache}
              onFetchSteps={handleFetchSteps}
              onStepUpdate={handleStepUpdate}
              onBulkStepUpdate={async (stepIds, updates) => {
                await Promise.all(stepIds.map((sid) => base44.entities.SampleStep.update(sid, updates)));
                await handleFetchSteps(sample.id);
              }}
              currentUser={user}
            />
          </div>
        )}
      </SectionCard>

      {/* ── SAMPLE BOM PLACEHOLDER ─────────────────────────────────────────── */}
      <SectionCard title="Sample BOM">
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground/25" />
          <p className="text-sm font-medium text-foreground/70">Sample BOM — Coming Soon</p>
          <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
            The bill of materials for this sample. This feature is coming soon — it will work in parallel to the
            Sample Routing, defining the materials consumed to physically realize this sample.
          </p>
        </div>
      </SectionCard>

      {/* ── DIALOGS ────────────────────────────────────────────────────────── */}
      <GenerateSampleRoutingDialog
        open={generateRoutingOpen}
        onClose={() => setGenerateRoutingOpen(false)}
        onGenerated={() => load()}
        sample={sample}
      />

      <SampleDeleteDialog
        open={deleteOpen}
        sample={sample}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate(project ? `/projects/${project.id}?tab=samples` : "/projects")}
      />
    </div>
  );
}