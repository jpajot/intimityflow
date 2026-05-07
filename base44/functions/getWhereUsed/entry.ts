/**
 * getWhereUsed
 *
 * Generic reverse-lookup / where-used query layer for ECO impact analysis,
 * dependency visualization, and Flow D AffectedDownstream population.
 *
 * v1: Live query only (no materialization). Per locked decision #5.
 * The function signature is intentionally generic — when materialization is
 * added later, callers won't change.
 *
 * Payload:
 *   entity_type              string   required  — one of the 10 supported types
 *   entity_id                string   required
 *   include_terminal_eco_state  boolean  optional  default false
 *   include_inactive            boolean  optional  default false
 *
 * Returns: WhereUsedResult (see spec)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Constants ──────────────────────────────────────────────────────────────────

const SUPPORTED_ENTITY_TYPES = [
  'Product',
  'ProductColor',
  'ProductRevision',
  'BOM',
  'SupplierRouting',
  'SupplierRoutingStep',
  'ApprovedSupplier',
  'ProductColorSupplierLink',
  'BOMLine',
  'BOMLineVariant',
];

const GROUP_CAP = 200;

const TERMINAL_ECO_STATUSES = ['closed', 'cancelled', 'rejected'];
const BOM_INACTIVE_STATUSES = ['superseded', 'obsolete'];
const DOWNSTREAM_TYPES_WITH_ECO = new Set(['BOM', 'BOL', 'BOMLineVariant', 'BOMLine']);

// ── Label cache (within a single call) ────────────────────────────────────────

function makeCache() {
  const _store = {};
  return {
    get: (k) => _store[k],
    set: (k, v) => { _store[k] = v; },
    has: (k) => k in _store,
  };
}

// ── Safe filter wrapper ────────────────────────────────────────────────────────
// Returns [] on failure and appends to skippedLookups.

async function safeFilter(entityObj, query, skippedLookups, lookupKey, limit = 500) {
  try {
    return await entityObj.filter(query, '-created_date', limit);
  } catch (err) {
    console.error(`[getWhereUsed] safeFilter failed for ${lookupKey}: ${err.message}`);
    skippedLookups.push(lookupKey);
    return [];
  }
}

// ── Truncation helper ──────────────────────────────────────────────────────────

function capGroup(records, relationshipKey, truncatedGroups) {
  if (records.length > GROUP_CAP) {
    truncatedGroups.push(relationshipKey);
    return { records: records.slice(0, GROUP_CAP), total: records.length };
  }
  return { records, total: records.length };
}

// ── Label builders ─────────────────────────────────────────────────────────────

async function getBomLabel(bomId, entities, cache) {
  if (!bomId) return `BOM:${bomId}`;
  const cacheKey = `bom:${bomId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  try {
    const boms = await entities.BOM.filter({ id: bomId });
    const bom = boms[0];
    if (!bom) { cache.set(cacheKey, `BOM:${bomId}`); return `BOM:${bomId}`; }
    const productName = await getProductName(bom.product_id, entities, cache);
    const ctx = bom.order_context || {};
    const ctxPart = [ctx.region, ctx.customer_ref].filter(Boolean).join('/');
    const label = `${bom.bom_type === 'production' ? 'Prod' : 'Dev'} BOM rev ${bom.revision_code} v${bom.version} — ${productName}${ctxPart ? ` — ${ctxPart}` : ''}`;
    cache.set(cacheKey, label);
    return label;
  } catch {
    cache.set(cacheKey, `BOM:${bomId}`);
    return `BOM:${bomId}`;
  }
}

async function getProductName(productId, entities, cache) {
  if (!productId) return '(unknown product)';
  const cacheKey = `product:${productId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  try {
    const prods = await entities.Product.filter({ id: productId });
    const p = prods[0];
    const name = p ? `${p.code || ''} ${p.name}`.trim() : `Product:${productId}`;
    cache.set(cacheKey, name);
    return name;
  } catch {
    cache.set(cacheKey, `Product:${productId}`);
    return `Product:${productId}`;
  }
}

async function getSupplierName(supplierId, entities, cache) {
  if (!supplierId) return '(unknown supplier)';
  const cacheKey = `supplier:${supplierId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  try {
    const suppliers = await entities.Supplier.filter({ id: supplierId });
    const s = suppliers[0];
    const name = s ? s.name : `Supplier:${supplierId}`;
    cache.set(cacheKey, name);
    return name;
  } catch {
    cache.set(cacheKey, `Supplier:${supplierId}`);
    return `Supplier:${supplierId}`;
  }
}

async function getRoutingName(routingId, entities, cache) {
  if (!routingId) return `SupplierRouting:${routingId}`;
  const cacheKey = `routing:${routingId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  try {
    const routings = await entities.SupplierRouting.filter({ id: routingId });
    const r = routings[0];
    const name = r ? r.name : `SupplierRouting:${routingId}`;
    cache.set(cacheKey, name);
    return name;
  } catch {
    cache.set(cacheKey, `SupplierRouting:${routingId}`);
    return `SupplierRouting:${routingId}`;
  }
}

async function getProductColorLabel(productColorId, entities, cache) {
  if (!productColorId) return `ProductColor:${productColorId}`;
  const cacheKey = `productcolor:${productColorId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  try {
    const pcs = await entities.ProductColor.filter({ id: productColorId });
    const pc = pcs[0];
    const label = pc ? `${pc.color_name}${pc.colorway_code ? ` (${pc.colorway_code})` : ''}` : `ProductColor:${productColorId}`;
    cache.set(cacheKey, label);
    return label;
  } catch {
    cache.set(cacheKey, `ProductColor:${productColorId}`);
    return `ProductColor:${productColorId}`;
  }
}

async function getEcoNumber(ecoId, entities, cache) {
  if (!ecoId) return `ECO:${ecoId}`;
  const cacheKey = `eco:${ecoId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  try {
    const ecos = await entities.ECO.filter({ id: ecoId });
    const e = ecos[0];
    const num = e ? e.eco_number : `ECO:${ecoId}`;
    cache.set(cacheKey, num);
    return num;
  } catch {
    cache.set(cacheKey, `ECO:${ecoId}`);
    return `ECO:${ecoId}`;
  }
}

// For BOMLine: get parent context + label
async function getBomLineContext(line, entities, cache) {
  const bomLabel = await getBomLabel(line.bom_id, entities, cache);
  const label = `${bomLabel} > Line #${line.position ?? '?'} (${line.component_role || '—'})`;

  let productName = '(unknown)';
  try {
    if (line.bom_id) {
      const boms = await entities.BOM.filter({ id: line.bom_id });
      const bom = boms[0];
      if (bom) productName = await getProductName(bom.product_id, entities, cache);
    }
  } catch { /* ignore */ }

  const boms = await entities.BOM.filter({ id: line.bom_id }).catch(() => []);
  const bom = boms[0] || {};

  return {
    label,
    parent_context: {
      bom_id: line.bom_id,
      bom_revision_code: bom.revision_code,
      bom_status: bom.status,
      product_id: bom.product_id,
      product_name: productName,
    },
  };
}

