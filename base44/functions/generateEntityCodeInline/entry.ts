/**
 * generateEntityCodeInline – CANONICAL CODE-GENERATION REFERENCE
 *
 * UNIQUENESS GUARD (Phase 5 #18-atomicity-fix):
 * This pattern is INLINED into every backend function that creates entity records
 * with auto-generated codes (ECO, ECR, ProductRevision, etc.). The Deno cross-function
 * call constraint prevents using this function as a sibling import — every consumer
 * must inline the pattern.
 *
 * After computing a candidate code from last_sequence, the function queries the
 * target entity table to confirm the code is not already in use. If it is, the
 * sequence is incremented and the candidate is regenerated. The loop is bounded
 * at 100 iterations to prevent infinite spinning on data corruption.
 *
 * RACE CONDITION CAVEAT:
 * Base44 does not expose true database-level atomic increment for SystemCodeGenerator.
 * Two simultaneous calls can technically read the same last_sequence and both
 * proceed. The uniqueness guard catches the collision after the fact (one call's
 * write succeeds; the other's guard detects the conflict and retries with a higher
 * sequence). Sequence gaps may result but data integrity is preserved.
 *
 * The 'last_sequence' field in SystemCodeGenerator should never be rolled back —
 * gaps in the issued codes are acceptable and align with audit-trail conventions.
 *
 * THE CANONICAL INLINE LOGIC (copy this block into any function that needs it):
 *
 *   async function generateEntityCodeInline(base44ServiceRole, entity_name, entity_type, code_field = null, query_filter = {}) {
 *     const generators = await base44ServiceRole.entities.SystemCodeGenerator.filter({ entity_name, entity_type });
 *     if (generators.length === 0) throw new Error(`No SystemCodeGenerator found for entity_name=${entity_name}, entity_type=${entity_type}.`);
 *     const gen = generators[0];
 *     const padding = gen.padding || 5;
 *     const excludedSet = new Set((gen.excluded_codes || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean));
 *     let nextSeq = (gen.last_sequence || 0) + 1;
 *     let code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
 *     while (excludedSet.has(code.toUpperCase())) { nextSeq++; code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`; }
 *
 *     // UNIQUENESS GUARD: Verify the generated code isn't already in the entity table
 *     const actualCodeField = code_field || (entity_name === 'ECO' ? 'eco_number' : entity_name === 'ECR' ? 'ecr_number' : 'revision_code');
 *     const checkFilter = { ...query_filter, [actualCodeField]: code };
 *     let attempts = 0;
 *     while (true) {
 *       const existing = await base44ServiceRole.entities[entity_name].filter(checkFilter, '-created_date', 1);
 *       if (existing.length === 0) break;
 *       nextSeq++;
 *       code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
 *       checkFilter[actualCodeField] = code;
 *       attempts++;
 *       if (attempts > 100) {
 *         throw new Error(`Code generation collision storm: 100+ attempts to find unique ${actualCodeField} starting from sequence ${gen.last_sequence}. Investigate SystemCodeGenerator drift.`);
 *       }
 *     }
 *
 *     await base44ServiceRole.entities.SystemCodeGenerator.update(gen.id, { last_sequence: nextSeq });
 *     return code;
 *   }
 *
 * WHEN TO USE:
 *   Inside backend functions that create ECR, ECO, or other
 *   SystemCodeGenerator-managed records. Call before the entity insert and
 *   set the result as the code field.
 *
 * WHEN NOT TO USE:
 *   Frontend code — use base44.functions.invoke('generateCode', { entity_name, entity_type }) instead.
 *
 * PARAMETERS:
 *   base44ServiceRole: service role client
 *   entity_name: e.g. "ECO", "ECR", "ProductRevision"
 *   entity_type: type within the entity, e.g. "ECO", "ECR", or target-type for ProductRevision
 *   code_field: (optional) override for which field holds the code (e.g. "eco_number", "ecr_number", "revision_code")
 *   query_filter: (optional) additional filter for uniqueness check, e.g. { target_id: "xyz" } for ProductRevision scoping
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  return Response.json(
    { error: 'This module is a shared utility reference — it has no callable endpoint. See the file comments for usage.' },
    { status: 405 }
  );
});