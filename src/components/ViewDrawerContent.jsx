import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Trash2, Loader2, X, Badge, ShieldCheck, GripVertical, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function ViewDrawerContent({ pageKey, activeViewId, onSelectView, allFields = [], currentViewType = null }) {
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [mode, setMode] = useState("list");
  const [editingView, setEditingView] = useState(null);
  const [formName, setFormName] = useState("");
  const [formFieldIds, setFormFieldIds] = useState([]);
  const [formFixedFieldIds, setFormFixedFieldIds] = useState([]);
  const [formFilters, setFormFilters] = useState({ operator: "and", filters: [] });
  const [formRoles, setFormRoles] = useState([]);
  const [dialogTab, setDialogTab] = useState("fields");
  const [roleInput, setRoleInput] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.ListViewConfig.filter({ page_key: pageKey }).then((data) => {
      setViews(data);
      setLoading(false);
    });
  }, [pageKey]);

  const openNew = () => {
    setFormName("");
    setFormFieldIds([]);
    setFormFixedFieldIds([]);
    setFormFilters({ operator: "and", filters: [] });
    setFormRoles([]);
    setRoleInput("");
    setFieldSearch("");
    setEditingView(null);
    setMode("new");
    setDialogTab("fields");
    setShowDialog(true);
  };

  const openEdit = (view) => {
    setFormName(view.name);
    setFormFieldIds(view.column_ids || []);
    setFormFixedFieldIds(view.fixed_column_ids || []);
    setFormFilters(view.filters_config || { operator: "and", filters: [] });
    setFormRoles(view.allowed_roles || []);
    setRoleInput("");
    setFieldSearch("");
    setEditingView(view);
    setMode("edit");
    setDialogTab("fields");
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    
    const data = {
      page_key: pageKey,
      name: formName.trim(),
      column_ids: formFieldIds,
      fixed_column_ids: formFixedFieldIds,
      filters_config: formFilters,
      allowed_roles: formRoles,
    };

    if (editingView) {
      await base44.entities.ListViewConfig.update(editingView.id, data);
      setViews(views.map((v) => v.id === editingView.id ? { ...v, ...data } : v));
      if (activeViewId === editingView.id) onSelectView(editingView.id);
    } else {
      const created = await base44.entities.ListViewConfig.create(data);
      setViews([...views, created]);
      onSelectView(created.id);
    }
    
    setSaving(false);
    setShowDialog(false);
  };

  const addFilter = () => {
    setFormFilters((f) => ({ ...f, filters: [...f.filters, { operator: "and", field: "", values: [] }] }));
  };

  const removeFilter = (idx) => {
    setFormFilters((f) => ({ ...f, filters: f.filters.filter((_, i) => i !== idx) }));
  };

  const updateFilter = (idx, patch) => {
    setFormFilters((f) => ({ ...f, filters: f.filters.map((fi, i) => i === idx ? { ...fi, ...patch } : fi) }));
  };

  const toggleFilterValue = (idx, val) => {
    setFormFilters((f) => ({
      ...f,
      filters: f.filters.map((fi, i) => i === idx ? { ...fi, values: fi.values.includes(val) ? fi.values.filter((v) => v !== val) : [...fi.values, val] } : fi),
    }));
  };

  const toggleField = (fieldId) => {
    setFormFieldIds((prev) => prev.includes(fieldId) ? prev.filter((x) => x !== fieldId) : [...prev, fieldId]);
  };

  const toggleFixedField = (fieldId) => {
    setFormFixedFieldIds((prev) => prev.includes(fieldId) ? prev.filter((x) => x !== fieldId) : [...prev, fieldId]);
  };

  const handleDelete = async (view) => {
    await base44.entities.ListViewConfig.delete(view.id);
    setViews(views.filter((v) => v.id !== view.id));
    if (activeViewId === view.id) onSelectView("default");
  };

  return (
    <div className="space-y-3">
      {/* View Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select View</p>
          {currentViewType && (
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
              {currentViewType === 'grid' ? 'Gallery' : 'Table'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSelectView("default")}
          className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
            activeViewId === "default"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-foreground hover:bg-muted"
          }`}
        >
          Default View
        </button>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : views.length > 0 ? (
          <div className="space-y-1.5">
            {views.map((v) => (
              <div key={v.id} className="group flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectView(v.id)}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    activeViewId === v.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-foreground hover:bg-muted"
                  }`}
                >
                  {v.name}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(v)}
                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                  title="Edit view"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(v)}
                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  title="Delete view"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* New View Button */}
      <Button
        onClick={(e) => { e.stopPropagation(); openNew(); }}
        variant="outline"
        size="sm"
        className="w-full gap-2 text-xs"
      >
        <Plus className="w-3.5 h-3.5" /> New View
      </Button>

      {/* Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>
              {mode === "list" ? "View Management" : mode === "new" ? "Create New View" : "Edit View"}
            </DialogTitle>
          </DialogHeader>

          {mode === "list" && (
            <div className="text-sm text-muted-foreground">
              {views.length === 0 ? "No views yet. Create one to get started." : "Select a view to edit or create a new one."}
            </div>
          )}

          {(mode === "new" || mode === "edit") && (
            <div className="space-y-4">
              <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                <Label className="text-xs">View Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sales View"
                  className="h-8 text-xs"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <Tabs value={dialogTab} onValueChange={setDialogTab} onClick={(e) => e.stopPropagation()}>
                <TabsList className="w-full" onClick={(e) => e.stopPropagation()}>
                  <TabsTrigger value="fields" className="flex-1 text-xs" onClick={(e) => e.stopPropagation()}>Fields</TabsTrigger>
                  <TabsTrigger value="filters" className="flex-1 text-xs" onClick={(e) => e.stopPropagation()}>
                    Filters
                    {formFilters.filters.filter(f => f.field && f.values.length > 0).length > 0 && (
                      <Badge className="ml-1.5 px-1.5 py-0 text-[10px] h-4">{formFilters.filters.filter(f => f.field && f.values.length > 0).length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="roles" className="flex-1 text-xs" onClick={(e) => e.stopPropagation()}>
                    Roles {formRoles.length > 0 && <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px] h-4">{formRoles.length}</Badge>}
                  </TabsTrigger>
                </TabsList>

                {/* FIELDS TAB */}
                <TabsContent value="fields" className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input value={fieldSearch} onChange={(e) => setFieldSearch(e.target.value)} placeholder="Search fields…" className="h-7 text-xs pl-8" onClick={(e) => e.stopPropagation()} />
                  </div>
                  {(() => {
                    const q = fieldSearch.toLowerCase();
                    const checked = formFieldIds.map((id) => allFields.find((f) => f.id === id)).filter(Boolean);
                    const unchecked = allFields.filter((f) => !formFieldIds.includes(f.id));
                    const filteredChecked = q ? checked.filter((f) => f.label.toLowerCase().includes(q)) : checked;
                    const filteredUnchecked = q ? unchecked.filter((f) => f.label.toLowerCase().includes(q)) : unchecked;
                    return (
                      <div className="border border-border rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="max-h-44 overflow-y-auto divide-y divide-border">
                          <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">Active Fields</div>
                          {filteredChecked.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">No fields selected</div>
                          ) : (
                            filteredChecked.map((field) => (
                              <div key={field.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors" onMouseDown={(e) => e.stopPropagation()}>
                                <Checkbox checked={true} onCheckedChange={() => toggleField(field.id)} id={`f-${field.id}`} onMouseDown={(e) => e.stopPropagation()} />
                                <label htmlFor={`f-${field.id}`} className="flex-1 text-xs cursor-pointer" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggleField(field.id); }}>{field.label}</label>
                                {formFixedFieldIds.includes(field.id) && (
                                  <Badge className="text-[10px] h-4 px-1">#</Badge>
                                )}
                                <button type="button" onClick={(e) => { e.stopPropagation(); toggleFixedField(field.id); }} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors" title={formFixedFieldIds.includes(field.id) ? "Unpin column" : "Pin column"}>
                                  {formFixedFieldIds.includes(field.id) ? "📌" : "○"}
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                        {filteredUnchecked.length > 0 && (
                          <div className="max-h-24 overflow-y-auto divide-y divide-border">
                            <div className="bg-muted/20 px-3 py-2 text-xs font-semibold text-muted-foreground">Available Fields</div>
                            {filteredUnchecked.map((field) => (
                              <div key={field.id} className="flex items-center gap-2.5 px-3 py-2 opacity-60 hover:opacity-100 transition-opacity" onMouseDown={(e) => e.stopPropagation()}>
                                <Checkbox checked={false} onCheckedChange={() => toggleField(field.id)} id={`f-${field.id}`} onMouseDown={(e) => e.stopPropagation()} />
                                <label htmlFor={`f-${field.id}`} className="flex-1 text-xs cursor-pointer">{field.label}</label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </TabsContent>

                {/* FILTERS TAB */}
                <TabsContent value="filters" className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs text-muted-foreground">Add filters to automatically apply when this view is selected.</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    {formFilters.filters.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No filters yet.</p>
                    )}
                    {formFilters.filters.map((fi, idx) => (
                      <div key={idx} className="border border-border rounded-lg p-2 space-y-2 text-xs">
                        <div className="flex items-center gap-1">
                          {idx === 0 ? (
                            <span className="font-medium text-muted-foreground w-12">WHERE</span>
                          ) : (
                            <Select value={fi.operator || "and"} onValueChange={(v) => updateFilter(idx, { operator: v })}>
                              <SelectTrigger className="h-6 text-xs w-16"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="and">AND</SelectItem>
                                <SelectItem value="or">OR</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <span className="text-muted-foreground">{fi.field || "—"}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeFilter(idx); }} className="ml-auto p-0.5 hover:text-destructive text-muted-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        {fi.values.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {fi.values.map((v) => (
                              <span key={v} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">{v}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); addFilter(); }} className="gap-1 text-xs w-full h-7">
                    <Plus className="w-3 h-3" /> Add Filter
                  </Button>
                </TabsContent>

                {/* ROLES TAB */}
                <TabsContent value="roles" className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs text-muted-foreground">Restrict this view to specific user roles. Leave empty for all.</p>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Input value={roleInput} onChange={(e) => setRoleInput(e.target.value)} onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const r = roleInput.trim(); if (r && !formRoles.includes(r)) setFormRoles((p) => [...p, r]); setRoleInput(""); } }}
                      placeholder="e.g. admin, manager…" className="h-7 text-xs flex-1" />
                    <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); const r = roleInput.trim(); if (r && !formRoles.includes(r)) setFormRoles((p) => [...p, r]); setRoleInput(""); }} className="h-7 text-xs gap-1 px-2">
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  {formRoles.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg p-2">
                      <ShieldCheck className="w-3.5 h-3.5" /> Visible to all roles
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {formRoles.map((r) => (
                        <div key={r} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full border border-primary/20">
                          {r}
                          <button type="button" onClick={(e) => { e.stopPropagation(); setFormRoles((p) => p.filter((x) => x !== r)); }} className="hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter onClick={(e) => e.stopPropagation()}>
                <Button variant="outline" onClick={(e) => { e.stopPropagation(); setShowDialog(false); }} className="text-xs" size="sm">
                  Cancel
                </Button>
                <Button onClick={(e) => { e.stopPropagation(); handleSave(); }} disabled={saving || !formName.trim()} className="text-xs gap-2" size="sm">
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}