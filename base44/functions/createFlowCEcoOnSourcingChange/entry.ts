/**
 * createFlowCEcoOnSourcingChange
 *
 * Flow C propagation trigger: fires when an ApprovedSupplier or ProductColorSupplierLink
 * is modified/removed in a way that affects downstream BOMLineVariant sourcing resolution.
 * Creates an auto-approved ECO (status=applied) with one AffectedItem and one
 * AffectedDownstream per affected BOMLineVariant.
 *
 * NOTE: Flow C does NOT increment pending_eco_review_count on any entity.
 *       Flow C does NOT write BOMChangeLog entries.
 *       BOMLineVariants have no pending_eco_review_count field.
 *       The audit trail lives entirely on the ECO + AffectedItem + AffectedDownstream rows.
 *
 * Payload:
 *   item_type      string   required  — "ApprovedSupplier" | "ProductColorSupplierLink"
 *   item_id        string   required
 *   change_kind    string   required  — "modify" | "remove"
 *   field_changes  object   required  — { fieldName: { before, after }, ... }
 *   triggered_by   string   required  — user email
 *
 * Returns: {
 *   success: boolean,
 *   eco_created: boolean,
 *   eco_id?: string,
 *   eco_number?: string,
 *   affected_item_id?: string,
 *   affected_downstream_count?: number,
 *   skipped_reason?: string
 * }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TERMINAL_BOM_STATUSES = ['superseded', 'obsolete'];
const NON_TERMINAL_DOWNSTREAM = ['pending', 'notified', 'under_review'];
const BATCH_CAP = 200;

// ── Trigger-eligible fields per item type ──────────────────────────────────────
const AS_TRIGGER_FIELDS = new Set([
  'unit_cost', 'currency', 'lead_time_days', 'moq', 'moq_uom', 'status',
  'is_primary', 'rank', 'price_break_tiers', 'valid_from', 'valid_until', 'supplier_reference',
]);

const PCSL_TRIGGER_FIELDS = new Set([
  'colorway_supplier_status', 'unit_cost_override', 'currency_override',
  'lead_time_override_days', 'moq_override', 'colorway_supplier_reference',
]);

// ── Inline SystemCodeGenerator increment ──────────────────────────────────────
async function generateEntityCodeInline(svc, entity_name, entity_type) {
  const generators = await svc.entities.SystemCodeGenerator.filter({ entity_name, entity_type });
  if (generators.length === 0) throw new Error(`No SystemCodeGenerator found for entity_name=${entity_name}, entity_type=${entity_type}.`);
  const gen = generators[0];
  const padding = gen.padding || 5;
  const excludedSet = new Set((gen.excluded_codes || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean));
  let nextSeq = (gen.last_sequence || 0) + 1;
  let code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
  while (excludedSet.has(code.toUpperCase())) { nextSeq++; code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`; }
  await svc.entities.SystemCodeGenerator.update(gen.id, { last_sequence: nextSeq });
  return code;
}

// ── Batch fetch helper ─────────────────────────────────────────────────────────
async function batchFetchById(entityObj, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const chunks = [];
  for (let i = 0; i < unique.length; i += BATCH_CAP) chunks.push(unique.slice(i, i + BATCH_CAP));
  const results = await Promise.all(
    chunks.map(chunk => entityObj.filter({ id: { $in: chunk } }, '-created_date', BATCH_CAP).catch(() => []))
  );
  const map = new Map();
  for (const batch of results) for (const rec of batch) map.set(rec.id, rec);
  return map;
}

// ── Supersede open Flow C downstream rows for a BOMLineVariant ────────────────
async function supersedeOpenFlowCDownstreams(svc, variantId, newEcoId) {
  try {
    const candidates = await svc.entities.ECOAffectedDownstream.filter({
      downstream_type: 'BOMLineVariant',
      downstream_id: variantId,
      propagation_status: { $in: NON_TERMINAL_DOWNSTREAM },
    });
    const toSupersede = candidates.filter(r => r.eco_id !== newEcoId && r.flow_type === 'C_sourcing_change');
    const now = new Date().toISOString();
    for (const row of toSupersede) {
      try {
        await svc.entities.ECOAffectedDownstream.update(row.id, {
          propagation_status: 'superseded',
          reviewed_at: now,
        });
      } catch (err) {
        console.error(`[FlowC] Failed to supersede downstream row ${row.id}: ${err.message}`);
      }
    }
    return toSupersede.length;
  } catch (err) {
    console.error(`[FlowC] supersedeOpenFlowCDownstreams failed for variant ${variantId}: ${err.message}`);
    return 0;
  }
}

// ── Build human-readable change summary ───────────────────────────────────────
function buildChangeSummary(field_changes) {
  const parts = Object.entries(field_changes)
    .slice(0, 3)
    .map(([f, { before, after }]) => `${f} changed from ${before ?? 'null'} to ${after ?? 'null'}`);
  return parts.join('; ') || 'record removed';
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      item_type,
      item_id,
      change_kind,
      field_changes = {},
      triggered_by,
    } = await req.json();

    // ── Step 1: Validate inputs ──────────────────────────────────────────────
    if (!item_id) return Response.json({ error: 'item_id is required' }, { status: 400 });
    if (!triggered_by) return Response.json({ error: 'triggered_by is required' }, { status: 400 });
    if (!['ApprovedSupplier', 'ProductColorSupplierLink'].includes(item_type)) {
      return Response.json({ error: 'item_type must be "ApprovedSupplier" or "ProductColorSupplierLink"' }, { status: 400 });
    }
    if (!['modify', 'remove'].includes(change_kind)) {
      return Response.json({ error: 'change_kind must be "modify" or "remove"' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const now = new Date().toISOString();
    const triggerFields = item_type === 'ApprovedSupplier' ? AS_TRIGGER_FIELDS : PCSL_TRIGGER_FIELDS;

    // ── Step 2: Filter meaningful changes ────────────────────────────────────
    if (change_kind === 'modify') {
      const eligibleChangedFields = Object.keys(field_changes).filter(f => triggerFields.has(f));
      if (eligibleChangedFields.length === 0) {
        console.log(`[FlowC] Skipped: no trigger-eligible field changes for ${item_type} ${item_id}`);
        return Response.json({ success: true, eco_created: false, skipped_reason: 'No trigger-eligible field changes' });
      }
    }

    // ── Load the source record (may not exist for "remove") ──────────────────
    let sourceRecord = null;
    let supplierName = 'Unknown Supplier';
    let productName = '';
    let colorLabel = '';

    if (item_type === 'ApprovedSupplier') {
      if (change_kind === 'modify') {
        const records = await svc.entities.ApprovedSupplier.filter({ id: item_id });
        if (records.length === 0) return Response.json({ error: `ApprovedSupplier not found: ${item_id}` }, { status: 404 });
        sourceRecord = records[0];
      } else {
        // "remove" — record may already be deleted; reconstruct from field_changes.before
        sourceRecord = { id: item_id, ...(Object.fromEntries(Object.entries(field_changes).map(([k, v]) => [k, v.before]))) };
      }

      // Resolve supplier + product names
      try {
        const [supResults, prodResults] = await Promise.all([
          sourceRecord.supplier_id ? svc.entities.Supplier.filter({ id: sourceRecord.supplier_id }) : Promise.resolve([]),
          sourceRecord.product_id ? svc.entities.Product.filter({ id: sourceRecord.product_id }) : Promise.resolve([]),
        ]);
        if (supResults[0]) supplierName = supResults[0].name || supplierName;
        if (prodResults[0]) productName = `${prodResults[0].code || ''} ${prodResults[0].name}`.trim();
      } catch (err) {
        console.warn(`[FlowC] Could not resolve names: ${err.message}`);
      }

    } else {
      // ProductColorSupplierLink
      if (change_kind === 'modify') {
        const records = await svc.entities.ProductColorSupplierLink.filter({ id: item_id });
        if (records.length === 0) return Response.json({ error: `ProductColorSupplierLink not found: ${item_id}` }, { status: 404 });
        sourceRecord = records[0];
      } else {
        sourceRecord = { id: item_id, ...(Object.fromEntries(Object.entries(field_changes).map(([k, v]) => [k, v.before]))) };
      }

      // Resolve colorway + supplier names
      try {
        const [colorResults, asResults] = await Promise.all([
          sourceRecord.product_color_id ? svc.entities.ProductColor.filter({ id: sourceRecord.product_color_id }) : Promise.resolve([]),
          sourceRecord.approved_supplier_id ? svc.entities.ApprovedSupplier.filter({ id: sourceRecord.approved_supplier_id }) : Promise.resolve([]),
        ]);
        if (colorResults[0]) colorLabel = `${colorResults[0].color_name}${colorResults[0].colorway_code ? ` (${colorResults[0].colorway_code})` : ''}`;
        if (asResults[0]) {
          const supRes = asResults[0].supplier_id ? await svc.entities.Supplier.filter({ id: asResults[0].supplier_id }) : [];
          if (supRes[0]) supplierName = supRes[0].name || supplierName;
          if (asResults[0].product_id) {
            const prodRes = await svc.entities.Product.filter({ id: asResults[0].product_id });
            if (prodRes[0]) productName = `${prodRes[0].code || ''} ${prodRes[0].name}`.trim();
          }
        }
      } catch (err) {
        console.warn(`[FlowC] Could not resolve PCSL names: ${err.message}`);
      }
    }

    // ── Step 3: Find affected BOMLineVariants ─────────────────────────────────
    let candidateVariants = [];

    if (item_type === 'ApprovedSupplier') {
      // Three lookup paths in parallel
      const [byResolved, byParent, byLineLevelLines] = await Promise.all([
        svc.entities.BOMLineVariant.filter({ approved_supplier_id: item_id }, '-created_date', 500).catch(() => []),
        svc.entities.BOMLineVariant.filter({ parent_approved_supplier_id: item_id }, '-created_date', 500).catch(() => []),
        svc.entities.BOMLine.filter({ line_level_approved_supplier_id: item_id }, '-created_date', 200).catch(() => []),
      ]);

      // For line-level lines, load their variants
      let byLineLevel = [];
      if (byLineLevelLines.length > 0) {
        const lineIds = byLineLevelLines.map(l => l.id);
        byLineLevel = await svc.entities.BOMLineVariant.filter({ bom_line_id: { $in: lineIds } }, '-created_date', 500).catch(() => []);
      }

      // Deduplicate by id
      const seen = new Set();
      for (const v of [...byResolved, ...byParent, ...byLineLevel]) {
        if (!seen.has(v.id)) { seen.add(v.id); candidateVariants.push(v); }
      }

    } else {
      // ProductColorSupplierLink — single path
      candidateVariants = await svc.entities.BOMLineVariant.filter({ product_color_supplier_link_id: item_id }, '-created_date', 500).catch(() => []);
    }

    // ── Step 4: Filter out variants on terminal BOMs ──────────────────────────
    if (candidateVariants.length === 0) {
      console.log(`[FlowC] Skipped: no variants reference ${item_type} ${item_id}`);
      return Response.json({ success: true, eco_created: false, skipped_reason: 'No active BOMLineVariants resolve through this sourcing record' });
    }

    // Batch-fetch BOMLines, then BOMs
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
      console.log(`[FlowC] Skipped: all variants belong to terminal BOMs for ${item_type} ${item_id}`);
      return Response.json({ success: true, eco_created: false, skipped_reason: 'No active BOMLineVariants resolve through this sourcing record' });
    }

    // ── Step 5: Create ECO ────────────────────────────────────────────────────
    const priority = change_kind === 'remove' ? 'normal' : 'low';
    const n = eligibleVariants.length;

    // Build ECO title
    let ecoTitle;
    if (item_type === 'ApprovedSupplier') {
      ecoTitle = `Sourcing changed — ${supplierName}${productName ? ` for ${productName}` : ''}`;
    } else {
      ecoTitle = `Colorway sourcing changed — ${colorLabel || item_id} via ${supplierName}`;
    }

    const changeSummary = change_kind === 'remove'
      ? `${item_type} record deleted`
      : buildChangeSummary(field_changes);

    let eco;
    try {
      const eco_number = await generateEntityCodeInline(svc, 'ECO', 'ECO');
      eco = await svc.entities.ECO.create({
        eco_number,
        title: ecoTitle,
        description: `Auto-generated by Flow C trigger. ${changeSummary}. ${n} BOMLineVariant(s) resolve through this sourcing record. No revision required — variants can adopt or pin in-place.`,
        reason_category: 'sourcing_update',
        priority,
        status: 'applied',
        origin: 'sourcing_change',
        flow_type: 'C_sourcing_change',
        requested_by: triggered_by,
        requested_at: now,
        applied_at: now,
        approver_id: triggered_by,
        approved_at: now,
      });
    } catch (err) {
      console.error(`[FlowC] ECO creation failed: ${err.message}`);
      return Response.json({ success: false, eco_created: false, error: `ECO creation failed: ${err.message}` });
    }

    // ── Step 6: Create AffectedItem ──────────────────────────────────────────
    // Build snapshots from field_changes
    const beforeSnapshot = Object.fromEntries(Object.entries(field_changes).map(([k, v]) => [k, v.before]));
    const afterSnapshot = change_kind === 'remove' ? {} : Object.fromEntries(Object.entries(field_changes).map(([k, v]) => [k, v.after]));
    const fieldDiffs = Object.entries(field_changes)
      .map(([field, { before, after }]) => ({ field, before, after }))
      .sort((a, b) => a.field.localeCompare(b.field));

    let itemLabel;
    if (item_type === 'ApprovedSupplier') {
      itemLabel = `${supplierName}${productName ? ` for ${productName}` : ''}`;
    } else {
      itemLabel = `${colorLabel || item_id} via ${supplierName}`;
    }

    let affectedItem;
    try {
      affectedItem = await svc.entities.ECOAffectedItem.create({
        eco_id: eco.id,
        item_type,
        item_id,
        item_label: itemLabel,
        change_kind,
        before_snapshot: beforeSnapshot,
        after_snapshot: afterSnapshot,
        field_diffs: fieldDiffs,
        applied: true,
        applied_at: now,
        applied_by: triggered_by,
      });
    } catch (err) {
      console.error(`[FlowC] AffectedItem creation failed: ${err.message}`);
      // ECO was created — partial state acceptable; continue
    }

    // ── Step 7: Create AffectedDownstream rows ────────────────────────────────
    // Pre-fetch product records for BOM labels
    const productIds = [...new Set([...bomMap.values()].map(b => b.product_id).filter(Boolean))];
    const productMap = await batchFetchById(svc.entities.Product, productIds);

    let affectedDownstreamCount = 0;

    for (const variant of eligibleVariants) {
      try {
        const line = lineMap.get(variant.bom_line_id);
        const bom = line ? bomMap.get(line.bom_id) : null;
        const prod = bom ? productMap.get(bom.product_id) : null;
        const prodName = prod ? `${prod.code || ''} ${prod.name}`.trim() : productName;

        // Build BOM label
        const bomLabel = bom
          ? `${bom.bom_type === 'production' ? 'Prod' : 'Dev'} BOM rev ${bom.revision_code} v${bom.version} — ${prodName}`
          : `BOM:${line?.bom_id}`;

        // Build variant descriptor
        const descriptorParts = [
          variant.product_color_id ? `color:${variant.product_color_id}` : null,
          variant.size_id ? `size:${variant.size_id}` : null,
          variant.product_color_and_more_id ? `more:${variant.product_color_and_more_id}` : null,
        ].filter(Boolean);
        const descriptor = descriptorParts.length > 0 ? descriptorParts.join(', ') : variant.id;

        const downstreamLabel = `${bomLabel} > Line #${line?.position ?? '?'} (${line?.component_role || '—'}) > Variant: ${descriptor}`;

        // Supersede prior open Flow C rows for this variant
        await supersedeOpenFlowCDownstreams(svc, variant.id, eco.id);

        // Insert downstream row
        await svc.entities.ECOAffectedDownstream.create({
          eco_id: eco.id,
          downstream_type: 'BOMLineVariant',
          downstream_id: variant.id,
          downstream_label: downstreamLabel,
          flow_type: 'C_sourcing_change',
          triggering_affected_item_id: affectedItem?.id || null,
          propagation_status: 'pending',
          priority,
        });

        affectedDownstreamCount++;
      } catch (err) {
        console.error(`[FlowC] Failed to process downstream for variant ${variant.id}: ${err.message}`);
        // Continue — partial success acceptable per spec
      }
    }

    console.log(`[FlowC] Done. eco_id=${eco.id} eco_number=${eco.eco_number} downstream_count=${affectedDownstreamCount}`);

    return Response.json({
      success: true,
      eco_created: true,
      eco_id: eco.id,
      eco_number: eco.eco_number,
      affected_item_id: affectedItem?.id || null,
      affected_downstream_count: affectedDownstreamCount,
    });

  } catch (error) {
    console.error(`[FlowC] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});