/**
 * recountBomPendingEcoReviews
 *
 * Reconcile / repair function for pending_eco_review_count drift on BOM records.
 * Recomputes the correct count from ECOAffectedDownstream source of truth and
 * updates any BOM records where the cached value is wrong.
 *
 * Payload:
 *   bom_id  string  optional — if provided, process only that BOM; if omitted, process ALL BOMs.
 *
 * Returns: {
 *   success: true,
 *   processed: number,
 *   updated: number,
 *   mismatches: Array<{ bom_id, before, after }>
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
    const { bom_id } = body;

    // Load target BOMs
    let boms;
    if (bom_id) {
      boms = await base44.asServiceRole.entities.BOM.filter({ id: bom_id });
      if (boms.length === 0) {
        return Response.json({ error: `BOM not found: ${bom_id}` }, { status: 404 });
      }
    } else {
      boms = await base44.asServiceRole.entities.BOM.list('-created_date', 2000);
    }

    const mismatches = [];
    let updated = 0;

    for (const bom of boms) {
      // Count non-terminal ECOAffectedDownstream rows targeting this BOM
      const rows = await base44.asServiceRole.entities.ECOAffectedDownstream.filter({
        downstream_type: 'BOM',
        downstream_id: bom.id,
        propagation_status: { $in: NON_TERMINAL_STATUSES },
      });
      const correctCount = rows.length;
      const cachedCount = bom.pending_eco_review_count || 0;

      if (correctCount !== cachedCount) {
        await base44.asServiceRole.entities.BOM.update(bom.id, { pending_eco_review_count: correctCount });
        mismatches.push({ bom_id: bom.id, before: cachedCount, after: correctCount });
        updated++;
      }
    }

    return Response.json({
      success: true,
      processed: boms.length,
      updated,
      mismatches,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});