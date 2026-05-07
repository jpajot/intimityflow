/**
 * populateBomLineRevisionSnapshot
 *
 * Populates product_revision_id on a BOMLine with the current ProductRevision id
 * for the referenced component Product (target_type = "product").
 *
 * If component_product_id is null, sets product_revision_id = null.
 * If no ProductRevision exists yet for the Product, sets product_revision_id = null.
 * Idempotent: always overwrites with current state.
 *
 * Payload:
 *   bom_line_id  string  required
 *
 * Returns: { success, product_revision_id }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bom_line_id } = await req.json();
    if (!bom_line_id) return Response.json({ error: 'bom_line_id is required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // 1. Load BOMLine
    const lines = await svc.entities.BOMLine.filter({ id: bom_line_id });
    if (lines.length === 0) return Response.json({ error: `BOMLine not found: ${bom_line_id}` }, { status: 404 });
    const line = lines[0];

    // 2. Resolve current ProductRevision for component_product_id
    let product_revision_id = null;
    if (line.component_product_id) {
      const rows = await svc.entities.ProductRevision.filter({
        target_type: 'product',
        target_id: line.component_product_id,
        is_current: true,
      });
      product_revision_id = rows[0]?.id ?? null;
    }

    // 3. Persist
    await svc.entities.BOMLine.update(bom_line_id, { product_revision_id });

    console.log(`[populateBomLineRevisionSnapshot] line=${bom_line_id} component_product_id=${line.component_product_id} product_revision_id=${product_revision_id}`);

    return Response.json({ success: true, product_revision_id });

  } catch (error) {
    console.error(`[populateBomLineRevisionSnapshot] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});