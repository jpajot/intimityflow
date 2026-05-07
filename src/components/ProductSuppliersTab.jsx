import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Plus, Trash2, Crown, ArrowUp, ChevronDown, ChevronRight,
  Building2, GitBranch, AlertTriangle, CheckCircle2, Pencil, GripVertical, X
} from "lucide-react";
import { usePageOptions } from "@/lib/PageOptionsContext";
import ProductColorSupplierLinkMatrix from "./bom/ProductColorSupplierLinkMatrix";

// ─── Sourcing Summary Banner ──────────────────────────────────────────────────
function SourcingSummary({ approvedSuppliers, routings, colorOverrides, colorVariants, suppliers }) {
  const primary = approvedSuppliers.find((a) => a.is_primary);
  const alternates = approvedSuppliers.filter((a) => !a.is_primary);
  const defaultRouting = routings.find((r) => r.is_default);
  const hasA = approvedSuppliers.length > 0;
  const hasB = routings.length > 0;
  const mode = hasA && hasB ? "Hybrid" : hasA ? "Single supplier" : hasB ? "Multi-supplier routing" : "Not configured";
  const isReady = (primary?.status === "active") || (defaultRouting?.status === "active");

  return (
    <div className={`rounded-xl border p-4 flex flex-wrap gap-4 items-center justify-between ${isReady ? "bg-green-50/50 border-green-200" : "bg-amber-50/50 border-amber-200"}`}>
      <div className="flex items-center gap-2">
        {isReady
          ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
        <div>
          <p className="text-sm font-semibold">{mode}</p>
          <p className="text-xs text-muted-foreground">
            {!isReady ? "No active sourcing path — sourcing not ready" :
              primary ? `Primary: ${suppliers.find((s) => s.id === primary.supplier_id)?.name || "—"}` :
              defaultRouting ? `Default routing: ${defaultRouting.name}` : ""}
          </p>
        </div>
      </div>
      <div className="flex gap-4 text-center">
        <div><p className="text-lg font-bold">{approvedSuppliers.length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Suppliers</p></div>
        <div><p className="text-lg font-bold">{routings.length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Routings</p></div>
        <div><p className="text-lg font-bold">{colorOverrides.length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Overrides</p></div>
      </div>
    </div>
  );
}

// ─── Add/Edit Approved Supplier Modal ────────────────────────────────────────
function ApprovedSupplierModal({ open, onClose, onSave, suppliers, lovValues, existing }) {
  const [form, setForm] = useState({ supplier_id: "", supplier_reference: "", unit_cost: "", currency: "", moq: "", moq_uom: "", lead_time_days: "", valid_from: "", valid_until: "", status: "active", notes: "" });
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      if (existing) {
        setForm({ ...existing, unit_cost: existing.unit_cost || "", moq: existing.moq || "", lead_time_days: existing.lead_time_days || "" });
      } else {
        setForm({ supplier_id: "", supplier_reference: "", unit_cost: "", currency: "", moq: "", moq_uom: "", lead_time_days: "", valid_from: "", valid_until: "", status: "active", notes: "" });
      }
      setSearch("");
    }
  }, [open, existing]);

  const getLov = (cat) => lovValues.filter((v) => v.category === cat).map((v) => v.name);
  const filteredSuppliers = suppliers.filter((s) => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Approved Supplier" : "Add Approved Supplier"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {!existing && (
            <div className="space-y-1.5">
              <Label className="text-xs">Supplier *</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search supplier…" className="h-8 text-xs mb-1" />
              <div className="border border-border rounded-lg max-h-40 overflow-y-auto">
                {filteredSuppliers.map((s) => (
                  <button key={s.id} type="button"
                    onClick={() => { setForm((f) => ({ ...f, supplier_id: s.id })); setSearch(s.name); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${form.supplier_id === s.id ? "bg-primary/10 text-primary" : ""}`}>
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{s.code}</span>
                  </button>
                ))}
                {filteredSuppliers.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No suppliers found</p>}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Supplier Reference</Label>
              <Input value={form.supplier_reference || ""} onChange={(e) => setForm((f) => ({ ...f, supplier_reference: e.target.value }))} placeholder="Supplier's own SKU / article code" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unit Cost</Label>
              <Input type="number" value={form.unit_cost || ""} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Select value={form.currency || "none"} onValueChange={(v) => setForm((f) => ({ ...f, currency: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {getLov("currency").map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">MOQ</Label>
              <Input type="number" value={form.moq || ""} onChange={(e) => setForm((f) => ({ ...f, moq: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">MOQ Unit</Label>
              <Select value={form.moq_uom || "none"} onValueChange={(v) => setForm((f) => ({ ...f, moq_uom: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {getLov("moq_uom").map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lead Time (days)</Label>
              <Input type="number" value={form.lead_time_days || ""} onChange={(e) => setForm((f) => ({ ...f, lead_time_days: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status || "active"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(getLov("approved_supplier_status").length > 0 ? getLov("approved_supplier_status") : ["active", "pending_approval", "expired", "rejected"]).map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valid From</Label>
              <Input type="date" value={form.valid_from || ""} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valid Until</Label>
              <Input type="date" value={form.valid_until || ""} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!existing && !form.supplier_id}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Routing Modal ────────────────────────────────────────────────────────
function AddRoutingModal({ open, onClose, onSave }) {
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  useEffect(() => { if (open) { setName(""); setIsDefault(false); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>New Manufacturing Routing</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Routing Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. EU production route" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="isDefault" checked={isDefault} onCheckedChange={setIsDefault} />
            <Label htmlFor="isDefault" className="text-sm cursor-pointer">Set as default routing</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ name, is_default: isDefault })} disabled={!name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add/Edit Routing Step Modal ──────────────────────────────────────────────
function RoutingStepModal({ open, onClose, onSave, onDelete, suppliers, lovValues, existing }) {
  const [form, setForm] = useState({ step_type: "", supplier_id: "", description: "", unit_cost: "", currency: "", lead_time_days: "", ships_to_next: true, input_description: "", output_description: "", notes: "" });
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (open) {
      if (existing) setForm({ ...existing, unit_cost: existing.unit_cost || "", lead_time_days: existing.lead_time_days || "" });
      else setForm({ step_type: "", supplier_id: "", description: "", unit_cost: "", currency: "", lead_time_days: "", ships_to_next: true, input_description: "", output_description: "", notes: "" });
      setSearch("");
    }
  }, [open, existing]);

  const getLov = (cat) => lovValues.filter((v) => v.category === cat).map((v) => v.name);
  const filteredSuppliers = suppliers.filter((s) => !search || s.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{existing ? "Edit Step" : "Add Routing Step"}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Step Type *</Label>
              <Select value={form.step_type || "none"} onValueChange={(v) => setForm((f) => ({ ...f, step_type: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  {getLov("routing_step_type").map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lead Time (days)</Label>
              <Input type="number" value={form.lead_time_days || ""} onChange={(e) => setForm((f) => ({ ...f, lead_time_days: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Supplier</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search supplier…" className="h-8 text-xs mb-1" />
            <div className="border border-border rounded-lg max-h-32 overflow-y-auto">
              {filteredSuppliers.map((s) => (
                <button key={s.id} type="button" onClick={() => { setForm((f) => ({ ...f, supplier_id: s.id })); setSearch(s.name); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${form.supplier_id === s.id ? "bg-primary/10 text-primary" : ""}`}>
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What this supplier does at this step" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Unit Cost</Label>
              <Input type="number" value={form.unit_cost || ""} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Select value={form.currency || "none"} onValueChange={(v) => setForm((f) => ({ ...f, currency: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {getLov("currency").map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Input description</Label>
              <Input value={form.input_description || ""} onChange={(e) => setForm((f) => ({ ...f, input_description: e.target.value }))} placeholder="What arrives" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Output description</Label>
              <Input value={form.output_description || ""} onChange={(e) => setForm((f) => ({ ...f, output_description: e.target.value }))} placeholder="What leaves" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ships-next" checked={!!form.ships_to_next} onCheckedChange={(v) => setForm((f) => ({ ...f, ships_to_next: v }))} />
            <Label htmlFor="ships-next" className="text-sm cursor-pointer">Ships directly to next step</Label>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {existing && onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete} className="mr-auto">Delete step</Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.step_type}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Color Override Row ───────────────────────────────────────────────────────
function ColorOverrideRow({ colorway, override, approvedSuppliers, suppliers, lovValues, onSet, onRemove }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ approved_supplier_id: "", supplier_reference: "", unit_cost: "", currency: "", lead_time_days: "", notes: "" });
  const getLov = (cat) => lovValues.filter((v) => v.category === cat).map((v) => v.name);

  const overrideSupplier = override
    ? suppliers.find((s) => {
        const as = approvedSuppliers.find((a) => a.id === override.approved_supplier_id);
        return s.id === as?.supplier_id;
      })
    : null;

  const primaryAS = approvedSuppliers.find((a) => a.is_primary);
  const primarySupplier = primaryAS ? suppliers.find((s) => s.id === primaryAS.supplier_id) : null;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-sm shrink-0" style={{ backgroundColor: colorway.color_hex || "#ccc" }} />
          <div>
            <p className="text-xs font-medium">{colorway.color_name}</p>
            {colorway.colorway_code && <p className="text-[10px] text-muted-foreground font-mono">{colorway.colorway_code}</p>}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        {override ? (
          <span className="text-xs font-medium text-primary">{overrideSupplier?.name || "—"}</span>
        ) : (
          <span className="text-xs text-muted-foreground">→ {primarySupplier?.name || "No primary supplier"}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{override?.supplier_reference || "—"}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{override?.unit_cost ? `${override.unit_cost} ${override.currency || ""}` : "—"}</td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
            setForm(override ? { ...override, unit_cost: override.unit_cost || "", lead_time_days: override.lead_time_days || "" } : { approved_supplier_id: primaryAS?.id || "", supplier_reference: "", unit_cost: "", currency: "", lead_time_days: "", notes: "" });
            setShowModal(true);
          }}>
            <Pencil className="w-3 h-3" />
          </Button>
          {override && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onRemove(override.id)}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        <Dialog open={showModal} onOpenChange={(o) => !o && setShowModal(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Color-Specific Supplier Override</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">Colorway: <strong>{colorway.color_name}</strong></p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Override Supplier</Label>
                <Select value={form.approved_supplier_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, approved_supplier_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select approved supplier…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select…</SelectItem>
                    {approvedSuppliers.map((as) => {
                      const sup = suppliers.find((s) => s.id === as.supplier_id);
                      return <SelectItem key={as.id} value={as.id}>{sup?.name || as.supplier_id} {as.is_primary ? "(Primary)" : `(Rank ${as.rank})`}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Supplier Reference</Label>
                  <Input value={form.supplier_reference || ""} onChange={(e) => setForm((f) => ({ ...f, supplier_reference: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Unit Cost</Label>
                  <Input type="number" value={form.unit_cost || ""} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Select value={form.currency || "none"} onValueChange={(v) => setForm((f) => ({ ...f, currency: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {getLov("currency").map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lead Time (days)</Label>
                  <Input type="number" value={form.lead_time_days || ""} onChange={(e) => setForm((f) => ({ ...f, lead_time_days: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={() => { onSet(colorway.id, form, override?.id); setShowModal(false); }} disabled={!form.approved_supplier_id}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProductSuppliersTab({ product, colorVariants }) {
  const { setOptions } = usePageOptions();
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [approvedSuppliers, setApprovedSuppliers] = useState([]);
  const [colorOverrides, setColorOverrides] = useState([]); // legacy, kept for display compat
  const [routings, setRoutings] = useState([]);
  const [routingSteps, setRoutingSteps] = useState([]);
  const [lovValues, setLovValues] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showAddRoutingModal, setShowAddRoutingModal] = useState(false);
  const [selectedRoutingId, setSelectedRoutingId] = useState(null);
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [targetRoutingId, setTargetRoutingId] = useState(null);

  const [collapseA, setCollapseA] = useState(false);
  const [collapseB, setCollapseB] = useState(false);
  const [collapseOverrides, setCollapseOverrides] = useState(true);

  useEffect(() => {
    setOptions({
      items: [
        { label: "Add Supplier", icon: Plus, onClick: () => setShowAddSupplierModal(true), className: "text-primary hover:bg-primary/10" },
        { divider: true },
        { label: "Add Routing", icon: GitBranch, onClick: () => setShowAddRoutingModal(true) },
      ],
    });
  }, [setOptions]);

  useEffect(() => {
    loadData();
  }, [product.id]);

  const loadData = async () => {
    setLoading(true);
    const [sups, apps, overrides, rts, steps, lovs] = await Promise.all([
      base44.entities.Supplier.list("name", 500),
      base44.entities.ApprovedSupplier.filter({ product_id: product.id }),
      base44.entities.ApprovedSupplierColorOverride.list("-created_date", 500),
      base44.entities.SupplierRouting.filter({ product_id: product.id }),
      base44.entities.SupplierRoutingStep.list("sequence", 2000),
      base44.entities.ListOfValues.list("name", 5000),
    ]);
    setAllSuppliers(sups);
    setApprovedSuppliers(apps.sort((a, b) => (a.rank || 99) - (b.rank || 99)));
    // Filter overrides to this product's colorways
    const colorwayIds = new Set(colorVariants.map((cv) => cv.id));
    setColorOverrides(overrides.filter((o) => colorwayIds.has(o.product_color_id)));
    setRoutings(rts);
    setRoutingSteps(steps);
    setLovValues(lovs);
    if (rts.length > 0) setSelectedRoutingId(rts.find((r) => r.is_default)?.id || rts[0].id);
    setLoading(false);
  };

  // ─── Approved Supplier CRUD ─────────────────────────────────────────────────
  const handleAddApprovedSupplier = async (form) => {
    const maxRank = approvedSuppliers.reduce((m, a) => Math.max(m, a.rank || 0), 0);
    const isFirst = approvedSuppliers.length === 0;
    const created = await base44.entities.ApprovedSupplier.create({
      product_id: product.id,
      supplier_id: form.supplier_id,
      supplier_reference: form.supplier_reference,
      unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
      currency: form.currency,
      moq: form.moq ? Number(form.moq) : null,
      moq_uom: form.moq_uom,
      lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
      valid_from: form.valid_from,
      valid_until: form.valid_until,
      status: form.status || "active",
      notes: form.notes,
      rank: isFirst ? 1 : maxRank + 1,
      is_primary: isFirst,
    });
    setApprovedSuppliers((prev) => [...prev, created].sort((a, b) => (a.rank || 99) - (b.rank || 99)));
    setShowAddSupplierModal(false);
  };

  const handleEditApprovedSupplier = async (form) => {
    await base44.entities.ApprovedSupplier.update(editingSupplier.id, {
      supplier_reference: form.supplier_reference,
      unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
      currency: form.currency,
      moq: form.moq ? Number(form.moq) : null,
      moq_uom: form.moq_uom,
      lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
      valid_from: form.valid_from,
      valid_until: form.valid_until,
      status: form.status,
      notes: form.notes,
    });
    setApprovedSuppliers((prev) => prev.map((a) => a.id === editingSupplier.id ? { ...a, ...form } : a));
    setEditingSupplier(null);
  };

  const handlePromoteToPrimary = async (as) => {
    if (as.status !== "active") return;
    const currentPrimary = approvedSuppliers.find((a) => a.is_primary);
    const updates = [];
    if (currentPrimary) {
      updates.push(base44.entities.ApprovedSupplier.update(currentPrimary.id, { is_primary: false, rank: 2 }));
    }
    updates.push(base44.entities.ApprovedSupplier.update(as.id, { is_primary: true, rank: 1 }));
    await Promise.all(updates);
    const freshApps = await base44.entities.ApprovedSupplier.filter({ product_id: product.id });
    setApprovedSuppliers(freshApps.sort((a, b) => (a.rank || 99) - (b.rank || 99)));
  };

  const handleRemoveApprovedSupplier = async (id) => {
    await base44.entities.ApprovedSupplier.delete(id);
    setApprovedSuppliers((prev) => prev.filter((a) => a.id !== id));
  };

  // ─── Routing CRUD ────────────────────────────────────────────────────────────
  const handleAddRouting = async ({ name, is_default }) => {
    if (is_default) {
      await Promise.all(routings.filter((r) => r.is_default).map((r) => base44.entities.SupplierRouting.update(r.id, { is_default: false })));
    }
    const created = await base44.entities.SupplierRouting.create({ product_id: product.id, name, is_default, status: "active" });
    setRoutings((prev) => [...prev, created]);
    setSelectedRoutingId(created.id);
    setShowAddRoutingModal(false);
  };

  const handleToggleDefaultRouting = async (routing) => {
    if (routing.is_default) return;
    await Promise.all(routings.map((r) => base44.entities.SupplierRouting.update(r.id, { is_default: r.id === routing.id })));
    setRoutings((prev) => prev.map((r) => ({ ...r, is_default: r.id === routing.id })));
    // Flow B trigger — best-effort, non-blocking
    try {
      const me = await base44.auth.me();
      await base44.functions.invoke("createFlowBEcoOnRoutingChange", {
        supplier_routing_id: routing.id,
        change_summary: "Default routing flag changed",
        triggered_by: me?.email || "",
      });
    } catch (err) { console.error("[FlowB] Routing update trigger failed:", err); }
  };

  const handleDeleteRouting = async (id) => {
    const steps = routingSteps.filter((s) => s.supplier_routing_id === id);
    await Promise.all(steps.map((s) => base44.entities.SupplierRoutingStep.delete(s.id)));
    await base44.entities.SupplierRouting.delete(id);
    setRoutings((prev) => prev.filter((r) => r.id !== id));
    setRoutingSteps((prev) => prev.filter((s) => s.supplier_routing_id !== id));
    setSelectedRoutingId(routings.find((r) => r.id !== id)?.id || null);
  };

  // ─── Routing Step CRUD ───────────────────────────────────────────────────────
  const handleSaveStep = async (form) => {
    const routingId = targetRoutingId || selectedRoutingId;
    const stepsForRouting = routingSteps.filter((s) => s.supplier_routing_id === routingId);
    let savedStepId = editingStep?.id || null;
    let stepChangeKind = "modify";

    if (editingStep) {
      await base44.entities.SupplierRoutingStep.update(editingStep.id, {
        step_type: form.step_type,
        supplier_id: form.supplier_id,
        description: form.description,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        currency: form.currency,
        lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
        ships_to_next: form.ships_to_next,
        input_description: form.input_description,
        output_description: form.output_description,
        notes: form.notes,
      });
      setRoutingSteps((prev) => prev.map((s) => s.id === editingStep.id ? { ...s, ...form } : s));
    } else {
      stepChangeKind = "add";
      const seq = stepsForRouting.length + 1;
      const created = await base44.entities.SupplierRoutingStep.create({
        supplier_routing_id: routingId,
        sequence: seq,
        step_type: form.step_type,
        supplier_id: form.supplier_id,
        description: form.description,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        currency: form.currency,
        lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
        ships_to_next: form.ships_to_next,
        input_description: form.input_description,
        output_description: form.output_description,
        notes: form.notes,
      });
      savedStepId = created.id;
      setRoutingSteps((prev) => [...prev, created]);
      // Update total lead time on routing
      const newTotal = [...stepsForRouting, created].reduce((sum, s) => sum + (Number(s.lead_time_days) || 0), 0);
      await base44.entities.SupplierRouting.update(routingId, { total_lead_time_days: newTotal });
      setRoutings((prev) => prev.map((r) => r.id === routingId ? { ...r, total_lead_time_days: newTotal } : r));
    }

    setShowStepModal(false);
    setEditingStep(null);

    // Flow B trigger — best-effort, non-blocking
    try {
      const me = await base44.auth.me();
      const seq = editingStep?.sequence || (stepsForRouting.length + 1);
      await base44.functions.invoke("createFlowBEcoOnRoutingChange", {
        supplier_routing_id: routingId,
        change_summary: stepChangeKind === "add" ? `Step ${seq} added` : `Step ${editingStep?.sequence} modified`,
        triggered_by: me?.email || "",
        routing_step_id: savedStepId,
        step_change_kind: stepChangeKind,
      });
    } catch (err) { console.error("[FlowB] Step save trigger failed:", err); }
  };

  const handleDeleteStep = async () => {
    const deletedStep = editingStep; // capture before clearing state
    const routingId = deletedStep.supplier_routing_id;

    await base44.entities.SupplierRoutingStep.delete(deletedStep.id);
    const remaining = routingSteps.filter((s) => s.id !== deletedStep.id && s.supplier_routing_id === routingId);
    // Re-number
    await Promise.all(remaining.sort((a, b) => a.sequence - b.sequence).map((s, i) =>
      base44.entities.SupplierRoutingStep.update(s.id, { sequence: i + 1 })
    ));
    const allRemaining = routingSteps.filter((s) => s.id !== deletedStep.id);
    const reNumbered = allRemaining.map((s) => {
      if (s.supplier_routing_id !== routingId) return s;
      const idx = remaining.sort((a, b) => a.sequence - b.sequence).findIndex((r) => r.id === s.id);
      return { ...s, sequence: idx + 1 };
    });
    setRoutingSteps(reNumbered);
    setShowStepModal(false);
    setEditingStep(null);

    // Flow B trigger — best-effort, non-blocking
    try {
      const me = await base44.auth.me();
      await base44.functions.invoke("createFlowBEcoOnRoutingChange", {
        supplier_routing_id: routingId,
        change_summary: `Step ${deletedStep.sequence} removed`,
        triggered_by: me?.email || "",
        routing_step_id: deletedStep.id,
        step_change_kind: "remove",
      });
    } catch (err) { console.error("[FlowB] Step delete trigger failed:", err); }
  };

  // ─── Color Override CRUD ─────────────────────────────────────────────────────
  const handleSetColorOverride = async (productColorId, form, existingOverrideId) => {
    if (existingOverrideId) {
      await base44.entities.ApprovedSupplierColorOverride.update(existingOverrideId, {
        approved_supplier_id: form.approved_supplier_id,
        supplier_reference: form.supplier_reference,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        currency: form.currency,
        lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
        notes: form.notes,
      });
      setColorOverrides((prev) => prev.map((o) => o.id === existingOverrideId ? { ...o, ...form } : o));
    } else {
      const created = await base44.entities.ApprovedSupplierColorOverride.create({
        approved_supplier_id: form.approved_supplier_id,
        product_color_id: productColorId,
        supplier_reference: form.supplier_reference,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        currency: form.currency,
        lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
        notes: form.notes,
      });
      setColorOverrides((prev) => [...prev, created]);
    }
  };

  const handleRemoveColorOverride = async (id) => {
    await base44.entities.ApprovedSupplierColorOverride.delete(id);
    setColorOverrides((prev) => prev.filter((o) => o.id !== id));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  const primary = approvedSuppliers.find((a) => a.is_primary);
  const alternates = approvedSuppliers.filter((a) => !a.is_primary);
  const selectedRouting = routings.find((r) => r.id === selectedRoutingId);
  const selectedSteps = routingSteps.filter((s) => s.supplier_routing_id === selectedRoutingId).sort((a, b) => a.sequence - b.sequence);

  const STATUS_CHIP = {
    active: "bg-green-100 text-green-700 border-green-200",
    pending_approval: "bg-amber-100 text-amber-700 border-amber-200",
    expired: "bg-gray-100 text-gray-500 border-gray-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <SourcingSummary
        approvedSuppliers={approvedSuppliers}
        routings={routings}
        colorOverrides={colorOverrides}
        colorVariants={colorVariants}
        suppliers={allSuppliers}
      />

      {/* ─── Section A: Approved Suppliers ─────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <button type="button" onClick={() => setCollapseA((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Approved Suppliers</span>
            <span className="text-xs text-muted-foreground">({approvedSuppliers.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); setShowAddSupplierModal(true); }}>
              <Plus className="w-3 h-3" /> Add
            </Button>
            {collapseA ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {!collapseA && (
          <div className="border-t border-border p-4 space-y-3">
            {/* Primary supplier */}
            {primary ? (
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{allSuppliers.find((s) => s.id === primary.supplier_id)?.name || primary.supplier_id}</p>
                      {primary.supplier_reference && <p className="text-xs text-muted-foreground font-mono">{primary.supplier_reference}</p>}
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_CHIP[primary.status] || "bg-muted text-muted-foreground border-border"}`}>{primary.status?.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSupplier(primary)}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveApprovedSupplier(primary.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                  {primary.unit_cost && <span>{primary.unit_cost} {primary.currency}</span>}
                  {primary.moq && <span>MOQ: {primary.moq} {primary.moq_uom}</span>}
                  {primary.lead_time_days && <span>{primary.lead_time_days}d lead time</span>}
                  {primary.valid_until && <span>Until: {primary.valid_until}</span>}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <p className="text-sm text-muted-foreground">No primary supplier set. Add a supplier to get started.</p>
              </div>
            )}

            {/* Alternates */}
            {alternates.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alternates</p>
                {alternates.map((as) => {
                  const sup = allSuppliers.find((s) => s.id === as.supplier_id);
                  return (
                    <div key={as.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
                      <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center shrink-0">{as.rank}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{sup?.name || "—"}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                          {as.supplier_reference && <span className="font-mono">{as.supplier_reference}</span>}
                          {as.unit_cost && <span>{as.unit_cost} {as.currency}</span>}
                          {as.lead_time_days && <span>{as.lead_time_days}d</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_CHIP[as.status] || ""}`}>{as.status?.replace(/_/g, " ")}</span>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Promote to primary" onClick={() => handlePromoteToPrimary(as)} disabled={as.status !== "active"}>
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingSupplier(as)}><Pencil className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveApprovedSupplier(as.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Colorway × Supplier Links (ProductColorSupplierLink matrix) */}
            {colorVariants.length > 0 && approvedSuppliers.length > 0 && (
              <div>
                <button type="button" onClick={() => setCollapseOverrides((v) => !v)}
                  className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors py-1">
                  {collapseOverrides ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Colorway–Supplier Links
                </button>
                {!collapseOverrides && (
                  <div className="mt-2">
                    <ProductColorSupplierLinkMatrix
                      colorVariants={colorVariants}
                      approvedSuppliers={approvedSuppliers}
                      allSuppliers={allSuppliers}
                      lovValues={lovValues}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Section B: Manufacturing Routings ─────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <button type="button" onClick={() => setCollapseB((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Manufacturing Routings</span>
            <span className="text-xs text-muted-foreground">({routings.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); setShowAddRoutingModal(true); }}>
              <Plus className="w-3 h-3" /> Add
            </Button>
            {collapseB ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {!collapseB && (
          <div className="border-t border-border p-4 space-y-4">
            {routings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No routings defined. Add one for multi-supplier manufacturing.</p>
            ) : (
              <>
                {/* Routing selector */}
                <div className="flex gap-2 flex-wrap">
                  {routings.map((r) => (
                    <button key={r.id} type="button"
                      onClick={() => setSelectedRoutingId(r.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${selectedRoutingId === r.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border hover:bg-muted"}`}>
                      {r.is_default && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
                      {r.name}
                    </button>
                  ))}
                </div>

                {/* Routing detail */}
                {selectedRouting && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold">{selectedRouting.name}</span>
                        <div className="flex items-center gap-1.5">
                          <Switch
                            id={`default-${selectedRouting.id}`}
                            checked={selectedRouting.is_default}
                            onCheckedChange={() => handleToggleDefaultRouting(selectedRouting)}
                          />
                          <Label htmlFor={`default-${selectedRouting.id}`} className="text-xs cursor-pointer">Default</Label>
                        </div>
                        {selectedRouting.total_lead_time_days && (
                          <span className="text-xs text-muted-foreground">Total: {selectedRouting.total_lead_time_days}d</span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_CHIP[selectedRouting.status] || ""}`}>{selectedRouting.status?.replace(/_/g, " ")}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={() => handleDeleteRouting(selectedRouting.id)}>
                        <Trash2 className="w-3 h-3 mr-1" /> Delete routing
                      </Button>
                    </div>

                    {/* Step sequence */}
                    <div className="overflow-x-auto">
                      <div className="flex gap-2 min-w-max pb-2">
                        {selectedSteps.map((step, idx) => {
                          const sup = allSuppliers.find((s) => s.id === step.supplier_id);
                          return (
                            <div key={step.id} className="flex items-center gap-2">
                              <div
                                className="w-44 rounded-lg border border-border bg-muted/30 p-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                                onClick={() => { setEditingStep(step); setTargetRoutingId(selectedRoutingId); setShowStepModal(true); }}
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{step.sequence}</span>
                                  <span className="text-xs font-semibold capitalize">{step.step_type?.replace(/_/g, " ")}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">{sup?.name || "No supplier"}</p>
                                <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground">
                                  {step.lead_time_days && <span>{step.lead_time_days}d</span>}
                                  {step.unit_cost && <span>·</span>}
                                  {step.unit_cost && <span>{step.unit_cost} {step.currency}</span>}
                                </div>
                                {step.ships_to_next && idx < selectedSteps.length - 1 && (
                                  <p className="text-[9px] text-primary mt-1">ships to next ↘</p>
                                )}
                              </div>
                              {idx < selectedSteps.length - 1 && (
                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                            </div>
                          );
                        })}
                        <Button variant="outline" size="sm" className="h-auto min-h-[88px] w-36 text-xs border-dashed flex-col gap-1"
                          onClick={() => { setEditingStep(null); setTargetRoutingId(selectedRoutingId); setShowStepModal(true); }}>
                          <Plus className="w-4 h-4" />
                          Add step
                        </Button>
                      </div>
                    </div>

                    {/* Cost summary */}
                    {selectedSteps.some((s) => s.unit_cost) && (
                      <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        Total step cost: {selectedSteps.reduce((sum, s) => {
                          const cost = Number(s.unit_cost) || 0;
                          return sum + cost;
                        }, 0).toFixed(2)} (mixed currencies may apply) · {selectedSteps.reduce((sum, s) => sum + (Number(s.lead_time_days) || 0), 0)}d total lead time
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <ApprovedSupplierModal
        open={showAddSupplierModal}
        onClose={() => setShowAddSupplierModal(false)}
        onSave={handleAddApprovedSupplier}
        suppliers={allSuppliers}
        lovValues={lovValues}
      />
      <ApprovedSupplierModal
        open={!!editingSupplier}
        onClose={() => setEditingSupplier(null)}
        onSave={handleEditApprovedSupplier}
        suppliers={allSuppliers}
        lovValues={lovValues}
        existing={editingSupplier}
      />
      <AddRoutingModal
        open={showAddRoutingModal}
        onClose={() => setShowAddRoutingModal(false)}
        onSave={handleAddRouting}
      />
      <RoutingStepModal
        open={showStepModal}
        onClose={() => { setShowStepModal(false); setEditingStep(null); }}
        onSave={handleSaveStep}
        onDelete={editingStep ? handleDeleteStep : null}
        suppliers={allSuppliers}
        lovValues={lovValues}
        existing={editingStep}
      />
    </div>
  );
}