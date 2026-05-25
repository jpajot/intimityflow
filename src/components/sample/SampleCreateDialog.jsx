import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Lock } from "lucide-react";
import { derivePhase } from "./sampleUtils";

const SAMPLE_TYPE_OPTIONS = [
  { value: "volume",        label: "Volume (Development)" },
  { value: "proto",         label: "Proto (Development)" },
  { value: "sample",        label: "Sample (Development)" },
  { value: "sms",           label: "SMS (Development)" },
  { value: "test_au_porter",label: "Test Au Porter (Development)" },
  { value: "gold_seal",     label: "Gold Seal (Production)" },
  { value: "pps",           label: "PPS (Production)" },
];

// Hash code generation: alphabet excludes ambiguous chars I, O, 0, 1
const HASH_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateHashCode(length = 6) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += HASH_ALPHA[Math.floor(Math.random() * HASH_ALPHA.length)];
  }
  return result;
}

async function generateUniqueSampleCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const hash = generateHashCode(6);
    const code = `SMP-${hash}`;
    const existing = await base44.entities.Sample.filter({ code });
    if (!existing || existing.length === 0) return code;
  }
  throw new Error("Failed to generate a unique sample code after 10 attempts.");
}

export default function SampleCreateDialog({ open, onClose, onCreated, preset = {}, productOptions }) {
  const [saving, setSaving] = useState(false);

  // Form state
  const [productId, setProductId] = useState(preset.product_id || "");
  const [projectId, setProjectId] = useState(preset.project_id || "");
  const [sampleType, setSampleType] = useState("");
  const [colorId, setColorId] = useState("");
  const [pcamId, setPcamId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [requestedQty, setRequestedQty] = useState("");
  const [notes, setNotes] = useState("");

  // Reference data
  const [products, setProducts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [colors, setColors] = useState([]);
  const [pcams, setPcams] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [resolvedProduct, setResolvedProduct] = useState(null);
  const [resolvedProject, setResolvedProject] = useState(null);
  const [resolvedRfq, setResolvedRfq] = useState(null);

  const phase = sampleType ? derivePhase(sampleType) : null;

  // Reset form on open
  useEffect(() => {
    if (!open) return;
    setProductId(preset.product_id || "");
    setProjectId(preset.project_id || "");
    setSampleType("");
    setColorId("");
    setPcamId("");
    setSizeId("");
    setRequestedQty("");
    setNotes("");
    setProductSearch("");
    setResolvedProduct(null);
    setResolvedProject(null);
    setResolvedRfq(null);
  }, [open]);

  // Load reference data on open
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const [projs] = await Promise.all([
        base44.entities.Project.list("-created_date", 500),
      ]);
      // Sort: most recently updated first
      setProjects(projs);

      if (!preset.product_id) {
        if (productOptions) {
          setProducts(productOptions);
        } else {
          const prods = await base44.entities.Product.list("name", 500);
          setProducts(prods);
        }
      }

      if (preset.product_id) {
        const prod = await base44.entities.Product.filter({ id: preset.product_id });
        setResolvedProduct(prod[0] || null);
        loadProductDependents(preset.product_id);
      }

      if (preset.project_id) {
        const proj = projs.find((p) => p.id === preset.project_id);
        setResolvedProject(proj || null);
      }

      if (preset.rfq_id) {
        const rfqs = await base44.entities.RFQ.filter({ id: preset.rfq_id });
        setResolvedRfq(rfqs[0] || null);
      }
    };
    load();
  }, [open]);

  const loadProductDependents = async (pid) => {
    const [cols, allPcams, prod] = await Promise.all([
      base44.entities.ProductColor.filter({ product_id: pid }),
      base44.entities.ProductColorAndMore.list("-created_date", 2000),
      base44.entities.Product.filter({ id: pid }),
    ]);
    setColors(cols);
    setPcams(allPcams); // we'll filter by colorId below

    const p = prod[0];
    if (p?.size_grid_id) {
      const gridSizes = await base44.entities.SizeGridSize.filter({ size_grid_id: p.size_grid_id });
      const sizeIds = gridSizes.map((gs) => gs.size_id);
      if (sizeIds.length) {
        const sizeRecords = await base44.entities.Size.list("name", 500);
        setSizes(sizeRecords.filter((s) => sizeIds.includes(s.id)));
      } else {
        setSizes([]);
      }
    } else {
      setSizes([]);
    }
  };

  const handleProductSelect = async (pid) => {
    setProductId(pid);
    setColorId("");
    setPcamId("");
    setSizeId("");
    if (pid) {
      const prods = products.length ? products : await base44.entities.Product.filter({ id: pid });
      setResolvedProduct(prods.find((p) => p.id === pid) || null);
      await loadProductDependents(pid);
    } else {
      setResolvedProduct(null);
      setColors([]);
      setPcams([]);
      setSizes([]);
    }
  };

  const filteredProducts = productSearch
    ? products.filter((p) =>
        (p.name || "").toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.code || "").toLowerCase().includes(productSearch.toLowerCase())
      )
    : products;

  const pcamsForColor = colorId
    ? pcams.filter((pc) => pc.product_color_id === colorId)
    : [];

  const hasPcams = colorId ? pcamsForColor.length > 0 : false;

  const canSubmit = productId && projectId && sampleType && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const code = await generateUniqueSampleCode();
    const now = new Date().toISOString();
    const me = await base44.auth.me();
    const record = await base44.entities.Sample.create({
      project_id: projectId,
      rfq_id: preset.rfq_id || null,
      code,
      qr_code_data: code,
      product_id: productId,
      product_color_id: colorId || null,
      product_color_and_more_id: pcamId || null,
      size_id: sizeId || null,
      sample_type: sampleType,
      phase: derivePhase(sampleType),
      requested_quantity: requestedQty ? Number(requestedQty) : null,
      linked_routing_id: null,
      conformity_status: "not_assessed",
      notes: notes || null,
      created_by: me?.email || "",
      created_at: now,
    });
    setSaving(false);
    onCreated(record);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Sample</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">

          {/* Product */}
          <div className="space-y-1.5">
            <Label className="text-xs">Product <span className="text-destructive">*</span></Label>
            {preset.product_id ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/40 text-sm">
                {resolvedProduct?.images?.[0] && (
                  <img src={resolvedProduct.images[0]} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                )}
                <span className="flex-1 truncate font-medium">
                  {resolvedProduct ? `${resolvedProduct.code ? resolvedProduct.code + " — " : ""}${resolvedProduct.name}` : preset.product_id}
                </span>
                <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
              </div>
            ) : (
              <>
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search product…"
                  className="h-8 text-xs mb-1"
                />
                <div className="border border-border rounded-lg max-h-36 overflow-y-auto">
                  {filteredProducts.slice(0, 50).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { handleProductSelect(p.id); setProductSearch(`${p.code ? p.code + " — " : ""}${p.name}`); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 transition-colors ${productId === p.id ? "bg-primary/10 text-primary" : ""}`}
                    >
                      {p.images?.[0] && <img src={p.images[0]} alt="" className="w-5 h-5 rounded object-cover shrink-0" />}
                      <span className="flex-1 truncate">{p.name}</span>
                      {p.code && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{p.code}</span>}
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">No products found</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Project */}
          <div className="space-y-1.5">
            <Label className="text-xs">Project <span className="text-destructive">*</span></Label>
            {preset.project_id ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/40 text-sm">
                <span className="flex-1 truncate font-medium">{resolvedProject?.name || preset.project_id}</span>
                <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
              </div>
            ) : (
              <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select project…</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* RFQ (only when preset.rfq_id is set) */}
          {preset.rfq_id && (
            <div className="space-y-1.5">
              <Label className="text-xs">RFQ</Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/40 text-sm">
                <span className="flex-1 font-mono font-medium">{resolvedRfq?.code || preset.rfq_id}</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">Attached to this RFQ</span>
                <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
              </div>
            </div>
          )}

          {/* Sample Type + Phase chip */}
          <div className="space-y-1.5">
            <Label className="text-xs">Sample Type <span className="text-destructive">*</span></Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select value={sampleType || "none"} onValueChange={(v) => setSampleType(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select type…</SelectItem>
                    {SAMPLE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {phase && (
                <span
                  className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border"
                  style={
                    phase === "production"
                      ? { color: "#059669", backgroundColor: "#d1fae5", borderColor: "#6ee7b7" }
                      : { color: "#6B7280", backgroundColor: "#f3f4f6", borderColor: "#d1d5db" }
                  }
                >
                  {phase === "production" ? "Production" : "Development"}
                </span>
              )}
            </div>
          </div>

          {/* Color */}
          {colors.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Color (optional)</Label>
              <Select value={colorId || "none"} onValueChange={(v) => { setColorId(v === "none" ? "" : v); setPcamId(""); }}>
                <SelectTrigger><SelectValue placeholder="Any color" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any color</SelectItem>
                  {colors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.color_hex && (
                          <span className="w-3 h-3 rounded-full inline-block border border-border" style={{ backgroundColor: c.color_hex }} />
                        )}
                        {c.colorway_code ? `${c.colorway_code} — ${c.color_name}` : c.color_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* PCAM — only when color selected and PCAMs exist */}
          {hasPcams && (
            <div className="space-y-1.5">
              <Label className="text-xs">Variation (optional)</Label>
              <Select value={pcamId || "none"} onValueChange={(v) => setPcamId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Any variation" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any variation</SelectItem>
                  {pcamsForColor.map((pc) => (
                    <SelectItem key={pc.id} value={pc.id}>{pc.name || pc.sequence}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Size */}
          {sizes.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Size (optional)</Label>
              <Select value={sizeId || "none"} onValueChange={(v) => setSizeId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Any size" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any size</SelectItem>
                  {sizes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.code || s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Requested Quantity */}
          <div className="space-y-1.5">
            <Label className="text-xs">Requested Quantity (optional)</Label>
            <Input
              type="number"
              min={1}
              value={requestedQty}
              onChange={(e) => setRequestedQty(e.target.value)}
              placeholder="e.g. 2"
              className="h-9"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context to record. Visible to all users who can see this sample."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Create Sample
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}