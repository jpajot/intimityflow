/**
 * addEcoAffectedItem
 *
 * Canonical entry point for attaching an affected item to an ECO.
 * Validates inputs, computes field_diffs, and inserts an ECOAffectedItem record.
 *
 * Payload:
 *   eco_id        string   required
 *   item_type     string   required  — must be in ALLOWED_ITEM_TYPES
 *   item_id       string   required
 *   change_kind   string   required  — must be in ALLOWED_CHANGE_KINDS
 *   before_snapshot  object  optional
 *   after_snapshot   object  optional
 *   item_label    string   optional
 *   notes         string   optional
 *
 * Returns: { success: true, affected_item_id: string }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_ITEM_TYPES = [
  'BOM', 'BOMLine', 'BOMLineVariant',
  'SupplierRouting', 'SupplierRoutingStep',
  'ApprovedSupplier', 'ProductColorSupplierLink',
  'ProductColor', 'Product', 'ProductRevision',
];

const ALLOWED_CHANGE_KINDS = ['add', 'modify', 'remove', 'reassign', 'release'];

function isEmpty(obj) {
  return obj === null || obj === undefined || (typeof obj === 'object' && Object.keys(obj).length === 0);
}

function computeFieldDiffs(before, after) {
  if (!before || !after) return [];
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  const diffs = [];
  for (const field of keys) {
    const b = before[field] ?? null;
    const a = after[field] ?? null;
    if (b === null && a === null) continue;
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diffs.push({ field, before: b, after: a });
    }
  }
  return diffs;
}

// NOTE: This function only creates the ECOAffectedItem record (the intent log).
// It does NOT trigger downstream auto-population (ECOAffectedDownstream rows).
// Downstream population is a separate concern handled by transitionEcoStatus
// when the ECO transitions to "applied" — at that point, computeDownstream()
// runs for each AffectedItem and creates the corresponding propagation rows.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      eco_id,
      item_type,
      item_id,
      change_kind,
      before_snapshot = null,
      after_snapshot = null,
      item_label = null,
      notes = null,
    } = await req.json();

    // 1. Required fields
    if (!eco_id) return Response.json({ error: 'eco_id is required' }, { status: 400 });
    if (!item_type) return Response.json({ error: 'item_type is required' }, { status: 400 });
    if (!item_id) return Response.json({ error: 'item_id is required' }, { status: 400 });
    if (!change_kind) return Response.json({ error: 'change_kind is required' }, { status: 400 });

    // 2. Validate item_type
    if (!ALLOWED_ITEM_TYPES.includes(item_type)) {
      return Response.json({ error: `Invalid item_type "${item_type}". Allowed: ${ALLOWED_ITEM_TYPES.join(', ')}` }, { status: 400 });
    }

    // 3. Validate change_kind
    if (!ALLOWED_CHANGE_KINDS.includes(change_kind)) {
      return Response.json({ error: `Invalid change_kind "${change_kind}". Allowed: ${ALLOWED_CHANGE_KINDS.join(', ')}` }, { status: 400 });
    }

    // 1 (cont). Validate ECO exists
    const ecos = await base44.asServiceRole.entities.ECO.filter({ id: eco_id });
    if (ecos.length === 0) {
      return Response.json({ error: `ECO not found: ${eco_id}` }, { status: 404 });
    }

    // 4. Validate snapshot / change_kind combination
    if (change_kind === 'add') {
      if (!isEmpty(before_snapshot)) {
        return Response.json({ error: 'change_kind "add": before_snapshot must be null or {} (item did not exist before this ECO).' }, { status: 400 });
      }
      if (isEmpty(after_snapshot)) {
        return Response.json({ error: 'change_kind "add": after_snapshot must be a non-empty object (captures the new item state).' }, { status: 400 });
      }
    } else if (change_kind === 'remove') {
      if (isEmpty(before_snapshot)) {
        return Response.json({ error: 'change_kind "remove": before_snapshot must be a non-empty object (captures the state being removed).' }, { status: 400 });
      }
      if (!isEmpty(after_snapshot)) {
        return Response.json({ error: 'change_kind "remove": after_snapshot must be null or {} (item will not exist after this ECO).' }, { status: 400 });
      }
    } else {
      // modify | reassign | release
      if (isEmpty(before_snapshot)) {
        return Response.json({ error: `change_kind "${change_kind}": before_snapshot must be a non-empty object.` }, { status: 400 });
      }
      if (isEmpty(after_snapshot)) {
        return Response.json({ error: `change_kind "${change_kind}": after_snapshot must be a non-empty object.` }, { status: 400 });
      }
    }

    // 5. Compute field_diffs
    const field_diffs = computeFieldDiffs(before_snapshot, after_snapshot);

    // 6. Insert record
    const record = await base44.asServiceRole.entities.ECOAffectedItem.create({
      eco_id,
      item_type,
      item_id,
      item_label: item_label || null,
      change_kind,
      before_snapshot: before_snapshot || null,
      after_snapshot: after_snapshot || null,
      field_diffs,
      applied: false,
      applied_at: null,
      applied_by: null,
      application_error: null,
      item_revision_id: null,
      notes: notes || null,
    });

    // 7. Return
    return Response.json({ success: true, affected_item_id: record.id });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});