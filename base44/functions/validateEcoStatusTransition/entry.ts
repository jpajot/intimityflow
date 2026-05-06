/**
 * validateEcoStatusTransition
 *
 * Validates that an ECO status transition is legal and that required fields
 * are present for the target status.
 *
 * Payload: {
 *   eco_id: string,          // id of the ECO being updated
 *   from_status: string,     // current status
 *   to_status: string,       // desired status
 *   fields: object           // the full update payload being written (used to check required fields)
 * }
 *
 * Returns: { valid: true } or throws with a descriptive error message.
 *
 * Wiring: stands alone for now. Will be called from ECO update paths in later prompts.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_TRANSITIONS = {
  proposed:     ["under_review", "cancelled"],
  under_review: ["approved", "rejected", "proposed"],
  approved:     ["applied"],
  applied:      ["closed"],
};

function validateTransition(from, to, fields) {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid ECO status transition: ${from} → ${to} is not allowed. ` +
      `Allowed transitions from "${from}": ${allowed.length ? allowed.join(", ") : "none"}.`
    );
  }

  // Required fields per target status
  if (to === "applied") {
    if (!fields?.applied_at) {
      throw new Error(`Transition to "applied" requires applied_at to be set in the same write.`);
    }
  }

  if (to === "closed") {
    if (!fields?.closed_at) {
      throw new Error(`Transition to "closed" requires closed_at to be set in the same write.`);
    }
  }

  if (to === "approved" || to === "rejected") {
    if (!fields?.approver_id) {
      throw new Error(`Transition to "${to}" requires approver_id to be set in the same write.`);
    }
    if (!fields?.approved_at) {
      throw new Error(`Transition to "${to}" requires approved_at to be set in the same write.`);
    }
  }

  return { valid: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eco_id, from_status, to_status, fields } = await req.json();

    if (!from_status || !to_status) {
      return Response.json({ error: 'from_status and to_status are required' }, { status: 400 });
    }

    const result = validateTransition(from_status, to_status, fields || {});
    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
});