// For BOMLineVariant: get parent context + label
async function getBomLineVariantLabel(variant, entities, cache) {
  try {
    const lines = await entities.BOMLine.filter({ id: variant.bom_line_id }).catch(() => []);
    const line = lines[0];
    if (!line) return `BOMLineVariant:${variant.id}`;
    const { label: lineLabel } = await getBomLineContext(line, entities, cache);
    const parts = [
      variant.product_color_id ? `color:${variant.product_color_id}` : null,
      variant.size_id ? `size:${variant.size_id}` : null,
      variant.product_color_and_more_id ? `more:${variant.product_color_and_more_id}` : null,
    ].filter(Boolean);
    return `${lineLabel} > Variant: ${parts.join(', ') || variant.id}`;
  } catch {
    return `BOMLineVariant:${variant.id}`;
  }
}

// ── ECO propagation context ────────────────────────────────────────────────────
// Batches ECO status checks — collects all eco_ids first, then fetches each ECO
// once, deduplicating by id to minimise API round-trips.

async function getEcoPropagation(entityType, entityId, entities, includeTerminal) {
  let affectedItemCount = 0;
  let affectedDownstreamCount = 0;
  const ecoIdSet = new Set();

  try {
    const items = await entities.ECOAffectedItem.filter({
      item_type: entityType,
      item_id: entityId,
    }, '-created_date', 500);
    affectedItemCount = items.length;
    for (const item of items) { if (item.eco_id) ecoIdSet.add(item.eco_id); }
  } catch (err) {
    console.error(`[getWhereUsed] ECO affected item lookup failed: ${err.message}`);
  }

  if (DOWNSTREAM_TYPES_WITH_ECO.has(entityType)) {
    try {
      const downstreams = await entities.ECOAffectedDownstream.filter({
        downstream_type: entityType,
        downstream_id: entityId,
      }, '-created_date', 500);
      affectedDownstreamCount = downstreams.length;
      for (const ds of downstreams) { if (ds.eco_id) ecoIdSet.add(ds.eco_id); }
    } catch (err) {
      console.error(`[getWhereUsed] ECO affected downstream lookup failed: ${err.message}`);
    }
  }

  // Fetch each unique ECO once (sequential to avoid burst, but deduplicated)
  const openEcoIds = [];
  for (const ecoId of ecoIdSet) {
    try {
      const ecos = await entities.ECO.filter({ id: ecoId });
      const eco = ecos[0];
      if (eco) {
        const isTerminal = TERMINAL_ECO_STATUSES.includes(eco.status);
        if (!isTerminal || includeTerminal) {
          openEcoIds.push(eco.id);
        }
      }
    } catch { /* ignore — broken FK, don't fail */ }
  }

  return {
    affected_item_count: affectedItemCount,
    affected_downstream_count: affectedDownstreamCount,
    open_eco_ids: openEcoIds,
  };
}

