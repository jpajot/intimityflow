import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Loader2, X, ShieldCheck, Pin, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const DEFAULT_FILTERS = { operator: "and", filters: [] };

export default function ViewsPanel({ pageKey, allColumns, onColumnsChange, filterableFields = [], rows = [], onClose }) {
  const [views, setViews] = useState([]);
  const [mode, setMode] = useState("list");
  const [editingView, setEditingView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogTab, setDialogTab] = useState("columns");
  const [columnSearch, setColumnSearch] = useState("");
  
  const [formName, setFormName] = useState("");
  const [formColumnIds, setFormColumnIds] = useState([]);
  const [formFilters, setFormFilters] = useState(DEFAULT_FILTERS);
  const [formRoles, setFormRoles] = useState([]);
  const [formFixedColumnIds, setFormFixedColumnIds] = useState([]);
  const [roleInput, setRoleInput] = useState("");

  useEffect(() => {
    base44.entities.ListViewConfig.filter({ page_key: pageKey }).then((data) => {
      setViews(data);
      setLoading(false);
    });
  }, [pageKey]);

  const openNew = () => {
    setFormName("");
    setFormColumnIds(allColumns.map((c) => c.id));
    setFormFilters(DEFAULT_FILTERS);
    setFormRoles([]);
    setFormFixedColumnIds([]);
    setRoleInput("");
    setEditingView(null);
    setDialogTab("columns");
    setMode("new");
  };

  const openEdit = (view) => {
    setFormName(view.name);
    const inView = (view.column_ids || []).filter((id) => allColumns.find((c) => c.id === id));
    setFormColumnIds([...inView]);
    setFormFilters(view.filters_config || DEFAULT_FILTERS);
    setFormRoles(view.allowed_roles || []);
    setFormFixedColumnIds(view.fixed_column_ids || []);
    setRoleInput("");
    setEditingView(view);
    setDialogTab("columns");
    setMode("edit");
  };

  const toggleCol = (id) => {
    setFormColumnIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const data = {
      page_key: pageKey,
      name: formName.trim(),
      column_ids: formColumnIds.filter((id) => allColumns.find((c) => c.id === id)),
      fixed_column_ids: formFixedColumnIds,
      filters_config: formFilters,
      allowed_roles: formRoles,
    };
    if (editingView) {
      await base44.entities.ListViewConfig.update(editingView.id, data);
      const updated = views.map((v) => v.id === editingView.id ? { ...v, ...data } : v);
      setViews(updated);
    } else {
      const created = await base44.entities.ListViewConfig.create(data);
      setViews([...views, created]);
    }
    setSaving(false);
    setMode("list");
  };

  const handleDelete = async (view) => {
    await base44.entities.ListViewConfig.delete(view.id);
    const updated = views.filter((v) => v.id !== view.id);
    setViews(updated);
  };

  const addFilter = () => setFormFilters((f) => ({ ...f, filters: [...f.filters, { operator: "and", field: "", values: [] }] }));
  const removeFilter = (idx) => setFormFilters((f) => ({ ...f, filters: f.filters.filter((_, i) => i !== idx) }));
  const updateFilter = (idx, patch) => setFormFilters((f) => ({
    ...f,
    filters: f.filters.map((fi, i) => i === idx ? { ...fi, ...patch } : fi),
  }));

  const getFieldOptions = (fieldId) => {
    const field = filterableFields.find((f) => f.id === fieldId);
    if (!field) return [];
    return [...new Set(rows.map((r) => field.getValue(r)).filter(Boolean))].sort();
  };

  const toggleFilterValue = (idx, val) => {
    setFormFilters((f) => {
      const fi = f.filters[idx];
      const values = fi.values.includes(val) ? fi.values.filter((v) => v !== val) : [...fi.values, val];
      return { ...f, filters: f.filters.map((x, i) => i === idx ? { ...x, values } : x) };
    });
  };

  const addRole = () => {
    const r = roleInput.trim();
    if (r && !formRoles.includes(r)) setFormRoles((prev) => [...prev, r]);
    setRoleInput("");
  };

  const removeRole = (r) => setFormRoles((prev) => prev.filter((x) => x !== r));

  return (
    <div className="w-96 max-w-96 flex flex-col h-full bg-background border-l border-border">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-sm">Views</h2>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {mode === "list" && (
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {views.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No custom views yet</p>
                ) : (
                  views.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border">
                      <span className="flex-1 text-sm font-medium truncate">{v.name}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(v)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))
                )}
              </>
            )}
            <Button onClick={openNew} className="gap-2 w-full" variant="outline">
              <Plus className="w-4 h-4" /> New View
            </Button>
          </div>
        )}

        {(mode === "new" || mode === "edit") && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">View Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Sales View" autoFocus />
            </div>

            <Tabs value={dialogTab} onValueChange={setDialogTab}>
              <TabsList className="w-full">
                <TabsTrigger value="columns" className="flex-1 text-xs">Columns</TabsTrigger>
                <TabsTrigger value="filters" className="flex-1 text-xs">Filters</TabsTrigger>
                <TabsTrigger value="roles" className="flex-1 text-xs">Roles</TabsTrigger>
              </TabsList>

              <TabsContent value="columns" className="mt-3">
                <Input value={columnSearch} onChange={(e) => setColumnSearch(e.target.value)} placeholder="Search columns…" className="h-7 text-xs mb-2" />
                {(() => {
                  const q = columnSearch.toLowerCase();
                  const checked = formColumnIds.map((id) => allColumns.find((c) => c.id === id)).filter(Boolean);
                  const unchecked = allColumns.filter((c) => !formColumnIds.includes(c.id));
                  const filteredChecked = q ? checked.filter((c) => c.label.toLowerCase().includes(q)) : checked;
                  const filteredUnchecked = q ? unchecked.filter((c) => c.label.toLowerCase().includes(q)) : unchecked;
                  const handleDragEnd = (result) => {
                    if (!result.destination) return;
                    const newIds = [...formColumnIds];
                    const [removed] = newIds.splice(result.source.index, 1);
                    newIds.splice(result.destination.index, 0, removed);
                    setFormColumnIds(newIds);
                  };
                  return (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="columns-checked">
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="max-h-44 overflow-y-auto divide-y divide-border">
                              {filteredChecked.map((col, index) => (
                                <Draggable key={col.id} draggableId={col.id} index={index}>
                                  {(drag, snapshot) => (
                                    <div ref={drag.innerRef} {...drag.draggableProps} className={`flex items-center gap-2.5 px-3 py-2 bg-card ${snapshot.isDragging ? "shadow-lg border border-border" : ""}`}>
                                      <div {...drag.dragHandleProps} className="text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
                                        <GripVertical className="w-3.5 h-3.5" />
                                      </div>
                                      <Checkbox checked={true} onCheckedChange={() => toggleCol(col.id)} id={`col-${col.id}`} />
                                      <label htmlFor={`col-${col.id}`} className="flex-1 text-sm cursor-pointer">{col.label}</label>
                                      <button type="button" title="Pin column" onClick={() => setFormFixedColumnIds((prev) => prev.includes(col.id) ? prev.filter((id) => id !== col.id) : [...prev, col.id])} className={`p-0.5 rounded hover:bg-muted transition-colors ${formFixedColumnIds.includes(col.id) ? "text-primary" : "text-muted-foreground"}`}>
                                        <Pin className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                      {filteredUnchecked.length > 0 && (
                        <div className="border-t border-border max-h-24 overflow-y-auto divide-y divide-border">
                          {filteredUnchecked.map((col) => (
                            <div key={col.id} className="flex items-center gap-2.5 px-3 py-2 opacity-50">
                              <div className="w-3.5 h-3.5 shrink-0" />
                              <Checkbox checked={false} onCheckedChange={() => toggleCol(col.id)} id={`col-${col.id}`} />
                              <label htmlFor={`col-${col.id}`} className="flex-1 text-sm cursor-pointer">{col.label}</label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="filters" className="mt-3 space-y-3">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {formFilters.filters.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No filters yet.</p>}
                  {formFilters.filters.map((fi, idx) => {
                    const opts = getFieldOptions(fi.field);
                    return (
                      <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          {idx === 0 ? (
                            <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">WHERE</span>
                          ) : (
                            <Select value={fi.operator || "and"} onValueChange={(v) => updateFilter(idx, { operator: v })}>
                              <SelectTrigger className="h-7 text-xs w-16 shrink-0"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="and">AND</SelectItem>
                                <SelectItem value="or">OR</SelectItem>
                                <SelectItem value="not">NOT</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Select value={fi.field || "none"} onValueChange={(v) => updateFilter(idx, { field: v === "none" ? "" : v, values: [] })}>
                            <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Select field…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Select field…</SelectItem>
                              {filterableFields.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <button type="button" onClick={() => removeFilter(idx)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {fi.field && (
                          <div className="pl-20 flex flex-wrap gap-1.5">
                            {opts.map((val) => (
                              <button key={val} type="button" onClick={() => toggleFilterValue(idx, val)} className={`px-2 py-0.5 rounded-full border text-xs transition-colors ${fi.values.includes(val) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                                {val}
                              </button>
                            ))}
                            {opts.length === 0 && <span className="text-xs text-muted-foreground">No values in data</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button variant="outline" size="sm" onClick={addFilter} className="gap-1.5 text-xs w-full">
                  <Plus className="w-3.5 h-3.5" /> Add Filter
                </Button>
              </TabsContent>

              <TabsContent value="roles" className="mt-3 space-y-3">
                <p className="text-xs text-muted-foreground">Restrict this view to specific user roles. Leave empty for all.</p>
                <div className="flex gap-2">
                  <Input value={roleInput} onChange={(e) => setRoleInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRole(); } }} placeholder="e.g. admin, manager…" className="h-8 text-xs flex-1" />
                  <Button type="button" variant="outline" size="sm" onClick={addRole} className="h-8 text-xs gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                </div>
                {formRoles.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg p-3">
                    <ShieldCheck className="w-4 h-4" /> Visible to all roles
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {formRoles.map((r) => (
                      <div key={r} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full border border-primary/20">
                        <ShieldCheck className="w-3 h-3" /> {r}
                        <button type="button" onClick={() => removeRole(r)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {(mode === "new" || mode === "edit") && (
        <div className="border-t border-border p-4 flex gap-2 justify-end bg-muted/30">
          <Button variant="outline" onClick={() => setMode("list")} size="sm">Back</Button>
          <Button onClick={handleSave} disabled={saving || !formName.trim()} size="sm" className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "new" ? "Create" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}