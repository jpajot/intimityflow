/**
 * RevisionContextModal
 *
 * Shown when a tracked-field edit is detected, or when the user clicks "New Revision".
 * Collects revision_context (required) before persisting the change.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, GitCommit } from "lucide-react";

export default function RevisionContextModal({ open, onClose, onConfirm, title, subtitle, saving }) {
  const [context, setContext] = useState("");

  useEffect(() => {
    if (open) setContext("");
  }, [open]);

  const handleConfirm = () => {
    if (!context.trim()) return;
    onConfirm(context.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-primary" />
            {title || "New Revision"}
          </DialogTitle>
        </DialogHeader>
        {subtitle && (
          <p className="text-xs text-muted-foreground -mt-1">{subtitle}</p>
        )}
        <div className="space-y-2">
          <Label className="text-xs">Revision context <span className="text-destructive">*</span></Label>
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Describe why this change is being made…"
            rows={3}
            autoFocus
          />
          <p className="text-[10px] text-muted-foreground">Required — explains why this revision was created.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!context.trim() || saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm &amp; Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}