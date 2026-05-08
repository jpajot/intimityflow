/**
 * ChangeManagementViewDrawer
 *
 * Wraps the existing ViewDrawerContent but enforces is_system protection:
 * - System views (is_system=true) have no edit/trash buttons
 * - Only queries views matching the given pageKey and display_mode
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Trash2, Loader2, ShieldCheck, Search, GripVertical, Pin, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function ChangeManagementViewDrawer({
  pageKey,
  activeViewId,
  onSelectView,
  allFields = [],
  displayMode = "list",
}) {
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [mode, setMode] = useState("new");
  const [editingView, setEditingView] = useState(null);
  const [formName, setFormName] = useState("");
  const [formFieldIds, setFormFieldIds] = useState([]);
  const [formFixedFieldIds, setFormFixedFieldIds] = useState([]);
  const [formFilters, setFormFilters] = useState({ operator: "and", filters: [] });
  const [dialogTab, setDialogTab] = useState("fields");
  const [fieldSearch, setFieldSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    setLoading(true);
    base44.entities.ListViewConfig.filter({ page_key: pageKey }).then((data) => {
      // Filter by display_mode, treating missing display_mode as "list"
      const filtered = data.filter(v => (v.display_mode || "list") === displayMode);
      setViews(filtered);
      // Auto-select first system view if none selected
      if (activeViewId === "default" && filtered.length > 0) {
        const firstSystem = filtered.find(v => v.is_system);
        if (firstSystem) onSelectView(firstSystem.id);
      }
      setLoading(false);
    });
  }, [pageKey, displayMode]);

  const openNew = () => {
    setFormName("");
    setFormFieldIds([]);
    setFormFixedFieldIds([]);
    setFormFilters({ operator: "and", filters: [] });
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
      is_system: false,
      display_mode: displayMode,
    };
    if (editingView) {
      await base44.entities.ListViewConfig.update(editingView.id, data);
      const updated = { ...editingView, ...data };
      setViews(views.map(v => v.id === editingView.id ? updated : v));
      if (activeViewId === editingView.id) {
        onSelectView("default");
        setTimeout(() => onSelectView(editingView.id), 0);
      }
    } else {
      const created = await base44.entities.ListViewConfig.create(data);
      setViews([...views, created]);
      onSelectView(created.id);
    }
    setSaving(false);
    setShowDialog(false);
  };

  const handleDelete = async (view) => {
    await base44.entities.ListViewConfig.delete(view.id);
    setViews(views.filter(v => v.id !== view.id));
    if (activeViewId === view.id) onSelectView("default");
    setDeleteConfirm(null);
  };

  const toggleField = (fieldId) => {
    setFormFieldIds(prev => {
      if (prev.includes(fieldId)) {
        setFormFixedFieldIds(p => p.filter(x => x !== fieldId));
        return prev.filter(x => x !== fieldId);
      }
      return [...prev, fieldId];
    });
  };

  const toggleFixedField = (fieldId) => {
    setFormFixedFieldIds(prev => {
      const isPinning = !prev.includes(fieldId);
      const next = isPinning ? [...prev, fieldId] : prev.filter(x => x !== fieldId);
      if (isPinning) {
        setFormFieldIds(fields => fields.includes(fieldId) ? [fieldId, ...fields.filter(x => x !== fieldId)] : fields);
      }
      return next;
    });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    setFormFieldIds(prev => {
      const next = [...prev];
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination.index, 0, moved);
      return next;
    });
  };

  const addFilter = () => setFormFilters(f => ({ ...f, filters: [...f.filters, { field: "", values: [] }] }));
  const removeFilter = (idx) => setFormFilters(f => ({ ...f, filters: f.filters.filter((_, i) => i !== idx) }));
  const updateFilter = (idx, patch) => setFormFilters(f => ({ ...f, filters: f.filters.map((fi, i) => i === idx ? { ...fi, ...patch } : fi) }));

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select View</p>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : views.length > 0 ? (
          <div className="space-y-1.5">
            {views.map((v) => (
              <div key={v.id} className="group flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectView(v.id)}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    activeViewId === v.id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {v.name}
                    {v.is_system && <ShieldCheck className="w-3 h-3 opacity-50 shrink-0" />}
                  </span>
                </button>
                {!v.is_system && (
                  <>
                    <button type="button" onClick={() => openEdit(v)}
                      className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-all" title="Edit view">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => setDeleteConfirm(v)}
                      className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all" title="Delete view">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">No views yet.</p>
        )}
      </div>

      <Button onClick={(e) => { e.stopPropagation(); openNew(); }} variant="outline" size="sm" className="w-full gap-2 text-xs">
        <Plus className="w-3.5 h-3.5" /> New View
      </Button>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <Dialog open={true} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="text-sm">Delete "{deleteConfirm.name}"?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(deleteConfirm)}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{mode === "new" ? "Create New View" : "Edit View"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
              <Label className="text-xs">View Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. My Filter" className="h-8 text-xs" autoFocus onClick={e => e.stopPropagation()} />
            </div>
            <div className="text-xs text-muted-foreground">Display mode: <span className="font-medium capitalize">{displayMode}</span></div>

            <Tabs value={dialogTab} onValueChange={setDialogTab} onClick={e => e.stopPropagation()}>
              <TabsList className="w-full">
                <TabsTrigger value="fields" className="flex-1 text-xs">Fields</TabsTrigger>
                <TabsTrigger value="filters" className="flex-1 text-xs">
                  Filters
                  {formFilters.filters.filter(f => f.field && f.values?.length > 0).length > 0 && (
                    <Badge className="ml-1.5 px-1.5 py-0 text-[10px] h-4">{formFilters.filters.filter(f => f.field && f.values?.length > 0).length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fields" className="mt-3 space-y-3" onClick={e => e.stopPropagation()}>
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input value={fieldSearch} onChange={e => setFieldSearch(e.target.value)} placeholder="Search fields…" className="h-7 text-xs pl-8" onClick={e => e.stopPropagation()} />
                </div>
                {(() => {
                  const q = fieldSearch.toLowerCase();
                  const activeFields = formFieldIds.map(id => allFields.find(f => f.id === id)).filter(Boolean);
                  const unchecked = allFields.filter(f => !formFieldIds.includes(f.id));
                  const filteredActive = q ? activeFields.filter(f => f.label.toLowerCase().includes(q)) : activeFields;
                  const filteredUnchecked = q ? unchecked.filter(f => f.label.toLowerCase().includes(q)) : unchecked;
                  return (
                    <div className="border border-border rounded-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                      <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">Active Fields <span className="font-normal opacity-70">· drag to reorder</span></div>
                      {filteredActive.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No fields selected</div>
                      ) : (
                        <DragDropContext onDragEnd={q ? () => {} : handleDragEnd}>
                          <Droppable droppableId="active-fields">
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.droppableProps} className="divide-y divide-border max-h-52 overflow-y-auto">
                                {filteredActive.map((field, index) => {
                                  const isPinned = formFixedFieldIds.includes(field.id);
                                  const trueIndex = formFieldIds.indexOf(field.id);
                                  return (
                                    <Draggable key={field.id} draggableId={field.id} index={q ? index : trueIndex}>
                                      {(provided, snapshot) => (
                                        <div ref={provided.innerRef} {...provided.draggableProps}
                                          className={`flex items-center gap-2 px-2 py-2 transition-colors ${snapshot.isDragging ? "bg-accent shadow-md rounded" : "hover:bg-muted/50"}`}
                                          onMouseDown={e => e.stopPropagation()}>
                                          <div {...provided.dragHandleProps} className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab" onMouseDown={e => e.stopPropagation()}>
                                            <GripVertical className="w-3.5 h-3.5" />
                                          </div>
                                          <Checkbox checked={true} onCheckedChange={() => toggleField(field.id)} id={`cf-${field.id}`} onMouseDown={e => e.stopPropagation()} />
                                          <label htmlFor={`cf-${field.id}`} className={`flex-1 text-xs cursor-pointer select-none ${isPinned ? "font-medium" : ""}`} onClick={e => { e.stopPropagation(); toggleField(field.id); }}>
                                            {field.label}
                                          </label>
                                          <button type="button" onClick={e => { e.stopPropagation(); toggleFixedField(field.id); }}
                                            className={`p-0.5 rounded transition-colors ${isPinned ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                                            title={isPinned ? "Unpin" : "Pin to left"}>
                                            <Pin className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </Draggable>
                                  );
                                })}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
                      )}
                      {filteredUnchecked.length > 0 && (
                        <div className="max-h-24 overflow-y-auto divide-y divide-border border-t border-border">
                          <div className="bg-muted/20 px-3 py-2 text-xs font-semibold text-muted-foreground">Available Fields</div>
                          {filteredUnchecked.map(field => (
                            <div key={field.id} className="flex items-center gap-2.5 px-3 py-2 opacity-60 hover:opacity-100 transition-opacity" onMouseDown={e => e.stopPropagation()}>
                              <Checkbox checked={false} onCheckedChange={() => toggleField(field.id)} id={`cf-${field.id}`} onMouseDown={e => e.stopPropagation()} />
                              <label htmlFor={`cf-${field.id}`} className="flex-1 text-xs cursor-pointer">{field.label}</label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="filters" className="mt-3 space-y-3" onClick={e => e.stopPropagation()}>
                <p className="text-xs text-muted-foreground">Add filters to apply when this view is selected.</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {formFilters.filters.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No filters yet.</p>}
                  {formFilters.filters.map((fi, idx) => (
                    <div key={idx} className="border border-border rounded-lg p-2 space-y-2 text-xs">
                      <div className="flex items-center gap-1">
                        {idx === 0 ? <span className="font-medium text-muted-foreground w-12">WHERE</span> : (
                          <Select value={fi.operator || "and"} onValueChange={v => updateFilter(idx, { operator: v })}>
                            <SelectTrigger className="h-6 text-xs w-16"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="and">AND</SelectItem><SelectItem value="or">OR</SelectItem></SelectContent>
                          </Select>
                        )}
                        <Input value={fi.field || ""} onChange={e => updateFilter(idx, { field: e.target.value })} placeholder="field name" className="h-6 text-xs flex-1" onClick={e => e.stopPropagation()} />
                        <button type="button" onClick={e => { e.stopPropagation(); removeFilter(idx); }} className="ml-auto p-0.5 hover:text-destructive text-muted-foreground">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <Input
                        value={(fi.values || []).join(", ")}
                        onChange={e => updateFilter(idx, { values: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })}
                        placeholder="values (comma-separated)"
                        className="h-6 text-xs"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); addFilter(); }} className="gap-1 text-xs w-full h-7">
                  <Plus className="w-3 h-3" /> Add Filter
                </Button>
              </TabsContent>
            </Tabs>

            <DialogFooter onClick={e => e.stopPropagation()}>
              <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); setShowDialog(false); }} className="text-xs">Cancel</Button>
              <Button size="sm" onClick={e => { e.stopPropagation(); handleSave(); }} disabled={saving || !formName.trim()} className="text-xs gap-2">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}