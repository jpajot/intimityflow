import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";

export default function BOMCreateVersionDialog({ open, onClose, bom, bomLines, bomLineVariants, user, viewStateId }) {
  const [working, setWorking] = useState(false);
  const navigate = useNavigate();

  const nextVersion = (bom?.version || 1) + 1;
  const isProduction = bom?.bom_type === "production";

  const handleCreate = async () => {
    setWorking(true);

    // Clone BOM with incremented version
    const { id, created_date, updated_date, created_by, ...bomBase } = bom;
    const newBom = await base44.entities.BOM.create({
      ...bomBase,
      version: nextVersion,
      status: "draft",
      superseded_by_version_id: null,
      superseded_by_id: null,
    });

    // Clone lines
    const lineIdMap = {};
    for (const line of bomLines) {
      const { id: lid, bom_id, created_date: _cd, updated_date: _ud, created_by: _cb, ...lineBase } = line;
      const newLine = await base44.entities.BOMLine.create({ ...lineBase, bom_id: newBom.id });
      lineIdMap[lid] = newLine.id;
    }

    // Clone variants
    for (const v of bomLineVariants) {
      const newLineId = lineIdMap[v.bom_line_id];
      if (!newLineId) continue;
      const { id: vid, created_date: _cd, updated_date: _ud, created_by: _cb, ...vBase } = v;
      await base44.entities.BOMLineVariant.create({ ...vBase, bom_line_id: newLineId });
    }

    // Clone view state for this user (so new version opens with same axis/filter config)
    if (viewStateId) {
      const existing = await base44.entities.BOMMatrixViewState.filter({ id: viewStateId });
      if (existing[0]) {
        const { id: _vsid, bom_id: _vsbid, created_date: _vscd, updated_date: _vsud, created_by: _vscb, ...vsBase } = existing[0];
        await base44.entities.BOMMatrixViewState.create({ ...vsBase, bom_id: newBom.id, last_used_at: new Date().toISOString() });
      }
    }

    // Mark the original BOM as superseded by this version
    await base44.entities.BOM.update(bom.id, { superseded_by_version_id: newBom.id });

    // Changelog
    await base44.entities.BOMChangeLog.create({
      bom_id: newBom.id,
      change_type: "version_created",
      payload: { from_bom_id: bom.id, from_version: bom.version, to_version: nextVersion, revision_code: bom.revision_code },
      triggered_by: user?.email || "",
      triggered_at: new Date().toISOString(),
    });

    setWorking(false);
    onClose();
    navigate(`/boms/${newBom.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Create version {nextVersion}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>
            This will snapshot the current draft{" "}
            <strong>(Rev {bom?.revision_code} · v{bom?.version})</strong> and start version {nextVersion}.
          </p>
          <p className="text-xs text-muted-foreground">
            The new version is editable; v{bom?.version} is preserved as a read-only historical snapshot.
          </p>
          <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-0.5">
            <li>All {bomLines?.length || 0} component line{(bomLines?.length || 0) !== 1 ? "s" : ""} and variants will be cloned to v{nextVersion}</li>

            <li>The new version becomes your active editing target</li>
            <li>v{bom?.version} stays in the history but is no longer editable</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={working}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={working}>
            {working && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            Create version {nextVersion}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}