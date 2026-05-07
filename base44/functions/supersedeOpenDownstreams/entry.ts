/**
 * supersedeOpenDownstreams
 *
 * When a new ECO targets the same downstream artifact as a still-open prior ECO's downstream
 * row, marks all prior non-terminal rows as "superseded" so only the newest ECO's row is active.
 * Called by the propagation engine (Phase 4). The function exists now so Phase 4 can wire it.
 *
 * Payload:
 *   target_downstream_type  string  required  — the downstream artifact type
 *   target_downstream_id    string  required  — the downstream artifact id
 *   new_eco_id              string  required  — the incoming/newer ECO (its own rows are excluded)
 *
 * Returns: { success: true, superseded_count: number, superseded_row_ids: string[], failures?: object[] }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const NON_TERMINAL_STATUSES = ['pending', 'notified', 'under_review'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { target_downstream_type, target_downstream_id, new_eco_id } = await req.json();

    if (!target_downstream_type) return Response.json({ error: 'target_downstream_type is required' }, { status: 400 });
    if (!target_downstream_id) return Response.json({ error: 'target_downstream_id is required' }, { status: 400 });
    if (!new_eco_id) return Response.json({ error: 'new_eco_id is required' }, { status: 400 });

    // 1. Find all open downstream rows for this artifact, excluding the new ECO
    const candidates = await base44.asServiceRole.entities.ECOAffectedDownstream.filter({
      downstream_type: target_downstream_type,
      downstream_id: target_downstream_id,
      propagation_status: { $in: NON_TERMINAL_STATUSES },
    });

    const toSupersede = candidates.filter((r) => r.eco_id !== new_eco_id);

    const superseded_row_ids = [];
    const failures = [];

    // 2. Transition each to "superseded" via the canonical helper (inline logic to avoid cross-function import)
    const now = new Date().toISOString();
    for (const row of toSupersede) {
      try {
        await base44.asServiceRole.entities.ECOAffectedDownstream.update(row.id, {
          propagation_status: 'superseded',
          reviewed_at: now,
        });
        superseded_row_ids.push(row.id);
      } catch (err) {
        failures.push({ row_id: row.id, error: err.message });
        console.error(`Failed to supersede row ${row.id}: ${err.message}`);
      }
    }

    const response = {
      success: true,
      superseded_count: superseded_row_ids.length,
      superseded_row_ids,
    };

    if (failures.length > 0) {
      response.failures = failures;
    }

    return Response.json(response);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});