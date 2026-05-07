/**
 * populateBomLineVariantRevisionSnapshots
 *
 * Populates component_revision_snapshots on a BOMLineVariant with the current
 * ProductRevision ids for each revisable component FK field.
 *
 * FK → target_type mapping:
 *   component_product_color_id → "product_color"
 *   component_color_and_more_id → "product_attribute" (fallback: "product_variant")
 *   component_size_id → "product_color_size"
 *
 * If the FK is non-null but no ProductRevision exists yet for that entity,
 * the snapshot key is set to null ("legacy variant" pattern).
 * If the FK is null, the key is omitted from the snapshots object.
 * If ALL three FKs are null, component_revision_snapshots is set to {}.
 *
 * Idempotent: always overwrites component_revision_snapshots with current state.
 *
 * Payload:
 *   bom_line_variant_id  string  required
 *
 * Returns: { success, snapshots_set, fields_resolved }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Shared snapshot-build helper (also inlined in backfillRevisionSnapshots) ──
export async function buildVariantSnapshots(svc, variant) {
  const snapshots = {};
  let fields_resolved = 0;

  // component_product_color_id → "product_color"
  if (variant.component_product_color_id) {
    const rows = await svc.entities.ProductRevision.filter({
      target_type: 'product_color',
      target_id: variant.component_product_color_id,
      is_current: true,
    });
    snapshots.component_product_color_id = rows[0]?.id ?? null;
    if (rows[0]) fields_resolved++;
  }

  // component_color_and_more_id → "product_attribute" (fallback: "product_variant")
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
      // No revision exists yet for this entity — legacy null anchor
      snapshots.component_color_and_more_id = null;
    }
  }

  // component_size_id → "product_color_size"
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

    const { bom_line_variant_id } = await req.json();
    if (!bom_line_variant_id) return Response.json({ error: 'bom_line_variant_id is required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // 1. Load variant
    const variants = await svc.entities.BOMLineVariant.filter({ id: bom_line_variant_id });
    if (variants.length === 0) return Response.json({ error: `BOMLineVariant not found: ${bom_line_variant_id}` }, { status: 404 });
    const variant = variants[0];

    // 2. Build snapshots
    const { snapshots, fields_resolved } = await buildVariantSnapshots(svc, variant);

    // 3. Persist
    await svc.entities.BOMLineVariant.update(bom_line_variant_id, { component_revision_snapshots: snapshots });

    console.log(`[populateBomLineVariantRevisionSnapshots] variant=${bom_line_variant_id} snapshots=${JSON.stringify(snapshots)} fields_resolved=${fields_resolved}`);

    return Response.json({ success: true, snapshots_set: snapshots, fields_resolved });

  } catch (error) {
    console.error(`[populateBomLineVariantRevisionSnapshots] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});