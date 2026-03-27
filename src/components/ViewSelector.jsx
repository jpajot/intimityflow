import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2, LayoutList, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = (pageKey) => `list_active_view_${pageKey}`;
const DEFAULT_FILTERS = { operator: "and", filters: [] };

function emptyFilter() {
  return { field: "", values: [] };
}

function applyFilters(rows, filtersConfig) {
  if (!filtersConfig || !filtersConfig.filters || filtersConfig.filters.length === 0) return rows;
  const { operator, filters } = filtersConfig;
  const activeFilters = filters.filter((f) => f.field && f.values.length > 0);
  if (activeFilters.length === 0) return rows;
  return rows.filter((row) => {
    const results = activeFilters.map((f) => f.values.includes(f.getValue ? f.getValue(row) : row[f.field]));
    if (operator === "or") return results.some(Boolean);
    if (operator === "nor") return results.every((r) => !r);
    return results.every(Boolean); // and
  });
}

export default function ViewSelector({ pageKey, allColumns, onColumnsChange, filterableFields = [], rows = [], onFilteredRowsChange }) {
  const [views, setViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(() => localStorage.getItem(STORAGE_KEY(pageKey)) || "default");
  const [activeFiltersConfig, setActiveFiltersConfig] = useState(DEFAULT_FILTERS);
  const [showManage, setShowManage] = useState(false);
  const [mode, setMode] = useState("list");
  const [editingView, setEditingView] = useState(null);
  const [formName, setFormName] = useState("");
  const [formColumnIds, setFormColumnIds] = useState([]);
  const [formFilters, setFormFilters] = useState(DEFAULT_FILTERS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogTab, setDialogTab] = useState("columns");

  useEffect(() => {
    base44.entities.ListViewConfig.filter({ page_key: pageKey }).then((data) => {
      setViews(data);
      setLoading(false);
    });
  }, [pageKey]);

  const applyView = useCallback((viewId, viewList) => {
    const list = viewList || views;
    if (viewId === "default") {
      onColumnsChange(allColumns);
      const stored = tryParseJSON(localStorage.getItem(`${STORAGE_KEY(pageKey)}_filters`)) || DEFAULT_FILTERS;
      setActiveFiltersConfig(stored);
    } else {
      const view = list.find((v) => v.id === viewId);
      if (view) {
        const ordered = (view.column_ids || []).map((id) => allColumns.find((c) => c.id === id)).filter(Boolean);
        onColumnsChange(ordered.length > 0 ? ordered : allColumns);
        setActiveFiltersConfig(view.filters_config || DEFAULT_FILTERS);
      }
    }
  }, [views, allColumns, onColumnsChange, pageKey]);

  useEffect(() => {
    if (!loading) applyView(activeViewId);
  }, [loading, activeViewId, views]);

  // Apply filters to rows whenever rows or activeFiltersConfig changes
  useEffect(() => {
    if (!onFilteredRowsChange) return;
    const enrichedConfig = {
      ...activeFiltersConfig,
      filters: (activeFiltersConfig.filters || []).map((f) => {
        const field = filterableFields.find((ff) => ff.id === f.field);
        return { ...f, getValue: field?.getValue };
      }),
    };
    onFilteredRowsChange(applyFilters(rows, enrichedConfig));
  }, [rows, activeFiltersConfig, filterableFields]);

  const switchView = (viewId) => {
    setActiveViewId(viewId);
    localStorage.setItem(STORAGE_KEY(pageKey), viewId);
    applyView(viewId);
  };

  const openNew = () => {
    setFormName("");
    setFormColumnIds(allColumns.map((c) => c.id));
    setFormFilters(DEFAULT_FILTERS);
    setEditingView(null);
    setDialogTab("columns");
    setMode("new");
  };

  const openEdit = (view) => {
    setFormName(view.name);
    const inView = (view.column_ids || []).filter((id) => allColumns.find((c) => c.id === id));
    const notInView = allColumns.map((c) => c.id).filter((id) => !inView.includes(id));
    setFormColumnIds([...inView, ...notInView]);
    setFormFilters(view.filters_config || DEFAULT_FILTERS);
    setEditingView(view);
    setDialogTab("columns");
    setMode("edit");
  };

  const toggleCol = (id) => {
    setFormColumnIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const moveCol = (id, dir) => {
    setFormColumnIds((prev) => {
      const idx = prev.indexOf(id);
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const addFilter = () => setFormFilters((f) => ({ ...f, filters: [...f.filters, emptyFilter()] }));

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

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const data = {
      page_key: pageKey,
      name: formName.trim(),
      column_ids: formColumnIds,
      filters_config: formFilters,
    };
    if (editingView) {
      await base44.entities.ListViewConfig.update(editingView.id, data);
      const updated = views.map((v) => v.id === editingView.id ? { ...v, ...data } : v);
      setViews(updated);
      if (activeViewId === editingView.id) {
        onColumnsChange(formColumnIds.map((id) => allColumns.find((c) => c.id === id)).filter(Boolean));
        setActiveFiltersConfig(formFilters);
      }
    } else {
      const created = await base44.entities.ListViewConfig.create(data);
      const updated = [...views, created];
      setViews(updated);
      switchView(created.id);
    }
    setSaving(false);
    setMode("list");
  };

  const handleDelete = async (view) => {
    await base44.entities.ListViewConfig.delete(view.id);
    const updated = views.filter((v) => v.id !== view.id);
    setViews(updated);
    if (activeViewId === view.id) switchView("default");
  };

  const activeLabel = activeViewId === "default" ? "Default" : views.find((v) => v.id === activeViewId)?.name || "Default";
  const activeFilterCount = (activeFiltersConfig.filters || []).filter((f) => f.field && f.values.length > 0).length;

  return (
    <div className="flex items-center gap-2">
      <LayoutList className="w-4 h-4 text-muted-foreground shrink-0" />
      <Select value={activeViewId} onValueChange={switchView}>
        <SelectTrigger className="h-8 text-xs w-36 border-dashed">
          <SelectValue>{activeLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Default</SelectItem>
          {views.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => { setMode("list"); setShowManage(true); }}>
        <Pencil className="w-3 h-3" /> Manage Views
        {activeFilterCount > 0 && <Badge className="ml-1 px-1.5 py-0 text-[10px] h-4">{activeFilterCount}</Badge>}
      </Button>

      <Dialog open={showManage} onOpenChange={(o) => { if (!o) { setShowManage(false); setMode("list"); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "list" ? "Views" : mode === "new" ? "New View" : `Edit: ${editingView?.name}`}
            </DialogTitle>
          </DialogHeader>

          {mode === "list" && (
            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                    <span className="flex-1 text-sm font-medium">Default</span>
                    <span className="text-xs text-muted-foreground">All columns</span>
                  </div>
                  {views.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border">
                      <span className="flex-1 text-sm font-medium">{v.name}</span>
                      <span className="text-xs text-muted-foreground">{v.column_ids?.length} cols</span>
                      {v.filters_config?.filters?.filter(f => f.field && f.values?.length).length > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5">{v.filters_config.filters.filter(f => f.field && f.values?.length).length} filter{v.filters_config.filters.filter(f => f.field && f.values?.length).length > 1 ? "s" : ""}</Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(v)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                  {views.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No custom views yet</p>}
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
                  <TabsTrigger value="filters" className="flex-1 text-xs">
                    Filters
                    {formFilters.filters.filter(f => f.field && f.values.length > 0).length > 0 && (
                      <Badge className="ml-1.5 px-1.5 py-0 text-[10px] h-4">{formFilters.filters.filter(f => f.field && f.values.length > 0).length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* COLUMNS TAB */}
                <TabsContent value="columns" className="mt-3">
                  <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
                    {formColumnIds.map((id, idx) => {
                      const col = allColumns.find((c) => c.id === id);
                      if (!col) return null;
                      return (
                        <div key={id} className="flex items-center gap-2.5 px-3 py-2">
                          <Checkbox checked={formColumnIds.includes(id)} onCheckedChange={() => toggleCol(id)} id={`col-${id}`} />
                          <label htmlFor={`col-${id}`} className="flex-1 text-sm cursor-pointer">{col.label}</label>
                          <div className="flex gap-0.5">
                            <button type="button" onClick={() => moveCol(id, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                            <button type="button" onClick={() => moveCol(id, 1)} disabled={idx === formColumnIds.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* FILTERS TAB */}
                <TabsContent value="filters" className="mt-3 space-y-3">
                  {formFilters.filters.length > 1 && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Combine filters with:</Label>
                      <Select value={formFilters.operator} onValueChange={(v) => setFormFilters((f) => ({ ...f, operator: v }))}>
                        <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="and">AND</SelectItem>
                          <SelectItem value="or">OR</SelectItem>
                          <SelectItem value="nor">NOR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {formFilters.filters.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No filters yet. Add one below.</p>
                    )}
                    {formFilters.filters.map((fi, idx) => {
                      const opts = getFieldOptions(fi.field);
                      return (
                        <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">
                              {idx === 0 ? "WHERE" : <span className="uppercase font-bold text-primary">{formFilters.operator}</span>}
                            </span>
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
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => toggleFilterValue(idx, val)}
                                  className={`px-2 py-0.5 rounded-full border text-xs transition-colors ${fi.values.includes(val) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                                >
                                  {val}
                                </button>
                              ))}
                              {opts.length === 0 && <span className="text-xs text-muted-foreground">No values found in data</span>}
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
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setMode("list")}>Back</Button>
                <Button onClick={handleSave} disabled={saving || !formName.trim()} className="gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {mode === "new" ? "Create & Apply" : "Save"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function tryParseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}