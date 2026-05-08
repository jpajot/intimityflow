/**
 * transitionEcoStatus
 *
 * Orchestrates ECO status transitions including:
 * - State machine validation (inlined from validateEcoStatusTransition)
 * - ECO record updates with proper timestamps
 * - Auto-apply on approval (applies AffectedItems + creates AffectedDownstream rows)
 * - Downstream auto-population (inlined getWhereUsed logic for ProductColor)
 * - BOMChangeLog entries with change_type = "manual_eco_applied"
 * - Close guard (all downstream must be terminal)
 *
 * Payload:
 *   eco_id                string  required
 *   new_status            string  required
 *   approver_id           string  optional (required for approved/rejected)
 *   rejection_reason      string  optional (required for rejected)
 *   cancellation_reason   string  optional (required for cancelled)
 *   notes_append          string  optional (appended to ECO.notes for send-back etc.)
 *   auto_apply_on_approve boolean default true
 *
 * Returns:
 *   { success, eco_id, final_status, affected_items_applied, affected_downstream_created, application_errors, error }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Inlined state machine ──────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS = {
  proposed:     ['under_review', 'cancelled'],
  under_review: ['approved', 'rejected', 'proposed'],
  approved:     ['applied'],
  applied:      ['closed'],
};

const NON_TERMINAL_DOWNSTREAM = new Set(['pending', 'notified', 'under_review']);

function validateTransition(from, to, fields) {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid ECO status transition: ${from} → ${to} is not allowed. ` +
      `Allowed transitions from "${from}": ${allowed.length ? allowed.join(', ') : 'none'}.`
    );
  }
  if (to === 'applied' && !fields?.applied_at) {
    throw new Error(`Transition to "applied" requires applied_at to be set in the same write.`);
  }
  if (to === 'closed' && !fields?.closed_at) {
    throw new Error(`Transition to "closed" requires closed_at to be set in the same write.`);
  }
  if ((to === 'approved' || to === 'rejected') && !fields?.approver_id) {
    throw new Error(`Transition to "${to}" requires approver_id to be set in the same write.`);
  }
  if ((to === 'approved' || to === 'rejected') && !fields?.approved_at) {
    throw new Error(`Transition to "${to}" requires approved_at to be set in the same write.`);
  }
  return { valid: true };
}

// ── Inlined apply-change logic (mirrors applyEcoAffectedItem) ─────────────────

const SOFT_DELETE_MAP = {
  ApprovedSupplier:         { field: 'status',            value: 'inactive' },
  SupplierRouting:          { field: 'status',            value: 'inactive' },
  ProductColor:             { field: 'colorway_status',   value: 'obsolete' },
  Product:                  { field: 'status',            value: 'inactive' },
  BOM:                      { field: 'status',            value: 'obsolete' },
};
const HARD_DELETE_TYPES = new Set(['BOMLine', 'BOMLineVariant', 'SupplierRoutingStep', 'ProductColorSupplierLink']);

async function applyChange(serviceRole, item) {
  const entityStore = serviceRole.entities[item.item_type];
  if (!entityStore) throw new Error(`No entity store found for item_type "${item.item_type}".`);

  if (item.change_kind === 'add') {
    const created = await entityStore.create(item.after_snapshot);
    return { created_id: created.id };
  }
  if (item.change_kind === 'modify' || item.change_kind === 'reassign' || item.change_kind === 'release') {
    const existing = await entityStore.filter({ id: item.item_id });
    if (existing.length === 0) throw new Error(`Target item not found: ${item.item_type} id=${item.item_id}`);
    await entityStore.update(item.item_id, item.after_snapshot);
    return {};
  }
  if (item.change_kind === 'remove') {
    if (HARD_DELETE_TYPES.has(item.item_type)) {
      const existing = await entityStore.filter({ id: item.item_id });
      if (existing.length === 0) throw new Error(`Target item not found: ${item.item_type} id=${item.item_id}`);
      await entityStore.delete(item.item_id);
      return {};
    }
    const softDelete = SOFT_DELETE_MAP[item.item_type];
    if (softDelete) {
      const existing = await entityStore.filter({ id: item.item_id });
      if (existing.length === 0) throw new Error(`Target item not found: ${item.item_type} id=${item.item_id}`);
      await entityStore.update(item.item_id, { [softDelete.field]: softDelete.value });
      return {};
    }
    throw new Error(`No removal mechanism defined for item_type "${item.item_type}".`);
  }
  throw new Error(`Unknown change_kind "${item.change_kind}".`);
}

// ── Inlined pending_eco_review_count increment ─────────────────────────────────

async function incrementPendingCount(serviceRole, downstream_type, downstream_id) {
  try {
    if (downstream_type === 'BOM') {
      const recs = await serviceRole.entities.BOM.filter({ id: downstream_id });
      if (recs.length === 0) return;
      const cur = recs[0].pending_eco_review_count || 0;
      await serviceRole.entities.BOM.update(downstream_id, { pending_eco_review_count: cur + 1 });
    } else if (downstream_type === 'BOL') {
      const recs = await serviceRole.entities.BOL.filter({ id: downstream_id });
      if (recs.length === 0) return;
      const cur = recs[0].pending_eco_review_count || 0;
      await serviceRole.entities.BOL.update(downstream_id, { pending_eco_review_count: cur + 1 });
    }
  } catch (err) {
    console.error(`[transitionEcoStatus] incrementPendingCount failed for ${downstream_type}/${downstream_id}: ${err.message}`);
  }
}

// ── Downstream auto-population: compute downstream artifacts for an AffectedItem ──
// Supports all item_types that have meaningful downstream relationships.
// Returns array of { downstream_type, downstream_id, downstream_label }

async function computeDownstream(serviceRole, item) {
  const results = [];
  const entities = serviceRole.entities;

  try {
    switch (item.item_type) {

      case 'ProductColor': {
        // BOMLineVariants that use this colorway as component or variant axis
        const [varComp, varAxis] = await Promise.all([
          entities.BOMLineVariant.filter({ component_product_color_id: item.item_id }, '-created_date', 200),
          entities.BOMLineVariant.filter({ product_color_id: item.item_id }, '-created_date', 200),
        ]);
        const allVariants = [...varComp, ...varAxis];
        const seen = new Set();
        for (const v of allVariants) {
          if (seen.has(v.id)) continue;
          seen.add(v.id);
          // Resolve label via BOMLine → BOM → Product
          let label = `BOMLineVariant:${v.id}`;
          try {
            const lines = await entities.BOMLine.filter({ id: v.bom_line_id });
            if (lines.length > 0) {
              const boms = await entities.BOM.filter({ id: lines[0].bom_id });
              if (boms.length > 0) {
                const prods = await entities.Product.filter({ id: boms[0].product_id });
                const pName = prods.length > 0 ? `${prods[0].code || ''} ${prods[0].name}`.trim() : `Product:${boms[0].product_id}`;
                const bomLabel = `${boms[0].bom_type === 'production' ? 'Prod' : 'Dev'} BOM rev ${boms[0].revision_code} v${boms[0].version} — ${pName}`;
                const parts = [
                  v.product_color_id ? `color:${v.product_color_id?.slice(-6)}` : null,
                  v.size_id ? `size:${v.size_id?.slice(-6)}` : null,
                ].filter(Boolean);
                label = `${bomLabel} > Line #${lines[0].position ?? '?'} (${lines[0].component_role || '—'}) > Variant: ${parts.join(', ') || v.id.slice(-6)}`;
              }
            }
          } catch (_) { /* label fallback */ }
          results.push({ downstream_type: 'BOMLineVariant', downstream_id: v.id, downstream_label: label });
        }
        break;
      }

      case 'Product': {
        // BOMs for this product + BOMLines where it's a component
        const [boms, lines] = await Promise.all([
          entities.BOM.filter({ product_id: item.item_id }, '-created_date', 100),
          entities.BOMLine.filter({ component_product_id: item.item_id }, '-created_date', 200),
        ]);
        for (const bom of boms) {
          const prods = await entities.Product.filter({ id: bom.product_id }).catch(() => []);
          const pName = prods.length > 0 ? `${prods[0].code || ''} ${prods[0].name}`.trim() : `Product:${bom.product_id}`;
          const label = `${bom.bom_type === 'production' ? 'Prod' : 'Dev'} BOM rev ${bom.revision_code} v${bom.version} — ${pName}`;
          results.push({ downstream_type: 'BOM', downstream_id: bom.id, downstream_label: label });
        }
        for (const line of lines.slice(0, 50)) {
          results.push({ downstream_type: 'BOMLine', downstream_id: line.id, downstream_label: `BOMLine #${line.position ?? '?'} (${line.component_role || '—'}) in BOM:${line.bom_id?.slice(-6)}` });
        }
        break;
      }

      case 'BOM': {
        // BOL attached to this BOM + derived production BOMs
        const [bols, derived] = await Promise.all([
          entities.BOL.filter({ bom_id: item.item_id }, '-created_date', 10),
          entities.BOM.filter({ derived_from_bom_id: item.item_id }, '-created_date', 50),
        ]);
        const boms = await entities.BOM.filter({ id: item.item_id }).catch(() => []);
        const bom = boms[0] || null;
        let bomBaseLabel = `BOM:${item.item_id}`;
        if (bom) {
          const prods = await entities.Product.filter({ id: bom.product_id }).catch(() => []);
          const pName = prods.length > 0 ? `${prods[0].code || ''} ${prods[0].name}`.trim() : `Product:${bom.product_id}`;
          bomBaseLabel = `${bom.bom_type === 'production' ? 'Prod' : 'Dev'} BOM rev ${bom.revision_code} v${bom.version} — ${pName}`;
        }
        for (const bol of bols) {
          results.push({ downstream_type: 'BOL', downstream_id: bol.id, downstream_label: `BOL for ${bomBaseLabel}` });
        }
        for (const d of derived.slice(0, 20)) {
          results.push({ downstream_type: 'BOM', downstream_id: d.id, downstream_label: `Derived BOM:${d.id.slice(-6)}` });
        }
        break;
      }

      case 'SupplierRouting': {
        const [boms, bols] = await Promise.all([
          entities.BOM.filter({ selected_routing_id: item.item_id }, '-created_date', 100),
          entities.BOL.filter({ source_routing_id: item.item_id }, '-created_date', 50),
        ]);
        for (const bom of boms) {
          results.push({ downstream_type: 'BOM', downstream_id: bom.id, downstream_label: `BOM:${bom.id.slice(-6)}` });
        }
        for (const bol of bols) {
          results.push({ downstream_type: 'BOL', downstream_id: bol.id, downstream_label: `BOL:${bol.id.slice(-6)}` });
        }
        break;
      }

      case 'ApprovedSupplier': {
        const variants = await entities.BOMLineVariant.filter({ approved_supplier_id: item.item_id }, '-created_date', 200).catch(() => []);
        for (const v of variants.slice(0, 50)) {
          results.push({ downstream_type: 'BOMLineVariant', downstream_id: v.id, downstream_label: `BOMLineVariant:${v.id.slice(-6)} (supplier changed)` });
        }
        break;
      }

      case 'BOMLine': {
        const variants = await entities.BOMLineVariant.filter({ bom_line_id: item.item_id }, '-created_date', 200).catch(() => []);
        for (const v of variants.slice(0, 50)) {
          results.push({ downstream_type: 'BOMLineVariant', downstream_id: v.id, downstream_label: `BOMLineVariant:${v.id.slice(-6)}` });
        }
        break;
      }

      // BOMLineVariant, ProductColorSupplierLink, SupplierRoutingStep, ProductRevision:
      // no significant downstream ECO propagation targets in v1
      default:
        break;
    }
  } catch (err) {
    console.error(`[transitionEcoStatus] computeDownstream error for ${item.item_type}/${item.item_id}: ${err.message}`);
  }

  return results;
}

