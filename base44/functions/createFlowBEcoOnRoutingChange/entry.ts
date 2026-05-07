/**
 * createFlowBEcoOnRoutingChange
 *
 * Flow B propagation trigger: fires when a SupplierRouting or any of its
 * SupplierRoutingSteps are modified. Finds all BOLs whose source_routing_snapshot_at
 * predates the current moment (i.e. any BOL that took a snapshot before this trigger
 * fires is stale relative to the change), creates an ECO (status=applied,
 * origin=routing_change), one AffectedItem (the modified routing), and one
 * AffectedDownstream per stale-snapshot BOL. Supersedes any prior open Flow B
 * downstream rows for the same BOLs.
 *
 * Payload:
 *   supplier_routing_id  string   required
 *   change_summary       string   required  — short human description of the change
 *   triggered_by         string   required  — user email
 *   routing_step_id      string   optional  — the step id if change was step-level
 *   step_change_kind     string   optional  — "add" | "modify" | "remove"
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

// ── Inline BOM pending_eco_review_count increment ─────────────────────────────
async function incrementBomCount(svc, bomId) {
  try {
    const records = await svc.entities.BOM.filter({ id: bomId });
    if (records.length === 0) { console.warn(`[FlowB] BOM not found for increment: ${bomId}`); return; }
    const current = records[0].pending_eco_review_count || 0;
    await svc.entities.BOM.update(bomId, { pending_eco_review_count: current + 1 });
  } catch (err) {
    console.error(`[FlowB] Failed to increment BOM.pending_eco_review_count on ${bomId}: ${err.message}`);
  }
}

// ── Inline BOM pending_eco_review_count decrement ─────────────────────────────
async function decrementBomCount(svc, bomId) {
  try {
    const records = await svc.entities.BOM.filter({ id: bomId });
    if (records.length === 0) { console.warn(`[FlowB] BOM not found for decrement: ${bomId}`); return; }
    const current = records[0].pending_eco_review_count || 0;
    await svc.entities.BOM.update(bomId, { pending_eco_review_count: Math.max(0, current - 1) });
  } catch (err) {
    console.error(`[FlowB] Failed to decrement BOM.pending_eco_review_count on ${bomId}: ${err.message}`);
  }
}

// ── Inline BOL pending_eco_review_count increment ─────────────────────────────
async function incrementBolCount(svc, bolId) {
  try {
    const records = await svc.entities.BOL.filter({ id: bolId });
    if (records.length === 0) { console.warn(`[FlowB] BOL not found for increment: ${bolId}`); return; }
    const current = records[0].pending_eco_review_count || 0;
    await svc.entities.BOL.update(bolId, { pending_eco_review_count: current + 1 });
  } catch (err) {
    console.error(`[FlowB] Failed to increment BOL.pending_eco_review_count on ${bolId}: ${err.message}`);
  }
}

// ── Inline BOL pending_eco_review_count decrement ─────────────────────────────
async function decrementBolCount(svc, bolId) {
  try {
    const records = await svc.entities.BOL.filter({ id: bolId });
    if (records.length === 0) { console.warn(`[FlowB] BOL not found for decrement: ${bolId}`); return; }
    const current = records[0].pending_eco_review_count || 0;
    await svc.entities.BOL.update(bolId, { pending_eco_review_count: Math.max(0, current - 1) });
  } catch (err) {
    console.error(`[FlowB] Failed to decrement BOL.pending_eco_review_count on ${bolId}: ${err.message}`);
  }
}

// ── Supersede open Flow B downstream rows for a BOL (excluding newEcoId) ──────
async function supersedeOpenFlowBDownstreams(svc, bolId, newEcoId, parentBomIdMap) {
  try {
    const candidates = await svc.entities.ECOAffectedDownstream.filter({
      downstream_type: 'BOL',
      downstream_id: bolId,
      propagation_status: { $in: NON_TERMINAL_DOWNSTREAM },
    });
    const toSupersede = candidates.filter(r => r.eco_id !== newEcoId);
    const now = new Date().toISOString();
    for (const row of toSupersede) {
      try {
        await svc.entities.ECOAffectedDownstream.update(row.id, {
          propagation_status: 'superseded',
          reviewed_at: now,
        });
        await decrementBolCount(svc, bolId);
        // Decrement parent BOM too
        const parentBomId = parentBomIdMap.get(bolId);
        if (parentBomId) await decrementBomCount(svc, parentBomId);
      } catch (err) {
        console.error(`[FlowB] Failed to supersede downstream row ${row.id}: ${err.message}`);
      }
    }
    return toSupersede.length;
  } catch (err) {
    console.error(`[FlowB] supersedeOpenFlowBDownstreams failed for BOL ${bolId}: ${err.message}`);
    return 0;
  }
}

// ── Batch fetch helper ─────────────────────────────────────────────────────────
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

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      supplier_routing_id,
      change_summary,
      triggered_by,
      routing_step_id = null,
      step_change_kind = null,
    } = await req.json();

    if (!supplier_routing_id) return Response.json({ error: 'supplier_routing_id is required' }, { status: 400 });
    if (!change_summary) return Response.json({ error: 'change_summary is required' }, { status: 400 });
    if (!triggered_by) return Response.json({ error: 'triggered_by is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const now = new Date().toISOString();

    // ── Step 1: Load and validate the SupplierRouting ────────────────────────
    const routingRecords = await svc.entities.SupplierRouting.filter({ id: supplier_routing_id });
    if (routingRecords.length === 0) return Response.json({ error: `SupplierRouting not found: ${supplier_routing_id}` }, { status: 404 });
    const routing = routingRecords[0];

    if (routing.status !== 'active') {
      return Response.json({ success: true, eco_created: false, skipped_reason: 'SupplierRouting is not active' });
    }

    // ── Step 2: Resolve product name ─────────────────────────────────────────
    let productName = routing.product_id || '';
    try {
      const prods = await svc.entities.Product.filter({ id: routing.product_id });
      if (prods[0]) productName = `${prods[0].code || ''} ${prods[0].name}`.trim();
    } catch (err) {
      console.warn(`[FlowB] Could not resolve product name: ${err.message}`);
    }

    // ── Step 3: Find stale-snapshot BOLs ─────────────────────────────────────
    // Any BOL with source_routing_id = this routing AND source_routing_snapshot_at < now
    // (i.e. any BOL that has taken a snapshot — not null — is stale after this change)
    const allBols = await svc.entities.BOL.filter({ source_routing_id: supplier_routing_id });
    const bolsWithSnapshot = allBols.filter(b => b.source_routing_snapshot_at && b.source_routing_snapshot_at < now);

    if (bolsWithSnapshot.length === 0) {
      return Response.json({ success: true, eco_created: false, skipped_reason: 'No active BOLs with stale routing snapshots' });
    }

    // Filter out BOLs whose parent BOM is terminal
    const bomIds = [...new Set(bolsWithSnapshot.map(b => b.bom_id).filter(Boolean))];
    const bomMap = await batchFetchById(svc.entities.BOM, bomIds);

    const eligibleBols = bolsWithSnapshot.filter(bol => {
      const bom = bomMap.get(bol.bom_id);
      return bom && !TERMINAL_BOM_STATUSES.includes(bom.status);
    });

    if (eligibleBols.length === 0) {
      return Response.json({ success: true, eco_created: false, skipped_reason: 'No active BOLs with stale routing snapshots' });
    }

    // Build parentBomId map for BOL id → BOM id (used in supersession count adjustments)
    const parentBomIdMap = new Map(eligibleBols.map(bol => [bol.id, bol.bom_id]));

    // ── Step 4: Create ECO ────────────────────────────────────────────────────
    const n = eligibleBols.length;
    const priority = n > 20 ? 'critical' : n > 5 ? 'high' : 'normal';

    let eco;
    try {
      const eco_number = await generateEntityCodeInline(svc, 'ECO', 'ECO');
      eco = await svc.entities.ECO.create({
        eco_number,
        title: `Routing changed — ${routing.name} (${productName})`,
        description: `Auto-generated by Flow B trigger. SupplierRouting '${routing.name}' was modified (${change_summary}). ${n} BOL(s) reference this routing with stale snapshots and require review.`,
        reason_category: 'routing_update',
        priority,
        status: 'applied',
        origin: 'routing_change',
        flow_type: 'B_routing_change',
        requested_by: triggered_by,
        requested_at: now,
        applied_at: now,
        approver_id: triggered_by,
        approved_at: now,
      });
    } catch (err) {
      console.error(`[FlowB] ECO creation failed: ${err.message}`);
      return Response.json({ success: false, eco_created: false, error: `ECO creation failed: ${err.message}` });
    }

    // ── Step 5: Create AffectedItem ──────────────────────────────────────────
    let affectedItem;
    try {
      affectedItem = await svc.entities.ECOAffectedItem.create({
        eco_id: eco.id,
        item_type: 'SupplierRouting',
        item_id: supplier_routing_id,
        item_label: `${routing.name} (${productName})`,
        change_kind: 'modify',
        before_snapshot: {},
        after_snapshot: {
          name: routing.name,
          status: routing.status,
          total_lead_time_days: routing.total_lead_time_days,
          change_summary,
          routing_step_id: routing_step_id || null,
          step_change_kind: step_change_kind || null,
        },
        field_diffs: [],
        applied: true,
        applied_at: now,
        applied_by: triggered_by,
      });
    } catch (err) {
      console.error(`[FlowB] AffectedItem creation failed: ${err.message}`);
      // ECO was created — partial state acceptable; continue
    }

    // ── Step 6: Create AffectedDownstream rows + supersede prior open rows ───
    let affectedDownstreamCount = 0;

    for (const bol of eligibleBols) {
      try {
        const parentBom = bomMap.get(bol.bom_id);

        // Supersede prior open rows BEFORE inserting new one
        await supersedeOpenFlowBDownstreams(svc, bol.id, eco.id, parentBomIdMap);

        // Build downstream label
        const bomLabel = parentBom
          ? `Prod BOM rev ${parentBom.revision_code} v${parentBom.version} — ${productName}`
          : `BOM:${bol.bom_id}`;
        const downstreamLabel = `BOL for ${bomLabel}`;

        // Insert downstream row
        await svc.entities.ECOAffectedDownstream.create({
          eco_id: eco.id,
          downstream_type: 'BOL',
          downstream_id: bol.id,
          downstream_label: downstreamLabel,
          flow_type: 'B_routing_change',
          triggering_affected_item_id: affectedItem?.id || null,
          propagation_status: 'pending',
          priority,
        });

        // Increment counts on BOL and parent BOM
        await incrementBolCount(svc, bol.id);
        if (bol.bom_id) await incrementBomCount(svc, bol.bom_id);

        // Step 7: BOMChangeLog entry on the Prod BOM
        if (bol.bom_id) {
          await svc.entities.BOMChangeLog.create({
            bom_id: bol.bom_id,
            change_type: 'routing_changed_upstream',
            payload: {
              eco_id: eco.id,
              eco_number: eco.eco_number,
              supplier_routing_id,
              change_summary,
              routing_step_id: routing_step_id || null,
              step_change_kind: step_change_kind || null,
            },
            triggered_by,
            triggered_at: now,
          });
        }

        affectedDownstreamCount++;
      } catch (err) {
        console.error(`[FlowB] Failed to process downstream for BOL ${bol.id}: ${err.message}`);
        // Continue — partial success acceptable per spec
      }
    }

    console.log(`[FlowB] Done. eco_id=${eco.id} eco_number=${eco.eco_number} downstream_count=${affectedDownstreamCount}`);

    return Response.json({
      success: true,
      eco_created: true,
      eco_id: eco.id,
      eco_number: eco.eco_number,
      affected_item_id: affectedItem?.id || null,
      affected_downstream_count: affectedDownstreamCount,
    });

  } catch (error) {
    console.error(`[FlowB] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});