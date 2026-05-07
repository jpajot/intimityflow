/**
 * createProductRevision
 *
 * Creates a new ProductRevision row for a given (product_id, target_type, target_id) tuple.
 * Handles revision_code generation (spreadsheet-column letter scheme), field_diffs computation,
 * and the atomic-ish insert-then-demote-old is_current flip.
 *
 * Payload:
 *   product_id       string   required
 *   target_type      string   required  — product | product_color | product_color_size | product_variant | product_attribute
 *   target_id        string   required
 *   revision_context string   required
 *   before_snapshot  object   required  — {} for first revision
 *   after_snapshot   object   required
 *   triggered_by     string   required  — user email
 *   linked_eco_id    string   optional
 *
 * Returns: { success, revision_id, revision_code, is_first_revision }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_TARGET_TYPES = ['product', 'product_color', 'product_color_size', 'product_variant', 'product_attribute'];

// ── Spreadsheet-column letter increment (canonical inlined algorithm) ──────────
// Sequence: A, B, …, Z (26), AA, AB, …, ZZ (702), AAA, …
// This matches the "base-26 with no zero" scheme used by Excel column headers.
//
// codeToNum("A") = 1, ("Z") = 26, ("AA") = 27, ("AZ") = 52, ("BA") = 53
// numToCode(1) = "A", (26) = "Z", (27) = "AA"

function codeToNum(code) {
  let n = 0;
  for (let i = 0; i < code.length; i++) {
    n = n * 26 + (code.charCodeAt(i) - 64); // 'A'=65 → 1
  }
  return n;
}

function numToCode(n) {
  let result = '';
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

function nextRevisionCode(existingCodes) {
  if (!existingCodes || existingCodes.length === 0) return 'A';
  // Sort by length first (longer = later), then alphabetically within same length
  const sorted = [...existingCodes].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });
  const latest = sorted[sorted.length - 1];
  return numToCode(codeToNum(latest) + 1);
}

// ── Compute field_diffs from two snapshots ────────────────────────────────────
function computeFieldDiffs(before, after) {
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const diffs = [];
  for (const field of allKeys) {
    const bv = (before || {})[field] ?? null;
    const av = (after || {})[field] ?? null;
    // Use JSON comparison for objects/arrays
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      diffs.push({ field, before: bv, after: av });
    }
  }
  return diffs.sort((a, b) => a.field.localeCompare(b.field));
}

// ── Main handler ───────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      product_id,
      target_type,
      target_id,
      revision_context,
      before_snapshot = {},
      after_snapshot = {},
      triggered_by,
      linked_eco_id = null,
    } = await req.json();

    // ── Validate ───────────────────────────────────────────────────────────────
    if (!product_id) return Response.json({ error: 'product_id is required' }, { status: 400 });
    if (!target_id) return Response.json({ error: 'target_id is required' }, { status: 400 });
    if (!target_type) return Response.json({ error: 'target_type is required' }, { status: 400 });
    if (!revision_context?.trim()) return Response.json({ error: 'revision_context is required' }, { status: 400 });
    if (!triggered_by) return Response.json({ error: 'triggered_by is required' }, { status: 400 });
    if (!ALLOWED_TARGET_TYPES.includes(target_type)) {
      return Response.json({ error: `target_type must be one of: ${ALLOWED_TARGET_TYPES.join(', ')}` }, { status: 400 });
    }
    if (target_type === 'product' && target_id !== product_id) {
      return Response.json({ error: 'For target_type="product", target_id must equal product_id' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const now = new Date().toISOString();

    // ── Compute field_diffs ────────────────────────────────────────────────────
    // If either snapshot is empty → no diffs (first revision or explicit bump)
    const hasBeforeContent = Object.keys(before_snapshot || {}).length > 0;
    const hasAfterContent = Object.keys(after_snapshot || {}).length > 0;
    const field_diffs = (hasBeforeContent && hasAfterContent)
      ? computeFieldDiffs(before_snapshot, after_snapshot)
      : [];

    // ── Find existing revisions for this tuple ─────────────────────────────────
    const existing = await svc.entities.ProductRevision.filter({
      product_id,
      target_type,
      target_id,
    });
    const is_first_revision = existing.length === 0;

    // ── Generate revision_code ─────────────────────────────────────────────────
    const existingCodes = existing.map(r => r.revision_code).filter(Boolean);
    const revision_code = nextRevisionCode(existingCodes);

    // ── Find current is_current=true row (to demote after insert) ─────────────
    const currentRow = existing.find(r => r.is_current === true) || null;

    // ── Insert the new revision (is_current = true) ────────────────────────────
    // Insert FIRST — fail-closed: if this fails, old current stays current.
    const newRevision = await svc.entities.ProductRevision.create({
      product_id,
      target_type,
      target_id,
      revision_code,
      revision_context: revision_context.trim(),
      before_snapshot: before_snapshot || {},
      after_snapshot: after_snapshot || {},
      field_diffs,
      created_by: triggered_by,
      created_at: now,
      is_current: true,
      linked_eco_id: linked_eco_id || null,
    });

    // ── Demote the old current row (fail-soft: log loudly but don't abort) ────
    if (currentRow) {
      try {
        await svc.entities.ProductRevision.update(currentRow.id, { is_current: false });
      } catch (err) {
        console.error(
          `[createProductRevision] INCONSISTENCY: Failed to demote old is_current row ${currentRow.id} for (${product_id}, ${target_type}, ${target_id}). ` +
          `Two rows now have is_current=true. Run reconcileIsCurrentFlags to fix. Error: ${err.message}`
        );
      }
    }

    console.log(`[createProductRevision] Created ${target_type} revision ${revision_code} for product ${product_id} target ${target_id}. id=${newRevision.id}`);

    return Response.json({
      success: true,
      revision_id: newRevision.id,
      revision_code,
      is_first_revision,
    });

  } catch (error) {
    console.error(`[createProductRevision] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});