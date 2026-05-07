/**
 * detectTrackedFieldChanges
 *
 * Compares two record snapshots against the active RevisionTrackedField config
 * for a given target_type. Returns whether any tracked fields changed, plus
 * the filtered before/after snapshots and field_diffs array.
 *
 * Called by the UI BEFORE persisting a Product or ProductColor edit to decide
 * whether to prompt the user for a revision_context.
 *
 * Payload:
 *   target_type    string   required  — product | product_color | ...
 *   before_record  object   required  — full record state before edit
 *   after_record   object   required  — full record state after edit (candidate)
 *
 * Returns: {
 *   has_tracked_changes: boolean,
 *   before_snapshot: object,
 *   after_snapshot: object,
 *   field_diffs: Array<{ field, before, after }>
 * }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { target_type, before_record, after_record } = await req.json();

    if (!target_type) return Response.json({ error: 'target_type is required' }, { status: 400 });
    if (!before_record || !after_record) return Response.json({ error: 'before_record and after_record are required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Load active tracked fields for this target_type
    const trackedFields = await svc.entities.RevisionTrackedField.filter({
      target_type,
      is_active: true,
    });

    const before_snapshot = {};
    const after_snapshot = {};
    const field_diffs = [];

    for (const tf of trackedFields) {
      const fieldName = tf.field_name;
      const beforeVal = before_record[fieldName] ?? null;
      const afterVal = after_record[fieldName] ?? null;

      // Include in snapshot
      before_snapshot[fieldName] = beforeVal;
      after_snapshot[fieldName] = afterVal;

      // Check for change (JSON comparison for objects/arrays)
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        field_diffs.push({ field: fieldName, before: beforeVal, after: afterVal });
      }
    }

    // Sort diffs alphabetically
    field_diffs.sort((a, b) => a.field.localeCompare(b.field));

    return Response.json({
      has_tracked_changes: field_diffs.length > 0,
      before_snapshot,
      after_snapshot,
      field_diffs,
    });

  } catch (error) {
    console.error(`[detectTrackedFieldChanges] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});