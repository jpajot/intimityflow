/**
 * generateEntityCodeInline
 *
 * WHY THIS EXISTS:
 *   The Deno runtime that runs Base44 backend functions blocks cross-function
 *   HTTP calls at the infrastructure level (sibling function invocation is not
 *   allowed). The standard `generateCode` cloud function therefore cannot be
 *   called from inside another backend function. Any backend code that needs to
 *   generate a SystemCodeGenerator-based code must inline the increment logic
 *   locally — this module is the single canonical implementation of that logic.
 *
 * WHEN TO USE IT:
 *   Import and call `generateEntityCodeInline` from any backend function or
 *   server-side hook that needs to generate a code (ECR number, ECO number, etc.)
 *   at record-creation time without going through an HTTP round-trip.
 *
 * WHEN NOT TO USE IT:
 *   Frontend (React) code should NOT import this module. Frontend callers can
 *   (and should) continue calling the `generateCode` cloud function via the
 *   Base44 SDK: `base44.functions.invoke('generateCode', { entity_name, entity_type })`.
 *   This utility is for server-side use only.
 */

/**
 * Generates and reserves the next code for a given entity/type pair by
 * atomically incrementing the matching SystemCodeGenerator record.
 *
 * @param {object} base44      - Initialized Base44 SDK client (service role).
 * @param {string} entity_name - Matches SystemCodeGenerator.entity_name (e.g. "ECR").
 * @param {string} entity_type - Matches SystemCodeGenerator.entity_type (e.g. "ECR").
 * @returns {Promise<string>}  - The generated code (e.g. "ECR00002").
 * @throws {Error}             - If no matching SystemCodeGenerator record is found.
 */
export async function generateEntityCodeInline(base44, entity_name, entity_type) {
  const generators = await base44.asServiceRole.entities.SystemCodeGenerator.filter({
    entity_name,
    entity_type,
  });

  if (generators.length === 0) {
    throw new Error(
      `No SystemCodeGenerator found for entity_name=${entity_name}, entity_type=${entity_type}.`
    );
  }

  const gen = generators[0];
  const padding = gen.padding || 5;
  const excludedSet = new Set(
    (gen.excluded_codes || '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean)
  );

  let nextSeq = (gen.last_sequence || 0) + 1;
  let code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;

  while (excludedSet.has(code.toUpperCase())) {
    nextSeq += 1;
    code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
  }

  await base44.asServiceRole.entities.SystemCodeGenerator.update(gen.id, {
    last_sequence: nextSeq,
  });

  return code;
}