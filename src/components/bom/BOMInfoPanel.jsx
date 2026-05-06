import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Pencil, Check, ExternalLink, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
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
  const [allBoms, setAllBoms] = useState([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [expandedRevisions, setExpandedRevisions] = useState({});

  useEffect(() => {
    if (!open || !bom) return;
    base44.entities.BOM.filter({ product_id: bom.product_id, bom_type: bom.bom_type })
      .then((all) => {
        setAllBoms(all);
        // Auto-expand the current revision
        setExpandedRevisions({ [bom.revision_code]: true });
      });
  }, [open, bom?.product_id, bom?.bom_type]);

  // Group BOMs by revision_code, sorted descending; versions within each group sorted ascending
  const groupedRevisions = useMemo(() => {
    const groups = {};
    for (const b of allBoms) {
      const rev = b.revision_code || "?";
      if (!groups[rev]) groups[rev] = [];
      groups[rev].push(b);
    }
    // Sort versions ascending within each revision
    for (const rev of Object.keys(groups)) {
      groups[rev].sort((a, b) => (a.version || 1) - (b.version || 1));
    }
    // Return sorted revision codes descending
    const sortedRevCodes = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return sortedRevCodes.map((rev) => ({ rev, versions: groups[rev] }));
  }, [allBoms]);

  // Detect non-released parent: this BOM's derived_from_bom_id points to a non-released BOM
  const nonReleasedParentWarning = useMemo(() => {
    if (!bom?.derived_from_bom_id) return null;
    const parent = allBoms.find((b) => b.id === bom.derived_from_bom_id);
    if (parent && parent.status !== "released") return parent;
    // Also check cross-product parents from allBoms (won't be there) — skip, only warn if parent is in same product set
    return null;
  }, [bom, allBoms]);

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

        {/* Non-released parent warning */}
        {nonReleasedParentWarning && (
          <div className="flex gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
            <p>
              This revision was created from <strong>Rev {nonReleasedParentWarning.revision_code}</strong> which was never released.
              Consider deleting this revision and using "Create new version" on Rev {nonReleasedParentWarning.revision_code} instead, or releasing it first to legitimize this revision.
            </p>
          </div>
        )}

        {/* SECTION: Revision history */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Revision History</p>
          <div className="space-y-1">
            {groupedRevisions.length === 0 && <p className="text-xs text-muted-foreground italic">Loading…</p>}
            {groupedRevisions.map(({ rev, versions }) => {
              const isExpanded = !!expandedRevisions[rev];
              const hasMultiple = versions.length > 1;
              // Latest version in this revision group
              const latestVersion = versions[versions.length - 1];
              const revStatus = latestVersion?.status;
              return (
                <div key={rev} className="border border-border rounded-lg overflow-hidden">
                  {/* Revision header row */}
                  <button
                    type="button"
                    onClick={() => setExpandedRevisions((prev) => ({ ...prev, [rev]: !prev[rev] }))}
                    className="w-full flex items-center justify-between px-2.5 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                      <span className="text-xs font-semibold">Rev {rev}</span>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${STATUS_COLORS[revStatus] || ""}`}>
                        {revStatus}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{versions.length} version{versions.length !== 1 ? "s" : ""}</span>
                  </button>

                  {/* Versions list */}
                  {isExpanded && (
                    <div className="divide-y divide-border/50">
                      {versions.map((v) => {
                        const isCurrent = v.id === bom.id;
                        const isSuperseded = !!v.superseded_by_version_id;
                        const validity = validityDisplay(v);
                        const supersededByVersion = isSuperseded
                          ? versions.find((vv) => vv.id === v.superseded_by_version_id)?.version
                          : null;
                        return (
                          <div
                            key={v.id}
                            className={`flex items-start justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                              isCurrent ? "bg-primary/8" : isSuperseded ? "opacity-50" : "hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-medium ${isSuperseded ? "line-through" : ""}`}>v{v.version}</span>
                                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${STATUS_COLORS[v.status] || ""}`}>
                                  {v.status}
                                </Badge>
                                {isCurrent && <span className="text-[9px] text-primary font-medium">current</span>}
                              </div>
                              {isSuperseded && supersededByVersion && (
                                <p className="text-[10px] text-muted-foreground">superseded by v{supersededByVersion}</p>
                              )}
                              {validity && <p className="text-[10px] text-muted-foreground">{validity}</p>}
                              {v.released_at && (
                                <p className="text-[10px] text-muted-foreground">Released {format(new Date(v.released_at), "dd MMM yyyy")}</p>
                              )}
                            </div>
                            {!isCurrent && (
                              <button
                                type="button"
                                onClick={() => { onClose(); navigate(`/boms/${v.id}`); }}
                                className="text-primary text-[10px] font-medium hover:underline shrink-0 mt-0.5"
                              >
                                Open
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
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