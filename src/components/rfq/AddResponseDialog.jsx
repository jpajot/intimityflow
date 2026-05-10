import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";

export default function AddResponseDialog({ line, rfq, productMap, stepMap, supplierMap, onSaved, onClose }) {
  const { user } = useAuth();

  const product  = productMap[line.product_id];
  const step     = stepMap[line.routing_step_id];
  const supplier = supplierMap[line.recipient_supplier_id];

  const dialogTitle = `Add Response — ${product?.code || "?"} / Step ${step?.sequence}: ${(step?.step_type || "").replace(/_/g, " ")} / ${supplier?.name || "?"}`;

  // ── Reference data ─────────────────────────────────────────────────────────
  const [currencies, setCurrencies] = useState([]);
  const [targetCurrency, setTargetCurrency] = useState(null);
  const [conversionRate, setConversionRate] = useState(null); // { rate, effective_date, id } | null
  const [rateLoading, setRateLoading] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    valid_from: "",
    valid_until: "",
    min_qty: "",
    max_qty: "",
    leadtime_days: "",
    supplier_currency_id: "",
    total_cost_supplier_ccy: "",
    supplier_notes: "",
    reviewer_notes: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  // ── Load currencies + target currency on mount ─────────────────────────────
  useEffect(() => {
    Promise.all([
      base44.entities.Currency.filter({ is_active: true }, "code", 200),
      rfq.target_currency_id ? base44.entities.Currency.filter({ id: rfq.target_currency_id }) : Promise.resolve([]),
    ]).then(([cList, tcList]) => {
      const sorted = cList.sort((a, b) => a.code.localeCompare(b.code));
      setCurrencies(sorted);
      setTargetCurrency(tcList[0] || null);

      // Default currency: supplier's default or rfq target
      const sup = supplierMap[line.recipient_supplier_id];
      const defaultCurrId = sup?.currency_default_id || rfq.target_currency_id || "";
      set("supplier_currency_id", defaultCurrId);
      setLoadingInit(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch conversion rate whenever supplier currency changes ───────────────
  useEffect(() => {
    if (!form.supplier_currency_id || !rfq.target_currency_id) return;
    if (form.supplier_currency_id === rfq.target_currency_id) {
      setConversionRate({ rate: 1, effective_date: null, id: null });
      return;
    }
    setRateLoading(true);
    const today = new Date().toISOString().split("T")[0];
    base44.entities.CurrencyConversionRate.filter(
      { from_currency_id: form.supplier_currency_id, to_currency_id: rfq.target_currency_id },
      "-effective_date",
      50
    ).then((rates) => {
      const valid = rates.filter((r) => r.effective_date <= today);
      setConversionRate(valid[0] ? { rate: valid[0].rate, effective_date: valid[0].effective_date, id: valid[0].id } : null);
      setRateLoading(false);
    });
  }, [form.supplier_currency_id, rfq.target_currency_id]);

  // ── Computed converted total ───────────────────────────────────────────────
  const chosenCurrency = useMemo(() => currencies.find((c) => c.id === form.supplier_currency_id), [currencies, form.supplier_currency_id]);
  const isSameCurrency = form.supplier_currency_id === rfq.target_currency_id;
  const rate = conversionRate?.rate ?? null;
  const costNum = parseFloat(form.total_cost_supplier_ccy);
  const convertedTotal = (!isNaN(costNum) && rate != null) ? costNum * rate : null;

  const decimalPlaces = chosenCurrency?.decimal_places ?? 2;
  const targetDecimalPlaces = targetCurrency?.decimal_places ?? 2;

  // ── Validation & submit ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = {};
    if (!form.supplier_currency_id) errs.supplier_currency_id = "Currency is required.";
    if (!form.total_cost_supplier_ccy || isNaN(parseFloat(form.total_cost_supplier_ccy))) {
      errs.total_cost_supplier_ccy = "Total cost is required.";
    }
    if (!isSameCurrency && rate == null && !errs.supplier_currency_id) {
      errs.supplier_currency_id = "No conversion rate available. Add one in Admin → Conversion Rates first.";
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    const now = new Date().toISOString();
    const today = now.split("T")[0];
    const totalSupplier = parseFloat(form.total_cost_supplier_ccy);
    const totalTarget = isSameCurrency ? totalSupplier : parseFloat((totalSupplier * rate).toFixed(targetDecimalPlaces));

    await base44.entities.RFQResponse.create({
      rfq_line_id:              line.id,
      valid_from:               form.valid_from  || null,
      valid_until:              form.valid_until || null,
      min_qty:                  form.min_qty     ? parseFloat(form.min_qty)     : null,
      max_qty:                  form.max_qty     ? parseFloat(form.max_qty)     : null,
      leadtime_days:            form.leadtime_days ? parseFloat(form.leadtime_days) : null,
      supplier_currency_id:     form.supplier_currency_id,
      total_cost_supplier_ccy:  totalSupplier,
      total_cost_target_ccy:    totalTarget,
      conversion_rate_used:     isSameCurrency ? 1 : rate,
      conversion_rate_id:       isSameCurrency ? null : (conversionRate?.id || null),
      conversion_rate_date:     isSameCurrency ? today : (conversionRate?.effective_date || null),
      status:                   "submitted",
      submitted_at:             now,
      submitted_by:             user?.email || "",
      is_awarded:               false,
      supplier_notes:           form.supplier_notes.trim() || null,
      reviewer_notes:           form.reviewer_notes.trim() || null,
    });

    // Update line status if still pending
    if (line.status === "pending") {
      await base44.entities.RFQLine.update(line.id, { status: "answered" });
    }

    setSubmitting(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm leading-snug">{dialogTitle}</DialogTitle>
        </DialogHeader>

        {loadingInit ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5 py-2">

            {/* Validity Window */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Validity Window</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Valid From</Label>
                  <Input type="date" value={form.valid_from} onChange={(e) => set("valid_from", e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valid Until</Label>
                  <Input type="date" value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quantity Applicability</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Min Qty</Label>
                  <Input type="number" min={0} value={form.min_qty} onChange={(e) => set("min_qty", e.target.value)} className="h-8 text-xs" placeholder="—" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Qty</Label>
                  <Input type="number" min={0} value={form.max_qty} onChange={(e) => set("max_qty", e.target.value)} className="h-8 text-xs" placeholder="—" />
                </div>
              </div>
            </div>

            {/* Lead Time */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lead Time</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0}
                  value={form.leadtime_days}
                  onChange={(e) => set("leadtime_days", e.target.value)}
                  className="h-8 text-xs w-28"
                  placeholder="—"
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pricing</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Supplier Currency <span className="text-destructive">*</span></Label>
                  <Select
                    value={form.supplier_currency_id || "none"}
                    onValueChange={(v) => set("supplier_currency_id", v === "none" ? "" : v)}
                  >
                    <SelectTrigger className={`h-8 text-xs ${errors.supplier_currency_id ? "border-destructive" : ""}`}>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>Select currency…</SelectItem>
                      {currencies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.supplier_currency_id && <p className="text-xs text-destructive">{errors.supplier_currency_id}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Total Cost (per unit) <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    min={0}
                    step={Math.pow(10, -decimalPlaces)}
                    value={form.total_cost_supplier_ccy}
                    onChange={(e) => set("total_cost_supplier_ccy", e.target.value)}
                    className={`h-8 text-xs ${errors.total_cost_supplier_ccy ? "border-destructive" : ""}`}
                    placeholder="0.00"
                  />
                  {errors.total_cost_supplier_ccy && <p className="text-xs text-destructive">{errors.total_cost_supplier_ccy}</p>}
                </div>
              </div>

              {/* Conversion preview */}
              {form.supplier_currency_id && targetCurrency && (
                <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Converted to {targetCurrency.code}
                  </p>
                  {rateLoading ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading rate…
                    </div>
                  ) : isSameCurrency ? (
                    <p className="text-xs text-muted-foreground">Same currency — no conversion needed.</p>
                  ) : rate != null ? (
                    <>
                      <p className="text-sm font-mono">
                        {!isNaN(costNum) ? costNum.toFixed(decimalPlaces) : "—"}
                        {" × "}
                        {rate}
                        {" = "}
                        <span className="font-semibold text-foreground">
                          {convertedTotal != null ? convertedTotal.toFixed(targetDecimalPlaces) : "—"} {targetCurrency.code}
                        </span>
                      </p>
                      {conversionRate?.effective_date && (
                        <p className="text-[10px] text-muted-foreground">
                          Rate effective: {conversionRate.effective_date}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-start gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>No conversion rate available — please add one in Admin → Conversion Rates before submitting.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</Label>
              <div className="space-y-1">
                <Label className="text-xs">Supplier Notes</Label>
                <Textarea
                  value={form.supplier_notes}
                  onChange={(e) => set("supplier_notes", e.target.value)}
                  placeholder="Comments from the supplier — capacity caveats, etc."
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reviewer Notes</Label>
                <Textarea
                  value={form.reviewer_notes}
                  onChange={(e) => set("reviewer_notes", e.target.value)}
                  placeholder="Internal annotation — not shared with the supplier."
                  rows={3}
                />
              </div>
            </div>

          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || loadingInit} className="gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Response
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}