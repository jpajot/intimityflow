/**
 * getWhereUsed
 *
 * Generic reverse-lookup / where-used query layer for ECO impact analysis,
 * dependency visualization, and Flow D AffectedDownstream population.
 *
 * v2: Parallelized lookups (Promise.all per entity_type batch) + batched
 *     label-resolution (N+1 → batch queries per parent entity type).
 *     Contract, return shape, and error handling are unchanged from v1.
 *
 * Payload:
 *   entity_type              string   required  — one of the 10 supported types
 *   entity_id                string   required
 *   include_terminal_eco_state  boolean  optional  default false
 *   include_inactive            boolean  optional  default false
 *
 * Returns: WhereUsedResult (unchanged from v1)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Constants ──────────────────────────────────────────────────────────────────

const SUPPORTED_ENTITY_TYPES = [
  'Product', 'ProductColor', 'ProductRevision', 'BOM', 'SupplierRouting',
  'SupplierRoutingStep', 'ApprovedSupplier', 'ProductColorSupplierLink',
  'BOMLine', 'BOMLineVariant',
];

const GROUP_CAP = 200;
const BATCH_CAP = 200; // max ids per $in query

const TERMINAL_ECO_STATUSES = ['closed', 'cancelled', 'rejected'];
const BOM_INACTIVE_STATUSES = ['superseded', 'obsolete'];
const DOWNSTREAM_TYPES_WITH_ECO = new Set(['BOM', 'BOL', 'BOMLineVariant', 'BOMLine']);

// ── Batch fetch helper ─────────────────────────────────────────────────────────
// Fetches records by an array of ids in chunks of BATCH_CAP, in parallel.
// Returns a Map<id, record>.

async function batchFetchById(entityObj, ids, skippedLookups, lookupKey) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const chunks = [];
  for (let i = 0; i < unique.length; i += BATCH_CAP) {
    chunks.push(unique.slice(i, i + BATCH_CAP));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        return await entityObj.filter({ id: { $in: chunk } }, '-created_date', BATCH_CAP);
      } catch (err) {
        console.error(`[getWhereUsed] batchFetch failed for ${lookupKey}: ${err.message}`);
        if (skippedLookups && !skippedLookups.includes(lookupKey)) skippedLookups.push(lookupKey);
        return [];
      }
    })
  );

  const map = new Map();
  for (const batch of results) {
    for (const rec of batch) map.set(rec.id, rec);
  }
  return map;
}

// ── Safe filter wrapper ────────────────────────────────────────────────────────

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

// ── Label builders (synchronous, using pre-fetched maps) ───────────────────────

function bomLabelFromRecord(bom, productName) {
  if (!bom) return `BOM:${bom?.id}`;
  const ctx = bom.order_context || {};
  const ctxPart = [ctx.region, ctx.customer_ref].filter(Boolean).join('/');
  return `${bom.bom_type === 'production' ? 'Prod' : 'Dev'} BOM rev ${bom.revision_code} v${bom.version} — ${productName}${ctxPart ? ` — ${ctxPart}` : ''}`;
}

function productNameFromRecord(product, productId) {
  if (!product) return `Product:${productId}`;
  return `${product.code || ''} ${product.name}`.trim();
}

function supplierNameFromRecord(supplier, supplierId) {
  return supplier ? supplier.name : `Supplier:${supplierId}`;
}

function routingNameFromRecord(routing, routingId) {
  return routing ? routing.name : `SupplierRouting:${routingId}`;
}

function productColorLabelFromRecord(pc, pcId) {
  if (!pc) return `ProductColor:${pcId}`;
  return `${pc.color_name}${pc.colorway_code ? ` (${pc.colorway_code})` : ''}`;
}

function ecoNumberFromRecord(eco, ecoId) {
  return eco ? eco.eco_number : `ECO:${ecoId}`;
}

// ── ECO propagation context ────────────────────────────────────────────────────
// Parallelizes the AffectedItem + AffectedDownstream lookups, deduplicates ECO ids,
// then fetches each unique ECO once sequentially (avoiding burst).

async function getEcoPropagation(entityType, entityId, entities, includeTerminal) {
  let affectedItemCount = 0;
  let affectedDownstreamCount = 0;
  const ecoIdSet = new Set();

  // Run item + downstream lookups in parallel
  const [itemsResult, downstreamsResult] = await Promise.allSettled([
    entities.ECOAffectedItem.filter({ item_type: entityType, item_id: entityId }, '-created_date', 500),
    DOWNSTREAM_TYPES_WITH_ECO.has(entityType)
      ? entities.ECOAffectedDownstream.filter({ downstream_type: entityType, downstream_id: entityId }, '-created_date', 500)
      : Promise.resolve([]),
  ]);

  if (itemsResult.status === 'fulfilled') {
    affectedItemCount = itemsResult.value.length;
    for (const item of itemsResult.value) { if (item.eco_id) ecoIdSet.add(item.eco_id); }
  } else {
    console.error(`[getWhereUsed] ECO affected item lookup failed: ${itemsResult.reason?.message}`);
  }

  if (downstreamsResult.status === 'fulfilled') {
    affectedDownstreamCount = downstreamsResult.value.length;
    for (const ds of downstreamsResult.value) { if (ds.eco_id) ecoIdSet.add(ds.eco_id); }
  } else {
    console.error(`[getWhereUsed] ECO affected downstream lookup failed: ${downstreamsResult.reason?.message}`);
  }

  // Fetch each unique ECO once (sequential to avoid burst, but deduplicated)
  const openEcoIds = [];
  for (const ecoId of ecoIdSet) {
    try {
      const ecos = await entities.ECO.filter({ id: ecoId });
      const eco = ecos[0];
      if (eco) {
        const isTerminal = TERMINAL_ECO_STATUSES.includes(eco.status);
        if (!isTerminal || includeTerminal) openEcoIds.push(eco.id);
      }
    } catch { /* broken FK — ignore */ }
  }

  return { affected_item_count: affectedItemCount, affected_downstream_count: affectedDownstreamCount, open_eco_ids: openEcoIds };
}

