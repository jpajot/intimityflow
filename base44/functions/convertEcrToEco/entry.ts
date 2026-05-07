/**
 * convertEcrToEco
 *
 * Converts an open ECR into a new ECO record, linking the two bidirectionally.
 * eco_number is generated via the inlined SystemCodeGenerator helper.
 *
 * Payload: {
 *   ecr_id: string,
 *   additional_eco_fields?: {
 *     flow_type?: string,
 *     description?: string,
 *     requested_by?: string,
 *     notes?: string,
 *     target_effective_date?: string,
 *   }
 * }
 *
 * Returns: { success: true, eco_id, eco_number, ecr_id }
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

    const { ecr_id, additional_eco_fields = {} } = await req.json();

    if (!ecr_id) {
      return Response.json({ error: 'ecr_id is required' }, { status: 400 });
    }

    // Step 1: Load ECR
    const ecrs = await base44.asServiceRole.entities.ECR.filter({ id: ecr_id });
    if (ecrs.length === 0) {
      return Response.json({ error: `ECR not found: ${ecr_id}` }, { status: 404 });
    }
    const ecr = ecrs[0];

    // Step 2: Validate ECR status
    const convertibleStatuses = ['open', 'under_investigation'];
    if (!convertibleStatuses.includes(ecr.status)) {
      return Response.json({
        error: `ECR cannot be converted: current status is "${ecr.status}". Only open or under_investigation ECRs can be converted.`,
      }, { status: 400 });
    }

    // Step 3: Idempotency guard
    if (ecr.converted_eco_id) {
      return Response.json({
        error: `ECR already converted to ECO ${ecr.converted_eco_id}.`,
      }, { status: 409 });
    }

    // Step 4a: Generate eco_number via shared inline utility
    const eco_number = await generateEntityCodeInline(base44.asServiceRole, 'ECO', 'ECO');

    const now = new Date().toISOString();

    // Step 4b: Create ECO
    let newEco;
    try {
      newEco = await base44.asServiceRole.entities.ECO.create({
        eco_number,
        title: ecr.title,
        description: additional_eco_fields.description ?? ecr.description ?? null,
        reason_category: ecr.reason_category,
        priority: ecr.priority || 'normal',
        status: 'proposed',
        origin: 'ecr_conversion',
        flow_type: additional_eco_fields.flow_type ?? 'manual',
        source_ecr_id: ecr.id,
        requested_by: additional_eco_fields.requested_by ?? ecr.requested_by,
        requested_at: now,
        notes: additional_eco_fields.notes ?? null,
        target_effective_date: additional_eco_fields.target_effective_date ?? null,
      });
    } catch (createErr) {
      return Response.json({
        error: `Failed to create ECO record: ${createErr.message}. No changes were made to the ECR.`,
      }, { status: 500 });
    }

    // Step 5: Update ECR
    try {
      await base44.asServiceRole.entities.ECR.update(ecr.id, {
        status: 'converted',
        converted_eco_id: newEco.id,
        converted_at: now,
        closed_at: now,
      });
    } catch (updateErr) {
      return Response.json({
        error: `PARTIAL FAILURE: ECO ${newEco.id} (${eco_number}) was created successfully, but the ECR status update failed: ${updateErr.message}. Manual reconciliation required.`,
        partial: true,
        eco_id: newEco.id,
        eco_number,
        ecr_id: ecr.id,
      }, { status: 207 });
    }

    return Response.json({
      success: true,
      eco_id: newEco.id,
      eco_number,
      ecr_id: ecr.id,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});