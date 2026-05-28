import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, X, AlertTriangle, Trash2 } from "lucide-react";

// ── helpers ────────────────────────────────────────────────────────────────────
const lineKey = (row) =>
  [row.recipient_supplier_id, row.routing_step_id, row.product_id, row.product_color_id ?? null, row.product_color_and_more_id ?? null].join("|");

const SectionHeader = ({ number, title, done }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{number}</span>
    <span className="text-sm font-semibold">{title}</span>
    {done && <span className="text-[10px] text-primary ml-1">✓</span>}
  </div>
);

// ── sub: product picker ────────────────────────────────────────────────────────
function ProductPicker({ products, selected, onToggle }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => (p.code || "").toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [products, search]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="pl-8 h-8 text-xs" />
      </div>
      <div className="max-h-44 overflow-y-auto border border-border rounded-md divide-y divide-border">
        {filtered.length === 0 && <p className="text-xs text-muted-foreground p-3">No products found.</p>}
        {filtered.map((p) => {
          const isSelected = selected.includes(p.id);
          return (
            <button key={p.id} type="button" onClick={() => onToggle(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
              <div className="w-7 h-7 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                {p.images?.[0]
                  ? <img src={p.images[0]} alt="" className="w-full h-full object-contain" />
                  : <span className="text-[9px] text-muted-foreground font-mono">{(p.code || "?").slice(0, 4)}</span>}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground shrink-0">{p.code}</span>
              <span className="truncate">{p.name}</span>
              {isSelected && <span className="ml-auto shrink-0 text-primary font-bold">✓</span>}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-[10px] text-muted-foreground">{selected.length} product{selected.length > 1 ? "s" : ""} selected</p>
      )}
    </div>
  );
}

// ── sub: granularity picker ────────────────────────────────────────────────────
function GranularityPicker({ selectedProducts, allProducts, colorsByProduct, pcamsByColor, granularity, onGranularityChange }) {
  return (
    <div className="space-y-3">
      {selectedProducts.map((pid) => {
        const prod = allProducts.find((p) => p.id === pid);
        const g = granularity[pid] || { level: "product", colorIds: [], pcamIds: [] };
        const colors = colorsByProduct[pid] || [];
        const pcams = colors.flatMap((c) => (pcamsByColor[c.id] || []).map((pc) => ({ ...pc, _colorName: c.color_name })));

        return (
          <div key={pid} className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                {prod?.images?.[0]
                  ? <img src={prod.images[0]} alt="" className="w-full h-full object-contain" />
                  : <span className="text-[8px] font-mono text-muted-foreground">{(prod?.code || "").slice(0,3)}</span>}
              </div>
              <span className="text-xs font-medium truncate">{prod?.name}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{prod?.code}</span>
            </div>

            {/* Level toggle */}
            <div className="flex gap-1">
              {["product", "color", "pcam"].map((level) => (
                <button key={level} type="button"
                  onClick={() => onGranularityChange(pid, { level, colorIds: [], pcamIds: [] })}
                  className={`text-[10px] px-2 py-1 rounded border font-medium transition-colors ${g.level === level ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                  {level === "product" ? "Product" : level === "color" ? "By Colorway" : "By PCAM"}
                </button>
              ))}
            </div>

            {/* Color multi-select */}
            {g.level === "color" && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground">Select colorways:</p>
                <div className="max-h-32 overflow-y-auto border border-border rounded divide-y divide-border">
                  {colors.length === 0 && <p className="text-[10px] text-muted-foreground p-2">No colorways found.</p>}
                  {colors.map((c) => {
                    const sel = g.colorIds.includes(c.id);
                    return (
                      <button key={c.id} type="button"
                        onClick={() => onGranularityChange(pid, { ...g, colorIds: sel ? g.colorIds.filter((x) => x !== c.id) : [...g.colorIds, c.id] })}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-[11px] transition-colors ${sel ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                        {c.color_hex && <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0" style={{ backgroundColor: c.color_hex }} />}
                        <span className="truncate">{c.color_name}</span>
                        {c.colorway_code && <span className="text-[10px] text-muted-foreground font-mono ml-auto shrink-0">{c.colorway_code}</span>}
                        {sel && <span className="text-primary font-bold ml-1 shrink-0">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PCAM multi-select */}
            {g.level === "pcam" && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground">Select variations (PCAM):</p>
                <div className="max-h-32 overflow-y-auto border border-border rounded divide-y divide-border">
                  {pcams.length === 0 && <p className="text-[10px] text-muted-foreground p-2">No variations found.</p>}
                  {pcams.map((pc) => {
                    const sel = g.pcamIds.includes(pc.id);
                    return (
                      <button key={pc.id} type="button"
                        onClick={() => onGranularityChange(pid, { ...g, pcamIds: sel ? g.pcamIds.filter((x) => x !== pc.id) : [...g.pcamIds, pc.id] })}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-[11px] transition-colors ${sel ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                        <span className="truncate text-muted-foreground">{pc._colorName} ›</span>
                        <span className="truncate">{pc.name}</span>
                        {sel && <span className="text-primary font-bold ml-auto shrink-0">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── main dialog ────────────────────────────────────────────────────────────────
export default function RFQLineBuilderDialog({ rfqId, projectId, existingLines, onSaved, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reference data
  const [allProducts, setAllProducts] = useState([]);
  const [colorsByProduct, setColorsByProduct] = useState({});   // { product_id: [ProductColor] }
  const [pcamsByColor, setPcamsByColor] = useState({});          // { product_color_id: [PCAM] }
  const [allRoutings, setAllRoutings] = useState([]);
  const [allSteps, setAllSteps] = useState([]);
  const [allSuppliers, setAllSuppliers] = useState([]);

  // Selections
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [granularity, setGranularity] = useState({});  // { product_id: { level, colorIds, pcamIds } }
  const [selectedStepIds, setSelectedStepIds] = useState([]);

  // Preview rows
  const [previewRows, setPreviewRows] = useState(null); // null = not yet computed

  useEffect(() => {
    const load = async () => {
      const [products, suppliers, routings, steps, colors, pcams] = await Promise.all([
        base44.entities.Product.filter({ project_ids: { $in: [projectId] } }, "code", 500),
        base44.entities.Supplier.filter({ status: "active" }, "name", 500),
        base44.entities.SupplierRouting.list("name", 500),
        base44.entities.SupplierRoutingStep.list("sequence", 2000),
        base44.entities.ProductColor.list("-created_date", 2000),
        base44.entities.ProductColorAndMore.list("-created_date", 2000),
      ]);

      setAllProducts(products);
      setAllSuppliers(suppliers);
      setAllRoutings(routings);
      setAllSteps(steps);

      // Index colors by product
      const cbp = {};
      colors.forEach((c) => { if (!cbp[c.product_id]) cbp[c.product_id] = []; cbp[c.product_id].push(c); });
      setColorsByProduct(cbp);

      // Index pcams by product_color_id
      const pbc = {};
      pcams.forEach((pc) => { if (!pbc[pc.product_color_id]) pbc[pc.product_color_id] = []; pbc[pc.product_color_id].push(pc); });
      setPcamsByColor(pbc);

      setLoading(false);
    };
    load();
  }, [projectId]);

  // Toggle product selection
  const toggleProduct = (pid) => {
    setSelectedProductIds((prev) => prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]);
    setGranularity((prev) => {
      if (prev[pid]) { const next = { ...prev }; delete next[pid]; return next; }
      return { ...prev, [pid]: { level: "product", colorIds: [], pcamIds: [] } };
    });
    setPreviewRows(null);
  };

  const updateGranularity = (pid, val) => {
    setGranularity((prev) => ({ ...prev, [pid]: val }));
    setPreviewRows(null);
  };

  const toggleStep = (sid) => {
    setSelectedStepIds((prev) => prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]);
    setPreviewRows(null);
  };

  // Routing steps filtered to selected products' routings
  const relevantSteps = useMemo(() => {
    const selectedProductIdSet = new Set(selectedProductIds);
    const relevantRoutingIds = new Set(
      allRoutings.filter((r) => selectedProductIdSet.has(r.product_id)).map((r) => r.id)
    );
    return allSteps
      .filter((s) => relevantRoutingIds.has(s.supplier_routing_id))
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  }, [allRoutings, allSteps, selectedProductIds]);

  // Group steps by product for display
  const stepsByProduct = useMemo(() => {
    const result = {};
    selectedProductIds.forEach((pid) => {
      const routingIds = new Set(allRoutings.filter((r) => r.product_id === pid).map((r) => r.id));
      result[pid] = relevantSteps.filter((s) => routingIds.has(s.supplier_routing_id));
    });
    return result;
  }, [relevantSteps, allRoutings, selectedProductIds]);

  // ── Section readiness ────────────────────────────────────────────────────────
  const s1Done = selectedProductIds.length > 0;
  const s2Done = s1Done && selectedProductIds.every((pid) => {
    const g = granularity[pid];
    if (!g) return false;
    if (g.level === "product") return true;
    if (g.level === "color") return g.colorIds.length > 0;
    if (g.level === "pcam") return g.pcamIds.length > 0;
    return false;
  });
  const s3Done = s2Done && selectedStepIds.length > 0;

  // ── Build preview rows ────────────────────────────────────────────────────────
  const buildPreview = () => {
    const rows = [];
    const selectedSteps = allSteps.filter((s) => selectedStepIds.includes(s.id));

    selectedProductIds.forEach((pid) => {
      const g = granularity[pid] || { level: "product", colorIds: [], pcamIds: [] };
      const prod = allProducts.find((p) => p.id === pid);

      // Compute granularity entries (product_color_id, product_color_and_more_id)
      let granEntries = [];
      if (g.level === "product") {
        granEntries = [{ product_color_id: null, product_color_and_more_id: null }];
      } else if (g.level === "color") {
        granEntries = g.colorIds.map((cid) => ({ product_color_id: cid, product_color_and_more_id: null }));
      } else if (g.level === "pcam") {
        granEntries = g.pcamIds.map((pcid) => {
          // Find parent color
          const allColors = colorsByProduct[pid] || [];
          const parentColor = allColors.find((c) => (pcamsByColor[c.id] || []).some((pc) => pc.id === pcid));
          return { product_color_id: parentColor?.id || null, product_color_and_more_id: pcid };
        });
      }

      // Steps scoped to this product
      const routingIds = new Set(allRoutings.filter((r) => r.product_id === pid).map((r) => r.id));
      const productSteps = selectedSteps.filter((s) => routingIds.has(s.supplier_routing_id));

      // Cartesian: granEntries × productSteps
      granEntries.forEach((gran) => {
        productSteps.forEach((step) => {
          rows.push({
            _id: Math.random().toString(36).slice(2),
            product_id: pid,
            product_color_id: gran.product_color_id,
            product_color_and_more_id: gran.product_color_and_more_id,
            routing_step_id: step.id,
            recipient_supplier_id: step.supplier_id || "",
            forecasted_qty: 0,
            forecasted_qty_uom: prod?.default_uom || "",
            // ── display helpers ──
            _product: prod,
            _step: step,
            _gran_level: g.level,
          });
        });
      });
    });

    // Check duplicates against existing lines
    const existingKeys = new Set(existingLines.map(lineKey));

    // Annotate
    const keyCount = {};
    rows.forEach((r) => { const k = lineKey(r); keyCount[k] = (keyCount[k] || 0) + 1; });

    return rows.map((r) => {
      const k = lineKey(r);
      const dupExisting = existingKeys.has(k);
      const dupBatch = keyCount[k] > 1;
      return { ...r, _dupExisting: dupExisting, _dupBatch: dupBatch };
    });
  };

  const handleBuildPreview = () => {
    setPreviewRows(buildPreview());
  };

  const removePreviewRow = (id) => {
    setPreviewRows((prev) => {
      const next = prev.filter((r) => r._id !== id);
      // Recompute batch dups
      const keyCount = {};
      next.forEach((r) => { const k = lineKey(r); keyCount[k] = (keyCount[k] || 0) + 1; });
      return next.map((r) => ({ ...r, _dupBatch: keyCount[lineKey(r)] > 1 }));
    });
  };

  const removeDuplicates = () => {
    setPreviewRows((prev) => {
      const seen = new Set();
      const existingKeys = new Set(existingLines.map(lineKey));
      return prev.filter((r) => {
        const k = lineKey(r);
        if (existingKeys.has(k) || seen.has(k)) return false;
        seen.add(k);
        return true;
      }).map((r) => ({ ...r, _dupExisting: false, _dupBatch: false }));
    });
  };

  const updatePreviewRow = (id, field, value) => {
    setPreviewRows((prev) => {
      const next = prev.map((r) => r._id === id ? { ...r, [field]: value } : r);
      // Recompute dups
      const existingKeys = new Set(existingLines.map(lineKey));
      const keyCount = {};
      next.forEach((r) => { const k = lineKey(r); keyCount[k] = (keyCount[k] || 0) + 1; });
      return next.map((r) => ({ ...r, _dupExisting: existingKeys.has(lineKey(r)), _dupBatch: keyCount[lineKey(r)] > 1 }));
    });
  };

  const hasDuplicates = previewRows?.some((r) => r._dupExisting || r._dupBatch);
  const validRows = previewRows?.filter((r) => !r._dupExisting && !r._dupBatch) ?? [];

  const handleSave = async () => {
    if (!previewRows || validRows.length === 0) return;
    setSaving(true);
    const toCreate = validRows.map((r) => ({
      supplier_request_id: rfqId,
      product_id: r.product_id,
      product_color_id: r.product_color_id || null,
      product_color_and_more_id: r.product_color_and_more_id || null,
      routing_step_id: r.routing_step_id,
      recipient_supplier_id: r.recipient_supplier_id,
      forecasted_qty: Number(r.forecasted_qty) || 0,
      forecasted_qty_uom: r.forecasted_qty_uom || null,
      status: "pending",
    }));
    await base44.entities.RFQLine.bulkCreate(toCreate);
    onSaved();
  };

  // ── Resolve display labels ────────────────────────────────────────────────────
  const getGranLabel = (row) => {
    if (row._gran_level === "product") return "Product";
    if (row._gran_level === "color") {
      const allColors = colorsByProduct[row.product_id] || [];
      const c = allColors.find((c) => c.id === row.product_color_id);
      return c ? `Color: ${c.color_name}` : "Color";
    }
    if (row._gran_level === "pcam") {
      const allColors = colorsByProduct[row.product_id] || [];
      const c = allColors.find((c) => c.id === row.product_color_id);
      const pcams = c ? (pcamsByColor[c.id] || []) : [];
      const pc = pcams.find((p) => p.id === row.product_color_and_more_id);
      return c && pc ? `${c.color_name} › ${pc.name}` : "PCAM";
    }
    return "—";
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Lines to Supplier Request</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-2">

            {/* ── Section 1: Products ── */}
            <div>
              <SectionHeader number={1} title="Pick Products" done={s1Done} />
              <ProductPicker
                products={allProducts}
                selected={selectedProductIds}
                onToggle={toggleProduct}
              />
            </div>

            {/* ── Section 2: Granularity ── */}
            <div className={s1Done ? "" : "opacity-40 pointer-events-none"}>
              <SectionHeader number={2} title="Pick Granularity" done={s2Done} />
              {s1Done && (
                <GranularityPicker
                  selectedProducts={selectedProductIds}
                  allProducts={allProducts}
                  colorsByProduct={colorsByProduct}
                  pcamsByColor={pcamsByColor}
                  granularity={granularity}
                  onGranularityChange={updateGranularity}
                />
              )}
              {!s1Done && <p className="text-xs text-muted-foreground">Select at least one product first.</p>}
            </div>

            {/* ── Section 3: Routing Steps ── */}
            <div className={s2Done ? "" : "opacity-40 pointer-events-none"}>
              <SectionHeader number={3} title="Pick Routing Steps" done={s3Done} />
              {s2Done && (
                <div className="space-y-3">
                  <p className="text-[10px] text-muted-foreground">The supplier on the routing step is the default recipient. You can override per line in the next step.</p>
                  {selectedProductIds.map((pid) => {
                    const prod = allProducts.find((p) => p.id === pid);
                    const steps = stepsByProduct[pid] || [];
                    return (
                      <div key={pid}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{prod?.name}</p>
                        {steps.length === 0 && <p className="text-xs text-muted-foreground pl-2">No routing steps found for this product.</p>}
                        <div className="border border-border rounded-md divide-y divide-border">
                          {steps.map((s) => {
                            const supplier = allSuppliers.find((sup) => sup.id === s.supplier_id);
                            const sel = selectedStepIds.includes(s.id);
                            return (
                              <button key={s.id} type="button" onClick={() => toggleStep(s.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${sel ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border ${sel ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{s.sequence}</span>
                                <span className="flex-1 truncate">{s.step_type?.replace(/_/g, " ") || "—"}</span>
                                {supplier && <span className="text-[10px] text-muted-foreground shrink-0">{supplier.name}</span>}
                                {sel && <span className="text-primary font-bold shrink-0">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!s2Done && <p className="text-xs text-muted-foreground">Complete granularity selection first.</p>}
            </div>

            {/* ── Section 4: Preview & Confirm ── */}
            <div className={s3Done ? "" : "opacity-40 pointer-events-none"}>
              <SectionHeader number={4} title="Confirm Lines" done={s3Done && previewRows !== null && previewRows.length > 0} />

              {s3Done && previewRows === null && (
                <Button size="sm" variant="outline" className="gap-2" onClick={handleBuildPreview}>
                  Generate Preview
                </Button>
              )}

              {s3Done && previewRows !== null && (
                <div className="space-y-2">
                  {hasDuplicates && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1">Some rows are duplicates (highlighted in red).</span>
                      <button type="button" onClick={removeDuplicates} className="underline underline-offset-2 font-medium shrink-0 hover:text-amber-900">Remove duplicates</button>
                    </div>
                  )}

                  {previewRows.length === 0 && (
                    <p className="text-xs text-muted-foreground">No rows to add. Change your selections above.</p>
                  )}

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {previewRows.map((row) => {
                      const isDup = row._dupExisting || row._dupBatch;
                      return (
                        <div key={row._id}
                          className={`rounded-lg border p-3 space-y-2 ${isDup ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}
                          title={isDup ? (row._dupExisting ? "Already in this RFQ" : "Duplicate of another row in this batch") : undefined}>

                          {isDup && (
                            <p className="text-[10px] text-destructive font-medium">
                              {row._dupExisting ? "Already in this RFQ" : "Duplicate in this batch"}
                            </p>
                          )}

                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                            <div>
                              <span className="text-muted-foreground">Product: </span>
                              <span className="font-medium">{row._product?.name}</span>
                              <span className="text-muted-foreground font-mono ml-1">{row._product?.code}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Granularity: </span>
                              <span>{getGranLabel(row)}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Step: </span>
                              <span>Step {row._step?.sequence}: {row._step?.step_type?.replace(/_/g, " ")}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            {/* Recipient supplier */}
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground">Recipient Supplier</p>
                              <Select value={row.recipient_supplier_id || "none"}
                                onValueChange={(v) => updatePreviewRow(row._id, "recipient_supplier_id", v === "none" ? "" : v)}>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Select supplier…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none" disabled>Select supplier…</SelectItem>
                                  {allSuppliers.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Forecasted qty */}
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground">Forecasted Qty</p>
                              <div className="flex items-center gap-1.5">
                                <Input type="number" min={0} value={row.forecasted_qty}
                                  onChange={(e) => updatePreviewRow(row._id, "forecasted_qty", e.target.value)}
                                  className="h-7 text-xs" />
                                <span className="text-[10px] text-muted-foreground shrink-0">{row.forecasted_qty_uom || "—"}</span>
                              </div>
                            </div>
                          </div>

                          <button type="button" onClick={() => removePreviewRow(row._id)}
                            className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors">
                            <Trash2 className="w-3 h-3" />
                            Remove from batch
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!s3Done && <p className="text-xs text-muted-foreground">Select routing steps first.</p>}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !previewRows || validRows.length === 0 || hasDuplicates}
            className="gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Add {validRows.length > 0 ? validRows.length : ""} line{validRows.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}