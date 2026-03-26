import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Returns the list of all entity names available in the app schema.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Read entity JSON files from the entities directory
    const entityNames = [];
    for await (const entry of Deno.readDir('/app/src/entities')) {
      if (entry.isFile && entry.name.endsWith('.json')) {
        entityNames.push(entry.name.replace('.json', ''));
      }
    }
    entityNames.sort();
    return Response.json({ entities: entityNames });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});