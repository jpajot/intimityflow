/**
 * addEcoAffectedDownstream
 *
 * Canonical entry point for attaching a downstream artifact row to an ECO.
 * Validates inputs, enforces deduplication, inherits priority from parent ECO,
 * inserts an ECOAffectedDownstream record, and increments pending_eco_review_count
 * on the targeted BOM or BOL (best-effort cache; failures are logged, not fatal).
 *
 * Payload:
 *   eco_id                       string   required
 *   downstream_type              string   required  — BOM | BOL | BOMLineVariant | BOMLine
 *   downstream_id                string   required
 *   flow_type                    string   required  — A_dev_bom_release | B_routing_change | C_sourcing_change | D_component_revision | manual
 *   triggering_affected_item_id  string   optional  — FK → ECOAffectedItem (must belong to same ECO)
 *   downstream_label             string   optional
 *   priority                     string   optional  — low | normal | high | critical (defaults to parent ECO.priority)
 *
 * Returns: { success: true, downstream_row_id: string }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_DOWNSTREAM_TYPES = ['BOM', 'BOL', 'BOMLineVariant', 'BOMLine'];
const ALLOWED_FLOW_TYPES = ['A_dev_bom_release', 'B_routing_change', 'C_sourcing_change', 'D_component_revision', 'manual'];
const ALLOWED_PRIORITIES = ['low', 'normal', 'high', 'critical'];

// ── Inline count increment helper ─────────────────────────────────────────────
// Cannot import from sibling functions in Deno; logic is inlined.
// Only BOM and BOL carry pending_eco_review_count in v1.
async function incrementPendingEcoReviewCount(base44ServiceRole, downstream_type, downstream_id) {
  try {
    if (downstream_type === 'BOM') {
      const records = await base44ServiceRole.entities.BOM.filter({ id: downstream_id });
      if (records.length === 0) {
        console.warn(`[addEcoAffectedDownstream] BOM not found for count increment: ${downstream_id}`);
        return;
      }
      const current = records[0].pending_eco_review_count || 0;
      await base44ServiceRole.entities.BOM.update(downstream_id, { pending_eco_review_count: current + 1 });
    } else if (downstream_type === 'BOL') {
      const records = await base44ServiceRole.entities.BOL.filter({ id: downstream_id });
      if (records.length === 0) {
        console.warn(`[addEcoAffectedDownstream] BOL not found for count increment: ${downstream_id}`);
        return;
      }
      const current = records[0].pending_eco_review_count || 0;
      await base44ServiceRole.entities.BOL.update(downstream_id, { pending_eco_review_count: current + 1 });
    }
    // BOMLineVariant and BOMLine: no count field in v1 — do nothing.
  } catch (err) {
    console.error(`[addEcoAffectedDownstream] Failed to increment pending_eco_review_count for ${downstream_type}/${downstream_id}: ${err.message}`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      eco_id,
      downstream_type,
      downstream_id,
      flow_type,
      triggering_affected_item_id = null,
      downstream_label = null,
      priority: inputPriority = null,
    } = await req.json();

    // 1. Required fields
    if (!eco_id) return Response.json({ error: 'eco_id is required' }, { status: 400 });
    if (!downstream_type) return Response.json({ error: 'downstream_type is required' }, { status: 400 });
    if (!downstream_id) return Response.json({ error: 'downstream_id is required' }, { status: 400 });
    if (!flow_type) return Response.json({ error: 'flow_type is required' }, { status: 400 });

    // 2. Validate downstream_type
    if (!ALLOWED_DOWNSTREAM_TYPES.includes(downstream_type)) {
      return Response.json({ error: `Invalid downstream_type "${downstream_type}". Allowed: ${ALLOWED_DOWNSTREAM_TYPES.join(', ')}` }, { status: 400 });
    }

    // 3. Validate flow_type
    if (!ALLOWED_FLOW_TYPES.includes(flow_type)) {
      return Response.json({ error: `Invalid flow_type "${flow_type}". Allowed: ${ALLOWED_FLOW_TYPES.join(', ')}` }, { status: 400 });
    }

    // 4. Validate priority if supplied
    if (inputPriority && !ALLOWED_PRIORITIES.includes(inputPriority)) {
      return Response.json({ error: `Invalid priority "${inputPriority}". Allowed: ${ALLOWED_PRIORITIES.join(', ')}` }, { status: 400 });
    }

    // 1 (cont). Validate ECO exists — also used for priority inheritance
    const ecos = await base44.asServiceRole.entities.ECO.filter({ id: eco_id });
    if (ecos.length === 0) {
      return Response.json({ error: `ECO not found: ${eco_id}` }, { status: 404 });
    }
    const eco = ecos[0];

    // 4. Validate triggering_affected_item_id if provided
    if (triggering_affected_item_id) {
      const items = await base44.asServiceRole.entities.ECOAffectedItem.filter({ id: triggering_affected_item_id });
      if (items.length === 0) {
        return Response.json({ error: `ECOAffectedItem not found: ${triggering_affected_item_id}` }, { status: 404 });
      }
      if (items[0].eco_id !== eco_id) {
        return Response.json({ error: 'triggering_affected_item_id does not belong to the same ECO.' }, { status: 400 });
      }
    }

    // 5. Deduplication guard — no duplicate (eco_id, downstream_type, downstream_id)
    const existing = await base44.asServiceRole.entities.ECOAffectedDownstream.filter({
      eco_id,
      downstream_type,
      downstream_id,
    });
    if (existing.length > 0) {
      return Response.json({
        error: `Downstream already tracked: ${existing[0].id}.`,
      }, { status: 409 });
    }

    // 6. Priority inheritance from parent ECO
    const priority = inputPriority || eco.priority || 'normal';

    // 7. Insert
    const record = await base44.asServiceRole.entities.ECOAffectedDownstream.create({
      eco_id,
      downstream_type,
      downstream_id,
      downstream_label: downstream_label || null,
      flow_type,
      triggering_affected_item_id: triggering_affected_item_id || null,
      propagation_status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      resulting_artifact_type: null,
      resulting_artifact_id: null,
      decision_notes: null,
      notification_sent_at: null,
      priority,
    });

    // 8. Increment pending_eco_review_count on the targeted artifact (best-effort)
    await incrementPendingEcoReviewCount(base44.asServiceRole, downstream_type, downstream_id);

    return Response.json({ success: true, downstream_row_id: record.id });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});