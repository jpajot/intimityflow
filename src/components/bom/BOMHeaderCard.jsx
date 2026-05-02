import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Pencil, Check, X } from "lucide-react";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  in_review: "bg-amber-100 text-amber-700 border-amber-300",
  released: "bg-green-100 text-green-700 border-green-300",
  superseded: "bg-purple-100 text-purple-700 border-purple-300",
  obsolete: "bg-red-100 text-red-700 border-red-300",
};

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

export default function BOMHeaderCard({ bom, product, isReadOnly, onBomUpdated }) {
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
  );
}