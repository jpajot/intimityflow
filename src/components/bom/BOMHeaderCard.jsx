import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Pencil, Check, X, Link, Loader2 } from "lucide-react";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  in_review: "bg-amber-100 text-amber-700 border-amber-300",
  released: "bg-green-100 text-green-700 border-green-300",
  superseded: "bg-purple-100 text-purple-700 border-purple-300",
  obsolete: "bg-red-100 text-red-700 border-red-300",
};

function sortRoutingsByRevVersion(rs) {
  return [...rs].sort((a, b) => {
    const revCmp = (b.revision_code || "").localeCompare(a.revision_code || "");
    if (revCmp !== 0) return revCmp;
    return (b.version || 0) - (a.version || 0);
  });
}

function routingLabel(r, typeChip) {
  return `${r.name} · [${typeChip}] · Rev ${r.revision_code || "—"} v${r.version || "—"} · [${(r.status || "").toUpperCase()}]`;
}

function routingCompactLabel(r) {
  const chip = r.routing_type === "production" ? "PROD" : r.routing_type === "development" ? "DEV" : "SAMPLE";
  return `${r.name} · [${chip}] · Rev ${r.revision_code || "—"} v${r.version || "—"} · [${(r.status || "").toUpperCase()}]`;
}

// ─── Change Routing Dialog ────────────────────────────────────────────────────
function ChangeRoutingDialog({ open, bom, currentRouting, onClose, onSaved }) {
  const [routings, setRoutings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(currentRouting?.id || null);
  const [saving, setSaving] = useState(false);

  const typeChip = bom?.bom_type === "production" ? "PROD" : "DEV";
  const routingType = bom?.bom_type === "production" ? "production" : "development";

  useEffect(() => {
    if (!open || !bom?.product_id) return;
    setLoading(true);
    setSelectedId(currentRouting?.id || null);
    base44.entities.SupplierRouting.filter({ product_id: bom.product_id, routing_type: routingType }).then((rs) => {
      setRoutings(sortRoutingsByRevVersion(rs));
      setLoading(false);
    });
  }, [open, bom?.product_id, bom?.bom_type, currentRouting?.id]);

  const handleConfirm = async () => {
    if (!selectedId || selectedId === currentRouting?.id) { onClose(); return; }
    setSaving(true);
    const newRouting = routings.find((r) => r.id === selectedId);
    await base44.entities.BOM.update(bom.id, { selected_routing_id: selectedId });
    const me = await base44.auth.me();
    await base44.entities.BOMChangeLog.create({
      bom_id: bom.id,
      change_type: "routing_changed_upstream",
      payload: {
        previous_routing_id: currentRouting?.id || null,
        new_routing_id: selectedId,
        previous_routing_label: currentRouting ? routingCompactLabel(currentRouting) : null,
        new_routing_label: newRouting ? routingCompactLabel(newRouting) : null,
      },
      triggered_by: me?.email || "",
      triggered_at: new Date().toISOString(),
    });
    setSaving(false);
    onSaved({ ...bom, selected_routing_id: selectedId }, newRouting);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Change Linked Routing</DialogTitle></DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground">
            BOM: Rev {bom?.revision_code} v{bom?.version} · [{(bom?.status || "").toUpperCase()}]
          </div>
          {currentRouting && (
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">Current: </span>
              {routingCompactLabel(currentRouting)}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">New routing <span className="text-destructive">*</span></Label>
            {loading ? (
              <div className="flex items-center gap-2 py-1 text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
            ) : routings.length === 0 ? (
              <p className="text-muted-foreground italic">No {routingType} routings found for this product.</p>
            ) : (
              <Select value={selectedId || ""} onValueChange={setSelectedId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {routings.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{routingLabel(r, typeChip)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleConfirm} disabled={saving || !selectedId || loading}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
            Change Routing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Validity date inline editor ──────────────────────────────────────────────
function ValidityDateField({ label, value, onSave, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => { setDraft(value || ""); setEditing(true); };
  const cancel = () => setEditing(false);
  const save = () => { onSave(draft || null); setEditing(false); };

  if (editing) {
    return (
      <div>
        <span className="font-medium text-foreground text-xs">{label}</span>
        <div className="flex items-center gap-1 mt-0.5">
          <Input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-6 text-xs w-36 px-1.5" />
          <Button size="icon" variant="ghost" className="h-5 w-5 text-green-600" onClick={save}><Check className="w-3 h-3" /></Button>
          <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground" onClick={cancel}><X className="w-3 h-3" /></Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <span className="font-medium text-foreground text-xs">{label}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <p className="text-xs">{value ? format(new Date(value), "dd MMM yyyy") : <span className="text-muted-foreground/60 italic">Not set</span>}</p>
        {canEdit && (
          <button type="button" onClick={startEdit} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <Pencil className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function BOMHeaderCard({ bom, product, isReadOnly, onBomUpdated }) {
  const [linkedRouting, setLinkedRouting] = useState(null);
  const [showChangePicker, setShowChangePicker] = useState(false);

  const canEditRouting = bom && ["draft", "in_review"].includes(bom.status);

  useEffect(() => {
    if (!bom?.selected_routing_id) { setLinkedRouting(null); return; }
    base44.entities.SupplierRouting.filter({ id: bom.selected_routing_id }).then((rs) => {
      setLinkedRouting(rs[0] || null);
    });
  }, [bom?.selected_routing_id]);

  if (!bom) return null;

  const canEditValidity = !["superseded", "obsolete"].includes(bom.status);

  const saveValidityField = async (field, value) => {
    const prev = { valid_from: bom.valid_from, valid_until: bom.valid_until };
    const next = { ...prev, [field]: value };
    await base44.entities.BOM.update(bom.id, { [field]: value });
    await base44.entities.BOMChangeLog.create({
      bom_id: bom.id,
      change_type: "validity_window_changed",
      payload: { before: prev, after: next },
      triggered_by: "",
      triggered_at: new Date().toISOString(),
    });
    if (onBomUpdated) onBomUpdated({ ...bom, [field]: value });
  };

  return (
    <>
      <div className="bg-card rounded-xl border border-border px-4 py-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">Product</span>
          <p className="mt-0.5">{product ? `${product.code || ""} ${product.name}`.trim() : "—"}</p>
        </div>
        <div>
          <span className="font-medium text-foreground">Type</span>
          <p className="capitalize mt-0.5">{bom.bom_type}</p>
        </div>
        <div>
          <span className="font-medium text-foreground">Revision</span>
          <p className="mt-0.5">Rev {bom.revision_code} · v{bom.version}</p>
        </div>
        <div>
          <span className="font-medium text-foreground">Status</span>
          <div className="mt-0.5">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[bom.status] || ""}`}>
              {bom.status}
            </Badge>
          </div>
        </div>

        {/* Linked Routing */}
        <div>
          <span className="font-medium text-foreground">Routing</span>
          <div className="mt-0.5 flex items-center gap-1">
            {linkedRouting ? (
              <span
                title={canEditRouting ? "Click to change routing" : "Routing is frozen after BOM release. To change the routing, create a new BOM revision."}
                onClick={() => canEditRouting && setShowChangePicker(true)}
                className={`text-xs ${canEditRouting ? "text-primary cursor-pointer hover:underline" : "text-muted-foreground"}`}
              >
                {routingCompactLabel(linkedRouting)}
              </span>
            ) : (
              <>
                <span className="italic text-muted-foreground/60">No routing linked</span>
                {canEditRouting && (
                  <button
                    type="button"
                    onClick={() => setShowChangePicker(true)}
                    className="flex items-center gap-0.5 text-primary hover:underline ml-1"
                  >
                    <Link className="w-3 h-3" /> Link a routing
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <ValidityDateField
          label="Valid From"
          value={bom.valid_from}
          canEdit={canEditValidity}
          onSave={(v) => saveValidityField("valid_from", v)}
        />
        <ValidityDateField
          label="Valid Until"
          value={bom.valid_until}
          canEdit={canEditValidity}
          onSave={(v) => saveValidityField("valid_until", v)}
        />
        {bom.released_at && (
          <div>
            <span className="font-medium text-foreground">Released</span>
            <p className="mt-0.5">{format(new Date(bom.released_at), "dd MMM yyyy")}{bom.released_by ? ` by ${bom.released_by}` : ""}</p>
          </div>
        )}
        {isReadOnly && (
          <div className="flex items-center ml-auto self-center">
            <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-300">Read-only</Badge>
          </div>
        )}
      </div>

      <ChangeRoutingDialog
        open={showChangePicker}
        bom={bom}
        currentRouting={linkedRouting}
        onClose={() => setShowChangePicker(false)}
        onSaved={(updatedBom, newRouting) => {
          setShowChangePicker(false);
          setLinkedRouting(newRouting);
          if (onBomUpdated) onBomUpdated(updatedBom);
        }}
      />
    </>
  );
}