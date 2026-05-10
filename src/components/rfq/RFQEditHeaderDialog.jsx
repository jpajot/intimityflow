import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function RFQEditHeaderDialog({ rfq, onSaved, onClose }) {
  const [rounds, setRounds] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    name:               rfq.name               || "",
    round_id:           rfq.round_id           || "",
    due_date:           rfq.due_date           || "",
    target_currency_id: rfq.target_currency_id || "",
    description:        rfq.description        || "",
    notes:              rfq.notes              || "",
  });

  useEffect(() => {
    Promise.all([
      base44.entities.RFQRound.filter({ is_active: true }, "sequence", 100),
      base44.entities.Currency.filter({ is_active: true }),
    ]).then(([rList, cList]) => {
      setRounds(rList.sort((a, b) => (a.sequence || 0) - (b.sequence || 0)));
      setCurrencies(cList.sort((a, b) => a.code.localeCompare(b.code)));
      setLoading(false);
    });
  }, []);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => { const next = { ...e }; delete next[field]; return next; });
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim())          errs.name               = "Name is required.";
    if (!form.round_id)             errs.round_id           = "Round is required.";
    if (!form.target_currency_id)   errs.target_currency_id = "Target currency is required.";
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    const updated = await base44.entities.RFQ.update(rfq.id, {
      name:               form.name.trim(),
      round_id:           form.round_id,
      due_date:           form.due_date || null,
      target_currency_id: form.target_currency_id,
      description:        form.description.trim() || null,
      notes:              form.notes.trim()        || null,
    });
    onSaved({ ...rfq, ...updated });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit RFQ Header</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. SS26 R1 Costing"
                className={errors.name ? "border-destructive" : ""}
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
                rows={4}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Internal notes — not shared with suppliers."
                rows={4}
              />
              <p className="text-[10px] text-muted-foreground">Internal — suppliers will not see this.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}