// ── Per-entity-type lookup implementations ────────────────────────────────────
// Each returns a groups[] array. All lookups within a type run in parallel.
// Label resolution uses batched parent queries (no N+1).

async function lookupProduct(entityId, entities, includeInactive, skippedLookups, truncatedGroups) {
  // Phase 1: all 4 reverse lookups in parallel
  const [rawLines, rawBoms, rawAS, rawRoutings] = await Promise.all([
    safeFilter(entities.BOMLine, { component_product_id: entityId }, skippedLookups, 'bomline_as_component', 500),
    safeFilter(entities.BOM, { product_id: entityId }, skippedLookups, 'bom_as_primary_product', 500),
    safeFilter(entities.ApprovedSupplier, { product_id: entityId }, skippedLookups, 'approved_supplier_records', 500),
    safeFilter(entities.SupplierRouting, { product_id: entityId }, skippedLookups, 'supplier_routings', 500),
  ]);

  // Apply inactive filter
  const filteredBoms = includeInactive ? rawBoms : rawBoms.filter(b => !BOM_INACTIVE_STATUSES.includes(b.status));
  const filteredAS = includeInactive ? rawAS : rawAS.filter(a => a.status === 'active');
  const filteredRoutings = includeInactive ? rawRoutings : rawRoutings.filter(r => r.status === 'active');

  // Cap records
  const { records: capLines, total: totalLines } = capGroup(rawLines, 'bomline_as_component', truncatedGroups);
  const { records: capBoms, total: totalBoms } = capGroup(filteredBoms, 'bom_as_primary_product', truncatedGroups);
  const { records: capAS, total: totalAS } = capGroup(filteredAS, 'approved_supplier_records', truncatedGroups);
  const { records: capRoutings, total: totalRoutings } = capGroup(filteredRoutings, 'supplier_routings', truncatedGroups);

  // Phase 2: batch-fetch parent records for label generation (all in parallel)
  const bomIdsForLines = capLines.map(l => l.bom_id);
  const supplierIdsForAS = capAS.map(a => a.supplier_id);

  const [bomMapForLines, productMapForBoms, supplierMapForAS] = await Promise.all([
    batchFetchById(entities.BOM, bomIdsForLines, skippedLookups, 'bomline_as_component_parents'),
    batchFetchById(entities.Product, [entityId], skippedLookups, 'bom_as_primary_product_product'),
    batchFetchById(entities.Supplier, supplierIdsForAS, skippedLookups, 'approved_supplier_suppliers'),
  ]);

  // Fetch product record once — used across multiple groups
  const productRecord = productMapForBoms.get(entityId);
  const productName = productNameFromRecord(productRecord, entityId);

  // Also batch the bom product ids for lines (each bom may have a different product_id)
  const productIdsForBomLines = [...new Set([...bomMapForLines.values()].map(b => b.product_id).filter(Boolean))];
  const productMapForBomLines = await batchFetchById(entities.Product, productIdsForBomLines, skippedLookups, 'bomline_bom_products');

  // Phase 3: build label records
  const mappedLines = capLines.map(line => {
    const bom = bomMapForLines.get(line.bom_id);
    const prod = bom ? productMapForBomLines.get(bom.product_id) : null;
    const bProdName = prod ? productNameFromRecord(prod, bom?.product_id) : `Product:${bom?.product_id}`;
    const bomLabel = bom ? bomLabelFromRecord(bom, bProdName) : `BOM:${line.bom_id}`;
    return {
      id: line.id,
      label: bomLabel,
      parent_context: {
        bom_id: line.bom_id,
        bom_revision_code: bom?.revision_code,
        bom_status: bom?.status,
        product_id: bom?.product_id,
        product_name: bProdName,
      },
    };
  });

  const mappedBoms = capBoms.map(bom => ({
    id: bom.id,
    label: bomLabelFromRecord(bom, productName),
    parent_context: { product_id: entityId, product_name: productName },
  }));

  const mappedAS = capAS.map(as => {
    const supplier = supplierMapForAS.get(as.supplier_id);
    const sName = supplierNameFromRecord(supplier, as.supplier_id);
    return {
      id: as.id,
      label: `${sName} for ${productName}${as.rank != null ? ` — rank ${as.rank}` : ''}`,
      parent_context: { product_id: entityId, supplier_id: as.supplier_id },
    };
  });

  const mappedRoutings = capRoutings.map(r => ({
    id: r.id,
    label: `${r.name} (${productName})`,
    parent_context: { product_id: entityId },
  }));

  return [
    { relationship: 'Used as component in BOMLines', relationship_key: 'bomline_as_component', downstream_type: 'BOMLine', count: totalLines, records: mappedLines },
    { relationship: 'Primary product of BOMs', relationship_key: 'bom_as_primary_product', downstream_type: 'BOM', count: totalBoms, records: mappedBoms },
    { relationship: 'Approved suppliers for this product', relationship_key: 'approved_supplier_records', downstream_type: 'ApprovedSupplier', count: totalAS, records: mappedAS },
    { relationship: 'Supplier routings for this product', relationship_key: 'supplier_routings', downstream_type: 'SupplierRouting', count: totalRoutings, records: mappedRoutings },
  ];
}

