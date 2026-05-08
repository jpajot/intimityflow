/**
 * EcoTransitionModals
 * All confirmation modals for ECO status transitions.
 * Exported individually: ApproveModal, SendBackModal, CancelModal, RejectModal, ApplyNowModal
 */
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// ── Approve Modal ──────────────────────────────────────────────────────────────
export function ApproveModal({ open, onClose, eco, affectedItems, onConfirm, loading }) {
  const [confirmed, setConfirmed] = useState(false);
  const [approver, setApprover] = useState("");
  const [previewCount, setPreviewCount] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!open) { setConfirmed(false); setPreviewCount(null); return; }
    // Pre-fill current user email
    base44.auth.me().then(u => setApprover(u?.email || "")).catch(() => {});
    // Preview downstream count by calling getWhereUsed for each affected item
    if (affectedItems?.length > 0) {
      setPreviewing(true);
      Promise.all(
        affectedItems.map(item =>
          base44.functions.invoke("getWhereUsed", { entity_type: item.item_type, entity_id: item.item_id })
            .then(res => {
              const groups = res.data?.groups || [];
              // Count only downstream-eligible types: BOMLineVariant, BOM, BOL, BOMLine
              const eligibleTypes = new Set(['BOMLineVariant', 'BOM', 'BOL', 'BOMLine']);
              return groups.filter(g => eligibleTypes.has(g.downstream_type)).reduce((sum, g) => sum + (g.count || 0), 0);
            })
            .catch(() => 0)
        )
      ).then(counts => {
        setPreviewCount(counts.reduce((a, b) => a + b, 0));
        setPreviewing(false);
      });
    } else {
      setPreviewCount(0);
      setPreviewing(false);
    }
  }, [open, affectedItems]);

  const nItems = affectedItems?.length || 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Approve ECO {eco?.eco_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
            <p>
              <span className="font-semibold">{nItems}</span> affected item{nItems !== 1 ? "s" : ""} will be applied.
            </p>
            <p>
              {previewing ? (
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Computing downstream estimate…
                </span>
              ) : (
                <span>
                  <span className="font-semibold">{previewCount ?? "?"}</span> downstream artifact{previewCount !== 1 ? "s" : ""} will be flagged for review.
                </span>
              )}
            </p>
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="approve-confirm"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="approve-confirm" className="text-sm cursor-pointer leading-snug">
              I understand this will modify <strong>{nItems}</strong> target {nItems !== 1 ? "entities" : "entity"} and create{" "}
              <strong>{previewCount ?? "?"}</strong> downstream review{previewCount !== 1 ? "s" : ""}.
            </label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Approver</Label>
            <Input
              value={approver}
              onChange={e => setApprover(e.target.value)}
              placeholder="approver@example.com"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            size="sm"
            disabled={!confirmed || !approver.trim() || loading || previewing}
            onClick={() => onConfirm({ approver_id: approver.trim() })}
            className="gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Approve and apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Send Back Modal ────────────────────────────────────────────────────────────
export function SendBackModal({ open, onClose, eco, onConfirm, loading }) {
  const [reason, setReason] = useState("");

  useEffect(() => { if (!open) setReason(""); }, [open]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Send ECO back for revisions</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">This will return the ECO to "proposed" status. Your reason will be appended to the ECO notes.</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Why are you sending this back? <span className="text-destructive">*</span></Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe what needs to be revised…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            size="sm"
            disabled={!reason.trim() || loading}
            onClick={() => onConfirm({ notes_append: `Sent back for revisions: ${reason.trim()}` })}
            className="gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Send back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Cancel Modal ───────────────────────────────────────────────────────────────
export function CancelModal({ open, onClose, eco, onConfirm, loading }) {
  const [reason, setReason] = useState("");

  useEffect(() => { if (!open) setReason(""); }, [open]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Cancel ECO {eco?.eco_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">Cancelled ECOs cannot be reopened.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cancellation reason <span className="text-destructive">*</span></Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why is this ECO being cancelled?"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Don't cancel</Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!reason.trim() || loading}
            onClick={() => onConfirm({ cancellation_reason: reason.trim() })}
            className="gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Cancel ECO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Reject Modal ───────────────────────────────────────────────────────────────
export function RejectModal({ open, onClose, eco, onConfirm, loading }) {
  const [reason, setReason] = useState("");

  useEffect(() => { if (!open) setReason(""); }, [open]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Reject ECO {eco?.eco_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Rejected ECOs cannot be reopened. The requester can file a new ECO if they want to revise the proposal.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Rejection reason <span className="text-destructive">*</span></Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why are you rejecting this ECO?"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Don't reject</Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!reason.trim() || loading}
            onClick={() => onConfirm({ rejection_reason: reason.trim() })}
            className="gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Apply Now Modal ────────────────────────────────────────────────────────────
export function ApplyNowModal({ open, onClose, eco, onConfirm, loading }) {
  const ted = eco?.target_effective_date;
  const formattedDate = ted ? new Date(ted).toLocaleDateString() : null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Apply ECO now?</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            {formattedDate
              ? `This ECO was originally scheduled to apply on ${formattedDate}. Applying now will immediately commit all affected item changes.`
              : "This will immediately commit all affected item changes and create downstream review tasks."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            size="sm"
            disabled={loading}
            onClick={() => onConfirm({})}
            className="gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Apply now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}