// ── Per-entity-type lookup implementations ────────────────────────────────────

async function lookupProduct(entityId, entities, includeInactive, cache, skippedLookups, truncatedGroups) {
  const groups = [];

  // a. BOMLines using this product as a component
  {
    const key = 'bomline_as_component';
    const raw = await safeFilter(entities.BOMLine, { component_product_id: entityId }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (line) => {
      const { label, parent_context } = await getBomLineContext(line, entities, cache);
      return { id: line.id, label, parent_context };
    }));
    groups.push({
      relationship: 'Used as component in BOMLines',
      relationship_key: key,
      downstream_type: 'BOMLine',
      count: total,
      records: mapped,
    });
  }

  // b. BOMs whose primary product is this entity
  {
    const key = 'bom_as_primary_product';
    let raw = await safeFilter(entities.BOM, { product_id: entityId }, skippedLookups, key, 500);
    if (!includeInactive) raw = raw.filter((b) => !BOM_INACTIVE_STATUSES.includes(b.status));
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const productName = await getProductName(entityId, entities, cache);
    const mapped = records.map((bom) => {
      const ctx = bom.order_context || {};
      const ctxPart = [ctx.region, ctx.customer_ref].filter(Boolean).join('/');
      return {
        id: bom.id,
        label: `${bom.bom_type === 'production' ? 'Prod' : 'Dev'} BOM rev ${bom.revision_code} v${bom.version} — ${productName}${ctxPart ? ` — ${ctxPart}` : ''}`,
        parent_context: { product_id: entityId, product_name: productName },
      };
    });
    groups.push({
      relationship: 'Primary product of BOMs',
      relationship_key: key,
      downstream_type: 'BOM',
      count: total,
      records: mapped,
    });
  }

  // c. ApprovedSupplier records for this product
  {
    const key = 'approved_supplier_records';
    let raw = await safeFilter(entities.ApprovedSupplier, { product_id: entityId }, skippedLookups, key, 500);
    if (!includeInactive) raw = raw.filter((as) => as.status === 'active');
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const productName = await getProductName(entityId, entities, cache);
    const mapped = await Promise.all(records.map(async (as) => {
      const supplierName = await getSupplierName(as.supplier_id, entities, cache);
      return {
        id: as.id,
        label: `${supplierName} for ${productName}${as.rank != null ? ` — rank ${as.rank}` : ''}`,
        parent_context: { product_id: entityId, supplier_id: as.supplier_id },
      };
    }));
    groups.push({
      relationship: 'Approved suppliers for this product',
      relationship_key: key,
      downstream_type: 'ApprovedSupplier',
      count: total,
      records: mapped,
    });
  }

  // d. SupplierRoutings for this product
  {
    const key = 'supplier_routings';
    let raw = await safeFilter(entities.SupplierRouting, { product_id: entityId }, skippedLookups, key, 500);
    if (!includeInactive) raw = raw.filter((r) => r.status === 'active');
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const productName = await getProductName(entityId, entities, cache);
    const mapped = records.map((r) => ({
      id: r.id,
      label: `${r.name} (${productName})`,
      parent_context: { product_id: entityId },
    }));
    groups.push({
      relationship: 'Supplier routings for this product',
      relationship_key: key,
      downstream_type: 'SupplierRouting',
      count: total,
      records: mapped,
    });
  }

  return groups;
}

