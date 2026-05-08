/**
 * backfillListViewConfigFields
 *
 * One-time migration: adds is_system=false and display_mode (list|gallery)
 * to all existing ListViewConfig records that lack these fields.
 *
 * display_mode logic:
 *   - If thumb_size is set (any non-null value) → display_mode = "gallery"
 *   - Otherwise → display_mode = "list"
 *
 * Safe to re-run: only updates records missing the fields.
 *
 * Returns: { success, total, updated_count, list_count, gallery_count, duration_ms }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const svc = base44.asServiceRole;
    const start = Date.now();

    const all = await svc.entities.ListViewConfig.list('-created_date', 500);
    const total = all.length;

    let updated_count = 0;
    let list_count = 0;
    let gallery_count = 0;

    for (const rec of all) {
      const needsUpdate = rec.is_system === undefined || rec.is_system === null || rec.display_mode === undefined || rec.display_mode === null;
      const display_mode = rec.thumb_size ? 'gallery' : 'list';
      if (display_mode === 'gallery') gallery_count++;
      else list_count++;

      if (needsUpdate) {
        await svc.entities.ListViewConfig.update(rec.id, {
          is_system: rec.is_system ?? false,
          display_mode: rec.display_mode ?? display_mode,
        });
        updated_count++;
      }
    }

    const duration_ms = Date.now() - start;
    console.log(`[backfillListViewConfigFields] total=${total} updated=${updated_count} list=${list_count} gallery=${gallery_count} duration=${duration_ms}ms`);

    return Response.json({ success: true, total, updated_count, list_count, gallery_count, duration_ms });
  } catch (error) {
    console.error(`[backfillListViewConfigFields] Error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});