// ── Supersede open downstream rows targeting the same artifact ────────────────

async function supersedeExistingOpenRows(serviceRole, eco_id, downstream_type, downstream_id) {
  try {
    const existing = await serviceRole.entities.ECOAffectedDownstream.filter({
      downstream_type,
      downstream_id,
    }, '-created_date', 50);
    const openOtherRows = existing.filter(r =>
      r.eco_id !== eco_id &&
      NON_TERMINAL_DOWNSTREAM.has(r.propagation_status)
    );
    for (const row of openOtherRows) {
      await serviceRole.entities.ECOAffectedDownstream.update(row.id, {
        propagation_status: 'superseded',
        reviewed_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error(`[transitionEcoStatus] supersede failed for ${downstream_type}/${downstream_id}: ${err.message}`);
  }
}

// ── BOMChangeLog entry writer ──────────────────────────────────────────────────

async function writeBomChangeLog(serviceRole, bom_id, eco_id, eco_number, affected_item_ids) {
  try {
    await serviceRole.entities.BOMChangeLog.create({
      bom_id,
      change_type: 'manual_eco_applied',
      payload: { eco_id, eco_number, affected_item_ids },
      triggered_by: 'system',
      triggered_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[transitionEcoStatus] BOMChangeLog write failed for bom_id=${bom_id}: ${err.message}`);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      eco_id,
      new_status,
      approver_id = null,
      rejection_reason = null,
      cancellation_reason = null,
      notes_append = null,
      auto_apply_on_approve = true,
    } = await req.json();

    if (!eco_id) return Response.json({ error: 'eco_id is required' }, { status: 400 });
    if (!new_status) return Response.json({ error: 'new_status is required' }, { status: 400 });

    const sr = base44.asServiceRole;

    // 1. Load ECO
    const ecos = await sr.entities.ECO.filter({ id: eco_id });
    if (ecos.length === 0) return Response.json({ success: false, error: `ECO not found: ${eco_id}` }, { status: 404 });
    const eco = ecos[0];
    const from_status = eco.status;

    const now = new Date().toISOString();

    // 2. Build the update payload for the target status
    let updatePayload = { status: new_status };

    if (new_status === 'approved') {
      updatePayload.approved_at = now;
      updatePayload.approver_id = approver_id || user.email;
    }
    if (new_status === 'rejected') {
      updatePayload.approved_at = now;
      updatePayload.approver_id = approver_id || user.email;
      if (rejection_reason) updatePayload.rejection_reason = rejection_reason;
    }
    if (new_status === 'applied') {
      if (!eco.applied_at) updatePayload.applied_at = now;
    }
    if (new_status === 'cancelled') {
      updatePayload.closed_at = now;
      if (cancellation_reason) updatePayload.cancellation_reason = cancellation_reason;
    }
    if (new_status === 'closed') {
      updatePayload.closed_at = now;
    }
    if (notes_append) {
      const existing = eco.notes || '';
      const prefix = `[${now.slice(0, 16).replace('T', ' ')} by ${user.email}] `;
      updatePayload.notes = existing ? `${existing}\n${prefix}${notes_append}` : `${prefix}${notes_append}`;
    }

    // 3. Validate transition
    try {
      validateTransition(from_status, new_status, updatePayload);
    } catch (err) {
      return Response.json({ success: false, final_status: from_status, error: err.message });
    }

    // 4. Closure guard: all downstream must be terminal
    if (new_status === 'closed') {
      const downstreamRows = await sr.entities.ECOAffectedDownstream.filter({ eco_id }, '-created_date', 500);
      const nonTerminal = downstreamRows.filter(r => NON_TERMINAL_DOWNSTREAM.has(r.propagation_status));
      if (nonTerminal.length > 0) {
        return Response.json({
          success: false,
          final_status: from_status,
          error: `Cannot close ECO: ${nonTerminal.length} downstream review(s) still pending.`,
        });
      }
    }

    // 5. Update ECO to new_status
    await sr.entities.ECO.update(eco_id, updatePayload);

    let finalStatus = new_status;
    let affectedItemsApplied = 0;
    let affectedDownstreamCreated = 0;
    const applicationErrors = [];

    // 6. Auto-approve → auto-apply (unless future-dated)
    let shouldApply = false;

    if (new_status === 'approved' && auto_apply_on_approve) {
      // Check if target_effective_date is in the future
      const ted = eco.target_effective_date;
      const tedIsInFuture = ted ? (new Date(ted) > new Date()) : false;

      if (tedIsInFuture) {
        // Skip auto-apply; stay at approved. User uses "Apply now" button later.
        console.log(`[transitionEcoStatus] Skipping auto-apply: target_effective_date ${ted} is in the future.`);
      } else {
        shouldApply = true;
      }
    }

    if (new_status === 'applied') {
      shouldApply = true;
    }

    // 7. If applying: transition ECO to "applied", then run items + downstream population
    if (shouldApply && new_status === 'approved') {
      // Second transition: approved → applied
      const applyNow = new Date().toISOString();
      const applyPayload = { status: 'applied', applied_at: applyNow };
      try {
        validateTransition('approved', 'applied', applyPayload);
        await sr.entities.ECO.update(eco_id, applyPayload);
        finalStatus = 'applied';
      } catch (err) {
        // If this second step fails, we stay at "approved" and report partial success
        console.error(`[transitionEcoStatus] auto-apply step failed: ${err.message}`);
        shouldApply = false;
      }
    }

    if (shouldApply) {
      // 7a. Load AffectedItems
      const affectedItems = await sr.entities.ECOAffectedItem.filter({ eco_id }, '-created_date', 200);

      // Track BOM ids for BOMChangeLog (deduped)
      const bomIdsForChangelog = new Set();

      // 7b. Apply each item
      for (const item of affectedItems) {
        if (item.applied === true) {
          affectedItemsApplied++;
          continue;
        }
        let applyError = null;
        try {
          await applyChange(sr, item);
        } catch (err) {
          applyError = err.message;
        }

        const applyNow = new Date().toISOString();
        if (applyError) {
          await sr.entities.ECOAffectedItem.update(item.id, { application_error: applyError });
          applicationErrors.push({ affected_item_id: item.id, error_message: applyError });
        } else {
          await sr.entities.ECOAffectedItem.update(item.id, {
            applied: true,
            applied_at: applyNow,
            applied_by: user.email,
            application_error: null,
          });
          affectedItemsApplied++;
        }

        // 7c. Compute downstream for this item (even if apply failed — we still track downstream)
        const downstreamTargets = await computeDownstream(sr, item);

        for (const dt of downstreamTargets) {
          try {
            // Check dedup first (inline)
            const existing = await sr.entities.ECOAffectedDownstream.filter({
              eco_id,
              downstream_type: dt.downstream_type,
              downstream_id: dt.downstream_id,
            });
            if (existing.length > 0) continue; // already tracked

            // Supersede other open rows targeting same artifact
            await supersedeExistingOpenRows(sr, eco_id, dt.downstream_type, dt.downstream_id);

            // Create the downstream row
            await sr.entities.ECOAffectedDownstream.create({
              eco_id,
              downstream_type: dt.downstream_type,
              downstream_id: dt.downstream_id,
              downstream_label: dt.downstream_label || null,
              flow_type: eco.flow_type || 'manual',
              triggering_affected_item_id: item.id,
              propagation_status: 'pending',
              reviewed_by: null,
              reviewed_at: null,
              resulting_artifact_type: null,
              resulting_artifact_id: null,
              decision_notes: null,
              notification_sent_at: null,
              priority: eco.priority || 'normal',
            });
            affectedDownstreamCreated++;

            // Increment pending_eco_review_count (best-effort)
            await incrementPendingCount(sr, dt.downstream_type, dt.downstream_id);

            // Track BOM ids for changelog
            if (dt.downstream_type === 'BOM') {
              bomIdsForChangelog.add(dt.downstream_id);
            }
          } catch (err) {
            console.error(`[transitionEcoStatus] downstream row creation failed for ${dt.downstream_type}/${dt.downstream_id}: ${err.message}`);
          }
        }
      }

      // 7d. Write BOMChangeLog entries for each affected BOM
      const affectedItemIds = affectedItems.map(i => i.id);
      for (const bom_id of bomIdsForChangelog) {
        await writeBomChangeLog(sr, bom_id, eco_id, eco.eco_number, affectedItemIds);
      }
    }

    return Response.json({
      success: true,
      eco_id,
      final_status: finalStatus,
      affected_items_applied: affectedItemsApplied,
      affected_downstream_created: affectedDownstreamCreated,
      application_errors: applicationErrors,
    });

  } catch (error) {
    console.error(`[transitionEcoStatus] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});