async function lookupProductColor(entityId, entities, includeInactive, cache, skippedLookups, truncatedGroups) {
  const groups = [];

  // a. BOMLineVariant.component_product_color_id = entityId
  {
    const key = 'bomlinevariant_as_component';
    const raw = await safeFilter(entities.BOMLineVariant, { component_product_color_id: entityId }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (v) => ({
      id: v.id,
      label: await getBomLineVariantLabel(v, entities, cache),
    })));
    groups.push({
      relationship: 'Used as component colorway in BOMLineVariants',
      relationship_key: key,
      downstream_type: 'BOMLineVariant',
      count: total,
      records: mapped,
    });
  }

  // b. BOMLineVariant.product_color_id = entityId (as variant axis)
  {
    const key = 'bomlinevariant_as_variant_axis';
    const raw = await safeFilter(entities.BOMLineVariant, { product_color_id: entityId }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (v) => ({
      id: v.id,
      label: await getBomLineVariantLabel(v, entities, cache),
    })));
    groups.push({
      relationship: 'Used as variant axis color in BOMLineVariants',
      relationship_key: key,
      downstream_type: 'BOMLineVariant',
      count: total,
      records: mapped,
    });
  }

  // c. ProductColorSupplierLink.product_color_id = entityId
  {
    const key = 'product_color_supplier_links';
    let raw = await safeFilter(entities.ProductColorSupplierLink, { product_color_id: entityId }, skippedLookups, key, 500);
    if (!includeInactive) raw = raw.filter((l) => l.colorway_supplier_status !== 'discontinued');
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const colorLabel = await getProductColorLabel(entityId, entities, cache);
    const mapped = await Promise.all(records.map(async (l) => {
      const supplierName = await getSupplierName(
        (await entities.ApprovedSupplier.filter({ id: l.approved_supplier_id }).catch(() => []))[0]?.supplier_id,
        entities, cache
      );
      return {
        id: l.id,
        label: `${supplierName} for ${colorLabel}`,
        parent_context: { approved_supplier_id: l.approved_supplier_id },
      };
    }));
    groups.push({
      relationship: 'ProductColorSupplierLinks for this colorway',
      relationship_key: key,
      downstream_type: 'ProductColorSupplierLink',
      count: total,
      records: mapped,
    });
  }

  return groups;
}

