import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";

export default function ListOfValuesLibrary() {
  const [typesOfLOV, setTypesOfLOV] = useState([]);
  const [listOfValues, setListOfValues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null);

  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [showValueDialog, setShowValueDialog] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [editingValue, setEditingValue] = useState(null);

  const [typeForm, setTypeForm] = useState({ code: "", name: "", depends_on_id: "" });
  const [valueForm, setValueForm] = useState({ type_of_lov_id: "", name: "", depends_on_value_id: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [types, values] = await Promise.all([
      base44.entities.TypeOfLOV.list("code", 500),
      base44.entities.ListOfValues.list("name", 2000),
    ]);
    setTypesOfLOV(types);
    setListOfValues(values);
    if (types.length > 0 && !selectedType) setSelectedType(types[0].id);
    setLoading(false);
  };

  const filteredValues = selectedType
    ? listOfValues.filter((v) => v.type_of_lov_id === selectedType)
    : [];

  const selectedTypeObj = typesOfLOV.find((t) => t.id === selectedType);
  const parentTypeId = selectedTypeObj?.depends_on_id;
  const parentType = parentTypeId ? typesOfLOV.find((t) => t.id === parentTypeId) : null;
  const parentTypeValues = parentTypeId
    ? listOfValues.filter((v) => v.type_of_lov_id === parentType?.id)
    : [];

  const openNewType = () => {
    setEditingType(null);
    setTypeForm({ code: "", name: "", depends_on_id: "" });
    setShowTypeDialog(true);
  };

  const openEditType = (t) => {
    setEditingType(t);
    setTypeForm({ code: t.code, name: t.name || t.code, depends_on_id: t.depends_on_id || "" });
    setShowTypeDialog(true);
  };

  const saveType = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...typeForm, name: typeForm.name || typeForm.code };
    if (editingType) {
      await base44.entities.TypeOfLOV.update(editingType.id, data);
      setTypesOfLOV((prev) => prev.map((t) => (t.id === editingType.id ? { ...t, ...data } : t)));
    } else {
      const created = await base44.entities.TypeOfLOV.create(data);
      setTypesOfLOV((prev) => [...prev, created]);
      setSelectedType(created.id);
    }
    setShowTypeDialog(false);
    setSaving(false);
  };

  const deleteType = async (t) => {
    const count = listOfValues.filter((v) => v.type_of_lov_id === t.id).length;
    if (count > 0) {
      alert(`Cannot delete "${t.name}". It has ${count} value(s).`);
      return;
    }
    await base44.entities.TypeOfLOV.delete(t.id);
    setTypesOfLOV((prev) => prev.filter((x) => x.id !== t.id));
    if (selectedType === t.id) setSelectedType(typesOfLOV[0]?.id || null);
  };

  const openNewValue = () => {
    setEditingValue(null);
    setValueForm({ type_of_lov_id: selectedType, name: "", depends_on_value_id: "" });
    setShowValueDialog(true);
  };

  const openEditValue = (v) => {
    setEditingValue(v);
    setValueForm({ type_of_lov_id: v.type_of_lov_id, name: v.name, depends_on_value_id: v.depends_on_value_id || "" });
    setShowValueDialog(true);
  };

  const saveValue = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editingValue) {
      await base44.entities.ListOfValues.update(editingValue.id, valueForm);
      setListOfValues((prev) => prev.map((v) => (v.id === editingValue.id ? { ...v, ...valueForm } : v)));
    } else {
      const created = await base44.entities.ListOfValues.create(valueForm);
      setListOfValues((prev) => [...prev, created]);
    }
    setShowValueDialog(false);
    setSaving(false);
  };

  const deleteValue = async (v) => {
    await base44.entities.ListOfValues.delete(v.id);
    setListOfValues((prev) => prev.filter((x) => x.id !== v.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">List of Values</h1>
        <p className="text-muted-foreground mt-1">Manage value types and their dependencies</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Types Panel */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Types ({typesOfLOV.length})</h3>
            <Button onClick={openNewType} size="sm" className="gap-1.5 h-8">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {typesOfLOV.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedType === t.id
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="font-medium text-sm">{t.name || t.code}</div>
                {t.depends_on_id && (
                  <div className="text-xs text-muted-foreground mt-1">
                    depends on:{" "}
                    {typesOfLOV.find((x) => x.id === t.depends_on_id)?.name ||
                      typesOfLOV.find((x) => x.id === t.depends_on_id)?.code}
                  </div>
                )}
                <div className="flex gap-1 mt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditType(t);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteType(t);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Values Panel */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              Values {selectedTypeObj ? `— ${selectedTypeObj.name || selectedTypeObj.code}` : ""}
            </h3>
            {selectedType && (
              <Button onClick={openNewValue} size="sm" className="gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            )}
          </div>
          {!selectedType ? (
            <p className="text-sm text-muted-foreground">Select a type to manage its values</p>
          ) : filteredValues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No values yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredValues.map((v) => {
                const parentValue = parentTypeValues.find((pv) => pv.id === v.depends_on_value_id);
                return (
                  <div key={v.id} className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div className="font-medium text-sm">{v.name}</div>
                    {parentValue && (
                      <div className="text-xs text-muted-foreground mt-1">
                        ↳ {parentType?.name || parentType?.code}: {parentValue.name}
                      </div>
                    )}
                    <div className="flex gap-1 mt-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => openEditValue(v)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => deleteValue(v)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Type Dialog */}
      <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingType ? "Edit Type" : "New Type"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveType} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Code</Label>
              <Input
                value={typeForm.code}
                onChange={(e) => setTypeForm((f) => ({ ...f, code: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input
                value={typeForm.name}
                onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Defaults to code"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Depends On</Label>
              <Select value={typeForm.depends_on_id || "none"} onValueChange={(v) => setTypeForm((f) => ({ ...f, depends_on_id: v === "none" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {typesOfLOV.filter((t) => t.id !== editingType?.id).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name || t.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowTypeDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Value Dialog */}
      <Dialog open={showValueDialog} onOpenChange={setShowValueDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingValue ? "Edit Value" : "New Value"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveValue} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input
                value={valueForm.name}
                onChange={(e) => setValueForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            {parentTypeId && (
              <div className="space-y-2">
                <Label className="text-xs">Depends On</Label>
                <Select
                  value={valueForm.depends_on_value_id || "none"}
                  onValueChange={(v) => setValueForm((f) => ({ ...f, depends_on_value_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {parentTypeValues.map((pv) => (
                      <SelectItem key={pv.id} value={pv.id}>
                        {pv.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowValueDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}