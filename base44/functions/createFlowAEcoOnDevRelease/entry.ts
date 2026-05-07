/**
 * createFlowAEcoOnDevRelease
 *
 * Flow A propagation trigger: fires when a Development BOM is released.
 * Finds all active Prod BOMs derived from any prior released revision of the
 * same Dev BOM root, creates an ECO (status=applied, origin=dev_bom_release),
 * one AffectedItem (the released Dev BOM), and one AffectedDownstream per
 * derived Prod BOM. Supersedes any prior open Flow A downstream rows for the
 * same Prod BOMs.
 *
 * Payload: { released_bom_id: string }
 *
 * Returns: {
 *   success: boolean,
 *   eco_created: boolean,
 *   eco_id?: string,
 *   eco_number?: string,
 *   affected_item_id?: string,
 *   affected_downstream_count?: number,
 *   skipped_reason?: string,
 *   error?: string
 * }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Inline code-generation helper (canonical pattern from generateEntityCodeInline) ──
async function generateEntityCodeInline(base44ServiceRole, entity_name, entity_type) {
  const generators = await base44ServiceRole.entities.SystemCodeGenerator.filter({ entity_name, entity_type });
  if (generators.length === 0) throw new Error(`No SystemCodeGenerator found for entity_name=${entity_name}, entity_type=${entity_type}.`);
  const gen = generators[0];
  const padding = gen.padding || 5;
  const excludedSet = new Set((gen.excluded_codes || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean));
  let nextSeq = (gen.last_sequence || 0) + 1;
  let code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
  while (excludedSet.has(code.toUpperCase())) { nextSeq++; code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`; }
  await base44ServiceRole.entities.SystemCodeGenerator.update(gen.id, { last_sequence: nextSeq });
  return code;
}

// ── Inline pending_eco_review_count increment ──────────────────────────────────
async function incrementBomPendingEcoCount(serviceRole, bomId) {
  try {
    const records = await serviceRole.entities.BOM.filter({ id: bomId });
    if (records.length === 0) { console.warn(`[FlowA] BOM not found for increment: ${bomId}`); return; }
    const current = records[0].pending_eco_review_count || 0;
    await serviceRole.entities.BOM.update(bomId, { pending_eco_review_count: current + 1 });
  } catch (err) {
    console.error(`[FlowA] Failed to increment pending_eco_review_count on BOM ${bomId}: ${err.message}`);
  }
}

// ── Inline pending_eco_review_count decrement ──────────────────────────────────
async function decrementBomPendingEcoCount(serviceRole, bomId) {
  try {
    const records = await serviceRole.entities.BOM.filter({ id: bomId });
    if (records.length === 0) { console.warn(`[FlowA] BOM not found for decrement: ${bomId}`); return; }
    const current = records[0].pending_eco_review_count || 0;
    await serviceRole.entities.BOM.update(bomId, { pending_eco_review_count: Math.max(0, current - 1) });
  } catch (err) {
    console.error(`[FlowA] Failed to decrement pending_eco_review_count on BOM ${bomId}: ${err.message}`);
  }
}

// ── Supersede open downstream rows for a given Prod BOM (excluding newEcoId) ──
async function supersedeOpenDownstreamsForBom(serviceRole, prodBomId, newEcoId) {
  const NON_TERMINAL = ['pending', 'notified', 'under_review'];
  const now = new Date().toISOString();
  try {
    const candidates = await serviceRole.entities.ECOAffectedDownstream.filter({
      downstream_type: 'BOM',
      downstream_id: prodBomId,
      propagation_status: { $in: NON_TERMINAL },
    });
    const toSupersede = candidates.filter(r => r.eco_id !== newEcoId);
    for (const row of toSupersede) {
      try {
        await serviceRole.entities.ECOAffectedDownstream.update(row.id, {
          propagation_status: 'superseded',
          reviewed_at: now,
        });
        // Decrement count for each superseded row
        await decrementBomPendingEcoCount(serviceRole, prodBomId);
      } catch (err) {
        console.error(`[FlowA] Failed to supersede downstream row ${row.id}: ${err.message}`);
      }
    }
    return toSupersede.length;
  } catch (err) {
    console.error(`[FlowA] supersedeOpenDownstreams failed for BOM ${prodBomId}: ${err.message}`);
    return 0;
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { released_bom_id } = await req.json();
    if (!released_bom_id) return Response.json({ error: 'released_bom_id is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const now = new Date().toISOString();

    // ── Step 1: Load and validate the released BOM ──────────────────────────
    const bomRecords = await svc.entities.BOM.filter({ id: released_bom_id });
    if (bomRecords.length === 0) return Response.json({ error: `BOM not found: ${released_bom_id}` }, { status: 404 });
    const releasedBom = bomRecords[0];

    if (releasedBom.bom_type !== 'development') {
      return Response.json({ success: true, eco_created: false, skipped_reason: 'Not a Development BOM' });
    }
    if (releasedBom.status !== 'released') {
      return Response.json({ success: true, eco_created: false, skipped_reason: 'BOM is not in released status' });
    }

    // ── Step 2: Find ALL prior released Dev BOM revisions for this root ─────
    const allDevBoms = await svc.entities.BOM.filter({
      bom_type: 'development',
      product_id: releasedBom.product_id,
      status: 'released',
    });

    const priorReleasedDevBoms = allDevBoms.filter(b =>
      b.id !== released_bom_id &&
      b.released_at &&
      releasedBom.released_at &&
      b.released_at < releasedBom.released_at
    );

    if (priorReleasedDevBoms.length === 0) {
      return Response.json({ success: true, eco_created: false, skipped_reason: 'No prior released revision; nothing to propagate to' });
    }

    const priorReleasedIds = priorReleasedDevBoms.map(b => b.id);

    // ── Step 3: Find derived active Prod BOMs ────────────────────────────────
    const TERMINAL_BOM_STATUSES = ['superseded', 'obsolete'];
    const allProdBoms = await svc.entities.BOM.filter({
      bom_type: 'production',
      product_id: releasedBom.product_id,
    });
    const derivedProdBoms = allProdBoms.filter(b =>
      priorReleasedIds.includes(b.derived_from_bom_id) &&
      !TERMINAL_BOM_STATUSES.includes(b.status)
    );

    if (derivedProdBoms.length === 0) {
      return Response.json({ success: true, eco_created: false, skipped_reason: 'No active derived Prod BOMs to propagate to' });
    }

    // ── Step 4: Resolve product name ─────────────────────────────────────────
    let productName = releasedBom.product_id;
    try {
      const prods = await svc.entities.Product.filter({ id: releasedBom.product_id });
      if (prods[0]) productName = `${prods[0].code || ''} ${prods[0].name}`.trim();
    } catch (err) {
      console.warn(`[FlowA] Could not resolve product name: ${err.message}`);
    }

    const n = derivedProdBoms.length;
    const priority = n > 20 ? 'critical' : n > 5 ? 'high' : 'normal';

    // ── Step 4: Create ECO ────────────────────────────────────────────────────
    let eco;
    try {
      const eco_number = await generateEntityCodeInline(svc, 'ECO', 'ECO');
      eco = await svc.entities.ECO.create({
        eco_number,
        title: `Dev BOM ${releasedBom.revision_code} released — ${productName}`,
        description: `Auto-generated by Flow A trigger. Released Dev BOM ${releasedBom.revision_code} v${releasedBom.version} for product ${productName}. ${n} derived Production BOM(s) require review.`,
        reason_category: 'design_change',
        priority,
        status: 'applied',
        origin: 'dev_bom_release',
        flow_type: 'A_dev_bom_release',
        requested_by: releasedBom.released_by || user.email,
        requested_at: now,
        applied_at: now,
        approver_id: releasedBom.released_by || user.email,
        approved_at: now,
      });
    } catch (err) {
      console.error(`[FlowA] ECO creation failed: ${err.message}`);
      return Response.json({ success: false, eco_created: false, error: `ECO creation failed: ${err.message}` });
    }

    // ── Step 5: Create AffectedItem ──────────────────────────────────────────
    let affectedItem;
    try {
      affectedItem = await svc.entities.ECOAffectedItem.create({
        eco_id: eco.id,
        item_type: 'BOM',
        item_id: releasedBom.id,
        item_label: `Dev BOM ${releasedBom.revision_code} v${releasedBom.version} — ${productName}`,
        change_kind: 'release',
        before_snapshot: {},
        after_snapshot: {
          revision_code: releasedBom.revision_code,
          version: releasedBom.version,
          status: 'released',
          released_at: releasedBom.released_at,
          released_by: releasedBom.released_by,
        },
        field_diffs: [],
        applied: true,
        applied_at: now,
        applied_by: releasedBom.released_by || user.email,
      });
    } catch (err) {
      console.error(`[FlowA] AffectedItem creation failed: ${err.message}`);
      // ECO was created — partial state, but don't fail entirely
    }

    // ── Step 6: Create AffectedDownstream rows + supersede old open rows ─────
    let affectedDownstreamCount = 0;

    for (const prodBom of derivedProdBoms) {
      try {
        // Supersede prior open rows BEFORE inserting new one (decrement happens inside)
        await supersedeOpenDownstreamsForBom(svc, prodBom.id, eco.id);

        // Build label
        const ctx = prodBom.order_context || {};
        const ctxPart = [ctx.region, ctx.customer_ref].filter(Boolean).join(' — ');
        const downstreamLabel = `Prod BOM rev ${prodBom.revision_code} v${prodBom.version} — ${productName}${ctxPart ? ` — ${ctxPart}` : ''}`;

        // Insert downstream row
        await svc.entities.ECOAffectedDownstream.create({
          eco_id: eco.id,
          downstream_type: 'BOM',
          downstream_id: prodBom.id,
          downstream_label: downstreamLabel,
          flow_type: 'A_dev_bom_release',
          triggering_affected_item_id: affectedItem?.id || null,
          propagation_status: 'pending',
          priority,
        });

        // Increment count on the Prod BOM
        await incrementBomPendingEcoCount(svc, prodBom.id);

        // Step 8: BOMChangeLog entry on the Prod BOM
        await svc.entities.BOMChangeLog.create({
          bom_id: prodBom.id,
          change_type: 'derived_source_changed',
          payload: {
            eco_id: eco.id,
            eco_number: eco.eco_number,
            source_dev_bom_id: releasedBom.id,
            source_revision_code: releasedBom.revision_code,
          },
          triggered_by: releasedBom.released_by || user.email,
          triggered_at: now,
        });

        affectedDownstreamCount++;
      } catch (err) {
        console.error(`[FlowA] Failed to process downstream for Prod BOM ${prodBom.id}: ${err.message}`);
        // Continue — partial success is acceptable per spec
      }
    }

    console.log(`[FlowA] Done. eco_id=${eco.id} eco_number=${eco.eco_number} downstream_count=${affectedDownstreamCount}`);

    return Response.json({
      success: true,
      eco_created: true,
      eco_id: eco.id,
      eco_number: eco.eco_number,
      affected_item_id: affectedItem?.id || null,
      affected_downstream_count: affectedDownstreamCount,
    });

  } catch (error) {
    console.error(`[FlowA] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});