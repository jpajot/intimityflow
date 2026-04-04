import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2, LayoutGrid, X, ShieldCheck, Layers } from "lucide-react";

const STORAGE_KEY = (pageKey) => `gallery_active_view_${pageKey}`;
const THUMB_KEY = (pageKey) => `gallery_thumb_size_${pageKey}`;
const DEFAULT_FILTERS = { operator: "and", filters: [] };

const THUMB_SIZES = [
  { id: "xs", label: "XS", cols: "grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9", height: "h-24" },
  { id: "sm", label: "S",  cols: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7", height: "h-32" },
  { id: "md", label: "M",  cols: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", height: "h-44" },
  { id: "lg", label: "L",  cols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", height: "h-60" },
  { id: "xl", label: "XL", cols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3", height: "h-80" },
];

function applyFilters(rows, filtersConfig, filterableFields) {
  if (!filtersConfig?.filters?.length) return rows;
  const active = filtersConfig.filters.filter((f) => f.field && f.values?.length > 0);
  if (!active.length) return rows;
  return rows.filter((row) => {
    let result = matchFilter(active[0], row, filterableFields);
    for (let i = 1; i < active.length; i++) {
      const op = active[i].operator || "and";
      const m = matchFilter(active[i], row, filterableFields);
      if (op === "or") result = result || m;
      else if (op === "not") result = result && !m;
      else result = result && m;
    }
    return result;
  });
}

function matchFilter(f, row, filterableFields) {
  const field = filterableFields.find((ff) => ff.id === f.field);
  const val = field ? field.getValue(row) : row[f.field];
  return f.values.includes(val);
}

function buildGroups(rows, groupCols, allFields, depth = 0) {
  if (depth >= groupCols.length) return rows;
  const field = allFields.find((f) => f.id === groupCols[depth]);
  const getKey = field?.getValue || ((r) => r[groupCols[depth]] || "—");
  const map = {};
  for (const row of rows) {
    const k = String(getKey(row) || "—");
    if (!map[k]) map[k] = [];
    map[k].push(row);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      key: `${depth}-${key}`,
      label: key,
      depth,
      items: depth + 1 < groupCols.length ? null : items,
      children: depth + 1 < groupCols.length ? buildGroups(items, groupCols, allFields, depth + 1) : null,
    }));
}

function FieldContextMenu({ x, y, fieldLabel, onGroup, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div ref={ref} style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
      className="bg-popover border border-border rounded-md shadow-lg py-1 min-w-[180px]">
      <button type="button" onClick={() => { onGroup(); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left">
        <Layers className="w-3.5 h-3.5 text-muted-foreground" />
        Group by <span className="font-medium ml-1">{fieldLabel}</span>
      </button>
    </div>
  );
}

function GalleryCard({ row, activeFields, allFields, thumbSize, renderThumbnail, onClickItem, onFieldRightClick }) {
  const ts = THUMB_SIZES.find((s) => s.id === thumbSize) || THUMB_SIZES[2];
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/20 transition-all">
      <div className={`${ts.height} bg-muted relative overflow-hidden cursor-pointer`} onClick={() => onClickItem?.(row)}>
        {renderThumbnail(row)}
      </div>
      {activeFields.length > 0 && (
        <div className="px-2.5 py-2 space-y-0.5">
          {activeFields.map((fieldId) => {
            const field = allFields.find((f) => f.id === fieldId);
            if (!field) return null;
            const content = field.render ? field.render(row) : (field.getValue?.(row) ?? "—");
            return (
              <div
                key={fieldId}
                className="text-xs truncate cursor-default select-none"
                onContextMenu={(e) => { e.preventDefault(); onFieldRightClick(e, field); }}
              >
                {content || <span className="text-muted-foreground/40">—</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GroupSection({ group, allFields, activeFields, thumbSize, renderThumbnail, onClickItem, onFieldRightClick, expandedGroups, toggleGroup, groupCols, depth = 0 }) {
  const isExpanded = expandedGroups.has(group.key);
  const count = group.items ? group.items.length : countLeaves(group.children || []);
  const ts = THUMB_SIZES.find((s) => s.id === thumbSize) || THUMB_SIZES[2];
  const groupField = allFields.find((f) => f.id === (groupCols?.[depth]));
  const labelContent = groupField?.renderGroupLabel ? groupField.renderGroupLabel(group.label) : group.label;

  return (
    <div>
      <button type="button" onClick={() => toggleGroup(group.key)}
        className="w-full flex items-center justify-between px-3 py-2 mb-2 bg-muted/60 rounded-lg hover:bg-muted transition-colors"
        style={{ marginLeft: depth * 16 }}>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">{labelContent} <span className="font-normal">({count})</span></span>
        <span className="text-sm text-muted-foreground">{isExpanded ? "−" : "+"}</span>
      </button>
      {isExpanded && (
        group.children ? (
          <div className="space-y-4 ml-4">
            {group.children.map((child) => (
              <GroupSection key={child.key} group={child} allFields={allFields} activeFields={activeFields}
                thumbSize={thumbSize} renderThumbnail={renderThumbnail} onClickItem={onClickItem}
                onFieldRightClick={onFieldRightClick} expandedGroups={expandedGroups} toggleGroup={toggleGroup} groupCols={groupCols} depth={depth + 1} />
            ))}
          </div>
        ) : (
          <div className={`grid ${ts.cols} gap-3 mb-4`}>
            {(group.items || []).map((row) => (
              <GalleryCard key={row.id} row={row} activeFields={activeFields} allFields={allFields}
                thumbSize={thumbSize} renderThumbnail={renderThumbnail} onClickItem={onClickItem}
                onFieldRightClick={onFieldRightClick} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function countLeaves(groups) {
  return groups.reduce((s, g) => s + (g.items ? g.items.length : countLeaves(g.children || [])), 0);
}

// ─── Main GalleryView ─────────────────────────────────────────────────────────
export default function GalleryView({ pageKey, allFields, rows = [], filterableFields = [], renderThumbnail, onClickItem, entityNames = [] }) {
  const [views, setViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(() => localStorage.getItem(STORAGE_KEY(pageKey)) || "default");
  const [activeFieldIds, setActiveFieldIds] = useState(() => allFields.map((f) => f.id));
  const [activeFiltersConfig, setActiveFiltersConfig] = useState(DEFAULT_FILTERS);
  const [thumbSize, setThumbSize] = useState(() => localStorage.getItem(THUMB_KEY(pageKey)) || "md");
  const [groupCols, setGroupCols] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [contextMenu, setContextMenu] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [showManage, setShowManage] = useState(false);
  const [mode, setMode] = useState("list");
  const [editingView, setEditingView] = useState(null);
  const [formName, setFormName] = useState("");
  const [formFieldIds, setFormFieldIds] = useState([]);
  const [formFilters, setFormFilters] = useState(DEFAULT_FILTERS);
  const [formRoles, setFormRoles] = useState([]);
  const [roleInput, setRoleInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialogTab, setDialogTab] = useState("fields");
  const [fieldSearch, setFieldSearch] = useState("");
  const [localThumbSize, setLocalThumbSize] = useState(thumbSize);

  useEffect(() => {
    base44.entities.ListViewConfig.filter({ page_key: `gallery_${pageKey}` }).then((data) => {
      setViews(data);
      setLoading(false);
    });
  }, [pageKey]);

  const applyView = useCallback((viewId, viewList) => {
    const list = viewList || views;
    if (viewId === "default") {
      setActiveFieldIds(allFields.map((f) => f.id));
      setActiveFiltersConfig(DEFAULT_FILTERS);
    } else {
      const view = list.find((v) => v.id === viewId);
      if (view) {
        setActiveFieldIds(view.column_ids || allFields.map((f) => f.id));
        setActiveFiltersConfig(view.filters_config || DEFAULT_FILTERS);
      }
    }
  }, [views, allFields]);

  useEffect(() => {
    if (!loading) applyView(activeViewId);
  }, [loading, activeViewId]);

  const filteredRows = useMemo(() =>
    applyFilters(rows, activeFiltersConfig, filterableFields),
    [rows, activeFiltersConfig, filterableFields]
  );

  const groups = useMemo(() => {
    if (!groupCols.length) return null;
    return buildGroups(filteredRows, groupCols, allFields);
  }, [filteredRows, groupCols, allFields]);

  const switchView = (viewId) => {
    setActiveViewId(viewId);
    localStorage.setItem(STORAGE_KEY(pageKey), viewId);
    applyView(viewId);
  };

  const openManage = () => {
    setLocalThumbSize(thumbSize);
    setMode("list");
    setShowManage(true);
  };

  const openNew = () => {
    setFormName("");
    setFormFieldIds(allFields.map((f) => f.id));
    setFormFilters(DEFAULT_FILTERS);
    setFormRoles([]);
    setEditingView(null);
    setDialogTab("fields");
    setMode("new");
  };

  const openEdit = (view) => {
    setFormName(view.name);
    setFormFieldIds(view.column_ids || allFields.map((f) => f.id));
    setFormFilters(view.filters_config || DEFAULT_FILTERS);
    setFormRoles(view.allowed_roles || []);
    setEditingView(view);
    setDialogTab("fields");
    setMode("edit");
  };

  const toggleField = (id) => setFormFieldIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const moveField = (id, dir) => setFormFieldIds((prev) => {
    const idx = prev.indexOf(id);
    const next = [...prev];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return prev;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    return next;
  });

  const addFilter = () => setFormFilters((f) => ({ ...f, filters: [...f.filters, { operator: "and", field: "", values: [] }] }));
  const removeFilter = (idx) => setFormFilters((f) => ({ ...f, filters: f.filters.filter((_, i) => i !== idx) }));
  const updateFilter = (idx, patch) => setFormFilters((f) => ({ ...f, filters: f.filters.map((fi, i) => i === idx ? { ...fi, ...patch } : fi) }));
  const getFieldOptions = (fieldId) => {
    const field = filterableFields.find((f) => f.id === fieldId);
    if (!field) return [];
    return [...new Set(rows.map((r) => field.getValue(r)).filter(Boolean))].sort();
  };
  const toggleFilterValue = (idx, val) => setFormFilters((f) => ({
    ...f,
    filters: f.filters.map((fi, i) => i === idx ? { ...fi, values: fi.values.includes(val) ? fi.values.filter((v) => v !== val) : [...fi.values, val] } : fi),
  }));

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    // Apply thumb size immediately
    setThumbSize(localThumbSize);
    localStorage.setItem(THUMB_KEY(pageKey), localThumbSize);
    const data = {
      page_key: `gallery_${pageKey}`,
      name: formName.trim(),
      column_ids: formFieldIds,
      filters_config: formFilters,
      allowed_roles: formRoles,
    };
    if (editingView) {
      await base44.entities.ListViewConfig.update(editingView.id, data);
      const updated = views.map((v) => v.id === editingView.id ? { ...v, ...data } : v);
      setViews(updated);
      if (activeViewId === editingView.id) {
        setActiveFieldIds(formFieldIds);
        setActiveFiltersConfig(formFilters);
      }
    } else {
      const created = await base44.entities.ListViewConfig.create(data);
      const updated = [...views, created];
      setViews(updated);
      setActiveViewId(created.id);
      localStorage.setItem(STORAGE_KEY(pageKey), created.id);
      setActiveFieldIds(formFieldIds);
      setActiveFiltersConfig(formFilters);
    }
    setSaving(false);
    setMode("list");
  };

  const handleSaveDisplayOnly = () => {
    setThumbSize(localThumbSize);
    localStorage.setItem(THUMB_KEY(pageKey), localThumbSize);
    setShowManage(false);
  };

  const handleDelete = async (view) => {
    await base44.entities.ListViewConfig.delete(view.id);
    const updated = views.filter((v) => v.id !== view.id);
    setViews(updated);
    if (activeViewId === view.id) switchView("default");
  };

  const addGroupCol = (fieldId) => {
    setGroupCols((prev) => {
      if (prev.includes(fieldId) || prev.length >= 3) return prev;
      return [...prev, fieldId];
    });
    setExpandedGroups(new Set());
  };
  const removeGroupCol = (fieldId) => { setGroupCols((prev) => prev.filter((id) => id !== fieldId)); setExpandedGroups(new Set()); };
  const clearGroups = () => { setGroupCols([]); setExpandedGroups(new Set()); };
  const toggleGroup = (key) => setExpandedGroups((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const toggleAllGroups = () => {
    const allKeys = collectGroupKeys(groups || []);
    setExpandedGroups(expandedGroups.size === allKeys.length ? new Set() : new Set(allKeys));
  };

  const activeLabel = activeViewId === "default" ? "Default" : views.find((v) => v.id === activeViewId)?.name || "Default";
  const activeFilterCount = (activeFiltersConfig.filters || []).filter((f) => f.field && f.values?.length > 0).length;
  const ts = THUMB_SIZES.find((s) => s.id === thumbSize) || THUMB_SIZES[2];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LayoutGrid className="w-4 h-4 text-muted-foreground shrink-0" />
        <Select value={activeViewId} onValueChange={switchView}>
          <SelectTrigger className="h-8 text-xs w-36 border-dashed">
            <SelectValue>{activeLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            {views.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={openManage}>
          <Pencil className="w-3 h-3" /> Manage Views
          {activeFilterCount > 0 && <Badge className="ml-1 px-1.5 py-0 text-[10px] h-4">{activeFilterCount}</Badge>}
        </Button>
      </div>

      {/* Active grouping pills */}
      {groupCols.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Grouped by:</span>
          {groupCols.map((id, idx) => {
            const field = allFields.find((f) => f.id === id);
            return (
              <div key={id} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full border border-primary/20">
                {idx > 0 && <span className="text-muted-foreground mr-1">›</span>}
                {field?.label}
                <button type="button" onClick={() => removeGroupCol(id)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
              </div>
            );
          })}
          <button type="button" onClick={clearGroups} className="text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline">Clear</button>
          <Button type="button" variant="outline" size="sm" onClick={toggleAllGroups} className="h-7 text-xs ml-auto">
            {expandedGroups.size === collectGroupKeys(groups || []).length ? "Collapse All" : "Expand All"}
          </Button>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <FieldContextMenu
          x={contextMenu.x} y={contextMenu.y} fieldLabel={contextMenu.field.label}
          onGroup={() => addGroupCol(contextMenu.field.id)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Gallery */}
      {groups ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupSection key={group.key} group={group} allFields={allFields} activeFields={activeFieldIds}
              thumbSize={thumbSize} renderThumbnail={renderThumbnail} onClickItem={onClickItem}
              onFieldRightClick={(e, field) => setContextMenu({ x: e.clientX, y: e.clientY, field })}
              expandedGroups={expandedGroups} toggleGroup={toggleGroup} groupCols={groupCols} />
          ))}
        </div>
      ) : (
        <div className={`grid ${ts.cols} gap-3`}>
          {filteredRows.map((row) => (
            <GalleryCard key={row.id} row={row} activeFields={activeFieldIds} allFields={allFields}
              thumbSize={thumbSize} renderThumbnail={renderThumbnail} onClickItem={onClickItem}
              onFieldRightClick={(e, field) => setContextMenu({ x: e.clientX, y: e.clientY, field })} />
          ))}
        </div>
      )}

      {/* Manage Dialog */}
      <Dialog open={showManage} onOpenChange={(o) => { if (!o) { setShowManage(false); setMode("list"); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "list" ? "Gallery Views" : mode === "new" ? "New View" : `Edit: ${editingView?.name}`}
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
                    <span className="text-xs text-muted-foreground">All fields</span>
                  </div>
                  {views.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border">
                      <span className="flex-1 text-sm font-medium">{v.name}</span>
                      <span className="text-xs text-muted-foreground">{v.column_ids?.length} fields</span>
                      {v.filters_config?.filters?.filter(f => f.field && f.values?.length).length > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5">{v.filters_config.filters.filter(f => f.field && f.values?.length).length} filter{v.filters_config.filters.filter(f => f.field && f.values?.length).length > 1 ? "s" : ""}</Badge>
                      )}
                      {v.allowed_roles?.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 gap-0.5"><ShieldCheck className="w-2.5 h-2.5 mr-0.5" />{v.allowed_roles.join(", ")}</Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(v)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                  {views.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No custom views yet</p>}
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
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Compact View" autoFocus />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Thumbnail Size</Label>
                <div className="flex gap-1.5">
                  {THUMB_SIZES.map((s) => (
                    <button key={s.id} type="button"
                      onClick={() => setLocalThumbSize(s.id)}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors border ${localThumbSize === s.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <Tabs value={dialogTab} onValueChange={setDialogTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="fields" className="flex-1 text-xs">Fields</TabsTrigger>
                  <TabsTrigger value="filters" className="flex-1 text-xs">
                    Filters
                    {formFilters.filters.filter(f => f.field && f.values.length > 0).length > 0 && (
                      <Badge className="ml-1.5 px-1.5 py-0 text-[10px] h-4">{formFilters.filters.filter(f => f.field && f.values.length > 0).length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="roles" className="flex-1 text-xs">
                    Roles {formRoles.length > 0 && <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px] h-4">{formRoles.length}</Badge>}
                  </TabsTrigger>
                </TabsList>

                {/* FIELDS TAB */}
                <TabsContent value="fields" className="mt-3">
                  <Input value={fieldSearch} onChange={(e) => setFieldSearch(e.target.value)} placeholder="Search fields…" className="h-7 text-xs mb-2" />
                  <div className="border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
                    {(() => {
                      const checked = formFieldIds.map((id) => allFields.find((f) => f.id === id)).filter(Boolean);
                      const unchecked = allFields.filter((f) => !formFieldIds.includes(f.id));
                      const all = [...checked, ...unchecked];
                      const q = fieldSearch.toLowerCase();
                      return (q ? all.filter((f) => f.label.toLowerCase().includes(q)) : all).map((field) => {
                        const isChecked = formFieldIds.includes(field.id);
                        const idx = formFieldIds.indexOf(field.id);
                        return (
                          <div key={field.id} className={`flex items-center gap-2.5 px-3 py-2 ${!isChecked ? "opacity-50" : ""}`}>
                            <Checkbox checked={isChecked} onCheckedChange={() => toggleField(field.id)} id={`f-${field.id}`} />
                            <label htmlFor={`f-${field.id}`} className="flex-1 text-sm cursor-pointer">{field.label}</label>
                            <div className="flex gap-0.5">
                              <button type="button" onClick={() => moveField(field.id, -1)} disabled={!isChecked || idx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                              <button type="button" onClick={() => moveField(field.id, 1)} disabled={!isChecked || idx === formFieldIds.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </TabsContent>

                {/* FILTERS TAB */}
                <TabsContent value="filters" className="mt-3 space-y-3">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {formFilters.filters.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No filters yet.</p>
                    )}
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
                                <button key={val} type="button" onClick={() => toggleFilterValue(idx, val)}
                                  className={`px-2 py-0.5 rounded-full border text-xs transition-colors ${fi.values.includes(val) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
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

                {/* ROLES TAB */}
                <TabsContent value="roles" className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">Restrict this view to specific user roles. Leave empty for all.</p>
                  <div className="flex gap-2">
                    <Input value={roleInput} onChange={(e) => setRoleInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const r = roleInput.trim(); if (r && !formRoles.includes(r)) setFormRoles((p) => [...p, r]); setRoleInput(""); } }}
                      placeholder="e.g. admin, manager…" className="h-8 text-xs flex-1" />
                    <Button type="button" variant="outline" size="sm" onClick={() => { const r = roleInput.trim(); if (r && !formRoles.includes(r)) setFormRoles((p) => [...p, r]); setRoleInput(""); }} className="h-8 text-xs gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                  </div>
                  {formRoles.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg p-3">
                      <ShieldCheck className="w-4 h-4" /> Visible to all roles
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {formRoles.map((r) => (
                        <div key={r} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full border border-primary/20">
                          <ShieldCheck className="w-3 h-3" />{r}
                          <button type="button" onClick={() => setFormRoles((p) => p.filter((x) => x !== r))} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
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

function collectGroupKeys(groups) {
  const keys = [];
  for (const g of groups) {
    if (g.label) { keys.push(g.key); if (g.children) keys.push(...collectGroupKeys(g.children)); }
  }
  return keys;
}