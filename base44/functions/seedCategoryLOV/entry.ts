import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const CATEGORIES = [
  "Briefs",
  "Boxers",
  "Trunks",
  "Thongs",
  "Bras",
  "Lingerie Sets",
  "Shapewear",
  "Loungewear"
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Check if Category TypeOfLOV exists
    const existing = await base44.entities.TypeOfLOV.filter({ code: "Category" });
    let categoryTypeId;

    if (existing.length === 0) {
      const created = await base44.entities.TypeOfLOV.create({ code: "Category", name: "Category" });
      categoryTypeId = created.id;
    } else {
      categoryTypeId = existing[0].id;
    }

    // Get existing category values
    const existingValues = await base44.entities.ListOfValues.filter({ type_of_lov_id: categoryTypeId });
    const existingNames = new Set(existingValues.map((v) => v.name));

    // Create missing category values
    const toCreate = CATEGORIES.filter((cat) => !existingNames.has(cat));
    let created = [];

    if (toCreate.length > 0) {
      created = await base44.entities.ListOfValues.bulkCreate(
        toCreate.map((name) => ({ type_of_lov_id: categoryTypeId, name }))
      );
    }

    return Response.json({
      success: true,
      typeOfLovId: categoryTypeId,
      created: created.length,
      total: existingValues.length + created.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});