async function lookupProductRevision(entityId, entities, cache, skippedLookups, truncatedGroups) {
  const groups = [];

  // a. BOMLineVariant.component_revision_snapshots contains entityId as any value
  {
    const key = 'bomlinevariant_revision_snapshot';
    // No direct filter on nested JSON values — fetch variants that are non-trivially likely to have snapshots
    // and filter in-memory. For v1 this is acceptable; for very large datasets materialization would help.
    try {
      const all = await entities.BOMLineVariant.list('-created_date', 2000);
      const matched = all.filter((v) => {
        const snaps = v.component_revision_snapshots;
        if (!snaps || typeof snaps !== 'object') return false;
        return Object.values(snaps).includes(entityId);
      });
      const { records, total } = capGroup(matched, key, truncatedGroups);
      const mapped = await Promise.all(records.map(async (v) => ({
        id: v.id,
        label: await getBomLineVariantLabel(v, entities, cache),
      })));
      groups.push({
        relationship: 'BOMLineVariants that snapshotted this ProductRevision',
        relationship_key: key,
        downstream_type: 'BOMLineVariant',
        count: total,
        records: mapped,
      });
    } catch (err) {
      console.error(`[getWhereUsed] ${key} failed: ${err.message}`);
      skippedLookups.push(key);
      groups.push({ relationship: 'BOMLineVariants that snapshotted this ProductRevision', relationship_key: key, downstream_type: 'BOMLineVariant', count: 0, records: [] });
    }
  }

  // b. BOMLine.product_revision_id = entityId
  {
    const key = 'bomline_revision_snapshot';
    const raw = await safeFilter(entities.BOMLine, { product_revision_id: entityId }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (line) => {
      const { label, parent_context } = await getBomLineContext(line, entities, cache);
      return { id: line.id, label, parent_context };
    }));
    groups.push({
      relationship: 'BOMLines snapshotted to this ProductRevision',
      relationship_key: key,
      downstream_type: 'BOMLine',
      count: total,
      records: mapped,
    });
  }

  // c. ECOAffectedItem.item_revision_id = entityId
  {
    const key = 'eco_affected_item_revision';
    const raw = await safeFilter(entities.ECOAffectedItem, { item_revision_id: entityId }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (item) => {
      const ecoNum = await getEcoNumber(item.eco_id, entities, cache);
      return {
        id: item.id,
        label: `${ecoNum} — ${item.change_kind} on ${item.item_type}`,
        parent_context: { eco_id: item.eco_id },
      };
    }));
    groups.push({
      relationship: 'ECOAffectedItems referencing this ProductRevision',
      relationship_key: key,
      downstream_type: 'ECOAffectedItem',
      count: total,
      records: mapped,
    });
  }

  return groups;
}

async function lookupBOM(entityId, entities, includeInactive, cache, skippedLookups, truncatedGroups) {
  const groups = [];

  // a. BOMs derived from this BOM (BOM.derived_from_bom_id = entityId)
  {
    const key = 'derived_boms';
    let raw = await safeFilter(entities.BOM, { derived_from_bom_id: entityId }, skippedLookups, key, 500);
    if (!includeInactive) raw = raw.filter((b) => !BOM_INACTIVE_STATUSES.includes(b.status));
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (bom) => {
      const label = await getBomLabel(bom.id, entities, cache);
      return { id: bom.id, label, parent_context: { derived_from_bom_id: entityId, revision_code: bom.revision_code, status: bom.status } };
    }));
    groups.push({
      relationship: 'Production BOMs derived from this BOM',
      relationship_key: key,
      downstream_type: 'BOM',
      count: total,
      records: mapped,
    });
  }

  // b. BOL.bom_id = entityId
  {
    const key = 'bol';
    const raw = await safeFilter(entities.BOL, { bom_id: entityId }, skippedLookups, key, 10);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const bomLabel = await getBomLabel(entityId, entities, cache);
    const mapped = records.map((bol) => ({
      id: bol.id,
      label: `BOL for ${bomLabel}`,
      parent_context: { bom_id: entityId },
    }));
    groups.push({
      relationship: 'BOL attached to this BOM',
      relationship_key: key,
      downstream_type: 'BOL',
      count: total,
      records: mapped,
    });
  }

  // c. BOMChangeLog.bom_id = entityId (last 50)
  {
    const key = 'bom_change_log';
    const raw = await safeFilter(entities.BOMChangeLog, { bom_id: entityId }, skippedLookups, key, 50);
    const sorted = raw.sort((a, b) => new Date(b.triggered_at || 0) - new Date(a.triggered_at || 0)).slice(0, 50);
    const bomLabel = await getBomLabel(entityId, entities, cache);
    const mapped = sorted.map((entry) => ({
      id: entry.id,
      label: `${entry.change_type} on ${bomLabel} at ${entry.triggered_at || '—'}`,
      parent_context: { bom_id: entityId, change_type: entry.change_type, triggered_by: entry.triggered_by },
    }));
    groups.push({
      relationship: 'BOM change history (last 50)',
      relationship_key: key,
      downstream_type: 'BOMChangeLog',
      count: sorted.length,
      records: mapped,
    });
  }

  return groups;
}

