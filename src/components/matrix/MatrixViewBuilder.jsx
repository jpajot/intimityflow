import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const MATRIX_ELIGIBLE_ENTITIES = ["Product", "TechnicalColor", "CommercialColor", "ProductColor", "ProductColorProjectLink", "ProductColorAndMore", "ProductColorAndMoreProjectLink"];

export default function MatrixViewBuilder({ projectId, onSave, onCancel, initialConfig }) {
  const defaults = {
    name: "",
    row_entity: "Product",
    row_fields: [],
    column_entity: "TechnicalColor",
    column_fields: [],
    junction_entity: "ProductColor",
    junction_fields: [],
    junction_link_fields: [],
    row_fk_field: "product_id",
    column_fk_field: "linked_tech_color_id",
    thumbnail_size: "md",
    cell_display_size: "normal",
  };
  
  const [config, setConfig] = useState(initialConfig ? { ...defaults, ...initialConfig } : defaults);
  
  const [entitySchemas, setEntitySchemas] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSchemas();
  }, []);

  const loadSchemas = async () => {
    const schemas = {};
    for (const entity of MATRIX_ELIGIBLE_ENTITIES) {
      try {
        if (!base44.entities[entity]) {
          schemas[entity] = [];
          continue;
        }
        // Try schema() first (doesn't require existing records)
        if (typeof base44.entities[entity].schema === 'function') {
          const schema = await base44.entities[entity].schema();
          if (schema?.properties && Object.keys(schema.properties).length > 0) {
            schemas[entity] = Object.keys(schema.properties).sort();
            continue;
          }
        }
        // Fallback to sample record
        const sample = await base44.entities[entity].list("-created_date", 1);
        if (sample.length > 0) {
          const fields = Object.keys(sample[0]).filter(k => !["id", "created_date", "updated_date", "created_by"].includes(k));
          schemas[entity] = fields.sort();
        } else {
          schemas[entity] = [];
        }
      } catch (err) {
        console.warn(`Failed to load schema for ${entity}:`, err.message);
        schemas[entity] = [];
      }
    }
    setEntitySchemas(schemas);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!config.name || !config.row_entity || !config.column_entity || !config.junction_entity) {
      alert("Please fill in all required fields");
      return;
    }
    setSaving(true);
    const configToSave = {
      ...config,
      project_id: projectId,
      row_entity: config.row_entity,
      row_fields: config.row_fields || [],
      column_entity: config.column_entity,
      column_fields: config.column_fields || [],
      junction_entity: config.junction_entity,
      junction_fields: config.junction_fields || [],
      junction_link_fields: config.junction_link_fields || [],
      row_fk_field: config.row_fk_field,
      column_fk_field: config.column_fk_field,
      thumbnail_size: config.thumbnail_size || "md",
      cell_display_size: config.cell_display_size || "normal"
    };
    await onSave(configToSave);
    setSaving(false);
  };

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const toggleField = (entity, field) => {
    const key = `${entity.toLowerCase()}_fields`;
    setConfig(prev => {
      const fields = prev[key] || [];
      return {
        ...prev,
        [key]: fields.includes(field) ? fields.filter(f => f !== field) : [...fields, field]
      };
    });
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-2">
        <Label className="text-xs">View Name</Label>
        <Input 
          value={config.name} 
          onChange={(e) => updateConfig("name", e.target.value)} 
          placeholder="e.g. Summer Colors"
        />
      </div>

      <Tabs defaultValue="structure" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="rows">Rows</TabsTrigger>
          <TabsTrigger value="columns">Columns</TabsTrigger>
          <TabsTrigger value="cells">Cells</TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Row Entity</Label>
              <Select value={config.row_entity} onValueChange={(v) => updateConfig("row_entity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATRIX_ELIGIBLE_ENTITIES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Column Entity</Label>
              <Select value={config.column_entity} onValueChange={(v) => updateConfig("column_entity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATRIX_ELIGIBLE_ENTITIES.filter(e => e !== config.row_entity).map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Junction Entity</Label>
            <Select value={config.junction_entity} onValueChange={(v) => updateConfig("junction_entity", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MATRIX_ELIGIBLE_ENTITIES.filter(e => e !== config.row_entity && e !== config.column_entity).map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <Label className="text-xs">Row FK Field</Label>
              <Input value={config.row_fk_field} onChange={(e) => updateConfig("row_fk_field", e.target.value)} placeholder="e.g. product_id" />
            </div>
            <div>
              <Label className="text-xs">Column FK Field</Label>
              <Input value={config.column_fk_field} onChange={(e) => updateConfig("column_fk_field", e.target.value)} placeholder="e.g. linked_tech_color_id" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="rows" className="space-y-3">
          <p className="text-xs text-muted-foreground">Select fields to display for {config.row_entity} items in rows</p>
          <div className="space-y-2">
            {(entitySchemas[config.row_entity] || []).map(field => (
              <div key={field} className="flex items-center gap-2">
                <Checkbox 
                  checked={(config.row_fields || []).includes(field)}
                  onCheckedChange={() => toggleField("row", field)}
                />
                <span className="text-sm">{field}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="columns" className="space-y-3">
          <p className="text-xs text-muted-foreground">Select fields to display for {config.column_entity} items in columns</p>
          <div className="space-y-2">
            {(entitySchemas[config.column_entity] || []).map(field => (
              <div key={field} className="flex items-center gap-2">
                <Checkbox 
                  checked={(config.column_fields || []).includes(field)}
                  onCheckedChange={() => toggleField("column", field)}
                />
                <span className="text-sm">{field}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cells" className="space-y-4">
          <p className="text-xs text-muted-foreground">Select fields to display in cells ({config.junction_entity})</p>
          <div className="space-y-2">
            {(entitySchemas[config.junction_entity] || []).map(field => (
              <div key={field} className="flex items-center gap-2">
                <Checkbox 
                  checked={(config.junction_fields || []).includes(field)}
                  onCheckedChange={() => toggleField("junction", field)}
                />
                <span className="text-sm">{field}</span>
              </div>
            ))}
          </div>

          {config.junction_entity === "ProductColor" && (entitySchemas["ProductColorProjectLink"] || []).length > 0 && (
            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Project-specific fields (ProductColorProjectLink)</p>
              <div className="space-y-2">
                {(entitySchemas["ProductColorProjectLink"] || []).map(field => (
                  <div key={field} className="flex items-center gap-2">
                    <Checkbox
                      checked={(config.junction_link_fields || []).includes(field)}
                      onCheckedChange={() => {
                        setConfig(prev => {
                          const fields = prev.junction_link_fields || [];
                          return {
                            ...prev,
                            junction_link_fields: fields.includes(field)
                              ? fields.filter(f => f !== field)
                              : [...fields, field]
                          };
                        });
                      }}
                    />
                    <span className="text-sm">{field}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t space-y-2">
            <Label className="text-xs">Cell Display Size</Label>
            <Select value={config.cell_display_size || "normal"} onValueChange={(v) => updateConfig("cell_display_size", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-2 pt-4">
        <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save View
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}