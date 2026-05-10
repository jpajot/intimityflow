import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const today = () => new Date().toISOString().split("T")[0];

const EMPTY_FORM = {
  name: "",
  round_id: "",
  due_date: "",
  target_currency_id: "",
  description: "",
  notes: "",
};

export default function RFQCreateDialog({ projectId, onCreated, onClose }) {
  const [rounds, setRounds] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    const load = async () => {
      const [roundList, currList, configList] = await Promise.all([
        base44.entities.RFQRound.filter({ is_active: true }, "sequence", 100),
        base44.entities.Currency.filter({ is_active: true }),
        base44.entities.AppConfig.filter({ key: { $in: ["rfq_default_due_days", "target_currency_id"] } }),
      ]);

      setRounds(roundList.sort((a, b) => (a.sequence || 0) - (b.sequence || 0)));
      setCurrencies(currList.sort((a, b) => a.code.localeCompare(b.code)));

      const dueDaysConfig = configList.find((c) => c.key === "rfq_default_due_days");
      const defaultDueDays = dueDaysConfig ? parseInt(dueDaysConfig.value, 10) || 14 : 14;
      const targetCurrConfig = configList.find((c) => c.key === "target_currency_id");

      setForm((f) => ({
        ...f,
        due_date: addDays(today(), defaultDueDays),
        target_currency_id: targetCurrConfig?.value || "",
      }));

      setLoading(false);
    };
    load();
  }, []);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => { const next = { ...e }; delete next[field]; return next; });
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim())        errs.name               = "Name is required.";
    if (!form.round_id)           errs.round_id           = "Round is required.";
    if (!form.target_currency_id) errs.target_currency_id = "Target currency is required.";
    return errs;
  };

  const handleCreate = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    let code = "";
    try {
      const res = await base44.functions.invoke("generateCode", { entity_name: "RFQ", entity_type: "RFQ" });
      code = res.data?.code || "";
    } catch (_) {}

    const created = await base44.entities.RFQ.create({
      code,
      name: form.name.trim(),
      round_id: form.round_id,
      due_date: form.due_date || null,
      target_currency_id: form.target_currency_id,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
      project_id: projectId,
      status: "draft",
      sample_requests: [],
      shared_product_specs: [],
    });

    onCreated(created);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create RFQ</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Code (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-xs">Code</Label>
              <Input disabled placeholder="Auto-generated on save" className="text-muted-foreground" />
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. SS26 R1 Costing"
                className={errors.name ? "border-destructive" : ""}
                autoFocus
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Round */}
            <div className="space-y-1.5">
              <Label className="text-xs">Round <span className="text-destructive">*</span></Label>
              <Select value={form.round_id || "none"} onValueChange={(v) => set("round_id", v === "none" ? "" : v)}>
                <SelectTrigger className={errors.round_id ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select round…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Select round…</SelectItem>
                  {rounds.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.round_id && <p className="text-xs text-destructive">{errors.round_id}</p>}
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input
                type="date"
                value={form.due_date || ""}
                onChange={(e) => set("due_date", e.target.value)}
              />
            </div>

            {/* Target Currency */}
            <div className="space-y-1.5">
              <Label className="text-xs">Target Currency <span className="text-destructive">*</span></Label>
              <Select value={form.target_currency_id || "none"} onValueChange={(v) => set("target_currency_id", v === "none" ? "" : v)}>
                <SelectTrigger className={errors.target_currency_id ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select currency…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Select currency…</SelectItem>
                  {currencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.target_currency_id && <p className="text-xs text-destructive">{errors.target_currency_id}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Purpose of this RFQ — visible to suppliers."
                rows={3}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Internal notes — not shared with suppliers."
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground">Internal — suppliers will not see this.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving || loading} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create RFQ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}