async function lookupProductColor(entityId, entities, includeInactive, skippedLookups, truncatedGroups) {
  // Phase 1: 3 reverse lookups in parallel
  const [rawVariantsComp, rawVariantsAxis, rawLinks] = await Promise.all([
    safeFilter(entities.BOMLineVariant, { component_product_color_id: entityId }, skippedLookups, 'bomlinevariant_as_component', 500),
    safeFilter(entities.BOMLineVariant, { product_color_id: entityId }, skippedLookups, 'bomlinevariant_as_variant_axis', 500),
    safeFilter(entities.ProductColorSupplierLink, { product_color_id: entityId }, skippedLookups, 'product_color_supplier_links', 500),
  ]);

  const filteredLinks = includeInactive ? rawLinks : rawLinks.filter(l => l.colorway_supplier_status !== 'discontinued');

  const { records: capComp, total: totalComp } = capGroup(rawVariantsComp, 'bomlinevariant_as_component', truncatedGroups);
  const { records: capAxis, total: totalAxis } = capGroup(rawVariantsAxis, 'bomlinevariant_as_variant_axis', truncatedGroups);
  const { records: capLinks, total: totalLinks } = capGroup(filteredLinks, 'product_color_supplier_links', truncatedGroups);

  // Phase 2: batch parent records for labels
  const allVariants = [...capComp, ...capAxis];
  const lineIds = [...new Set(allVariants.map(v => v.bom_line_id).filter(Boolean))];
  const asIds = [...new Set(capLinks.map(l => l.approved_supplier_id).filter(Boolean))];

  const [lineMap, asMap, colorRecord] = await Promise.all([
    batchFetchById(entities.BOMLine, lineIds, skippedLookups, 'blv_productcolor_lines'),
    batchFetchById(entities.ApprovedSupplier, asIds, skippedLookups, 'blv_productcolor_as'),
    entities.ProductColor.filter({ id: entityId }).catch(() => []),
  ]);

  // Need bom records for lines, and product records for boms
  const bomIds = [...new Set([...lineMap.values()].map(l => l.bom_id).filter(Boolean))];
  const bomMap = await batchFetchById(entities.BOM, bomIds, skippedLookups, 'blv_productcolor_boms');
  const productIds = [...new Set([...bomMap.values()].map(b => b.product_id).filter(Boolean))];
  const [productMap, supplierIds] = [
    await batchFetchById(entities.Product, productIds, skippedLookups, 'blv_productcolor_products'),
    [...new Set([...asMap.values()].map(a => a.supplier_id).filter(Boolean))],
  ];
  const supplierMap = await batchFetchById(entities.Supplier, supplierIds, skippedLookups, 'blv_productcolor_suppliers');

  const pcRecord = colorRecord[0];
  const colorLabel = productColorLabelFromRecord(pcRecord, entityId);

  const makeVariantLabel = (v) => {
    const line = lineMap.get(v.bom_line_id);
    if (!line) return `BOMLineVariant:${v.id}`;
    const bom = bomMap.get(line.bom_id);
    const prod = bom ? productMap.get(bom.product_id) : null;
    const bProdName = prod ? productNameFromRecord(prod, bom?.product_id) : `Product:${bom?.product_id}`;
    const bomLabel = bom ? bomLabelFromRecord(bom, bProdName) : `BOM:${line.bom_id}`;
    const parts = [
      v.product_color_id ? `color:${v.product_color_id}` : null,
      v.size_id ? `size:${v.size_id}` : null,
      v.product_color_and_more_id ? `more:${v.product_color_and_more_id}` : null,
    ].filter(Boolean);
    return `${bomLabel} > Line #${line.position ?? '?'} (${line.component_role || '—'}) > Variant: ${parts.join(', ') || v.id}`;
  };

  const mappedComp = capComp.map(v => ({ id: v.id, label: makeVariantLabel(v) }));
  const mappedAxis = capAxis.map(v => ({ id: v.id, label: makeVariantLabel(v) }));

  const mappedLinks = capLinks.map(l => {
    const as = asMap.get(l.approved_supplier_id);
    const supplier = as ? supplierMap.get(as.supplier_id) : null;
    const sName = supplierNameFromRecord(supplier, as?.supplier_id);
    return {
      id: l.id,
      label: `${sName} for ${colorLabel}`,
      parent_context: { approved_supplier_id: l.approved_supplier_id },
    };
  });

  return [
    { relationship: 'Used as component colorway in BOMLineVariants', relationship_key: 'bomlinevariant_as_component', downstream_type: 'BOMLineVariant', count: totalComp, records: mappedComp },
    { relationship: 'Used as variant axis color in BOMLineVariants', relationship_key: 'bomlinevariant_as_variant_axis', downstream_type: 'BOMLineVariant', count: totalAxis, records: mappedAxis },
    { relationship: 'ProductColorSupplierLinks for this colorway', relationship_key: 'product_color_supplier_links', downstream_type: 'ProductColorSupplierLink', count: totalLinks, records: mappedLinks },
  ];
}

