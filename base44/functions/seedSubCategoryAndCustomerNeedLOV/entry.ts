import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get existing LOV types
    const lovTypes = await base44.entities.TypeOfLOV.list('code', 500);
    
    // Create Sub-Category type if it doesn't exist
    if (!lovTypes.find(t => t.code === 'Sub-Category')) {
      await base44.entities.TypeOfLOV.create({
        code: 'Sub-Category',
        name: 'Sub-Category'
      });
    }

    // Create Customer Need type if it doesn't exist
    if (!lovTypes.find(t => t.code === 'Customer Need')) {
      await base44.entities.TypeOfLOV.create({
        code: 'Customer Need',
        name: 'Customer Need'
      });
    }

    return Response.json({ success: true, message: 'LOV types created/verified' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});