async function lookupSupplierRouting(entityId, entities, includeInactive, cache, skippedLookups, truncatedGroups) {
  const groups = [];

  // a. BOM.selected_routing_id = entityId
  {
    const key = 'bom_using_routing';
    let raw = await safeFilter(entities.BOM, { selected_routing_id: entityId }, skippedLookups, key, 500);
    if (!includeInactive) raw = raw.filter((b) => !BOM_INACTIVE_STATUSES.includes(b.status));
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (bom) => {
      const label = await getBomLabel(bom.id, entities, cache);
      return { id: bom.id, label, parent_context: { selected_routing_id: entityId, status: bom.status } };
    }));
    groups.push({
      relationship: 'Production BOMs using this routing as selected path',
      relationship_key: key,
      downstream_type: 'BOM',
      count: total,
      records: mapped,
    });
  }

  // b. BOL.source_routing_id = entityId
  {
    const key = 'bol_derived_from_routing';
    const raw = await safeFilter(entities.BOL, { source_routing_id: entityId }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const routingName = await getRoutingName(entityId, entities, cache);
    const mapped = await Promise.all(records.map(async (bol) => {
      const bomLabel = await getBomLabel(bol.bom_id, entities, cache);
      return {
        id: bol.id,
        label: `BOL for ${bomLabel}`,
        parent_context: { bom_id: bol.bom_id, source_routing_id: entityId, routing_name: routingName },
      };
    }));
    groups.push({
      relationship: 'BOLs derived from this routing',
      relationship_key: key,
      downstream_type: 'BOL',
      count: total,
      records: mapped,
    });
  }

  // c. SupplierRoutingStep.supplier_routing_id = entityId
  {
    const key = 'supplier_routing_steps';
    const raw = await safeFilter(entities.SupplierRoutingStep, { supplier_routing_id: entityId }, skippedLookups, key, 200);
    const sorted = raw.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    const { records, total } = capGroup(sorted, key, truncatedGroups);
    const routingName = await getRoutingName(entityId, entities, cache);
    const mapped = records.map((step) => ({
      id: step.id,
      label: `${routingName} > Step ${step.sequence} — ${step.step_type || '—'}`,
      parent_context: { supplier_routing_id: entityId, sequence: step.sequence, step_type: step.step_type },
    }));
    groups.push({
      relationship: 'Steps in this routing',
      relationship_key: key,
      downstream_type: 'SupplierRoutingStep',
      count: total,
      records: mapped,
    });
  }

  return groups;
}

async function lookupSupplierRoutingStep(entityId, entities, cache, skippedLookups, truncatedGroups) {
  const groups = [];

  // a. BOLOperation.source_routing_step_id = entityId
  {
    const key = 'bol_operations_from_step';
    try {
      const raw = await entities.BOLOperation.filter({ source_routing_step_id: entityId }, '-created_date', 500);
      const { records, total } = capGroup(raw, key, truncatedGroups);
      const mapped = await Promise.all(records.map(async (op) => {
        const bolId = op.bol_id;
        const bols = await entities.BOL.filter({ id: bolId }).catch(() => []);
        const bol = bols[0];
        const bomLabel = bol ? await getBomLabel(bol.bom_id, entities, cache) : `BOL:${bolId}`;
        return {
          id: op.id,
          label: `BOLOperation step ${op.sequence} on ${bomLabel}`,
          parent_context: { bol_id: bolId, sequence: op.sequence, step_type: op.step_type },
        };
      }));
      groups.push({
        relationship: 'BOLOperations derived from this routing step',
        relationship_key: key,
        downstream_type: 'BOLOperation',
        count: total,
        records: mapped,
      });
    } catch (err) {
      console.error(`[getWhereUsed] ${key} failed: ${err.message}`);
      skippedLookups.push(key);
      groups.push({
        relationship: 'BOLOperations derived from this routing step',
        relationship_key: key,
        downstream_type: 'BOLOperation',
        count: 0,
        records: [],
      });
    }
  }

  return groups;
}