async function lookupProductRevision(entityId, entities, skippedLookups, truncatedGroups) {
  // Phase 1: 3 lookups in parallel (allVariants scan is expensive but necessary)
  const [allVariants, rawLines, rawEcoItems] = await Promise.all([
    (async () => {
      try { return await entities.BOMLineVariant.list('-created_date', 2000); }
      catch (err) { console.error(`[getWhereUsed] bomlinevariant_revision_snapshot failed: ${err.message}`); skippedLookups.push('bomlinevariant_revision_snapshot'); return []; }
    })(),
    safeFilter(entities.BOMLine, { product_revision_id: entityId }, skippedLookups, 'bomline_revision_snapshot', 500),
    safeFilter(entities.ECOAffectedItem, { item_revision_id: entityId }, skippedLookups, 'eco_affected_item_revision', 500),
  ]);

  const matchedVariants = allVariants.filter(v => {
    const snaps = v.component_revision_snapshots;
    return snaps && typeof snaps === 'object' && Object.values(snaps).includes(entityId);
  });

  const { records: capVariants, total: totalVariants } = capGroup(matchedVariants, 'bomlinevariant_revision_snapshot', truncatedGroups);
  const { records: capLines, total: totalLines } = capGroup(rawLines, 'bomline_revision_snapshot', truncatedGroups);
  const { records: capItems, total: totalItems } = capGroup(rawEcoItems, 'eco_affected_item_revision', truncatedGroups);

  // Phase 2: batch parent records in parallel
  const variantLineIds = [...new Set(capVariants.map(v => v.bom_line_id).filter(Boolean))];
  const ecoIds = [...new Set(capItems.map(i => i.eco_id).filter(Boolean))];

  const [variantLineMap, lineForItemMap, ecoMap] = await Promise.all([
    batchFetchById(entities.BOMLine, variantLineIds, skippedLookups, 'prodrev_variant_lines'),
    batchFetchById(entities.BOMLine, capLines.map(l => l.id), skippedLookups, 'prodrev_lines'),
    batchFetchById(entities.ECO, ecoIds, skippedLookups, 'prodrev_ecos'),
  ]);

  const allLineIds = [...new Set([...variantLineMap.values(), ...lineForItemMap.values()].map(l => l.bom_id).filter(Boolean))];
  const bomMap = await batchFetchById(entities.BOM, allLineIds, skippedLookups, 'prodrev_boms');
  const productIds = [...new Set([...bomMap.values()].map(b => b.product_id).filter(Boolean))];
  const productMap = await batchFetchById(entities.Product, productIds, skippedLookups, 'prodrev_products');

  const makeBomLabel = (bom) => {
    if (!bom) return null;
    const prod = productMap.get(bom.product_id);
    const pName = prod ? productNameFromRecord(prod, bom.product_id) : `Product:${bom.product_id}`;
    return bomLabelFromRecord(bom, pName);
  };

  const mappedVariants = capVariants.map(v => {
    const line = variantLineMap.get(v.bom_line_id);
    if (!line) return { id: v.id, label: `BOMLineVariant:${v.id}` };
    const bom = bomMap.get(line.bom_id);
    const bomLabel = makeBomLabel(bom) || `BOM:${line.bom_id}`;
    const parts = [
      v.product_color_id ? `color:${v.product_color_id}` : null,
      v.size_id ? `size:${v.size_id}` : null,
      v.product_color_and_more_id ? `more:${v.product_color_and_more_id}` : null,
    ].filter(Boolean);
    return { id: v.id, label: `${bomLabel} > Line #${line.position ?? '?'} (${line.component_role || '—'}) > Variant: ${parts.join(', ') || v.id}` };
  });

  const mappedLines = capLines.map(line => {
    const bom = bomMap.get(line.bom_id);
    const bomLabel = makeBomLabel(bom) || `BOM:${line.bom_id}`;
    const prod = bom ? productMap.get(bom.product_id) : null;
    return {
      id: line.id,
      label: bomLabel,
      parent_context: {
        bom_id: line.bom_id,
        bom_revision_code: bom?.revision_code,
        bom_status: bom?.status,
        product_id: bom?.product_id,
        product_name: prod ? productNameFromRecord(prod, bom.product_id) : `Product:${bom?.product_id}`,
      },
    };
  });

  const mappedItems = capItems.map(item => {
    const eco = ecoMap.get(item.eco_id);
    const ecoNum = ecoNumberFromRecord(eco, item.eco_id);
    return {
      id: item.id,
      label: `${ecoNum} — ${item.change_kind} on ${item.item_type}`,
      parent_context: { eco_id: item.eco_id },
    };
  });

  return [
    { relationship: 'BOMLineVariants that snapshotted this ProductRevision', relationship_key: 'bomlinevariant_revision_snapshot', downstream_type: 'BOMLineVariant', count: totalVariants, records: mappedVariants },
    { relationship: 'BOMLines snapshotted to this ProductRevision', relationship_key: 'bomline_revision_snapshot', downstream_type: 'BOMLine', count: totalLines, records: mappedLines },
    { relationship: 'ECOAffectedItems referencing this ProductRevision', relationship_key: 'eco_affected_item_revision', downstream_type: 'ECOAffectedItem', count: totalItems, records: mappedItems },
  ];
}

async function lookupBOM(entityId, entities, includeInactive, skippedLookups, truncatedGroups) {
  // Phase 1: 3 lookups in parallel
  const [rawDerived, rawBol, rawLog] = await Promise.all([
    safeFilter(entities.BOM, { derived_from_bom_id: entityId }, skippedLookups, 'derived_boms', 500),
    safeFilter(entities.BOL, { bom_id: entityId }, skippedLookups, 'bol', 10),
    safeFilter(entities.BOMChangeLog, { bom_id: entityId }, skippedLookups, 'bom_change_log', 50),
  ]);

  const filteredDerived = includeInactive ? rawDerived : rawDerived.filter(b => !BOM_INACTIVE_STATUSES.includes(b.status));
  const { records: capDerived, total: totalDerived } = capGroup(filteredDerived, 'derived_boms', truncatedGroups);
  const { records: capBol, total: totalBol } = capGroup(rawBol, 'bol', truncatedGroups);
  const sortedLog = rawLog.sort((a, b) => new Date(b.triggered_at || 0) - new Date(a.triggered_at || 0)).slice(0, 50);

  // Phase 2: batch-fetch product records for all derived BOMs + the entity BOM itself
  const productIds = [...new Set([...capDerived.map(b => b.product_id), entityId].filter(Boolean))];
  // Also need the entity BOM's own product for BOL label
  const entityBomResult = await safeFilter(entities.BOM, { id: entityId }, skippedLookups, 'bom_self', 1);
  const entityBom = entityBomResult[0] || null;
  const selfProductId = entityBom?.product_id;
  if (selfProductId && !productIds.includes(selfProductId)) productIds.push(selfProductId);

  const productMap = await batchFetchById(entities.Product, productIds, skippedLookups, 'bom_products');

  const selfProd = selfProductId ? productMap.get(selfProductId) : null;
  const selfProdName = selfProd ? productNameFromRecord(selfProd, selfProductId) : `Product:${selfProductId}`;
  const selfBomLabel = entityBom ? bomLabelFromRecord(entityBom, selfProdName) : `BOM:${entityId}`;

  const mappedDerived = capDerived.map(bom => {
    const prod = productMap.get(bom.product_id);
    const pName = prod ? productNameFromRecord(prod, bom.product_id) : `Product:${bom.product_id}`;
    return {
      id: bom.id,
      label: bomLabelFromRecord(bom, pName),
      parent_context: { derived_from_bom_id: entityId, revision_code: bom.revision_code, status: bom.status },
    };
  });

  const mappedBol = capBol.map(bol => ({
    id: bol.id,
    label: `BOL for ${selfBomLabel}`,
    parent_context: { bom_id: entityId },
  }));

  const mappedLog = sortedLog.map(entry => ({
    id: entry.id,
    label: `${entry.change_type} on ${selfBomLabel} at ${entry.triggered_at || '—'}`,
    parent_context: { bom_id: entityId, change_type: entry.change_type, triggered_by: entry.triggered_by },
  }));

  return [
    { relationship: 'Production BOMs derived from this BOM', relationship_key: 'derived_boms', downstream_type: 'BOM', count: totalDerived, records: mappedDerived },
    { relationship: 'BOL attached to this BOM', relationship_key: 'bol', downstream_type: 'BOL', count: totalBol, records: mappedBol },
    { relationship: 'BOM change history (last 50)', relationship_key: 'bom_change_log', downstream_type: 'BOMChangeLog', count: sortedLog.length, records: mappedLog },
  ];
}

