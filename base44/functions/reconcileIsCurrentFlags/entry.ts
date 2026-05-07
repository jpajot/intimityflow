/**
 * reconcileIsCurrentFlags
 *
 * Drift-recovery function for ProductRevision.is_current inconsistencies.
 * Groups all rows by (product_id, target_type, target_id) and ensures exactly
 * one row per group has is_current = true (the most-recently-created one).
 *
 * Payload:
 *   product_id  string   optional — if provided, scope to that product only
 *
 * Returns: {
 *   success: boolean,
 *   processed: number,
 *   fixed: Array<{ product_id, target_type, target_id, before_count, after_count }>
 * }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { product_id } = body;

    const svc = base44.asServiceRole;

    // Load target revisions
    let revisions;
    if (product_id) {
      revisions = await svc.entities.ProductRevision.filter({ product_id }, '-created_date', 2000);
    } else {
      revisions = await svc.entities.ProductRevision.list('-created_date', 5000);
    }

    // Group by (product_id, target_type, target_id)
    const groups = new Map();
    for (const rev of revisions) {
      const key = `${rev.product_id}||${rev.target_type}||${rev.target_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(rev);
    }

    const fixed = [];
    let processed = 0;

    for (const [key, rows] of groups.entries()) {
      processed++;
      const currentRows = rows.filter(r => r.is_current === true);

      if (currentRows.length === 1) continue; // OK

      // Sort by created_date descending — most recent first
      const sorted = [...rows].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      const winnerRow = sorted[0];

      const [pid, ttype, tid] = key.split('||');
      const before_count = currentRows.length;

      // Set winner to true (may already be, but ensure it)
      if (!winnerRow.is_current) {
        await svc.entities.ProductRevision.update(winnerRow.id, { is_current: true });
      }

      // Set all others to false
      const others = rows.filter(r => r.id !== winnerRow.id && r.is_current);
      for (const row of others) {
        await svc.entities.ProductRevision.update(row.id, { is_current: false });
      }

      fixed.push({
        product_id: pid,
        target_type: ttype,
        target_id: tid,
        before_count,
        after_count: 1,
      });

      console.log(`[reconcileIsCurrentFlags] Fixed (${pid}, ${ttype}, ${tid}): ${before_count} → 1 is_current`);
    }

    return Response.json({
      success: true,
      processed,
      fixed,
    });

  } catch (error) {
    console.error(`[reconcileIsCurrentFlags] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});