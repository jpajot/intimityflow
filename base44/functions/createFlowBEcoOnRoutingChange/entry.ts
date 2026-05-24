/**
 * createFlowBEcoOnRoutingChange
 *
 * Flow B propagation trigger: fires when a SupplierRouting or any of its
 * SupplierRoutingSteps are modified. Finds all production BOMs whose
 * selected_routing_id matches the changed routing (and whose status is
 * non-terminal), creates an ECO (status=applied, origin=routing_change),
 * one AffectedItem (the modified routing), and one AffectedDownstream per
 * affected BOM (downstream_type="SupplierRouting"). Supersedes any prior
 * open Flow B downstream rows targeting the same routing.
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

// ── Inline code-generation helper with uniqueness guard ──────────────────────
async function generateEntityCodeInline(svc, entity_name, entity_type) {
  const generators = await svc.entities.SystemCodeGenerator.filter({ entity_name, entity_type });
  if (generators.length === 0) throw new Error(`No SystemCodeGenerator found for entity_name=${entity_name}, entity_type=${entity_type}.`);
  const gen = generators[0];
  const padding = gen.padding || 5;
  const excludedSet = new Set((gen.excluded_codes || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean));
  let nextSeq = (gen.last_sequence || 0) + 1;
  let code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
  while (excludedSet.has(code.toUpperCase())) { nextSeq++; code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`; }

  // UNIQUENESS GUARD
  let attempts = 0;
  while (true) {
    const existing = await svc.entities.ECO.filter({ eco_number: code }, '-created_date', 1);
    if (existing.length === 0) break;
    nextSeq++;
    code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
    attempts++;
    if (attempts > 100) {
      throw new Error(`Code generation collision storm: 100+ attempts to find unique eco_number.`);
    }
  }

  await svc.entities.SystemCodeGenerator.update(gen.id, { last_sequence: nextSeq });
  return code;
}

// ── Inline BOM pending_eco_review_count helpers ────────────────────────────────
async function incrementBomCount(svc, bomId) {
  try {
    const records = await svc.entities.BOM.filter({ id: bomId });
    if (records.length === 0) { console.warn(`[FlowB] BOM not found: ${bomId}`); return; }
    await svc.entities.BOM.update(bomId, { pending_eco_review_count: (records[0].pending_eco_review_count || 0) + 1 });
  } catch (err) {
    console.error(`[FlowB] Failed to increment BOM.pending_eco_review_count on ${bomId}: ${err.message}`);
  }
}

async function decrementBomCount(svc, bomId) {
  try {
    const records = await svc.entities.BOM.filter({ id: bomId });
    if (records.length === 0) { console.warn(`[FlowB] BOM not found: ${bomId}`); return; }
    await svc.entities.BOM.update(bomId, { pending_eco_review_count: Math.max(0, (records[0].pending_eco_review_count || 0) - 1) });
  } catch (err) {
    console.error(`[FlowB] Failed to decrement BOM.pending_eco_review_count on ${bomId}: ${err.message}`);
  }
}

// ── Inline SupplierRouting pending_eco_review_count helpers ──────────────────
async function incrementRoutingCount(svc, routingId) {
  try {
    const records = await svc.entities.SupplierRouting.filter({ id: routingId });
    if (records.length === 0) { console.warn(`[FlowB] SupplierRouting not found: ${routingId}`); return; }
    await svc.entities.SupplierRouting.update(routingId, { pending_eco_review_count: (records[0].pending_eco_review_count || 0) + 1 });
  } catch (err) {
    console.error(`[FlowB] Failed to increment SupplierRouting.pending_eco_review_count on ${routingId}: ${err.message}`);
  }
}

async function decrementRoutingCount(svc, routingId) {
  try {
    const records = await svc.entities.SupplierRouting.filter({ id: routingId });
    if (records.length === 0) { console.warn(`[FlowB] SupplierRouting not found: ${routingId}`); return; }
    await svc.entities.SupplierRouting.update(routingId, { pending_eco_review_count: Math.max(0, (records[0].pending_eco_review_count || 0) - 1) });
  } catch (err) {
    console.error(`[FlowB] Failed to decrement SupplierRouting.pending_eco_review_count on ${routingId}: ${err.message}`);
  }
}

// ── Supersede open Flow B downstream rows for this routing (excluding newEcoId) ─
async function supersedeOpenFlowBDownstreams(svc, routingId, newEcoId, affectedBomIds) {
  try {
    const candidates = await svc.entities.ECOAffectedDownstream.filter({
      downstream_type: 'SupplierRouting',
      downstream_id: routingId,
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
        await decrementRoutingCount(svc, routingId);
        // Decrement parent BOMs too
        for (const bomId of affectedBomIds) await decrementBomCount(svc, bomId);
      } catch (err) {
        console.error(`[FlowB] Failed to supersede downstream row ${row.id}: ${err.message}`);
      }
    }
    return toSupersede.length;
  } catch (err) {
    console.error(`[FlowB] supersedeOpenFlowBDownstreams failed for routing ${routingId}: ${err.message}`);
    return 0;
  }
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

    if (!['draft', 'in_review', 'released'].includes(routing.status)) {
      return Response.json({ success: true, eco_created: false, skipped_reason: `SupplierRouting status '${routing.status}' is terminal — no propagation needed` });
    }

    // ── Step 2: Resolve product name ─────────────────────────────────────────
    let productName = routing.product_id || '';
    try {
      const prods = await svc.entities.Product.filter({ id: routing.product_id });
      if (prods[0]) productName = `${prods[0].code || ''} ${prods[0].name}`.trim();
    } catch (err) {
      console.warn(`[FlowB] Could not resolve product name: ${err.message}`);
    }

    // ── Step 3: Find production BOMs using this routing ───────────────────────
    const allBoms = await svc.entities.BOM.filter({ selected_routing_id: supplier_routing_id, bom_type: 'production' });
    const eligibleBoms = allBoms.filter(b => !TERMINAL_BOM_STATUSES.includes(b.status));

    if (eligibleBoms.length === 0) {
      return Response.json({ success: true, eco_created: false, skipped_reason: 'No active production BOMs reference this routing' });
    }

    const affectedBomIds = eligibleBoms.map(b => b.id);

    // ── Step 4: Create ECO ────────────────────────────────────────────────────
    const n = eligibleBoms.length;
    const priority = n > 20 ? 'critical' : n > 5 ? 'high' : 'normal';

    let eco;
    try {
      const eco_number = await generateEntityCodeInline(svc, 'ECO', 'ECO');
      eco = await svc.entities.ECO.create({
        eco_number,
        title: `Routing changed — ${routing.name} (${productName})`,
        description: `Auto-generated by Flow B trigger. SupplierRouting '${routing.name}' was modified (${change_summary}). ${n} production BOM(s) reference this routing and require review.`,
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
    }

    // ── Step 6: Supersede prior open rows + create new downstream row ─────────
    await supersedeOpenFlowBDownstreams(svc, supplier_routing_id, eco.id, affectedBomIds);

    let affectedDownstreamCount = 0;

    // One downstream row targeting the SupplierRouting itself
    try {
      const downstreamLabel = `${routing.name} (${productName}) — ${n} prod BOM(s) affected`;
      await svc.entities.ECOAffectedDownstream.create({
        eco_id: eco.id,
        downstream_type: 'SupplierRouting',
        downstream_id: supplier_routing_id,
        downstream_label: downstreamLabel,
        flow_type: 'B_routing_change',
        triggering_affected_item_id: affectedItem?.id || null,
        propagation_status: 'pending',
        priority,
      });

      await incrementRoutingCount(svc, supplier_routing_id);
      affectedDownstreamCount++;
    } catch (err) {
      console.error(`[FlowB] Failed to create downstream row for routing ${supplier_routing_id}: ${err.message}`);
    }

    // ── Step 7: BOMChangeLog entries on each affected BOM ────────────────────
    for (const bom of eligibleBoms) {
      try {
        await incrementBomCount(svc, bom.id);
        await svc.entities.BOMChangeLog.create({
          bom_id: bom.id,
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
      } catch (err) {
        console.error(`[FlowB] Failed to log BOMChangeLog for BOM ${bom.id}: ${err.message}`);
      }
    }

    console.log(`[FlowB] Done. eco_id=${eco.id} eco_number=${eco.eco_number} downstream_count=${affectedDownstreamCount} boms_notified=${eligibleBoms.length}`);

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