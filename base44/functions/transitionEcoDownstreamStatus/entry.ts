/**
 * transitionEcoDownstreamStatus
 *
 * Validates and applies a propagation_status transition on an ECOAffectedDownstream row.
 * Enforces the allowed transition state machine, flow-specific guards, required side fields,
 * and decrements pending_eco_review_count on the targeted BOM or BOL when a row leaves a
 * non-terminal state and enters a terminal state (best-effort cache; failures are logged, not fatal).
 *
 * Payload:
 *   downstream_row_id        string   required
 *   new_status               string   required
 *   reviewed_by              string   optional  — required for user-driven terminal states (adopted, partially_adopted, rejected, pinned)
 *   resulting_artifact_type  string   optional  — required for adopted / partially_adopted
 *   resulting_artifact_id    string   optional  — required for adopted / partially_adopted
 *   decision_notes           string   optional  — required for rejected / partially_adopted
 *   is_system_call           boolean  optional  — must be true to allow → superseded
 *
 * Returns: { success: true, propagation_status: string }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Allowed transitions: from_status → [to_status, ...]
const TRANSITIONS = {
  pending:      ['notified', 'not_applicable'],
  notified:     ['under_review', 'not_applicable'],
  under_review: ['adopted', 'partially_adopted', 'rejected', 'pinned', 'not_applicable'],
};

const NON_TERMINAL_STATUSES = new Set(['pending', 'notified', 'under_review']);
const TERMINAL_USER_ACTION_STATUSES = new Set(['adopted', 'partially_adopted', 'rejected', 'pinned']);
const ALL_TERMINAL_STATUSES = new Set(['adopted', 'partially_adopted', 'rejected', 'pinned', 'superseded', 'not_applicable']);

// ── Inline count decrement helper ─────────────────────────────────────────────
// Cannot import from sibling functions in Deno; logic is inlined.
// Decrements pending_eco_review_count with a floor of 0. Only BOM and BOL carry this field in v1.
async function decrementPendingEcoReviewCount(base44ServiceRole, downstream_type, downstream_id) {
  try {
    if (downstream_type === 'BOM') {
      const records = await base44ServiceRole.entities.BOM.filter({ id: downstream_id });
      if (records.length === 0) {
        console.warn(`[transitionEcoDownstreamStatus] BOM not found for count decrement: ${downstream_id}`);
        return;
      }
      const current = records[0].pending_eco_review_count || 0;
      const next = Math.max(0, current - 1);
      await base44ServiceRole.entities.BOM.update(downstream_id, { pending_eco_review_count: next });
    } else if (downstream_type === 'BOL') {
      const records = await base44ServiceRole.entities.BOL.filter({ id: downstream_id });
      if (records.length === 0) {
        console.warn(`[transitionEcoDownstreamStatus] BOL not found for count decrement: ${downstream_id}`);
        return;
      }
      const current = records[0].pending_eco_review_count || 0;
      const next = Math.max(0, current - 1);
      await base44ServiceRole.entities.BOL.update(downstream_id, { pending_eco_review_count: next });
    }
    // BOMLineVariant and BOMLine: no count field in v1 — do nothing.
  } catch (err) {
    console.error(`[transitionEcoDownstreamStatus] Failed to decrement pending_eco_review_count for ${downstream_type}/${downstream_id}: ${err.message}`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      downstream_row_id,
      new_status,
      reviewed_by = null,
      resulting_artifact_type = null,
      resulting_artifact_id = null,
      decision_notes = null,
      is_system_call = false,
    } = await req.json();

    if (!downstream_row_id) return Response.json({ error: 'downstream_row_id is required' }, { status: 400 });
    if (!new_status) return Response.json({ error: 'new_status is required' }, { status: 400 });

    // 1. Load the row
    const rows = await base44.asServiceRole.entities.ECOAffectedDownstream.filter({ id: downstream_row_id });
    if (rows.length === 0) {
      return Response.json({ error: `ECOAffectedDownstream not found: ${downstream_row_id}` }, { status: 404 });
    }
    const row = rows[0];
    const current_status = row.propagation_status;

    // 2. Validate transition
    if (new_status === 'superseded') {
      // Special case: any non-terminal → superseded, system-only
      if (!is_system_call) {
        return Response.json({ error: 'Transition to "superseded" is reserved for system calls only. Set is_system_call: true.' }, { status: 400 });
      }
      if (!NON_TERMINAL_STATUSES.has(current_status)) {
        return Response.json({ error: `Cannot transition to "superseded": current status "${current_status}" is already terminal.` }, { status: 400 });
      }
    } else if (new_status === 'not_applicable' && NON_TERMINAL_STATUSES.has(current_status)) {
      // not_applicable is reachable from any non-terminal — already in TRANSITIONS map
      const allowed = TRANSITIONS[current_status] || [];
      if (!allowed.includes(new_status)) {
        return Response.json({ error: `Invalid transition: "${current_status}" → "${new_status}". Allowed from "${current_status}": ${(TRANSITIONS[current_status] || []).join(', ') || 'none'}.` }, { status: 400 });
      }
    } else {
      const allowed = TRANSITIONS[current_status] || [];
      if (!allowed.includes(new_status)) {
        return Response.json({
          error: `Invalid transition: "${current_status}" → "${new_status}". Allowed from "${current_status}": ${allowed.join(', ') || 'none (terminal state)'}.`,
        }, { status: 400 });
      }
    }

    // 3. Flow-specific guards
    if (new_status === 'pinned' && row.flow_type !== 'C_sourcing_change') {
      return Response.json({ error: `"pinned" is only valid for rows with flow_type = "C_sourcing_change". This row has flow_type = "${row.flow_type}".` }, { status: 400 });
    }

    // 4. Required-field guards
    if (new_status === 'adopted' || new_status === 'partially_adopted') {
      if (!resulting_artifact_type) {
        return Response.json({ error: `Transition to "${new_status}" requires resulting_artifact_type.` }, { status: 400 });
      }
      if (!resulting_artifact_id) {
        return Response.json({ error: `Transition to "${new_status}" requires resulting_artifact_id.` }, { status: 400 });
      }
    }

    if (new_status === 'rejected' || new_status === 'partially_adopted') {
      if (!decision_notes) {
        return Response.json({ error: `Transition to "${new_status}" requires decision_notes.` }, { status: 400 });
      }
    }

    // Guard: reviewed_by is required for user-driven terminal state transitions
    if (TERMINAL_USER_ACTION_STATUSES.has(new_status) && !is_system_call) {
      if (!reviewed_by || (typeof reviewed_by === 'string' && reviewed_by.trim() === '')) {
        return Response.json({ error: `reviewed_by is required for user-driven transitions to terminal states (${new_status}).` }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const updates = { propagation_status: new_status };

    // Set resulting artifact fields
    if (resulting_artifact_type) updates.resulting_artifact_type = resulting_artifact_type;
    if (resulting_artifact_id) updates.resulting_artifact_id = resulting_artifact_id;
    if (decision_notes) updates.decision_notes = decision_notes;

    // Terminal user-action states: set reviewed_by + reviewed_at
    if (TERMINAL_USER_ACTION_STATUSES.has(new_status) || new_status === 'not_applicable') {
      updates.reviewed_at = now;
      if (reviewed_by) updates.reviewed_by = reviewed_by;
    }

    // pending → notified: set notification_sent_at
    if (new_status === 'notified') {
      updates.notification_sent_at = now;
    }

    // 5. Apply the update
    await base44.asServiceRole.entities.ECOAffectedDownstream.update(downstream_row_id, updates);

    // 6. Decrement pending_eco_review_count if transitioning from non-terminal → terminal (best-effort)
    const was_non_terminal = NON_TERMINAL_STATUSES.has(current_status);
    const is_now_terminal = ALL_TERMINAL_STATUSES.has(new_status);
    if (was_non_terminal && is_now_terminal) {
      await decrementPendingEcoReviewCount(base44.asServiceRole, row.downstream_type, row.downstream_id);
    }

    return Response.json({ success: true, propagation_status: new_status });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});