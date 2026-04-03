import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [types, values] = await Promise.all([
      base44.entities.TypeOfLOV.list("code", 100),
      base44.entities.ListOfValues.list("name", 1000),
    ]);

    const subCatType = types.find(t => t.code === "Sub-Category");
    const categoryType = types.find(t => t.code === "Category");

    const categories = values.filter(v => v.type_of_lov_id === categoryType?.id);
    const subCats = values.filter(v => v.type_of_lov_id === subCatType?.id);

    return Response.json({
      categoryType,
      subCatType,
      categories: categories.map(c => ({ id: c.id, name: c.name })),
      subCategories: subCats.map(s => ({ id: s.id, name: s.name, depends_on_value_id: s.depends_on_value_id })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});