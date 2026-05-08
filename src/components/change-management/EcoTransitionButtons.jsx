/**
 * EcoTransitionButtons
 * Renders the correct set of transition buttons based on ECO state.
 * Used in EcoDetailPage sticky header.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, X, RotateCcw, Archive, Clock, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import {
  ApproveModal, SendBackModal, CancelModal, RejectModal, ApplyNowModal,
} from "@/components/change-management/EcoTransitionModals";

// Badge counts ALL non-terminal ECOAffectedDownstream rows for this ECO,
// regardless of downstream_type. BOM/BOL/BOMLineVariant/BOMLine all contribute.
// (Note: BOM/BOL counts on the entity records are separate denormalized caches
// for inbox badges; this badge counts the propagation rows directly.)
const NON_TERMINAL_DOWNSTREAM = new Set(['pending', 'notified', 'under_review']);

export default function EcoTransitionButtons({ eco, affectedItems, affectedDownstream, onTransitioned }) {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(null); // 'approve' | 'sendback' | 'cancel' | 'reject' | 'applynow'
  const [transitioning, setTransitioning] = useState(false);

  if (!eco) return null;

  const { status, origin } = eco;

  // Manual-eligible origins: manual + ecr_conversion
  const isManual = origin === "manual" || origin === "ecr_conversion";

  // Non-terminal downstream count
  const openDownstreamCount = (affectedDownstream || []).filter(r => NON_TERMINAL_DOWNSTREAM.has(r.propagation_status)).length;
  const allDownstreamTerminal = openDownstreamCount === 0;
  // Only show close if there are no non-terminal AND there's at least 1 downstream row (or ECO was applied with 0 downstream)
  const canClose = allDownstreamTerminal;

  // ── Core transition caller ───────────────────────────────────────────────────
  async function doTransition(new_status, extra = {}) {
    setTransitioning(true);
    try {
      const res = await base44.functions.invoke("transitionEcoStatus", {
        eco_id: eco.id,
        new_status,
        auto_apply_on_approve: true,
        ...extra,
      });

      const data = res.data;

      if (!data.success && data.error) {
        toast({ title: "Transition failed", description: data.error, variant: "destructive" });
        return;
      }

      // Build success toast message
      let description = `ECO moved to ${data.final_status}.`;
      if (data.affected_items_applied != null && data.affected_items_applied > 0) {
        description += ` ${data.affected_items_applied} item(s) applied.`;
      }
      if (data.affected_downstream_created != null && data.affected_downstream_created > 0) {
        description += ` ${data.affected_downstream_created} downstream review(s) created.`;
      }
      if (data.application_errors?.length > 0) {
        description += ` ${data.application_errors.length} item(s) failed to apply.`;
      }

      toast({ title: "Transition successful", description });
      setModalOpen(null);
      onTransitioned?.();
    } catch (err) {
      toast({ title: "Transition failed", description: err?.response?.data?.error || err?.message, variant: "destructive" });
    } finally {
      setTransitioning(false);
    }
  }

  // ── Terminal states — no buttons ─────────────────────────────────────────────
  if (status === 'rejected' || status === 'cancelled' || status === 'closed') {
    return null;
  }

  // ── Applied state: Close button or awaiting text ─────────────────────────────
  if (status === 'applied') {
    return (
      <>
        {canClose ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            disabled={transitioning}
            onClick={() => doTransition('closed')}
          >
            {transitioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
            Close ECO
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Awaiting downstream review ({openDownstreamCount} open)
          </span>
        )}
      </>
    );
  }

  // ── Approved state: Apply Now (if not yet applied) or auto-applied text ───────
  if (status === 'approved') {
    if (eco.applied_at) {
      return (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          Auto-applied at {new Date(eco.applied_at).toLocaleString()}
        </span>
      );
    }
    return (
      <>
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5"
          disabled={transitioning}
          onClick={() => setModalOpen('applynow')}
        >
          Apply now
        </Button>
        <ApplyNowModal
          open={modalOpen === 'applynow'}
          onClose={() => setModalOpen(null)}
          eco={eco}
          loading={transitioning}
          onConfirm={() => doTransition('applied')}
        />
      </>
    );
  }

  // ── Proposed state (manual/ecr_conversion only) ───────────────────────────────
  if (status === 'proposed' && isManual) {
    return (
      <>
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5"
          disabled={transitioning}
          onClick={() => doTransition('under_review')}
        >
          {transitioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Submit for review
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
          disabled={transitioning}
          onClick={() => setModalOpen('cancel')}
        >
          <X className="w-3.5 h-3.5" />
          Cancel ECO
        </Button>
        <CancelModal
          open={modalOpen === 'cancel'}
          onClose={() => setModalOpen(null)}
          eco={eco}
          loading={transitioning}
          onConfirm={({ cancellation_reason }) => doTransition('cancelled', { cancellation_reason })}
        />
      </>
    );
  }

  // ── Under review state (manual/ecr_conversion) ────────────────────────────────
  if (status === 'under_review' && isManual) {
    return (
      <>
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5"
          disabled={transitioning}
          onClick={() => setModalOpen('approve')}
        >
          {transitioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          disabled={transitioning}
          onClick={() => setModalOpen('sendback')}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Send back
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
          disabled={transitioning}
          onClick={() => setModalOpen('reject')}
        >
          <X className="w-3.5 h-3.5" />
          Reject
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 text-destructive/70 border-destructive/20 hover:bg-destructive/5"
          disabled={transitioning}
          onClick={() => setModalOpen('cancel')}
        >
          Cancel ECO
        </Button>

        <ApproveModal
          open={modalOpen === 'approve'}
          onClose={() => setModalOpen(null)}
          eco={eco}
          affectedItems={affectedItems}
          loading={transitioning}
          onConfirm={({ approver_id }) => doTransition('approved', { approver_id })}
        />
        <SendBackModal
          open={modalOpen === 'sendback'}
          onClose={() => setModalOpen(null)}
          eco={eco}
          loading={transitioning}
          onConfirm={({ notes_append }) => doTransition('proposed', { notes_append })}
        />
        <RejectModal
          open={modalOpen === 'reject'}
          onClose={() => setModalOpen(null)}
          eco={eco}
          loading={transitioning}
          onConfirm={({ rejection_reason }) => doTransition('rejected', { rejection_reason })}
        />
        <CancelModal
          open={modalOpen === 'cancel'}
          onClose={() => setModalOpen(null)}
          eco={eco}
          loading={transitioning}
          onConfirm={({ cancellation_reason }) => doTransition('cancelled', { cancellation_reason })}
        />
      </>
    );
  }

  // Auto-generated ECOs in applied state are handled above (the status === 'applied' branch fires for all origins)
  return null;
}