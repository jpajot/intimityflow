/**
 * generateEntityCodeInline
 *
 * This file doubles as:
 *   1. A documented HTTP endpoint (returns 405 for all requests) that makes the
 *      pattern visible in the function list.
 *   2. The canonical home of the generateEntityCodeInlineLogic helper — but
 *      because the Deno runtime blocks cross-file imports, the actual logic
 *      must be copy-pasted (inlined) into each consuming function.
 *
 * WHY THIS PATTERN EXISTS:
 *   The Base44 / Deno runtime does not allow one backend function to import
 *   from another backend function file at deploy time. Every function is
 *   deployed as an isolated module. Shared logic must therefore be inlined
 *   into each consuming function.
 *
 * THE CANONICAL INLINE LOGIC (copy this block into any function that needs it):
 *
 *   async function generateEntityCodeInline(base44ServiceRole, entity_name, entity_type) {
 *     const generators = await base44ServiceRole.entities.SystemCodeGenerator.filter({ entity_name, entity_type });
 *     if (generators.length === 0) throw new Error(`No SystemCodeGenerator found for entity_name=${entity_name}, entity_type=${entity_type}.`);
 *     const gen = generators[0];
 *     const padding = gen.padding || 5;
 *     const excludedSet = new Set((gen.excluded_codes || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean));
 *     let nextSeq = (gen.last_sequence || 0) + 1;
 *     let code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
 *     while (excludedSet.has(code.toUpperCase())) { nextSeq++; code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`; }
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
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  return Response.json(
    { error: 'This module is a shared utility reference — it has no callable endpoint. See the file comments for usage.' },
    { status: 405 }
  );
});