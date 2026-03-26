import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Hash, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EMPTY_FORM = {
  entity_name: "",
  entity_type: "",
  prefix: "",
  padding: 5,
  excluded_codes: "",
  description: "",
};



export default function SystemCodeGeneratorLibrary() {
  const [generators, setGenerators] = useState([]);
  const [entityNames, setEntityNames] = useState([]);
  const [entityLovValues, setEntityLovValues] = useState([]); // all Entities LOV values
  const [entityTypesLovId, setEntityTypesLovId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null); // null | "add" | "edit"
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [typeOptions, setTypeOptions] = useState([]); // enum values for the "type" field of selected entity

  useEffect(() => {
    load();
    loadEntityNames();
  }, []);

  const loadEntityNames = async () => {
    const [entitiesLov, entityTypesLov] = await Promise.all([
      base44.entities.TypeOfLOV.filter({ code: "Entities" }),
      base44.entities.TypeOfLOV.filter({ code: "EntityTypes" }),
    ]);
    if (entitiesLov.length > 0) {
      const values = await base44.entities.ListOfValues.filter({ type_of_lov_id: entitiesLov[0].id });
      setEntityNames(values.map((v) => v.name).sort());
      setEntityLovValues(values);
    }
    if (entityTypesLov.length > 0) {
      setEntityTypesLovId(entityTypesLov[0].id);
    }
  };

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.SystemCodeGenerator.list("entity_name", 200);
    setGenerators(data);
    setLoading(false);
  };

  const loadTypeOptions = async (entityName) => {
    if (!entityTypesLovId) { setTypeOptions([]); return; }
    const entityValue = entityLovValues.find((v) => v.name === entityName);
    if (!entityValue) { setTypeOptions([]); return; }
    const types = await base44.entities.ListOfValues.filter({
      type_of_lov_id: entityTypesLovId,
      depends_on_value_id: entityValue.id,
    });
    setTypeOptions(types.map((t) => t.name));
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setTypeOptions([]);
    setDialog("add");
  };

  const openEdit = (gen) => {
    setEditing(gen);
    setForm({
      entity_name: gen.entity_name,
      entity_type: gen.entity_type,
      prefix: gen.prefix,
      padding: gen.padding ?? 5,
      excluded_codes: gen.excluded_codes || "",
      description: gen.description || "",
    });
    loadTypeOptions(gen.entity_name);
    setDialog("edit");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      await base44.entities.SystemCodeGenerator.update(editing.id, form);
    } else {
      await base44.entities.SystemCodeGenerator.create({ ...form, last_sequence: 0 });
    }
    setSaving(false);
    setDialog(null);
    load();
  };

  const handleDelete = async (gen) => {
    setDeleting(gen.id);
    await base44.entities.SystemCodeGenerator.delete(gen.id);
    setDeleting(null);
    load();
  };

  const previewCode = () => {
    if (!form.prefix) return "—";
    const pad = Number(form.padding) || 5;
    return `${form.prefix}${String(1).padStart(pad, "0")}`;
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Code Generators</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure automatic sequential codes per entity and type.
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" /> Add Generator
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : generators.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl bg-muted/30">
          <Hash className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No code generators yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Entity</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Prefix</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Padding</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Last Seq.</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Next Code</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Description</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {generators.map((gen) => {
                const next = `${gen.prefix}${String((gen.last_sequence || 0) + 1).padStart(gen.padding || 5, "0")}`;
                return (
                  <tr key={gen.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{gen.entity_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{gen.entity_type}</td>
                    <td className="px-4 py-3 font-mono text-xs bg-muted/30 rounded">{gen.prefix}</td>
                    <td className="px-4 py-3 text-muted-foreground">{gen.padding ?? 5}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{gen.last_sequence ?? 0}</td>
                    <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{next}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{gen.description || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(gen)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(gen)}
                          disabled={deleting === gen.id}
                        >
                          {deleting === gen.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "edit" ? "Edit Generator" : "New Code Generator"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Entity Name</Label>
              <Select
                value={form.entity_name}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, entity_name: v, entity_type: "" }));
                  loadTypeOptions(v);
                }}
                required
              >
                <SelectTrigger><SelectValue placeholder="Select entity…" /></SelectTrigger>
                <SelectContent>
                  {entityNames.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Entity Type</Label>
              {typeOptions.length > 0 ? (
                <Select
                  value={form.entity_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, entity_type: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.entity_type}
                  onChange={(e) => setForm((f) => ({ ...f, entity_type: e.target.value }))}
                  placeholder={form.entity_name ? "No 'type' field — enter manually" : "Select an entity first"}
                  disabled={!form.entity_name}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Prefix</Label>
                <Input
                  value={form.prefix}
                  onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value.toUpperCase() }))}
                  placeholder="e.g. STY"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Padding (digits)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.padding}
                  onChange={(e) => setForm((f) => ({ ...f, padding: Number(e.target.value) }))}
                  required
                />
              </div>
            </div>

            {form.prefix && (
              <p className="text-xs text-muted-foreground">
                First code will look like: <span className="font-mono font-semibold text-primary">{previewCode()}</span>
              </p>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Excluded Codes (optional)</Label>
              <Input
                value={form.excluded_codes}
                onChange={(e) => setForm((f) => ({ ...f, excluded_codes: e.target.value }))}
                placeholder="e.g. STY00010,STY00013"
              />
              <p className="text-xs text-muted-foreground">Comma-separated codes to skip during generation.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What this generator is used for"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {dialog === "edit" ? "Update" : "Create"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}