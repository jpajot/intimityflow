/**
 * createEcr
 *
 * Server-side ECR creation endpoint. Automatically generates and assigns
 * ecr_number via the SystemCodeGenerator — the caller MUST NOT supply
 * ecr_number. Any caller-supplied ecr_number is silently ignored.
 *
 * Payload: all ECR fields EXCEPT ecr_number. Required fields:
 *   title, reason_category, requested_by, requested_at
 *   (status defaults to "open" if not supplied)
 *
 * Returns: the created ECR record.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Inline code-generation helper with uniqueness guard ──────────────────────
// Cannot import from sibling functions in Deno; logic is inlined here.
// Source of truth / canonical copy: functions/generateEntityCodeInline.js
// Uniqueness guard added in Phase 5 #18-atomicity-fix
async function generateEntityCodeInline(base44ServiceRole, entity_name, entity_type) {
  const generators = await base44ServiceRole.entities.SystemCodeGenerator.filter({ entity_name, entity_type });
  if (generators.length === 0) throw new Error(`No SystemCodeGenerator found for entity_name=${entity_name}, entity_type=${entity_type}.`);
  const gen = generators[0];
  const padding = gen.padding || 5;
  const excludedSet = new Set((gen.excluded_codes || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean));
  let nextSeq = (gen.last_sequence || 0) + 1;
  let code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
  while (excludedSet.has(code.toUpperCase())) { nextSeq++; code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`; }

  // UNIQUENESS GUARD: Check if generated code already exists
  let attempts = 0;
  while (true) {
    const existing = await base44ServiceRole.entities.ECR.filter({ ecr_number: code }, '-created_date', 1);
    if (existing.length === 0) break;
    nextSeq++;
    code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
    attempts++;
    if (attempts > 100) {
      throw new Error(`Code generation collision storm: 100+ attempts to find unique ecr_number starting from sequence ${gen.last_sequence}. Investigate SystemCodeGenerator drift.`);
    }
  }

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

    // Strip any caller-supplied ecr_number — we always generate it server-side
    const { ecr_number: _ignored, ...fields } = payload;

    // Validate required fields
    const required = ['title', 'reason_category', 'requested_by', 'requested_at'];
    for (const f of required) {
      if (!fields[f]) {
        return Response.json({ error: `Missing required field: ${f}` }, { status: 400 });
      }
    }

    // Auto-generate ecr_number
    const ecr_number = await generateEntityCodeInline(base44.asServiceRole, 'ECR', 'ECR');

    const ecr = await base44.asServiceRole.entities.ECR.create({
      ...fields,
      ecr_number,
      status: fields.status || 'open',
    });

    return Response.json(ecr);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});