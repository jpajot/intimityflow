/**
 * backfillRevisionSnapshots
 *
 * One-time backfill: iterates all BOMLineVariants and BOMLines and populates
 * their revision snapshot fields using the same logic as the standalone functions.
 *
 * Returns: {
 *   success,
 *   bom_line_variants_processed,
 *   bom_line_variants_updated,
 *   bom_lines_processed,
 *   bom_lines_updated,
 *   duration_ms
 * }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Inlined variant snapshot builder (cannot import from sibling per Deno constraint) ──
async function buildVariantSnapshots(svc, variant) {
  const snapshots = {};
  let fields_resolved = 0;

  if (variant.component_product_color_id) {
    const rows = await svc.entities.ProductRevision.filter({
      target_type: 'product_color',
      target_id: variant.component_product_color_id,
      is_current: true,
    });
    snapshots.component_product_color_id = rows[0]?.id ?? null;
    if (rows[0]) fields_resolved++;
  }

  if (variant.component_color_and_more_id) {
    let found = false;
    const rowsAttr = await svc.entities.ProductRevision.filter({
      target_type: 'product_attribute',
      target_id: variant.component_color_and_more_id,
      is_current: true,
    });
    if (rowsAttr.length > 0) {
      snapshots.component_color_and_more_id = rowsAttr[0].id;
      fields_resolved++;
      found = true;
    }
    if (!found) {
      const rowsVar = await svc.entities.ProductRevision.filter({
        target_type: 'product_variant',
        target_id: variant.component_color_and_more_id,
        is_current: true,
      });
      if (rowsVar.length > 0) {
        snapshots.component_color_and_more_id = rowsVar[0].id;
        fields_resolved++;
        found = true;
      }
    }
    if (!found) {
      snapshots.component_color_and_more_id = null;
    }
  }

  if (variant.component_size_id) {
    const rows = await svc.entities.ProductRevision.filter({
      target_type: 'product_color_size',
      target_id: variant.component_size_id,
      is_current: true,
    });
    snapshots.component_size_id = rows[0]?.id ?? null;
    if (rows[0]) fields_resolved++;
  }

  return { snapshots, fields_resolved };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const startMs = Date.now();

    // ── PART 1: BOMLineVariants ───────────────────────────────────────────────
    let variantOffset = 0;
    const BATCH = 50;
    let bom_line_variants_processed = 0;
    let bom_line_variants_updated = 0;

    while (true) {
      const batch = await svc.entities.BOMLineVariant.list('created_date', BATCH, variantOffset);
      if (batch.length === 0) break;

      for (const variant of batch) {
        bom_line_variants_processed++;
        await new Promise(r => setTimeout(r, 200)); // throttle to avoid rate limits
        try {
          const { snapshots } = await buildVariantSnapshots(svc, variant);
          const before = JSON.stringify(variant.component_revision_snapshots ?? null);
          const after = JSON.stringify(snapshots);
          // Always update (idempotent) — count as updated if value changed or was null
          await svc.entities.BOMLineVariant.update(variant.id, { component_revision_snapshots: snapshots });
          if (before !== after) bom_line_variants_updated++;
        } catch (err) {
          console.error(`[backfill] Variant ${variant.id} failed: ${err.message}`);
        }
      }

      if (batch.length < BATCH) break;
      variantOffset += BATCH;
    }

    // ── PART 2: BOMLines ──────────────────────────────────────────────────────
    let lineOffset = 0;
    let bom_lines_processed = 0;
    let bom_lines_updated = 0;

    while (true) {
      const batch = await svc.entities.BOMLine.list('created_date', BATCH, lineOffset);
      if (batch.length === 0) break;

      for (const line of batch) {
        bom_lines_processed++;
        await new Promise(r => setTimeout(r, 200)); // throttle
        try {
          let product_revision_id = null;
          if (line.component_product_id) {
            const rows = await svc.entities.ProductRevision.filter({
              target_type: 'product',
              target_id: line.component_product_id,
              is_current: true,
            });
            product_revision_id = rows[0]?.id ?? null;
          }
          const changed = (line.product_revision_id ?? null) !== product_revision_id;
          await svc.entities.BOMLine.update(line.id, { product_revision_id });
          if (changed) bom_lines_updated++;
        } catch (err) {
          console.error(`[backfill] BOMLine ${line.id} failed: ${err.message}`);
        }
      }

      if (batch.length < BATCH) break;
      lineOffset += BATCH;
    }

    const duration_ms = Date.now() - startMs;

    console.log(`[backfillRevisionSnapshots] Done. variants=${bom_line_variants_processed} updated=${bom_line_variants_updated} lines=${bom_lines_processed} lines_updated=${bom_lines_updated} duration=${duration_ms}ms`);

    return Response.json({
      success: true,
      bom_line_variants_processed,
      bom_line_variants_updated,
      bom_lines_processed,
      bom_lines_updated,
      duration_ms,
    });

  } catch (error) {
    console.error(`[backfillRevisionSnapshots] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});