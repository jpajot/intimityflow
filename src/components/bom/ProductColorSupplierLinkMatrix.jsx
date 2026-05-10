import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const STATUS_OPTIONS = ["available", "not_applicable", "pending_confirmation", "discontinued"];
const STATUS_COLORS = {
  available: "bg-green-100 text-green-700 border-green-200",
  not_applicable: "bg-gray-100 text-gray-500 border-gray-200",
  pending_confirmation: "bg-amber-100 text-amber-700 border-amber-200",
  discontinued: "bg-red-100 text-red-700 border-red-200",
};

function LinkEditModal({ open, onClose, onSave, colorway, approvedSupplier, supplierName, existing, currencies }) {
  const [form, setForm] = useState({ colorway_supplier_reference: "", colorway_supplier_status: "available", unit_cost_override: "", currency_override_id: "", lead_time_override_days: "", notes: "" });

  useEffect(() => {
    if (open) {
      setForm(existing
        ? { ...existing, unit_cost_override: existing.unit_cost_override ?? "", lead_time_override_days: existing.lead_time_override_days ?? "" }
        : { colorway_supplier_reference: "", colorway_supplier_status: "available", unit_cost_override: "", currency_override_id: "", lead_time_override_days: "", notes: "" }
      );
    }
  }, [open, existing]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Colorway–Supplier Link</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground mb-3">
          <span className="font-medium text-foreground">{colorway?.color_name}</span> × <span className="font-medium text-foreground">{supplierName}</span>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.colorway_supplier_status} onValueChange={(v) => setForm((f) => ({ ...f, colorway_supplier_status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Supplier Reference (colorway-specific)</Label>
            <Input value={form.colorway_supplier_reference || ""} onChange={(e) => setForm((f) => ({ ...f, colorway_supplier_reference: e.target.value }))} placeholder="e.g. TPL-200-BK" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Unit Cost Override</Label>
              <Input type="number" value={form.unit_cost_override || ""} onChange={(e) => setForm((f) => ({ ...f, unit_cost_override: e.target.value }))} placeholder="Inherit" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lead Time Override (days)</Label>
              <Input type="number" value={form.lead_time_override_days || ""} onChange={(e) => setForm((f) => ({ ...f, lead_time_override_days: e.target.value }))} placeholder="Inherit" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Currency Override</Label>
            <Select value={form.currency_override_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, currency_override_id: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Inherit from parent supplier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Inherit from parent supplier</SelectItem>
                {currencies.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {(() => {
              const parentCurrId = approvedSupplier?.currency_id;
              const parentCurr = parentCurrId ? currencies.find((c) => c.id === parentCurrId) : null;
              return (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Inheriting: {parentCurr ? parentCurr.code : "—"}
                </p>
              );
            })()}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductColorSupplierLinkMatrix({ colorVariants, approvedSuppliers, allSuppliers, lovValues }) {
  const [links, setLinks] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState(null); // { colorway, approvedSupplier, existing }

  useEffect(() => {
    base44.entities.Currency.filter({ is_active: true }).then((currs) =>
      setCurrencies(currs.sort((a, b) => a.code.localeCompare(b.code)))
    );
  }, []);

  useEffect(() => {
    if (!colorVariants.length || !approvedSuppliers.length) { setLoading(false); return; }
    const colorIds = colorVariants.map((c) => c.id);
    base44.entities.ProductColorSupplierLink.list("-created_date", 2000).then((all) => {
      setLinks(all.filter((l) => colorIds.includes(l.product_color_id)));
      setLoading(false);
    });
  }, [colorVariants, approvedSuppliers]);

  const getLink = (colorwayId, approvedSupplierId) =>
    links.find((l) => l.product_color_id === colorwayId && l.approved_supplier_id === approvedSupplierId);

  const PCSL_TRIGGER_FIELDS = ['colorway_supplier_status', 'unit_cost_override', 'currency_override_id', 'lead_time_override_days', 'moq_override', 'colorway_supplier_reference'];

  const handleSave = async (form) => {
    const { colorway, approvedSupplier, existing } = editCell;
    const payload = {
      product_color_id: colorway.id,
      approved_supplier_id: approvedSupplier.id,
      colorway_supplier_reference: form.colorway_supplier_reference,
      colorway_supplier_status: form.colorway_supplier_status,
      unit_cost_override: form.unit_cost_override ? Number(form.unit_cost_override) : null,
      currency_override_id: form.currency_override_id || null,
      lead_time_override_days: form.lead_time_override_days ? Number(form.lead_time_override_days) : null,
      notes: form.notes,
    };

    if (existing) {
      await base44.entities.ProductColorSupplierLink.update(existing.id, payload);
      setLinks((prev) => prev.map((l) => l.id === existing.id ? { ...l, ...payload } : l));
      setEditCell(null);

      // Flow C trigger — post-commit, best-effort, non-blocking (update only; create is not a trigger)
      try {
        const fieldChanges = {};
        for (const field of PCSL_TRIGGER_FIELDS) {
          const beforeVal = existing[field] ?? null;
          const afterVal = payload[field] ?? null;
          if (beforeVal !== afterVal) fieldChanges[field] = { before: beforeVal, after: afterVal };
        }
        if (Object.keys(fieldChanges).length > 0) {
          const me = await base44.auth.me();
          await base44.functions.invoke("createFlowCEcoOnSourcingChange", {
            item_type: "ProductColorSupplierLink",
            item_id: existing.id,
            change_kind: "modify",
            field_changes: fieldChanges,
            triggered_by: me?.email || "",
          });
        }
      } catch (err) { console.error("[FlowC] ProductColorSupplierLink update trigger failed:", err); }
    } else {
      const created = await base44.entities.ProductColorSupplierLink.create(payload);
      setLinks((prev) => [...prev, created]);
      setEditCell(null);
      // CREATE does not trigger Flow C per spec
    }
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-xl border border-border overflow-auto">
      <table className="w-full text-xs min-w-[400px]">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Colorway</th>
            {approvedSuppliers.map((as) => {
              const sup = allSuppliers.find((s) => s.id === as.supplier_id);
              return (
                <th key={as.id} className="px-3 py-2 text-center font-semibold text-muted-foreground min-w-[120px]">
                  {sup?.name || "—"}
                  {as.is_primary && <span className="ml-1 text-[9px] text-primary">(Primary)</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {colorVariants.map((cv) => (
            <tr key={cv.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-sm shrink-0 border border-border/50" style={{ backgroundColor: cv.color_hex || "#ccc" }} />
                  <span className="font-medium truncate max-w-[120px]">{cv.color_name}</span>
                </div>
              </td>
              {approvedSuppliers.map((as) => {
                const link = getLink(cv.id, as.id);
                const status = link?.colorway_supplier_status || null;
                const sup = allSuppliers.find((s) => s.id === as.supplier_id);
                return (
                  <td key={as.id} className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setEditCell({ colorway: cv, approvedSupplier: as, supplierName: sup?.name || "—", existing: link || null })}
                      className={`px-2 py-1 rounded border text-[10px] font-medium transition-colors hover:opacity-80 w-full ${
                        status ? STATUS_COLORS[status] || "bg-muted text-muted-foreground border-border" : "border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:border-primary hover:text-primary bg-transparent"
                      }`}
                    >
                      {status ? status.replace(/_/g, " ") : "+ link"}
                    </button>
                    {link?.colorway_supplier_reference && (
                      <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{link.colorway_supplier_reference}</p>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {editCell && (
        <LinkEditModal
          open={!!editCell}
          onClose={() => setEditCell(null)}
          onSave={handleSave}
          colorway={editCell.colorway}
          approvedSupplier={editCell.approvedSupplier}
          supplierName={editCell.supplierName}
          existing={editCell.existing}
          currencies={currencies}
        />
      )}
    </div>
  );
}