async function lookupSupplierRouting(entityId, entities, includeInactive, skippedLookups, truncatedGroups) {
  // Phase 1: 3 lookups in parallel
  const [rawBoms, rawBols, rawSteps] = await Promise.all([
    safeFilter(entities.BOM, { selected_routing_id: entityId }, skippedLookups, 'bom_using_routing', 500),
    safeFilter(entities.BOL, { source_routing_id: entityId }, skippedLookups, 'bol_derived_from_routing', 500),
    safeFilter(entities.SupplierRoutingStep, { supplier_routing_id: entityId }, skippedLookups, 'supplier_routing_steps', 200),
  ]);

  const filteredBoms = includeInactive ? rawBoms : rawBoms.filter(b => !BOM_INACTIVE_STATUSES.includes(b.status));
  const { records: capBoms, total: totalBoms } = capGroup(filteredBoms, 'bom_using_routing', truncatedGroups);
  const { records: capBols, total: totalBols } = capGroup(rawBols, 'bol_derived_from_routing', truncatedGroups);
  const sortedSteps = rawSteps.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const { records: capSteps, total: totalSteps } = capGroup(sortedSteps, 'supplier_routing_steps', truncatedGroups);

  // Phase 2: batch-fetch product records for BOMs, bom records for BOLs, routing record for steps
  const productIds = [...new Set(capBoms.map(b => b.product_id).filter(Boolean))];
  const bolBomIds = [...new Set(capBols.map(b => b.bom_id).filter(Boolean))];

  const [productMap, bolBomMap, routingResult] = await Promise.all([
    batchFetchById(entities.Product, productIds, skippedLookups, 'sr_products'),
    batchFetchById(entities.BOM, bolBomIds, skippedLookups, 'sr_bol_boms'),
    entities.SupplierRouting.filter({ id: entityId }).catch(() => []),
  ]);

  // Need products for bol boms too
  const bolBomProductIds = [...new Set([...bolBomMap.values()].map(b => b.product_id).filter(Boolean))];
  const newProductIds = bolBomProductIds.filter(id => !productMap.has(id));
  const extraProductMap = newProductIds.length > 0
    ? await batchFetchById(entities.Product, newProductIds, skippedLookups, 'sr_bol_bom_products')
    : new Map();
  const allProductMap = new Map([...productMap, ...extraProductMap]);

  const routingRecord = routingResult[0] || null;
  const routingName = routingNameFromRecord(routingRecord, entityId);

  const mappedBoms = capBoms.map(bom => {
    const prod = allProductMap.get(bom.product_id);
    const pName = prod ? productNameFromRecord(prod, bom.product_id) : `Product:${bom.product_id}`;
    return {
      id: bom.id,
      label: bomLabelFromRecord(bom, pName),
      parent_context: { selected_routing_id: entityId, status: bom.status },
    };
  });

  const mappedBols = capBols.map(bol => {
    const bom = bolBomMap.get(bol.bom_id);
    const prod = bom ? allProductMap.get(bom.product_id) : null;
    const pName = prod ? productNameFromRecord(prod, bom?.product_id) : `Product:${bom?.product_id}`;
    const bomLabel = bom ? bomLabelFromRecord(bom, pName) : `BOL:${bol.bom_id}`;
    return {
      id: bol.id,
      label: `BOL for ${bomLabel}`,
      parent_context: { bom_id: bol.bom_id, source_routing_id: entityId, routing_name: routingName },
    };
  });

  const mappedSteps = capSteps.map(step => ({
    id: step.id,
    label: `${routingName} > Step ${step.sequence} — ${step.step_type || '—'}`,
    parent_context: { supplier_routing_id: entityId, sequence: step.sequence, step_type: step.step_type },
  }));

  return [
    { relationship: 'Production BOMs using this routing as selected path', relationship_key: 'bom_using_routing', downstream_type: 'BOM', count: totalBoms, records: mappedBoms },
    { relationship: 'BOLs derived from this routing', relationship_key: 'bol_derived_from_routing', downstream_type: 'BOL', count: totalBols, records: mappedBols },
    { relationship: 'Steps in this routing', relationship_key: 'supplier_routing_steps', downstream_type: 'SupplierRoutingStep', count: totalSteps, records: mappedSteps },
  ];
}

