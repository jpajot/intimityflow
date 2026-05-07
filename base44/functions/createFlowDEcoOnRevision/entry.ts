/**
 * createFlowDEcoOnRevision
 *
 * Flow D propagation trigger. Fires when a ProductRevision is created (non-first).
 * Finds stale BOMLineVariants (or BOMLines for product target_type) and creates:
 *   - One ECO (status=applied, origin=component_revision, flow_type=D_component_revision)
 *   - One ECOAffectedItem (the ProductRevision itself)
 *   - One ECOAffectedDownstream per stale BOMLineVariant
 *
 * Supersedes prior open Flow D downstreams for the same target chain.
 * Does NOT write BOMChangeLog entries.
 * Does NOT increment any pending_eco_review_count.
 *
 * Payload:
 *   product_revision_id  string  required
 *   triggered_by         string  required
 *
 * Returns: {
 *   success, eco_created, eco_id?, eco_number?,
 *   affected_item_id?, affected_downstream_count?, skipped_reason?
 * }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TERMINAL_BOM_STATUSES = ['superseded', 'obsolete'];
const NON_TERMINAL_DOWNSTREAM = ['pending', 'notified', 'under_review'];
const BATCH_CAP = 200;

// ── Inline SystemCodeGenerator increment ──────────────────────────────────────
async function generateEntityCodeInline(svc, entity_name, entity_type) {
  const generators = await svc.entities.SystemCodeGenerator.filter({ entity_name, entity_type });
  if (generators.length === 0) throw new Error(`No SystemCodeGenerator for ${entity_name}/${entity_type}`);
  const gen = generators[0];
  const padding = gen.padding || 5;
  const excludedSet = new Set((gen.excluded_codes || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean));
  let nextSeq = (gen.last_sequence || 0) + 1;
  let code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
  while (excludedSet.has(code.toUpperCase())) { nextSeq++; code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`; }
  await svc.entities.SystemCodeGenerator.update(gen.id, { last_sequence: nextSeq });
  return code;
}

// ── Batch fetch by id list ────────────────────────────────────────────────────
async function batchFetchById(entityObj, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const chunks = [];
  for (let i = 0; i < unique.length; i += BATCH_CAP) chunks.push(unique.slice(i, i + BATCH_CAP));
  const results = await Promise.all(chunks.map(chunk => entityObj.filter({ id: { $in: chunk } }, '-created_date', BATCH_CAP).catch(() => [])));
  const map = new Map();
  for (const batch of results) for (const rec of batch) map.set(rec.id, rec);
  return map;
}

// ── FK key that corresponds to a target_type on BOMLineVariant snapshots ──────
function targetTypeToVariantKey(target_type) {
  switch (target_type) {
    case 'product_color':      return 'component_product_color_id';
    case 'product_color_size': return 'component_size_id';
    case 'product_attribute':  return 'component_color_and_more_id';
    case 'product_variant':    return 'component_color_and_more_id';
    default:                   return null;
  }
}

// ── Supersede open Flow D downstreams for a variant from the same target chain ─
async function supersedeOldFlowDRows(svc, variantId, newRevision, newEcoId) {
  try {
    const candidates = await svc.entities.ECOAffectedDownstream.filter({
      downstream_type: 'BOMLineVariant',
      downstream_id: variantId,
      flow_type: 'D_component_revision',
      propagation_status: { $in: NON_TERMINAL_DOWNSTREAM },
    });

    const toSupersede = candidates.filter(r => r.eco_id !== newEcoId);
    if (toSupersede.length === 0) return 0;

    // For each prior open row, check if its ECO targets the same (target_type, target_id) chain
    const ecoIds = [...new Set(toSupersede.map(r => r.eco_id).filter(Boolean))];
    const ecoItemsAll = [];
    for (const eid of ecoIds) {
      const items = await svc.entities.ECOAffectedItem.filter({ eco_id: eid, item_type: 'ProductRevision' });
      ecoItemsAll.push(...items);
    }

    // Gather ProductRevision ids from those items
    const prIds = [...new Set(ecoItemsAll.map(i => i.item_revision_id || i.item_id).filter(Boolean))];
    const prMap = await batchFetchById(svc.entities.ProductRevision, prIds);

    const now = new Date().toISOString();
    let count = 0;
    for (const row of toSupersede) {
      // Find the ECO's AffectedItem's ProductRevision
      const item = ecoItemsAll.find(i => i.eco_id === row.eco_id);
      if (!item) continue;
      const pr = prMap.get(item.item_revision_id || item.item_id);
      if (!pr) continue;
      // Same target chain = same (product_id, target_type, target_id)
      if (pr.target_type !== newRevision.target_type || pr.target_id !== newRevision.target_id) continue;
      try {
        await svc.entities.ECOAffectedDownstream.update(row.id, { propagation_status: 'superseded', reviewed_at: now });
        count++;
      } catch (err) {
        console.error(`[FlowD] Failed to supersede downstream ${row.id}: ${err.message}`);
      }
    }
    return count;
  } catch (err) {
    console.error(`[FlowD] supersedeOldFlowDRows error for variant ${variantId}: ${err.message}`);
    return 0;
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // This function is invoked internally from createProductRevision (service role) or directly by users.
    // triggered_by in the payload is the auditable identity; body is validated below.
    // No end-user auth check needed — the caller (createProductRevision) is already auth-gated.

    const { product_revision_id, triggered_by } = await req.json();
    if (!product_revision_id) return Response.json({ error: 'product_revision_id is required' }, { status: 400 });
    if (!triggered_by) return Response.json({ error: 'triggered_by is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const now = new Date().toISOString();

    // ── Step 1: Load and validate ProductRevision ────────────────────────────
    const prRows = await svc.entities.ProductRevision.filter({ id: product_revision_id });
    if (prRows.length === 0) return Response.json({ error: `ProductRevision not found: ${product_revision_id}` }, { status: 404 });
    const revision = prRows[0];
    const { product_id, target_type, target_id, revision_code, before_snapshot, after_snapshot, field_diffs } = revision;

    // ── Step 2: Resolve product + target names ───────────────────────────────
    let productName = product_id;
    let colorName = '';
    let targetLabel = target_id;

    try {
      const prods = await svc.entities.Product.filter({ id: product_id });
      if (prods[0]) productName = `${prods[0].code || ''} ${prods[0].name}`.trim();
    } catch (_) {}

    if (target_type === 'product_color') {
      try {
        const colors = await svc.entities.ProductColor.filter({ id: target_id });
        if (colors[0]) { colorName = colors[0].color_name; targetLabel = `${productName} / ${colorName}`; }
      } catch (_) {}
    } else {
      targetLabel = productName;
    }

    // ── Step 3: Find stale BOMLineVariants ───────────────────────────────────
    let candidateVariants = [];

    if (target_type === 'product') {
      // Find BOMLines whose component_product_id = product_id AND product_revision_id != new revision
      const allLines = await svc.entities.BOMLine.filter({ component_product_id: product_id });
      const staleLines = allLines.filter(l => (l.product_revision_id ?? null) !== product_revision_id);

      if (staleLines.length === 0) {
        return Response.json({ success: true, eco_created: false, skipped_reason: 'No stale BOMLineVariants reference this revision target' });
      }

      const staleLineIds = staleLines.map(l => l.id);
      const variants = await svc.entities.BOMLineVariant.filter({ bom_line_id: { $in: staleLineIds } });
      candidateVariants = variants;

      // If no variants exist under stale lines, still skip
      if (candidateVariants.length === 0) {
        return Response.json({ success: true, eco_created: false, skipped_reason: 'No stale BOMLineVariants reference this revision target' });
      }
    } else {
      // For product_color / product_color_size / product_attribute / product_variant
      const variantKey = targetTypeToVariantKey(target_type);
      if (!variantKey) {
        return Response.json({ success: true, eco_created: false, skipped_reason: `target_type "${target_type}" has no BOMLineVariant FK mapping` });
      }

      // Fetch all variants referencing this target_id via the FK
      const filterObj = {};
      filterObj[variantKey] = target_id;
      const allVariants = await svc.entities.BOMLineVariant.filter(filterObj, '-created_date', 500);

      // Filter to stale: snapshot[key] !== new revision id (null counts as stale)
      candidateVariants = allVariants.filter(v => {
        const snap = v.component_revision_snapshots;
        if (!snap || typeof snap !== 'object') return true; // no snapshots at all → stale
        if (!(variantKey in snap)) return true;             // key missing → stale
        return snap[variantKey] !== product_revision_id;    // different revision or null → stale
      });
    }

    if (candidateVariants.length === 0) {
      return Response.json({ success: true, eco_created: false, skipped_reason: 'No stale BOMLineVariants reference this revision target' });
    }

    // ── Filter out variants on terminal BOMs ─────────────────────────────────
    const lineIds = [...new Set(candidateVariants.map(v => v.bom_line_id).filter(Boolean))];
    const lineMap = await batchFetchById(svc.entities.BOMLine, lineIds);
    const bomIds = [...new Set([...lineMap.values()].map(l => l.bom_id).filter(Boolean))];
    const bomMap = await batchFetchById(svc.entities.BOM, bomIds);

    const eligibleVariants = candidateVariants.filter(v => {
      const line = lineMap.get(v.bom_line_id);
      if (!line) return false;
      const bom = bomMap.get(line.bom_id);
      return bom && !TERMINAL_BOM_STATUSES.includes(bom.status);
    });

    if (eligibleVariants.length === 0) {
      return Response.json({ success: true, eco_created: false, skipped_reason: 'No stale BOMLineVariants reference this revision target' });
    }

    // ── Step 4: Create ECO ────────────────────────────────────────────────────
    const n = eligibleVariants.length;
    const priority = n > 20 ? 'critical' : n > 5 ? 'high' : 'normal';

    let ecoTitle;
    if (target_type === 'product') {
      ecoTitle = `Component revised — ${productName}`;
    } else if (target_type === 'product_color') {
      ecoTitle = `Color revised — ${targetLabel}`;
    } else {
      ecoTitle = `${target_type} revised — ${productName}`;
    }

    const ecoDescription = `Auto-generated by Flow D trigger. ${target_type} revision ${revision_code} was applied to ${targetLabel}. ${n} BOMLineVariant(s) reference this entity with stale snapshots and require review.`;

    let eco;
    try {
      const eco_number = await generateEntityCodeInline(svc, 'ECO', 'ECO');
      eco = await svc.entities.ECO.create({
        eco_number,
        title: ecoTitle,
        description: ecoDescription,
        reason_category: 'design_change',
        priority,
        status: 'applied',
        origin: 'component_revision',
        flow_type: 'D_component_revision',
        requested_by: triggered_by,
        requested_at: now,
        applied_at: now,
        approver_id: triggered_by,
        approved_at: now,
      });
    } catch (err) {
      console.error(`[FlowD] ECO creation failed: ${err.message}`);
      return Response.json({ success: false, eco_created: false, error: `ECO creation failed: ${err.message}` });
    }

    // ── Step 5: Create AffectedItem ──────────────────────────────────────────
    let affectedItem;
    try {
      affectedItem = await svc.entities.ECOAffectedItem.create({
        eco_id: eco.id,
        item_type: 'ProductRevision',
        item_id: product_revision_id,
        item_label: `${target_type} revision ${revision_code} — ${targetLabel}`,
        change_kind: 'modify',
        before_snapshot: before_snapshot || {},
        after_snapshot: after_snapshot || {},
        field_diffs: field_diffs || [],
        applied: true,
        applied_at: now,
        applied_by: triggered_by,
        item_revision_id: product_revision_id,
      });
    } catch (err) {
      console.error(`[FlowD] AffectedItem creation failed: ${err.message}`);
      // Continue — partial state acceptable
    }

    // ── Step 6: Pre-fetch data for downstream labels ─────────────────────────
    const productMap = await batchFetchById(svc.entities.Product,
      [...new Set([...bomMap.values()].map(b => b.product_id).filter(Boolean))]);

    // ── Step 7: Create AffectedDownstream rows ────────────────────────────────
    let affectedDownstreamCount = 0;

    for (const variant of eligibleVariants) {
      try {
        const line = lineMap.get(variant.bom_line_id);
        const bom = line ? bomMap.get(line.bom_id) : null;
        const prod = bom ? productMap.get(bom.product_id) : null;
        const prodName = prod ? `${prod.code || ''} ${prod.name}`.trim() : '';

        const bomLabel = bom
          ? `${bom.bom_type === 'production' ? 'Prod' : 'Dev'} BOM rev ${bom.revision_code} v${bom.version}${prodName ? ` — ${prodName}` : ''}`
          : `BOM:${line?.bom_id || '?'}`;

        // Build variant descriptor
        const descriptorParts = [
          variant.product_color_id ? `color:${variant.product_color_id}` : null,
          variant.size_id ? `size:${variant.size_id}` : null,
          variant.product_color_and_more_id ? `more:${variant.product_color_and_more_id}` : null,
        ].filter(Boolean);
        const descriptor = descriptorParts.length > 0 ? descriptorParts.join(', ') : variant.id;

        const downstreamLabel = `${bomLabel} > Line #${line?.position ?? '?'} > Variant: ${descriptor}`;

        // Supersede prior open Flow D rows for this variant (same target chain)
        await supersedeOldFlowDRows(svc, variant.id, revision, eco.id);

        // Insert downstream row
        await svc.entities.ECOAffectedDownstream.create({
          eco_id: eco.id,
          downstream_type: 'BOMLineVariant',
          downstream_id: variant.id,
          downstream_label: downstreamLabel,
          flow_type: 'D_component_revision',
          triggering_affected_item_id: affectedItem?.id || null,
          propagation_status: 'pending',
          priority,
        });

        affectedDownstreamCount++;
      } catch (err) {
        console.error(`[FlowD] Failed downstream for variant ${variant.id}: ${err.message}`);
      }
    }

    console.log(`[FlowD] Done. eco_id=${eco.id} eco_number=${eco.eco_number} downstream_count=${affectedDownstreamCount}`);

    return Response.json({
      success: true,
      eco_created: true,
      eco_id: eco.id,
      eco_number: eco.eco_number,
      affected_item_id: affectedItem?.id || null,
      affected_downstream_count: affectedDownstreamCount,
    });

  } catch (error) {
    console.error(`[FlowD] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});