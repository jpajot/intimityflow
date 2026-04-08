import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const MATRIX_ELIGIBLE_ENTITIES = ["Product", "TechnicalColor", "CommercialColor", "ProductColor"];

export default function MatrixViewBuilder({ projectId, onSave, onCancel, initialConfig }) {
  const [config, setConfig] = useState(initialConfig || {
    name: "",
    row_entity: "Product",
    row_fields: [],
    column_entity: "TechnicalColor",
    column_fields: [],
    junction_entity: "ProductColor",
    junction_fields: [],
    row_fk_field: "product_id",
    column_fk_field: "linked_tech_color_id",
    thumbnail_size: "md",
    row_width: 128,
    column_width: 128,
  });
  
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
        const sample = await base44.entities[entity].list("name", 1);
        if (sample.length > 0) {
          const fields = Object.keys(sample[0]).filter(k => !["id", "created_date", "updated_date", "created_by"].includes(k));
          schemas[entity] = fields;
        }
      } catch (err) {
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
    await onSave({ ...config, project_id: projectId });
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="rows">Rows</TabsTrigger>
          <TabsTrigger value="columns">Columns</TabsTrigger>
          <TabsTrigger value="cells">Cells</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
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

        <TabsContent value="cells" className="space-y-3">
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
        </TabsContent>

        <TabsContent value="display" className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Row Width (px)</Label>
              <Input 
                type="number" 
                value={config.row_width || 128} 
                onChange={(e) => updateConfig("row_width", parseInt(e.target.value) || 128)}
                min="80"
                max="400"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Column Width (px)</Label>
              <Input 
                type="number" 
                value={config.column_width || 128} 
                onChange={(e) => updateConfig("column_width", parseInt(e.target.value) || 128)}
                min="80"
                max="400"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Thumbnail Size</Label>
              <Select value={config.thumbnail_size || "md"} onValueChange={(v) => updateConfig("thumbnail_size", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="md">Medium</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
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