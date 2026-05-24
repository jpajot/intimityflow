import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

export default function BOMCreateProdBOMDialog({ open, onClose, bom, bomLines, bomLineVariants, user, lovValues }) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [working, setWorking] = useState(false);

  // Step 1 fields
  const [region, setRegion] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [notes, setNotes] = useState("");

  // Step 2 fields
  const [routings, setRoutings] = useState([]);
  const [routingStepsMap, setRoutingStepsMap] = useState({}); // routingId -> steps[]
  const [selectedRoutingId, setSelectedRoutingId] = useState(null);
  const [routingsLoading, setRoutingsLoading] = useState(false);
  const [suppliers, setSuppliers] = useState({}); // supplierId -> supplier

  const regionOptions = lovValues.filter((v) => v.category === "supplier_region");

  // Load routings when reaching step 2
  useEffect(() => {
    if (step !== 2 || !bom?.product_id) return;
    setRoutingsLoading(true);
    let cancelled = false;
    const load = async () => {
      // Filter: product_id + routing_type = production (no status filter)
      const allRs = await base44.entities.SupplierRouting.filter({ product_id: bom.product_id, routing_type: "production" });
      if (cancelled) return;
      // Sort: revision_code DESC, version DESC
      const rs = [...allRs].sort((a, b) => {
        const revCmp = (b.revision_code || "").localeCompare(a.revision_code || "");
        if (revCmp !== 0) return revCmp;
        return (b.version || 0) - (a.version || 0);
      });
      setRoutings(rs);
      // Pre-select first (highest rev+version), regardless of status
      setSelectedRoutingId(rs[0]?.id || null);

      // Load steps for all routings
      const stepsMap = {};
      const supplierIds = new Set();
      for (const r of rs) {
        const steps = await base44.entities.SupplierRoutingStep.filter({ supplier_routing_id: r.id });
        if (cancelled) return;
        stepsMap[r.id] = steps.sort((a, b) => a.sequence - b.sequence);
        steps.forEach((s) => { if (s.supplier_id) supplierIds.add(s.supplier_id); });
      }
      setRoutingStepsMap(stepsMap);

      // Load supplier names
      const supMap = {};
      for (const sid of supplierIds) {
        const sups = await base44.entities.Supplier.filter({ id: sid });
        if (cancelled) return;
        if (sups[0]) supMap[sid] = sups[0];
      }
      setSuppliers(supMap);
      setRoutingsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [step, bom?.product_id]);

  const handleClose = () => {
    setStep(1); setRegion(""); setCustomerRef(""); setNotes("");
    setRoutings([]); setRoutingStepsMap({}); setSelectedRoutingId(null);
    onClose();
  };

  const selectedRouting = routings.find((r) => r.id === selectedRoutingId) || null;
  const selectedSteps = selectedRoutingId ? (routingStepsMap[selectedRoutingId] || []) : [];

  const getSupplierSequence = (steps) => {
    if (!steps.length) return "—";
    return steps.map((s) => suppliers[s.supplier_id]?.name || "?").join(" → ");
  };

  const handleConfirm = async () => {
    setWorking(true);

    // Build order_context (omit empty fields)
    const orderContext = {};
    if (region) orderContext.region = region;
    if (customerRef) orderContext.customer_ref = customerRef;

    // 1. Create the new Prod BOM
    const newBom = await base44.entities.BOM.create({
      bom_type: "production",
      product_id: bom.product_id,
      revision_code: "A",
      version: 1,
      status: "draft",
      derived_from_bom_id: bom.id,
      derived_from_revision_code: bom.revision_code,
      source_change_pending: false,
      order_context: Object.keys(orderContext).length > 0 ? orderContext : null,
      selected_routing_id: selectedRoutingId || null,
      notes: notes || null,
      valid_from: null,
      valid_until: null,
    });

    // 2. Clone BOMLines
    const lineIdMap = {};
    for (const line of bomLines) {
      const { id: lid, bom_id, created_date, updated_date, created_by, ...lineBase } = line;
      const newLine = await base44.entities.BOMLine.create({
        ...lineBase,
        bom_id: newBom.id,
        source_bom_line_id: lid,
      });
      lineIdMap[lid] = newLine.id;
    }

    // 3. Clone BOMLineVariants
    for (const v of bomLineVariants) {
      const newLineId = lineIdMap[v.bom_line_id];
      if (!newLineId) continue;
      const { id: vid, created_date, updated_date, created_by, ...vBase } = v;
      await base44.entities.BOMLineVariant.create({ ...vBase, bom_line_id: newLineId });
    }

    // 4. BOMChangeLog
    await base44.entities.BOMChangeLog.create({
      bom_id: newBom.id,
      change_type: "derived",
      payload: {
        derived_from_bom_id: bom.id,
        derived_from_revision_code: bom.revision_code,
        order_context: orderContext,
        cloned_lines: bomLines.length,
        cloned_variants: bomLineVariants.length,
        routing_id: selectedRoutingId || null,
      },
      triggered_by: user?.email || "",
      triggered_at: new Date().toISOString(),
    });

    setWorking(false);
    handleClose();
    toast({ title: `Production BOM created from Rev ${bom.revision_code} · v${bom.version}. Now in draft.` });
    navigate(`/boms/${newBom.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            Create Production BOM
            <span className="text-muted-foreground font-normal text-xs">— from Dev Rev {bom?.revision_code} · v{bom?.version}</span>
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mt-2">
            {[1, 2, 3].map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors ${
                  step === s ? "bg-primary text-primary-foreground" :
                  step > s ? "bg-green-500 text-white" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {step > s ? "✓" : s}
                </div>
                <span className={`text-[10px] ${step === s ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {s === 1 ? "Order context" : s === 2 ? "Routing" : "Confirm"}
                </span>
                {i < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* STEP 1 — Order context */}
        {step === 1 && (
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Region <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={region || "__none__"} onValueChange={(v) => setRegion(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select region…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— none —</SelectItem>
                  {regionOptions.map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Customer reference <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={customerRef} onChange={(e) => setCustomerRef(e.target.value)} placeholder="e.g. PO-2026-001" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Purpose of this production BOM…" className="text-xs min-h-[60px]" />
            </div>
            <p className="text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1.5">
              All fields are optional. This Prod BOM is scope-flexible — vendor commitment happens at the cell level via the supplier matrix.
            </p>
          </div>
        )}

        {/* STEP 2 — Routing selection */}
        {step === 2 && (
          <div className="space-y-3 py-1">
            {routingsLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading routings…
              </div>
            ) : routings.length === 0 ? (
              <div className="flex gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-xs text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  No production routings exist for this product. Create one on <strong>Product → Suppliers → Manufacturing Routings</strong> before deriving a Production BOM.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">Select production routing <span className="text-destructive">*</span></Label>
                {routings.map((r) => {
                  const steps = routingStepsMap[r.id] || [];
                  const isSelected = selectedRoutingId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoutingId(r.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-colors space-y-1 ${
                        isSelected ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold">{r.name}</span>
                        <span className="text-muted-foreground font-mono">[PROD] · Rev {r.revision_code || "—"} v{r.version || "—"} · [{(r.status || "").toUpperCase()}]</span>
                        {r.is_default && <span className="px-1 py-0 rounded bg-primary/10 text-primary text-[10px]">default</span>}
                        <span className="text-muted-foreground">{steps.length} step{steps.length !== 1 ? "s" : ""}</span>
                      </div>
                      {steps.length > 0 && (
                        <p className="text-[10px] text-muted-foreground truncate">{getSupplierSequence(steps)}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — Confirmation */}
        {step === 3 && (
          <div className="space-y-3 py-1 text-sm">
            <div className="bg-muted/40 rounded-lg p-3 space-y-2 text-xs">
              <p className="font-semibold text-foreground text-sm">Create Production BOM from Rev {bom?.revision_code} · v{bom?.version}</p>
              <div className="border-t border-border pt-2 space-y-1 text-muted-foreground">
                <p><span className="text-foreground font-medium">Source:</span> Dev BOM Rev {bom?.revision_code} · v{bom?.version} (released)</p>
              </div>
              <div className="border-t border-border pt-2 space-y-1">
                <p className="font-medium text-foreground">Order context</p>
                <p className="text-muted-foreground">Region: <span className="text-foreground">{region || "—"}</span></p>
                <p className="text-muted-foreground">Customer reference: <span className="text-foreground">{customerRef || "—"}</span></p>
                <p className="text-muted-foreground">Notes: <span className="text-foreground">{notes || "—"}</span></p>
              </div>
              <div className="border-t border-border pt-2 space-y-1">
                <p className="font-medium text-foreground">Routing</p>
                {selectedRouting ? (
                  <p className="text-muted-foreground">
                    {selectedRouting.name} · [PROD] · Rev {selectedRouting.revision_code || "—"} v{selectedRouting.version || "—"} · [{(selectedRouting.status || "").toUpperCase()}] · {selectedSteps.length} step{selectedSteps.length !== 1 ? "s" : ""}
                  </p>
                ) : (
                  <p className="text-muted-foreground italic">No routing selected</p>
                )}
              </div>
              <div className="border-t border-border pt-2 space-y-0.5">
                <p className="font-medium text-foreground">Will be cloned</p>
                <p className="text-muted-foreground">• {bomLines.length} BOMLine{bomLines.length !== 1 ? "s" : ""} (with variation flags, base quantities, UOMs)</p>
                <p className="text-muted-foreground">• {bomLineVariants.length} BOMLineVariant{bomLineVariants.length !== 1 ? "s" : ""} (color resolutions, size mappings, supplier overrides)</p>

              </div>
              <div className="border-t border-border pt-2">
                <p className="text-muted-foreground">The new Prod BOM starts as <strong className="text-foreground">Rev A · v1 in draft</strong> status.</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={working}>Cancel</Button>
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)} disabled={working}>Back</Button>
            )}
          </div>
          <div>
            {step < 3 ? (
              <Button
                size="sm"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 2 && (routingsLoading || routings.length === 0 || !selectedRoutingId)}
              >
                Next →
              </Button>
            ) : (
              <Button size="sm" onClick={handleConfirm} disabled={working}>
                {working && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                Create Production BOM
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}