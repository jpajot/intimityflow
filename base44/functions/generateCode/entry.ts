import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Atomically increments the last_sequence on a SystemCodeGenerator record
 * and returns the generated code string, skipping any excluded codes.
 *
 * Payload: { entity_name: string, entity_type: string }
 * Returns: { code: string, sequence: number }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_name, entity_type } = await req.json();

    if (!entity_name || !entity_type) {
      return Response.json({ error: 'entity_name and entity_type are required' }, { status: 400 });
    }

    // Find the matching generator config
    const generators = await base44.asServiceRole.entities.SystemCodeGenerator.filter({
      entity_name,
      entity_type,
    });

    if (generators.length === 0) {
      return Response.json(
        { error: `No code generator configured for ${entity_name} / ${entity_type}` },
        { status: 404 }
      );
    }

    const gen = generators[0];
    const padding = gen.padding || 5;

    // Build excluded codes set
    const excludedSet = new Set(
      (gen.excluded_codes || '')
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
    );

    // Find next sequence that doesn't produce an excluded code
    let nextSeq = (gen.last_sequence || 0) + 1;
    let code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
    while (excludedSet.has(code.toUpperCase())) {
      nextSeq += 1;
      code = `${gen.prefix}${String(nextSeq).padStart(padding, '0')}`;
    }

    // Persist incremented sequence
    await base44.asServiceRole.entities.SystemCodeGenerator.update(gen.id, {
      last_sequence: nextSeq,
    });

    return Response.json({ code, sequence: nextSeq });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});