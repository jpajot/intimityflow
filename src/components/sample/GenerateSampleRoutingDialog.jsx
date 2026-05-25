import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Info } from "lucide-react";

// Sort routings: matching-phase first, then by revision_code DESC + version DESC
function sortRoutings(routings, samplePhase) {
  const phaseMatch = (r) => {
    if (samplePhase === "development") return r.routing_type === "development";
    if (samplePhase === "production")  return r.routing_type === "production";
    return false;
  };
  return [...routings].sort((a, b) => {
    const aMatch = phaseMatch(a) ? 0 : 1;
    const bMatch = phaseMatch(b) ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    // Within group: revision_code DESC, version DESC
    const revCmp = (b.revision_code || "").localeCompare(a.revision_code || "");
    if (revCmp !== 0) return revCmp;
    return (b.version || 1) - (a.version || 1);
  });
}

function routingLabel(r) {
  const typeLabel = r.routing_type === "development" ? "DEV" : "PROD";
  const status = (r.status || "").toUpperCase();
  return `${r.name} · [${typeLabel}] · Rev ${r.revision_code || "?"} v${r.version || 1} · [${status}]`;
}

export default function GenerateSampleRoutingDialog({ open, onClose, onGenerated, sample }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [routings, setRoutings] = useState([]);
  const [stepsMap, setStepsMap] = useState({});    // { [routingId]: SupplierRoutingStep[] }
  const [suppliersMap, setSuppliersMap] = useState({});
  const [currenciesMap, setCurrenciesMap] = useState({});

  const [name, setName] = useState("");
  const [selectedRoutingId, setSelectedRoutingId] = useState(null);

  const sortedRoutings = useMemo(() => sortRoutings(routings, sample?.phase), [routings, sample?.phase]);
  const hasReferenceRoutings = sortedRoutings.length > 0;
  const selectedRouting = sortedRoutings.find((r) => r.id === selectedRoutingId) || null;
  const previewSteps = selectedRoutingId ? (stepsMap[selectedRoutingId] || []) : [];

  // Load data when dialog opens
  useEffect(() => {
    if (!open || !sample) return;
    setName(sample.code || "");
    setLoading(true);

    const doLoad = async () => {
      const [allRoutings, allCurrencies] = await Promise.all([
        base44.entities.SupplierRouting.filter({ product_id: sample.product_id }, "revision_code", 500),
        base44.entities.Currency.list("code", 200),
      ]);

      const refRoutings = allRoutings.filter((r) => r.routing_type === "development" || r.routing_type === "production");
      const sorted = sortRoutings(refRoutings, sample.phase);
      setRoutings(sorted);

      const cMap = {};
      allCurrencies.forEach((c) => { cMap[c.id] = c; });
      setCurrenciesMap(cMap);

      if (sorted.length > 0) {
        setSelectedRoutingId(sorted[0].id);

        // Load steps for all reference routings upfront so preview is instant
        const stepResults = await Promise.all(
          sorted.map((r) =>
            base44.entities.SupplierRoutingStep
              .filter({ supplier_routing_id: r.id }, "sequence", 200)
              .then((steps) => ({ routingId: r.id, steps }))
          )
        );
        const sMap = {};
        const supplierIds = new Set();
        stepResults.forEach(({ routingId, steps }) => {
          sMap[routingId] = steps;
          steps.forEach((s) => { if (s.supplier_id) supplierIds.add(s.supplier_id); });
        });
        setStepsMap(sMap);

        if (supplierIds.size > 0) {
          const allSuppliers = await base44.entities.Supplier.list("name", 2000);
          const supMap = {};
          allSuppliers.filter((s) => supplierIds.has(s.id)).forEach((s) => { supMap[s.id] = s; });
          setSuppliersMap(supMap);
        }
      } else {
        setSelectedRoutingId(null);
      }

      setLoading(false);
    };

    doLoad();
  }, [open, sample?.id]);

  const handleConfirm = async () => {
    if (!name.trim()) { toast.error("Please enter a name for the sample routing."); return; }

    // Defensive guard
    if (sample.linked_routing_id) {
      toast.error("This sample already has a routing linked.");
      return;
    }

    setSaving(true);

    // STEP 1 — Create SupplierRouting
    let newRouting;
    try {
      newRouting = await base44.entities.SupplierRouting.create({
        product_id: sample.product_id,
        name: name.trim(),
        routing_type: "sample",
        revision_code: "A",
        version: 1,
        status: "draft",
        is_default: false,
        derived_from_routing_id: selectedRouting?.id || null,
        derived_from_revision_code: selectedRouting?.revision_code || null,
        notes: "Generated from sample " + sample.code,
        pending_eco_review_count: 0,
      });
    } catch (err) {
      toast.error("Failed to create sample routing. Please retry.");
      setSaving(false);
      return;
    }

    const newRoutingId = newRouting.id;
    let newSteps = [];

    // STEP 2 — Clone SupplierRoutingStep records (Mode A only)
    if (hasReferenceRoutings && selectedRouting) {
      const sourceSteps = stepsMap[selectedRouting.id] || [];
      if (sourceSteps.length > 0) {
        try {
          newSteps = await Promise.all(
            sourceSteps.map((src) =>
              base44.entities.SupplierRoutingStep.create({
                supplier_routing_id: newRoutingId,
                sequence: src.sequence,
                step_type: src.step_type,
                supplier_id: src.supplier_id || null,
                unit_cost: src.unit_cost || null,
                currency_id: src.currency_id || null,
                lead_time_days: src.lead_time_days || null,
                ships_to_next: src.ships_to_next || null,
                input_description: src.input_description || null,
                output_description: src.output_description || null,
                description: src.description || null,
                notes: src.notes || null,
              })
            )
          );
        } catch (err) {
          toast.error("Failed to clone routing steps. The sample routing was created but is empty. You can add steps manually.");
          // Still link the sample to the routing (partial-success recoverable)
          await base44.entities.Sample.update(sample.id, { linked_routing_id: newRoutingId });
          onGenerated(newRouting);
          setSaving(false);
          onClose();
          return;
        }

        // STEP 3 — Create SampleStep records
        try {
          await Promise.all(
            newSteps.map((newStep) =>
              base44.entities.SampleStep.create({
                sample_id: sample.id,
                source_routing_step_id: newStep.id,
                sequence: newStep.sequence,
                step_type: newStep.step_type,
                supplier_id: newStep.supplier_id || null,
                unit_cost: newStep.unit_cost || null,
                currency_id: newStep.currency_id || null,
                lead_time_days: newStep.lead_time_days || null,
                due_date: null,
                requested_quantity: sample.requested_quantity || null,
                workflow_status: "created",
                workflow_status_changed_at: null,
                workflow_status_changed_by: null,
                conformity_status: "not_assessed",
                conformity_assessed_at: null,
                conformity_assessed_by: null,
                notes: null,
              })
            )
          );
        } catch (err) {
          toast.error("Failed to create sample steps. The sample routing exists with steps, but the sample is not yet linked to its steps. Please retry or contact support.");
          await base44.entities.Sample.update(sample.id, { linked_routing_id: newRoutingId });
          onGenerated(newRouting);
          setSaving(false);
          onClose();
          return;
        }
      }
    }

    // STEP 4 — Update Sample
    await base44.entities.Sample.update(sample.id, { linked_routing_id: newRoutingId });

    // STEP 5 — Success toast with navigation action
    toast.success(`Sample routing generated for ${sample.code}`, {
      action: {
        label: "Open routing",
        onClick: () => navigate(`/products/${sample.product_id}?tab=suppliers`),
      },
    });

    setSaving(false);

    // STEP 6 — Notify parent
    onGenerated(newRouting);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Sample Routing</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {/* Mode B banner */}
            {!hasReferenceRoutings && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>No existing routing for this product — a blank sample routing will be created. Add steps after generation.</span>
              </div>
            )}

            {/* Name field */}
            <div className="space-y-1">
              <Label htmlFor="sr-name">Name</Label>
              <Input
                id="sr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Routing name…"
              />
              <p className="text-[11px] text-muted-foreground">
                {hasReferenceRoutings
                  ? "This becomes the new sample routing's name. Edit if you want a more descriptive name."
                  : "This becomes the new sample routing's name."}
              </p>
            </div>

            {/* Source Routing dropdown (Mode A only) */}
            {hasReferenceRoutings && (
              <div className="space-y-1">
                <Label>Source Routing</Label>
                <Select value={selectedRoutingId || ""} onValueChange={setSelectedRoutingId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select a reference routing…" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedRoutings.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        {routingLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  The new sample routing will be cloned from this source. You can edit steps after generation.
                </p>
              </div>
            )}

            {/* Step preview */}
            {hasReferenceRoutings && selectedRoutingId && (
              <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Steps to clone</p>
                {previewSteps.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Source routing has no steps. Generation will produce a blank sample routing.</p>
                ) : (
                  previewSteps.map((step) => {
                    const sup = suppliersMap[step.supplier_id];
                    const cur = currenciesMap[step.currency_id];
                    return (
                      <div key={step.id} className="text-xs text-foreground flex items-center gap-1.5">
                        <span className="font-mono text-muted-foreground w-4 shrink-0">{step.sequence}.</span>
                        <span className="font-medium">{step.step_type}</span>
                        {sup && <><span className="text-muted-foreground">·</span><span>{sup.name}</span></>}
                        {step.lead_time_days != null && (
                          <><span className="text-muted-foreground">·</span><span>{step.lead_time_days}d</span></>
                        )}
                        {step.unit_cost != null && (
                          <><span className="text-muted-foreground">·</span>
                          <span>{step.unit_cost} {cur?.code || ""}</span></>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading || saving}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {hasReferenceRoutings ? "Generate Sample Routing" : "Generate Blank Sample Routing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}