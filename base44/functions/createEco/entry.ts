/**
 * createEco
 *
 * Server-side ECO creation endpoint. Automatically generates and assigns
 * eco_number via the SystemCodeGenerator — the caller MUST NOT supply
 * eco_number. Any caller-supplied eco_number is silently ignored.
 *
 * Payload: all ECO fields EXCEPT eco_number. Required fields:
 *   title, reason_category, status, origin, flow_type, requested_by, requested_at
 *
 * Returns: the created ECO record.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Canonical inline code-generation helper ──────────────────────────────────
// Cannot import from sibling functions in Deno; logic is inlined here.
// Source of truth / canonical copy: functions/generateEntityCodeInline.js
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
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();

    // Strip any caller-supplied eco_number — we always generate it server-side
    const { eco_number: _ignored, ...fields } = payload;

    // Validate required fields
    const required = ['title', 'reason_category', 'status', 'origin', 'flow_type', 'requested_by', 'requested_at'];
    for (const f of required) {
      if (!fields[f]) {
        return Response.json({ error: `Missing required field: ${f}` }, { status: 400 });
      }
    }

    // Auto-generate eco_number
    const eco_number = await generateEntityCodeInline(base44.asServiceRole, 'ECO', 'ECO');

    const eco = await base44.asServiceRole.entities.ECO.create({
      ...fields,
      eco_number,
    });

    return Response.json(eco);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});