async function lookupSupplierRoutingStep(entityId, entities, skippedLookups, truncatedGroups) {
  // Phase 1: single lookup (only one relationship for this type)
  let rawOps = [];
  try {
    rawOps = await entities.BOLOperation.filter({ source_routing_step_id: entityId }, '-created_date', 500);
  } catch (err) {
    console.error(`[getWhereUsed] bol_operations_from_step failed: ${err.message}`);
    skippedLookups.push('bol_operations_from_step');
  }

  const { records: capOps, total: totalOps } = capGroup(rawOps, 'bol_operations_from_step', truncatedGroups);

  // Phase 2: batch-fetch BOL records, then BOM records for labels
  const bolIds = [...new Set(capOps.map(op => op.bol_id).filter(Boolean))];
  const bolMap = await batchFetchById(entities.BOL, bolIds, skippedLookups, 'srs_bols');
  const bomIds = [...new Set([...bolMap.values()].map(b => b.bom_id).filter(Boolean))];
  const [bomMap] = await Promise.all([batchFetchById(entities.BOM, bomIds, skippedLookups, 'srs_boms')]);
  const productIds = [...new Set([...bomMap.values()].map(b => b.product_id).filter(Boolean))];
  const productMap = await batchFetchById(entities.Product, productIds, skippedLookups, 'srs_products');

  const mappedOps = capOps.map(op => {
    const bol = bolMap.get(op.bol_id);
    const bom = bol ? bomMap.get(bol.bom_id) : null;
    const prod = bom ? productMap.get(bom.product_id) : null;
    const pName = prod ? productNameFromRecord(prod, bom?.product_id) : `Product:${bom?.product_id}`;
    const bomLabel = bom ? bomLabelFromRecord(bom, pName) : `BOL:${op.bol_id}`;
    return {
      id: op.id,
      label: `BOLOperation step ${op.sequence} on ${bomLabel}`,
      parent_context: { bol_id: op.bol_id, sequence: op.sequence, step_type: op.step_type },
    };
  });

  return [
    { relationship: 'BOLOperations derived from this routing step', relationship_key: 'bol_operations_from_step', downstream_type: 'BOLOperation', count: totalOps, records: mappedOps },
  ];
}

async function lookupApprovedSupplier(entityId, entities, includeInactive, skippedLookups, truncatedGroups) {
  // Phase 1: 4 lookups in parallel
  const [rawVariantsResolved, rawVariantsParent, rawLinks, rawLines] = await Promise.all([
    safeFilter(entities.BOMLineVariant, { approved_supplier_id: entityId }, skippedLookups, 'bomlinevariant_as_resolved_supplier', 500),
    safeFilter(entities.BOMLineVariant, { parent_approved_supplier_id: entityId }, skippedLookups, 'bomlinevariant_as_parent_supplier', 500),
    safeFilter(entities.ProductColorSupplierLink, { approved_supplier_id: entityId }, skippedLookups, 'product_color_supplier_links', 500),
    safeFilter(entities.BOMLine, { line_level_approved_supplier_id: entityId }, skippedLookups, 'bomline_line_level_supplier', 500),
  ]);

  const filteredLinks = includeInactive ? rawLinks : rawLinks.filter(l => l.colorway_supplier_status !== 'discontinued');

  const { records: capResolved, total: totalResolved } = capGroup(rawVariantsResolved, 'bomlinevariant_as_resolved_supplier', truncatedGroups);
  const { records: capParent, total: totalParent } = capGroup(rawVariantsParent, 'bomlinevariant_as_parent_supplier', truncatedGroups);
  const { records: capLinks, total: totalLinks } = capGroup(filteredLinks, 'product_color_supplier_links', truncatedGroups);
  const { records: capLines, total: totalLines } = capGroup(rawLines, 'bomline_line_level_supplier', truncatedGroups);

  // Phase 2: batch parent records
  const allVariants = [...capResolved, ...capParent];
  const variantLineIds = [...new Set(allVariants.map(v => v.bom_line_id).filter(Boolean))];
  const directLineIds = [...new Set(capLines.map(l => l.id).filter(Boolean))];
  const colorIds = [...new Set(capLinks.map(l => l.product_color_id).filter(Boolean))];
  const asResult = await entities.ApprovedSupplier.filter({ id: entityId }).catch(() => []);
  const asRecord = asResult[0] || null;

  const [variantLineMap, colorMap] = await Promise.all([
    batchFetchById(entities.BOMLine, [...new Set([...variantLineIds, ...directLineIds])], skippedLookups, 'as_lines'),
    batchFetchById(entities.ProductColor, colorIds, skippedLookups, 'as_colors'),
  ]);

  const bomIds = [...new Set([...variantLineMap.values()].map(l => l.bom_id).filter(Boolean))];
  const bomMap = await batchFetchById(entities.BOM, bomIds, skippedLookups, 'as_boms');
  const productIds = [...new Set([...bomMap.values()].map(b => b.product_id).filter(Boolean))];
  const [productMap, supplierMap] = await Promise.all([
    batchFetchById(entities.Product, productIds, skippedLookups, 'as_products'),
    asRecord?.supplier_id ? batchFetchById(entities.Supplier, [asRecord.supplier_id], skippedLookups, 'as_supplier') : Promise.resolve(new Map()),
  ]);

  const supplierRecord = asRecord?.supplier_id ? supplierMap.get(asRecord.supplier_id) : null;
  const supplierName = supplierNameFromRecord(supplierRecord, asRecord?.supplier_id);

  const makeVariantLabel = (v) => {
    const line = variantLineMap.get(v.bom_line_id);
    if (!line) return `BOMLineVariant:${v.id}`;
    const bom = bomMap.get(line.bom_id);
    const prod = bom ? productMap.get(bom.product_id) : null;
    const pName = prod ? productNameFromRecord(prod, bom?.product_id) : `Product:${bom?.product_id}`;
    const bomLabel = bom ? bomLabelFromRecord(bom, pName) : `BOM:${line.bom_id}`;
    const parts = [v.product_color_id ? `color:${v.product_color_id}` : null, v.size_id ? `size:${v.size_id}` : null].filter(Boolean);
    return `${bomLabel} > Line #${line.position ?? '?'} (${line.component_role || '—'}) > Variant: ${parts.join(', ') || v.id}`;
  };

  const makeLineLabel = (line) => {
    const bom = bomMap.get(line.bom_id);
    const prod = bom ? productMap.get(bom.product_id) : null;
    const pName = prod ? productNameFromRecord(prod, bom?.product_id) : `Product:${bom?.product_id}`;
    return {
      label: bom ? bomLabelFromRecord(bom, pName) : `BOM:${line.bom_id}`,
      parent_context: {
        bom_id: line.bom_id,
        bom_revision_code: bom?.revision_code,
        bom_status: bom?.status,
        product_id: bom?.product_id,
        product_name: pName,
      },
    };
  };

  const mappedResolved = capResolved.map(v => ({ id: v.id, label: makeVariantLabel(v) }));
  const mappedParent = capParent.map(v => ({ id: v.id, label: makeVariantLabel(v) }));
  const mappedLinks = capLinks.map(l => {
    const pc = colorMap.get(l.product_color_id);
    const colorLabel = productColorLabelFromRecord(pc, l.product_color_id);
    return {
      id: l.id,
      label: `${supplierName} for ${colorLabel}`,
      parent_context: { product_color_id: l.product_color_id, colorway_supplier_status: l.colorway_supplier_status },
    };
  });
  const mappedLines = capLines.map(line => {
    const { label, parent_context } = makeLineLabel(line);
    return { id: line.id, label, parent_context };
  });

  return [
    { relationship: 'BOMLineVariants using this supplier as resolved component supplier', relationship_key: 'bomlinevariant_as_resolved_supplier', downstream_type: 'BOMLineVariant', count: totalResolved, records: mappedResolved },
    { relationship: 'BOMLineVariants using this supplier as parent supplier axis', relationship_key: 'bomlinevariant_as_parent_supplier', downstream_type: 'BOMLineVariant', count: totalParent, records: mappedParent },
    { relationship: 'ProductColorSupplierLinks for this approved supplier', relationship_key: 'product_color_supplier_links', downstream_type: 'ProductColorSupplierLink', count: totalLinks, records: mappedLinks },
    { relationship: 'BOMLines with this supplier set as line-level override', relationship_key: 'bomline_line_level_supplier', downstream_type: 'BOMLine', count: totalLines, records: mappedLines },
  ];
}

