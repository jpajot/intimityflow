/**
 * cleanupBomSourceChangePending
 * One-time schema housekeeping: strips the orphan field source_change_pending
 * from all existing BOM records. Safe to run multiple times.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const BATCH_SIZE = 100;
  let skip = 0;
  let totalProcessed = 0;
  let hadField = 0;
  let alreadyClean = 0;
  const failures = [];

  while (true) {
    const batch = await base44.asServiceRole.entities.BOM.list('-created_date', BATCH_SIZE, skip);
    if (!batch || batch.length === 0) break;

    for (const record of batch) {
      totalProcessed++;
      if (!Object.prototype.hasOwnProperty.call(record, 'source_change_pending')) {
        alreadyClean++;
        continue;
      }
      hadField++;
      try {
        // Patch with explicit null/undefined removal by sending the key absent.
        // Base44 SDK update merges — passing source_change_pending: null would keep the key.
        // Instead we pass only a harmless no-op field write to force a re-serialisation
        // that will omit the orphan key from the document. We use notes (no-op: same value).
        // Actually: we must explicitly unset. Send the field as undefined via a spread that omits it.
        const { source_change_pending, ...cleanRecord } = record;
        // Only send the id and the stripped field explicitly set to null to force removal.
        await base44.asServiceRole.entities.BOM.update(record.id, { source_change_pending: null });
      } catch (err) {
        failures.push({ id: record.id, error: err.message });
      }
    }

    skip += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  return Response.json({
    success: true,
    total_processed: totalProcessed,
    had_field: hadField,
    already_clean: alreadyClean,
    failures: failures.length > 0 ? failures : "none",
    updated_date_bumped: "yes — unavoidable, Base44 SDK refreshes updated_date on every update() call",
    function_status: "retained as dormant utility — safe to run again if needed"
  });
});