async function lookupApprovedSupplier(entityId, entities, includeInactive, cache, skippedLookups, truncatedGroups) {
  const groups = [];

  // a. BOMLineVariant.approved_supplier_id = entityId (as resolved supplier)
  {
    const key = 'bomlinevariant_as_resolved_supplier';
    const raw = await safeFilter(entities.BOMLineVariant, { approved_supplier_id: entityId }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (v) => ({
      id: v.id,
      label: await getBomLineVariantLabel(v, entities, cache),
    })));
    groups.push({
      relationship: 'BOMLineVariants using this supplier as resolved component supplier',
      relationship_key: key,
      downstream_type: 'BOMLineVariant',
      count: total,
      records: mapped,
    });
  }

  // b. BOMLineVariant.parent_approved_supplier_id = entityId (as parent supplier axis)
  {
    const key = 'bomlinevariant_as_parent_supplier';
    const raw = await safeFilter(entities.BOMLineVariant, { parent_approved_supplier_id: entityId }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (v) => ({
      id: v.id,
      label: await getBomLineVariantLabel(v, entities, cache),
    })));
    groups.push({
      relationship: 'BOMLineVariants using this supplier as parent supplier axis',
      relationship_key: key,
      downstream_type: 'BOMLineVariant',
      count: total,
      records: mapped,
    });
  }

  // c. ProductColorSupplierLink.approved_supplier_id = entityId
  {
    const key = 'product_color_supplier_links';
    let raw = await safeFilter(entities.ProductColorSupplierLink, { approved_supplier_id: entityId }, skippedLookups, key, 500);
    if (!includeInactive) raw = raw.filter((l) => l.colorway_supplier_status !== 'discontinued');
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (l) => {
      const colorLabel = await getProductColorLabel(l.product_color_id, entities, cache);
      const asRows = await entities.ApprovedSupplier.filter({ id: entityId }).catch(() => []);
      const as = asRows[0];
      const supplierName = await getSupplierName(as?.supplier_id, entities, cache);
      return {
        id: l.id,
        label: `${supplierName} for ${colorLabel}`,
        parent_context: { product_color_id: l.product_color_id, colorway_supplier_status: l.colorway_supplier_status },
      };
    }));
    groups.push({
      relationship: 'ProductColorSupplierLinks for this approved supplier',
      relationship_key: key,
      downstream_type: 'ProductColorSupplierLink',
      count: total,
      records: mapped,
    });
  }

  // d. BOMLine.line_level_approved_supplier_id = entityId
  {
    const key = 'bomline_line_level_supplier';
    const raw = await safeFilter(entities.BOMLine, { line_level_approved_supplier_id: entityId }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (line) => {
      const { label, parent_context } = await getBomLineContext(line, entities, cache);
      return { id: line.id, label, parent_context };
    }));
    groups.push({
      relationship: 'BOMLines with this supplier set as line-level override',
      relationship_key: key,
      downstream_type: 'BOMLine',
      count: total,
      records: mapped,
    });
  }

  return groups;
}

async function lookupProductColorSupplierLink(entityId, entities, cache, skippedLookups, truncatedGroups) {
  const groups = [];

  // a. BOMLineVariant.product_color_supplier_link_id = entityId
  {
    const key = 'bomlinevariant_using_link';
    const raw = await safeFilter(entities.BOMLineVariant, { product_color_supplier_link_id: entityId }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (v) => ({
      id: v.id,
      label: await getBomLineVariantLabel(v, entities, cache),
    })));
    groups.push({
      relationship: 'BOMLineVariants using this ProductColorSupplierLink',
      relationship_key: key,
      downstream_type: 'BOMLineVariant',
      count: total,
      records: mapped,
    });
  }

  return groups;
}

async function lookupBOMLine(entityId, entities, cache, skippedLookups, truncatedGroups) {
  const groups = [];

  // a. BOMLineVariant.bom_line_id = entityId
  {
    const key = 'bomlinevariant_variants';
    const raw = await safeFilter(entities.BOMLineVariant, { bom_line_id: entityId }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (v) => ({
      id: v.id,
      label: await getBomLineVariantLabel(v, entities, cache),
    })));
    groups.push({
      relationship: 'BOMLineVariants resolving this line',
      relationship_key: key,
      downstream_type: 'BOMLineVariant',
      count: total,
      records: mapped,
    });
  }

  // b. BOMLine.source_bom_line_id = entityId (prod lines cloned from this dev line)
  {
    const key = 'bomline_cloned_to_prod';
    const raw = await safeFilter(entities.BOMLine, { source_bom_line_id: entityId }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (line) => {
      const { label, parent_context } = await getBomLineContext(line, entities, cache);
      return { id: line.id, label, parent_context };
    }));
    groups.push({
      relationship: 'Prod BOMLines cloned from this Dev BOMLine',
      relationship_key: key,
      downstream_type: 'BOMLine',
      count: total,
      records: mapped,
    });
  }

  return groups;
}