async function lookupProductColorSupplierLink(entityId, entities, skippedLookups, truncatedGroups) {
  const rawVariants = await safeFilter(entities.BOMLineVariant, { product_color_supplier_link_id: entityId }, skippedLookups, 'bomlinevariant_using_link', 500);
  const { records: capVariants, total: totalVariants } = capGroup(rawVariants, 'bomlinevariant_using_link', truncatedGroups);

  // Batch parent records for labels
  const lineIds = [...new Set(capVariants.map(v => v.bom_line_id).filter(Boolean))];
  const lineMap = await batchFetchById(entities.BOMLine, lineIds, skippedLookups, 'pcsl_lines');
  const bomIds = [...new Set([...lineMap.values()].map(l => l.bom_id).filter(Boolean))];
  const bomMap = await batchFetchById(entities.BOM, bomIds, skippedLookups, 'pcsl_boms');
  const productIds = [...new Set([...bomMap.values()].map(b => b.product_id).filter(Boolean))];
  const productMap = await batchFetchById(entities.Product, productIds, skippedLookups, 'pcsl_products');

  const mappedVariants = capVariants.map(v => {
    const line = lineMap.get(v.bom_line_id);
    if (!line) return { id: v.id, label: `BOMLineVariant:${v.id}` };
    const bom = bomMap.get(line.bom_id);
    const prod = bom ? productMap.get(bom.product_id) : null;
    const pName = prod ? productNameFromRecord(prod, bom?.product_id) : `Product:${bom?.product_id}`;
    const bomLabel = bom ? bomLabelFromRecord(bom, pName) : `BOM:${line.bom_id}`;
    const parts = [v.product_color_id ? `color:${v.product_color_id}` : null, v.size_id ? `size:${v.size_id}` : null].filter(Boolean);
    return { id: v.id, label: `${bomLabel} > Line #${line.position ?? '?'} (${line.component_role || '—'}) > Variant: ${parts.join(', ') || v.id}` };
  });

  return [
    { relationship: 'BOMLineVariants using this ProductColorSupplierLink', relationship_key: 'bomlinevariant_using_link', downstream_type: 'BOMLineVariant', count: totalVariants, records: mappedVariants },
  ];
}

