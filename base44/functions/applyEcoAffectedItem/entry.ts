/**
 * applyEcoAffectedItem
 *
 * Applies a single ECOAffectedItem's change to the target entity.
 * Idempotent: if already applied, returns success immediately.
 *
 * Does NOT create ProductRevision rows, BOMChangeLog entries, or trigger
 * AffectedDownstream propagation — those are Phase 4 concerns.
 *
 * Payload:
 *   affected_item_id  string  required
 *
 * Returns: { success: boolean, applied: boolean, error?: string }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ECO_APPLY_ALLOWED_STATUSES = ['approved', 'applied'];

// Entity types that use soft-delete (status field) rather than hard delete.
// Maps item_type → { field, value } to set when removing.
const SOFT_DELETE_MAP = {
  ApprovedSupplier:         { field: 'status',            value: 'inactive' },
  SupplierRouting:          { field: 'status',            value: 'inactive' },
  ProductColor:             { field: 'colorway_status',   value: 'obsolete' },
  Product:                  { field: 'status',            value: 'inactive' },
  BOM:                      { field: 'status',            value: 'obsolete' },
};

// Entity types where hard delete is reasonable (junction/line records with no status field)
const HARD_DELETE_TYPES = new Set([
  'BOMLine', 'BOMLineVariant', 'SupplierRoutingStep', 'ProductColorSupplierLink',
]);

async function applyChange(serviceRole, item) {
  const entityStore = serviceRole.entities[item.item_type];
  if (!entityStore) {
    throw new Error(`No entity store found for item_type "${item.item_type}".`);
  }

  if (item.change_kind === 'add') {
    // Create the entity using after_snapshot as field values
    const created = await entityStore.create(item.after_snapshot);
    return { created_id: created.id };
  }

  if (item.change_kind === 'modify' || item.change_kind === 'reassign' || item.change_kind === 'release') {
    // Verify the target still exists
    const existing = await entityStore.filter({ id: item.item_id });
    if (existing.length === 0) {
      throw new Error(`Target item not found: ${item.item_type} id=${item.item_id}`);
    }
    await entityStore.update(item.item_id, item.after_snapshot);
    return {};
  }

  if (item.change_kind === 'remove') {
    if (HARD_DELETE_TYPES.has(item.item_type)) {
      // Verify exists first
      const existing = await entityStore.filter({ id: item.item_id });
      if (existing.length === 0) {
        throw new Error(`Target item not found: ${item.item_type} id=${item.item_id}`);
      }
      await entityStore.delete(item.item_id);
      return {};
    }

    const softDelete = SOFT_DELETE_MAP[item.item_type];
    if (softDelete) {
      const existing = await entityStore.filter({ id: item.item_id });
      if (existing.length === 0) {
        throw new Error(`Target item not found: ${item.item_type} id=${item.item_id}`);
      }
      await entityStore.update(item.item_id, { [softDelete.field]: softDelete.value });
      return {};
    }

    // Fallback: no removal mechanism known
    throw new Error(`No removal mechanism defined for item_type "${item.item_type}". Cannot apply remove change_kind.`);
  }

  throw new Error(`Unknown change_kind "${item.change_kind}".`);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { affected_item_id } = await req.json();
    if (!affected_item_id) {
      return Response.json({ error: 'affected_item_id is required' }, { status: 400 });
    }

    // 1. Load the ECOAffectedItem
    const items = await base44.asServiceRole.entities.ECOAffectedItem.filter({ id: affected_item_id });
    if (items.length === 0) {
      return Response.json({ error: `ECOAffectedItem not found: ${affected_item_id}` }, { status: 404 });
    }
    const item = items[0];

    // 2. Idempotency guard
    if (item.applied === true) {
      return Response.json({ success: true, applied: true });
    }

    // 3. Validate parent ECO status
    const ecos = await base44.asServiceRole.entities.ECO.filter({ id: item.eco_id });
    if (ecos.length === 0) {
      return Response.json({ error: `Parent ECO not found: ${item.eco_id}` }, { status: 404 });
    }
    const eco = ecos[0];
    if (!ECO_APPLY_ALLOWED_STATUSES.includes(eco.status)) {
      return Response.json({
        error: `Cannot apply AffectedItem: parent ECO status is "${eco.status}". Required: approved or applied.`,
      }, { status: 400 });
    }

    // 4. Apply the change (catching item-level errors without rethrowing)
    let applyError = null;
    try {
      await applyChange(base44.asServiceRole, item);
    } catch (err) {
      applyError = err.message;
    }

    const now = new Date().toISOString();

    if (applyError) {
      // 6. On failure: record error, do not throw
      await base44.asServiceRole.entities.ECOAffectedItem.update(affected_item_id, {
        application_error: applyError,
      });
      return Response.json({ success: false, applied: false, error: applyError });
    }

    // 5. On success: mark applied
    await base44.asServiceRole.entities.ECOAffectedItem.update(affected_item_id, {
      applied: true,
      applied_at: now,
      applied_by: user.email,
      application_error: null,
    });

    return Response.json({ success: true, applied: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});