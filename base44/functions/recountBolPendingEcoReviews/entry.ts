/**
 * recountBolPendingEcoReviews
 *
 * Reconcile / repair function for pending_eco_review_count drift on BOL records.
 * Recomputes the correct count from ECOAffectedDownstream source of truth and
 * updates any BOL records where the cached value is wrong.
 *
 * Payload:
 *   bol_id  string  optional — if provided, process only that BOL; if omitted, process ALL BOLs.
 *
 * Returns: {
 *   success: true,
 *   processed: number,
 *   updated: number,
 *   mismatches: Array<{ bol_id, before, after }>
 * }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const NON_TERMINAL_STATUSES = ['pending', 'notified', 'under_review'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { bol_id } = body;

    // Load target BOLs
    let bols;
    if (bol_id) {
      bols = await base44.asServiceRole.entities.BOL.filter({ id: bol_id });
      if (bols.length === 0) {
        return Response.json({ error: `BOL not found: ${bol_id}` }, { status: 404 });
      }
    } else {
      bols = await base44.asServiceRole.entities.BOL.list('-created_date', 2000);
    }

    const mismatches = [];
    let updated = 0;

    for (const bol of bols) {
      // Count non-terminal ECOAffectedDownstream rows targeting this BOL
      const rows = await base44.asServiceRole.entities.ECOAffectedDownstream.filter({
        downstream_type: 'BOL',
        downstream_id: bol.id,
        propagation_status: { $in: NON_TERMINAL_STATUSES },
      });
      const correctCount = rows.length;
      const cachedCount = bol.pending_eco_review_count || 0;

      if (correctCount !== cachedCount) {
        await base44.asServiceRole.entities.BOL.update(bol.id, { pending_eco_review_count: correctCount });
        mismatches.push({ bol_id: bol.id, before: cachedCount, after: correctCount });
        updated++;
      }
    }

    return Response.json({
      success: true,
      processed: bols.length,
      updated,
      mismatches,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});