async function lookupBOMLine(entityId, entities, skippedLookups, truncatedGroups) {
  // Phase 1: 2 lookups in parallel
  const [rawVariants, rawProdLines] = await Promise.all([
    safeFilter(entities.BOMLineVariant, { bom_line_id: entityId }, skippedLookups, 'bomlinevariant_variants', 500),
    safeFilter(entities.BOMLine, { source_bom_line_id: entityId }, skippedLookups, 'bomline_cloned_to_prod', 500),
  ]);

  const { records: capVariants, total: totalVariants } = capGroup(rawVariants, 'bomlinevariant_variants', truncatedGroups);
  const { records: capProdLines, total: totalProdLines } = capGroup(rawProdLines, 'bomline_cloned_to_prod', truncatedGroups);

  // Phase 2: fetch self BOM for variant labels, and parent BOMs for cloned lines
  const prodLineBomIds = [...new Set(capProdLines.map(l => l.bom_id).filter(Boolean))];
  const [selfBomResult, prodLineBomMap] = await Promise.all([
    entities.BOMLine.filter({ id: entityId }).catch(() => []),
    batchFetchById(entities.BOM, prodLineBomIds, skippedLookups, 'bl_prod_boms'),
  ]);

  const selfLine = selfBomResult[0] || null;
  const allBomIds = [...new Set([selfLine?.bom_id, ...[...prodLineBomMap.keys()]].filter(Boolean))];
  const bomMap = await batchFetchById(entities.BOM, allBomIds, skippedLookups, 'bl_boms');
  const productIds = [...new Set([...bomMap.values()].map(b => b.product_id).filter(Boolean))];
  const productMap = await batchFetchById(entities.Product, productIds, skippedLookups, 'bl_products');

  const selfBom = selfLine ? bomMap.get(selfLine.bom_id) : null;
  const selfProd = selfBom ? productMap.get(selfBom.product_id) : null;
  const selfBomLabel = selfBom ? bomLabelFromRecord(selfBom, selfProd ? productNameFromRecord(selfProd, selfBom.product_id) : `Product:${selfBom.product_id}`) : `BOM:${selfLine?.bom_id}`;

  const mappedVariants = capVariants.map(v => {
    const parts = [v.product_color_id ? `color:${v.product_color_id}` : null, v.size_id ? `size:${v.size_id}` : null, v.product_color_and_more_id ? `more:${v.product_color_and_more_id}` : null].filter(Boolean);
    return { id: v.id, label: `${selfBomLabel} > Line #${selfLine?.position ?? '?'} > Variant: ${parts.join(', ') || v.id}` };
  });

  const mappedProdLines = capProdLines.map(line => {
    const bom = prodLineBomMap.get(line.bom_id) || bomMap.get(line.bom_id);
    const prod = bom ? productMap.get(bom.product_id) : null;
    const pName = prod ? productNameFromRecord(prod, bom?.product_id) : `Product:${bom?.product_id}`;
    const label = bom ? bomLabelFromRecord(bom, pName) : `BOM:${line.bom_id}`;
    return {
      id: line.id, label,
      parent_context: { bom_id: line.bom_id, bom_revision_code: bom?.revision_code, bom_status: bom?.status, product_id: bom?.product_id, product_name: pName },
    };
  });

  return [
    { relationship: 'BOMLineVariants resolving this line', relationship_key: 'bomlinevariant_variants', downstream_type: 'BOMLineVariant', count: totalVariants, records: mappedVariants },
    { relationship: 'Prod BOMLines cloned from this Dev BOMLine', relationship_key: 'bomline_cloned_to_prod', downstream_type: 'BOMLine', count: totalProdLines, records: mappedProdLines },
  ];
}

async function lookupBOMLineVariant(entityId, entities, skippedLookups, truncatedGroups) {
  const rawDs = await safeFilter(entities.ECOAffectedDownstream, { downstream_type: 'BOMLineVariant', downstream_id: entityId }, skippedLookups, 'eco_affected_downstream', 500);
  const { records: capDs, total: totalDs } = capGroup(rawDs, 'eco_affected_downstream', truncatedGroups);

  // Batch-fetch ECO records for labels
  const ecoIds = [...new Set(capDs.map(ds => ds.eco_id).filter(Boolean))];
  const ecoMap = await batchFetchById(entities.ECO, ecoIds, skippedLookups, 'blv_ecos');

  const mappedDs = capDs.map(ds => {
    const eco = ecoMap.get(ds.eco_id);
    const ecoNum = ecoNumberFromRecord(eco, ds.eco_id);
    return {
      id: ds.id,
      label: `${ecoNum} — ${ds.propagation_status} on BOMLineVariant`,
      parent_context: { eco_id: ds.eco_id, propagation_status: ds.propagation_status, flow_type: ds.flow_type },
    };
  });

  return [
    { relationship: 'ECO propagation history targeting this BOMLineVariant', relationship_key: 'eco_affected_downstream', downstream_type: 'ECOAffectedDownstream', count: totalDs, records: mappedDs },
  ];
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

    if (!entity_id) return Response.json({ error: 'entity_id is required' }, { status: 400 });
    if (!entity_type) return Response.json({ error: 'entity_type is required' }, { status: 400 });
    if (!SUPPORTED_ENTITY_TYPES.includes(entity_type)) {
      return Response.json({
        error: `Unsupported entity_type "${entity_type}". Supported types: ${SUPPORTED_ENTITY_TYPES.join(', ')}`,
      }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const skippedLookups = [];
    const truncatedGroups = [];

    // Dispatch main lookup + eco_propagation in parallel
    let groupsPromise;
    switch (entity_type) {
      case 'Product':          groupsPromise = lookupProduct(entity_id, entities, include_inactive, skippedLookups, truncatedGroups); break;
      case 'ProductColor':     groupsPromise = lookupProductColor(entity_id, entities, include_inactive, skippedLookups, truncatedGroups); break;
      case 'ProductRevision':  groupsPromise = lookupProductRevision(entity_id, entities, skippedLookups, truncatedGroups); break;
      case 'BOM':              groupsPromise = lookupBOM(entity_id, entities, include_inactive, skippedLookups, truncatedGroups); break;
      case 'SupplierRouting':  groupsPromise = lookupSupplierRouting(entity_id, entities, include_inactive, skippedLookups, truncatedGroups); break;
      case 'SupplierRoutingStep': groupsPromise = lookupSupplierRoutingStep(entity_id, entities, skippedLookups, truncatedGroups); break;
      case 'ApprovedSupplier': groupsPromise = lookupApprovedSupplier(entity_id, entities, include_inactive, skippedLookups, truncatedGroups); break;
      case 'ProductColorSupplierLink': groupsPromise = lookupProductColorSupplierLink(entity_id, entities, skippedLookups, truncatedGroups); break;
      case 'BOMLine':          groupsPromise = lookupBOMLine(entity_id, entities, skippedLookups, truncatedGroups); break;
      case 'BOMLineVariant':   groupsPromise = lookupBOMLineVariant(entity_id, entities, skippedLookups, truncatedGroups); break;
    }

    // Run main lookup and eco_propagation in parallel
    const [groups, eco_propagation] = await Promise.all([
      groupsPromise,
      getEcoPropagation(entity_type, entity_id, entities, include_terminal_eco_state),
    ]);

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