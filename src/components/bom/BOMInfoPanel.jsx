import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Pencil, Check, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  in_review: "bg-amber-100 text-amber-700 border-amber-300",
  released: "bg-green-100 text-green-700 border-green-300",
  superseded: "bg-purple-100 text-purple-700 border-purple-300",
  obsolete: "bg-red-100 text-red-700 border-red-300",
};

function InlineDateField({ label, value, onSave, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing) {
    return (
      <div>
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1 mt-0.5">
          <Input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-6 text-xs w-36 px-1.5" />
          <button type="button" onClick={() => { onSave(draft || null); setEditing(false); }} className="text-green-600 hover:text-green-700">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <p className="text-xs">{value ? format(new Date(value), "dd MMM yyyy") : <span className="italic text-muted-foreground/50">Not set</span>}</p>
        {canEdit && (
          <button type="button" onClick={() => { setDraft(value || ""); setEditing(true); }} className="text-muted-foreground/40 hover:text-muted-foreground">
            <Pencil className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function BOMInfoPanel({ open, onClose, bom, product, onBomUpdated, onOpenChangelog }) {
  const navigate = useNavigate();
  const [revisions, setRevisions] = useState([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => {
    if (!open || !bom) return;
    // Load all BOMs for same product + type
    base44.entities.BOM.filter({ product_id: bom.product_id, bom_type: bom.bom_type })
      .then((all) => setRevisions(all.sort((a, b) => (b.revision_code || "").localeCompare(a.revision_code || ""))));
  }, [open, bom?.product_id, bom?.bom_type]);

  if (!open || !bom) return null;

  const canEditValidity = !["superseded", "obsolete"].includes(bom.status);

  const saveField = async (field, value) => {
    await base44.entities.BOM.update(bom.id, { [field]: value });
    onBomUpdated({ ...bom, [field]: value });
  };

  const saveNotes = async () => {
    await base44.entities.BOM.update(bom.id, { notes: notesDraft });
    onBomUpdated({ ...bom, notes: notesDraft });
    setEditingNotes(false);
  };

  const validityDisplay = (b) => {
    const from = b.valid_from ? format(new Date(b.valid_from), "dd MMM yyyy") : null;
    const until = b.valid_until ? format(new Date(b.valid_until), "dd MMM yyyy") : null;
    if (from && until) return `${from} → ${until}`;
    if (from) return `${from} → present`;
    if (until) return `until ${until}`;
    return null;
  };

  const panel = (
    <div
      className="fixed top-0 right-0 h-full z-[9998] flex flex-col bg-popover border-l border-border shadow-2xl overflow-y-auto"
      style={{ width: 360 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-popover z-10">
        <span className="text-sm font-semibold">BOM Details</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-6 flex-1">
        {/* SECTION: Current revision */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Current Revision</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground">Product</span>
              <div className="mt-0.5 flex items-center gap-1">
                <p className="font-medium truncate">{product ? `${product.code || ""} ${product.name}`.trim() : "—"}</p>
                {product && (
                  <Link to={`/products/${product.id}`} className="text-muted-foreground/50 hover:text-primary shrink-0">
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">Type</span>
              <p className="mt-0.5 capitalize font-medium">{bom.bom_type}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">Revision</span>
              <p className="mt-0.5 font-medium">Rev {bom.revision_code} · v{bom.version}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">Status</span>
              <div className="mt-0.5">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[bom.status] || ""}`}>
                  {bom.status}
                </Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InlineDateField label="Valid From" value={bom.valid_from} canEdit={canEditValidity} onSave={(v) => saveField("valid_from", v)} />
            <InlineDateField label="Valid Until" value={bom.valid_until} canEdit={canEditValidity} onSave={(v) => saveField("valid_until", v)} />
          </div>
          {bom.status === "released" && bom.released_at && (
            <div className="text-xs">
              <span className="text-[10px] text-muted-foreground">Released</span>
              <p className="mt-0.5">{format(new Date(bom.released_at), "dd MMM yyyy")}{bom.released_by ? ` by ${bom.released_by}` : ""}</p>
            </div>
          )}
          {/* Notes */}
          <div className="text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Notes</span>
              {!editingNotes && (
                <button type="button" onClick={() => { setNotesDraft(bom.notes || ""); setEditingNotes(true); }} className="text-muted-foreground/40 hover:text-muted-foreground">
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-1.5">
                <Textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} className="text-xs min-h-[60px]" />
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-6 text-xs px-2" onClick={saveNotes}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingNotes(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground/80 italic">{bom.notes || "No notes"}</p>
            )}
          </div>
        </div>

        {/* SECTION: Revision history */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Revision History</p>
          <div className="space-y-1.5">
            {revisions.map((rev) => {
              const isCurrent = rev.id === bom.id;
              const validity = validityDisplay(rev);
              return (
                <div
                  key={rev.id}
                  className={`flex items-start justify-between gap-2 px-2.5 py-2 rounded-lg text-xs border transition-colors ${
                    isCurrent ? "bg-primary/8 border-primary/20" : "bg-muted/30 border-transparent hover:bg-muted/60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">Rev {rev.revision_code} · v{rev.version}</span>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${STATUS_COLORS[rev.status] || ""}`}>
                        {rev.status}
                      </Badge>
                    </div>
                    {validity && <p className="text-[10px] text-muted-foreground mt-0.5">{validity}</p>}
                    {rev.released_at && (
                      <p className="text-[10px] text-muted-foreground">Released {format(new Date(rev.released_at), "dd MMM yyyy")}</p>
                    )}
                  </div>
                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => { onClose(); navigate(`/boms/${rev.id}`); }}
                      className="text-primary text-[10px] font-medium hover:underline shrink-0 mt-0.5"
                    >
                      Open
                    </button>
                  )}
                  {isCurrent && <span className="text-[10px] text-primary font-medium shrink-0 mt-0.5">Current</span>}
                </div>
              );
            })}
            {revisions.length === 0 && <p className="text-xs text-muted-foreground italic">Loading…</p>}
          </div>
        </div>

        {/* SECTION: Quick metadata */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Quick Metadata</p>
          <div className="space-y-1.5 text-xs">
            {bom.created_by && (
              <div>
                <span className="text-[10px] text-muted-foreground">Created by</span>
                <p className="mt-0.5">{bom.created_by}{bom.created_date ? ` · ${format(new Date(bom.created_date), "dd MMM yyyy")}` : ""}</p>
              </div>
            )}
            {bom.updated_date && (
              <div>
                <span className="text-[10px] text-muted-foreground">Last updated</span>
                <p className="mt-0.5">{format(new Date(bom.updated_date), "dd MMM yyyy HH:mm")}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => { onClose(); onOpenChangelog?.(); }}
              className="text-primary text-xs hover:underline"
            >
              View change log →
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}