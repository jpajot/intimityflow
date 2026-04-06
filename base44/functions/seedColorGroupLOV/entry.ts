import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const COLOR_GROUPS = [
  "Beige / Khaki", "Black", "Blue", "Brown", "Green",
  "Grey", "Orange", "Pink", "Purple", "Red", "White", "Yellow"
];

const COLOR_SUB_GROUPS = [
  { name: "blue", group: "Blue" },
  { name: "blue black", group: "Black" },
  { name: "bright red", group: "Red" },
  { name: "charcoal", group: "Grey" },
  { name: "dark beige", group: "Beige / Khaki" },
  { name: "dark brown", group: "Brown" },
  { name: "deep black", group: "Black" },
  { name: "deep pink", group: "Pink" },
  { name: "deep red", group: "Red" },
  { name: "golden yellow", group: "Yellow" },
  { name: "green", group: "Green" },
  { name: "jet black", group: "Black" },
  { name: "light beige", group: "Beige / Khaki" },
  { name: "light grey", group: "Grey" },
  { name: "medium beige", group: "Beige / Khaki" },
  { name: "medium brown", group: "Brown" },
  { name: "medium grey", group: "Grey" },
  { name: "navy", group: "Blue" },
  { name: "off white", group: "White" },
  { name: "olive green", group: "Green" },
  { name: "orange", group: "Orange" },
  { name: "plum", group: "Purple" },
  { name: "soft pink", group: "Pink" },
  { name: "soft yellow", group: "Yellow" },
  { name: "violet", group: "Purple" },
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 1. Get or create ColorGroup TypeOfLOV
  let groupTypes = await base44.asServiceRole.entities.TypeOfLOV.filter({ code: "ColorGroup" });
  let groupType;
  if (groupTypes.length === 0) {
    groupType = await base44.asServiceRole.entities.TypeOfLOV.create({ code: "ColorGroup", name: "Color Group" });
  } else {
    groupType = groupTypes[0];
  }

  // 2. Get existing group values
  const existingGroupVals = await base44.asServiceRole.entities.ListOfValues.filter({ type_of_lov_id: groupType.id });
  const existingGroupNames = new Set(existingGroupVals.map(v => v.name));

  // 3. Create missing group values
  const createdGroupVals = [...existingGroupVals];
  for (const name of COLOR_GROUPS) {
    if (!existingGroupNames.has(name)) {
      const created = await base44.asServiceRole.entities.ListOfValues.create({ type_of_lov_id: groupType.id, name });
      createdGroupVals.push(created);
    }
  }
  const groupValMap = {};
  createdGroupVals.forEach(v => { groupValMap[v.name] = v.id; });

  // 4. Get or create ColorSubGroup TypeOfLOV
  let subGroupTypes = await base44.asServiceRole.entities.TypeOfLOV.filter({ code: "ColorSubGroup" });
  let subGroupType;
  if (subGroupTypes.length === 0) {
    subGroupType = await base44.asServiceRole.entities.TypeOfLOV.create({ code: "ColorSubGroup", name: "Color Sub-Group", depends_on_id: groupType.id });
  } else {
    subGroupType = subGroupTypes[0];
  }

  // 5. Get existing sub-group values
  const existingSubVals = await base44.asServiceRole.entities.ListOfValues.filter({ type_of_lov_id: subGroupType.id });
  const existingSubNames = new Set(existingSubVals.map(v => v.name));

  // 6. Create missing sub-group values
  let created = 0;
  for (const { name, group } of COLOR_SUB_GROUPS) {
    if (!existingSubNames.has(name)) {
      await base44.asServiceRole.entities.ListOfValues.create({
        type_of_lov_id: subGroupType.id,
        name,
        depends_on_value_id: groupValMap[group],
      });
      created++;
    }
  }

  return Response.json({ success: true, groupTypeId: groupType.id, subGroupTypeId: subGroupType.id, subGroupsCreated: created });
});