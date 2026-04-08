import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";



export default function EntityFieldConfigMatrix() {
  const [selectedEntity, setSelectedEntity] = useState("Product");
  const [configs, setConfigs] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [entities, setEntities] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfigs();
    loadEntities();
  }, []);

  useEffect(() => {
    loadEntityTypes();
    loadFields(selectedEntity);
  }, [selectedEntity]);

  const loadEntities = async () => {
    const [types, values] = await Promise.all([
      base44.entities.TypeOfLOV.list("code", 500),
      base44.entities.ListOfValues.list("name", 5000),
    ]);
    const entitiesLov = types.find((t) => t.code === "Entities");
    if (entitiesLov) {
      const entityValues = values.filter((v) => v.type_of_lov_id === entitiesLov.id);
      setEntities(entityValues.map((v) => v.name));
      if (entityValues.length > 0 && !entityValues.find((e) => e.name === selectedEntity)) {
        setSelectedEntity(entityValues[0].name);
      }
    }
  };

  const loadFields = async (entityName) => {
    try {
      if (!entityName || !base44.entities[entityName]) {
        setFields([]);
        return;
      }
      const entity = base44.entities[entityName];
      let fieldList = [];
      
      // Try to get schema
      if (typeof entity.schema === 'function') {
        const schema = await entity.schema();
        if (schema?.properties) {
          fieldList = Object.keys(schema.properties);
        }
      } else {
        // Fallback: try to fetch a sample record and infer fields
        const sample = await entity.list('name', 1);
        if (sample.length > 0) {
          fieldList = Object.keys(sample[0]).filter(k => !['id', 'created_date', 'updated_date', 'created_by'].includes(k));
        }
      }
      
      setFields(fieldList);
    } catch (err) {
      console.error(`Failed to load fields for ${entityName}:`, err);
      setFields([]);
    }
  };

  const loadConfigs = async () => {
    setLoading(true);
    const all = await base44.entities.EntityFieldConfig.list("field_name", 500);
    setConfigs(all);
    setLoading(false);
  };

  const loadEntityTypes = async () => {
    const [types, values] = await Promise.all([
      base44.entities.TypeOfLOV.list("code", 500),
      base44.entities.ListOfValues.list("name", 5000),
    ]);
    const entitiesLov = types.find((t) => t.code === "Entities");
    const entityTypesLov = types.find((t) => t.code === "EntityTypes");
    if (!entitiesLov || !entityTypesLov) return;
    const parentEntity = values.find((v) => v.type_of_lov_id === entitiesLov.id && v.name === selectedEntity);
    if (!parentEntity) return;
    const typeValues = values.filter((v) => v.type_of_lov_id === entityTypesLov.id && v.depends_on_value_id === parentEntity.id);
    setEntityTypes(typeValues.map((v) => v.name));
  };

  const handleToggle = async (field, entityType) => {
    setSaving(true);
    const key = `${selectedEntity}:${field}`;
    const existing = configs.find((c) => c.entity_name === selectedEntity && c.field_name === field);
    const visibleTypes = existing?.visible_for_types || [];
    const updated = visibleTypes.includes(entityType)
      ? visibleTypes.filter((t) => t !== entityType)
      : [...visibleTypes, entityType];

    if (existing) {
      await base44.entities.EntityFieldConfig.update(existing.id, { visible_for_types: updated });
      setConfigs((prev) => prev.map((c) => c.id === existing.id ? { ...c, visible_for_types: updated } : c));
    } else {
      const created = await base44.entities.EntityFieldConfig.create({
        entity_name: selectedEntity,
        field_name: field,
        visible_for_types: updated,
      });
      setConfigs((prev) => [...prev, created]);
    }
    setSaving(false);
  };



  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Select Entity</Label>
        <Select value={selectedEntity} onValueChange={setSelectedEntity}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {entities.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2 text-left font-semibold text-xs">Field</th>
                {entityTypes.map((type) => (
                  <th key={type} className="px-3 py-2 text-center font-semibold text-xs">
                    {type}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const config = configs.find((c) => c.entity_name === selectedEntity && c.field_name === field);
                return (
                  <tr key={field} className="border-b border-border hover:bg-muted/20">
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{field}</td>
                    {entityTypes.map((type) => (
                      <td key={`${field}:${type}`} className="px-3 py-2 text-center">
                        <Checkbox
                          checked={(config?.visible_for_types || []).includes(type)}
                          onCheckedChange={() => handleToggle(field, type)}
                          disabled={saving}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

EntityFieldConfigMatrix.displayName = "EntityFieldConfigMatrix";