async function lookupBOMLineVariant(entityId, entities, cache, skippedLookups, truncatedGroups) {
  const groups = [];

  // a. ECOAffectedDownstream where downstream_type = "BOMLineVariant" AND downstream_id = entityId
  {
    const key = 'eco_affected_downstream';
    const raw = await safeFilter(entities.ECOAffectedDownstream, {
      downstream_type: 'BOMLineVariant',
      downstream_id: entityId,
    }, skippedLookups, key, 500);
    const { records, total } = capGroup(raw, key, truncatedGroups);
    const mapped = await Promise.all(records.map(async (ds) => {
      const ecoNum = await getEcoNumber(ds.eco_id, entities, cache);
      return {
        id: ds.id,
        label: `${ecoNum} — ${ds.propagation_status} on BOMLineVariant`,
        parent_context: { eco_id: ds.eco_id, propagation_status: ds.propagation_status, flow_type: ds.flow_type },
      };
    }));
    groups.push({
      relationship: 'ECO propagation history targeting this BOMLineVariant',
      relationship_key: key,
      downstream_type: 'ECOAffectedDownstream',
      count: total,
      records: mapped,
    });
  }

  return groups;
}

// ── Main dispatcher ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const startMs = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      entity_type,
      entity_id,
      include_terminal_eco_state = false,
      include_inactive = false,
    } = await req.json();

    // Validate inputs
    if (!entity_id) {
      return Response.json({ error: 'entity_id is required' }, { status: 400 });
    }
    if (!entity_type) {
      return Response.json({ error: 'entity_type is required' }, { status: 400 });
    }
    if (!SUPPORTED_ENTITY_TYPES.includes(entity_type)) {
      return Response.json({
        error: `Unsupported entity_type "${entity_type}". Supported types: ${SUPPORTED_ENTITY_TYPES.join(', ')}`,
      }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const cache = makeCache();
    const skippedLookups = [];
    const truncatedGroups = [];

    let groups = [];

    // Dispatch to per-type handler
    switch (entity_type) {
      case 'Product':
        groups = await lookupProduct(entity_id, entities, include_inactive, cache, skippedLookups, truncatedGroups);
        break;
      case 'ProductColor':
        groups = await lookupProductColor(entity_id, entities, include_inactive, cache, skippedLookups, truncatedGroups);
        break;
      case 'ProductRevision':
        groups = await lookupProductRevision(entity_id, entities, cache, skippedLookups, truncatedGroups);
        break;
      case 'BOM':
        groups = await lookupBOM(entity_id, entities, include_inactive, cache, skippedLookups, truncatedGroups);
        break;
      case 'SupplierRouting':
        groups = await lookupSupplierRouting(entity_id, entities, include_inactive, cache, skippedLookups, truncatedGroups);
        break;
      case 'SupplierRoutingStep':
        groups = await lookupSupplierRoutingStep(entity_id, entities, cache, skippedLookups, truncatedGroups);
        break;
      case 'ApprovedSupplier':
        groups = await lookupApprovedSupplier(entity_id, entities, include_inactive, cache, skippedLookups, truncatedGroups);
        break;
      case 'ProductColorSupplierLink':
        groups = await lookupProductColorSupplierLink(entity_id, entities, cache, skippedLookups, truncatedGroups);
        break;
      case 'BOMLine':
        groups = await lookupBOMLine(entity_id, entities, cache, skippedLookups, truncatedGroups);
        break;
      case 'BOMLineVariant':
        groups = await lookupBOMLineVariant(entity_id, entities, cache, skippedLookups, truncatedGroups);
        break;
    }

    // ECO propagation context
    const eco_propagation = await getEcoPropagation(entity_type, entity_id, entities, include_terminal_eco_state);

    const elapsed = Date.now() - startMs;
    console.log(`[getWhereUsed] entity_type=${entity_type} entity_id=${entity_id} elapsed=${elapsed}ms`);

    return Response.json({
      success: true,
      entity_type,
      entity_id,
      queried_at: new Date().toISOString(),
      groups,
      eco_propagation,
      skipped_lookups: skippedLookups,
      truncated_groups: truncatedGroups,
      _elapsed_ms: elapsed,
    });

  } catch (error) {
    console.error(`[getWhereUsed] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});