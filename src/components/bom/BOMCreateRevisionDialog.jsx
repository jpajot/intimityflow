import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";

function nextRevision(code) {
  if (!code) return "B";
  const last = code.trim().toUpperCase();
  // If single letter, increment
  if (/^[A-Z]$/.test(last)) {
    const next = String.fromCharCode(last.charCodeAt(0) + 1);
    return next <= "Z" ? next : "AA";
  }
  return last + "A";
}

export default function BOMCreateRevisionDialog({ open, onClose, bom, bomLines, bomLineVariants, user }) {
  const [working, setWorking] = useState(false);
  const navigate = useNavigate();

  const nextRev = nextRevision(bom?.revision_code);

  // Precondition: only allow creating a new revision from a released BOM
  const isReleased = bom?.status === "released";

  const handleCreate = async () => {
    if (!isReleased) return;
    setWorking(true);
    // Clone BOM
    const { id, created_date, updated_date, created_by, released_at, released_by, ...bomBase } = bom;
    const newBom = await base44.entities.BOM.create({
      ...bomBase,
      revision_code: nextRev,
      version: 1,
      status: "draft",
      valid_from: null,
      valid_until: null,
      released_at: null,
      released_by: null,
      superseded_by_id: null,
      source_change_pending: false,
    });

    // Clone lines
    const lineIdMap = {};
    for (const line of bomLines) {
      const { id: lid, bom_id, created_date, updated_date, created_by, ...lineBase } = line;
      const newLine = await base44.entities.BOMLine.create({ ...lineBase, bom_id: newBom.id });
      lineIdMap[lid] = newLine.id;
    }

    // Clone variants
    for (const v of bomLineVariants) {
      const newLineId = lineIdMap[v.bom_line_id];
      if (!newLineId) continue;
      const { id: vid, created_date, updated_date, created_by, ...vBase } = v;
      await base44.entities.BOMLineVariant.create({ ...vBase, bom_line_id: newLineId });
    }

    // Log
    await base44.entities.BOMChangeLog.create({
      bom_id: newBom.id,
      change_type: "derived",
      payload: { derived_from_bom_id: bom.id, derived_from_revision_code: bom.revision_code },
      triggered_by: user?.email || "",
      triggered_at: new Date().toISOString(),
    });

    setWorking(false);
    onClose();
    navigate(`/boms/${newBom.id}`);
  };

  if (!isReleased) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Cannot create new revision</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Releases come before revisions. Use <strong>"Create new version"</strong> to iterate within the current draft, or release this BOM first to start a new revision.
            </p>
            <p className="text-xs">
              Current status: <strong>{bom?.status}</strong>. Revision creation requires status <strong>released</strong>.
            </p>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={onClose}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Create new revision</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>
            A new revision <strong>{nextRev}</strong> will be created in <strong>draft</strong> status, cloning:
          </p>
          <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-0.5">
            <li>All {bomLines.length} component line{bomLines.length !== 1 ? "s" : ""}</li>
            <li>All {bomLineVariants.length} variant record{bomLineVariants.length !== 1 ? "s" : ""}</li>
          </ul>
          <p className="text-xs text-muted-foreground">The current revision stays unchanged. You'll be taken to the new revision.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={working}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={working}>
            {working && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            Create revision {nextRev}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}