import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get existing LOV types
    const types = await base44.asServiceRole.entities.TypeOfLOV.list('code', 100);
    const categoryTypeId = types.find(t => t.code === 'Category')?.id;
    
    // Create Sub-Category type if missing
    let subCategoryType = types.find(t => t.code === 'Sub-Category');
    if (!subCategoryType) {
      subCategoryType = await base44.asServiceRole.entities.TypeOfLOV.create({
        code: 'Sub-Category',
        name: 'Sub-Category',
        depends_on_id: categoryTypeId,
      });
    }

    // Create Customer Need type if missing
    let customerNeedType = types.find(t => t.code === 'Customer Need');
    if (!customerNeedType) {
      customerNeedType = await base44.asServiceRole.entities.TypeOfLOV.create({
        code: 'Customer Need',
        name: 'Customer Need',
        depends_on_id: subCategoryType.id,
      });
    }

    // Get all existing values
    const values = await base44.asServiceRole.entities.ListOfValues.list('name', 5000);
    
    // Get categories and existing sub-categories
    const categories = values.filter(v => v.type_of_lov_id === categoryTypeId);
    const existingSubCats = values.filter(v => v.type_of_lov_id === subCategoryType.id);

    // Sample sub-categories for each category
    const subCatSamples = {
      'Loungewear': ['Loungewear - Casual', 'Loungewear - Sleep'],
      'Lingerie Sets': ['Bra & Brief Set', 'Bra & Thong Set'],
      'Shapewear': ['Mid-Thigh', 'Full Body'],
    };

    // Create missing sub-categories
    for (const [catName, subNames] of Object.entries(subCatSamples)) {
      const cat = categories.find(c => c.name === catName);
      if (!cat) continue;

      for (const subName of subNames) {
        const exists = existingSubCats.find(v => v.name === subName && v.depends_on_value_id === cat.id);
        if (!exists) {
          await base44.asServiceRole.entities.ListOfValues.create({
            type_of_lov_id: subCategoryType.id,
            name: subName,
            depends_on_value_id: cat.id,
          });
        }
      }
    }

    return Response.json({
      success: true,
      message: 'LOV types and sample values created/verified',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});