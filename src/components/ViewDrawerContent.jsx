import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Trash2, Loader2, X, Badge, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ViewDrawerContent({ pageKey, activeViewId, onSelectView }) {
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [mode, setMode] = useState("list");
  const [editingView, setEditingView] = useState(null);
  const [formName, setFormName] = useState("");
  const [formFieldIds, setFormFieldIds] = useState([]);
  const [formFilters, setFormFilters] = useState({ operator: "and", filters: [] });
  const [formRoles, setFormRoles] = useState([]);
  const [dialogTab, setDialogTab] = useState("fields");
  const [roleInput, setRoleInput] = useState("");
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
    setFormFilters({ operator: "and", filters: [] });
    setFormRoles([]);
    setRoleInput("");
    setEditingView(null);
    setMode("new");
    setDialogTab("fields");
    setShowDialog(true);
  };

  const openEdit = (view) => {
    setFormName(view.name);
    setFormFieldIds(view.column_ids || []);
    setFormFilters(view.filters_config || { operator: "and", filters: [] });
    setFormRoles(view.allowed_roles || []);
    setRoleInput("");
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
      filters_config: formFilters,
      allowed_roles: formRoles,
    };

    if (editingView) {
      await base44.entities.ListViewConfig.update(editingView.id, data);
      setViews(views.map((v) => v.id === editingView.id ? { ...v, ...data } : v));
    } else {
      const created = await base44.entities.ListViewConfig.create(data);
      setViews([...views, created]);
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

  const handleDelete = async (view) => {
    await base44.entities.ListViewConfig.delete(view.id);
    setViews(views.filter((v) => v.id !== view.id));
    if (activeViewId === view.id) onSelectView("default");
  };

  return (
    <div className="space-y-3">
      {/* View Selection */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select View</p>
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
              <div key={v.id} className="flex items-center gap-2">
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
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit view name"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(v)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
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
        onClick={openNew}
        variant="outline"
        size="sm"
        className="w-full gap-2 text-xs"
      >
        <Plus className="w-3.5 h-3.5" /> New View
      </Button>

      {/* Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "list" ? "View Management" : mode === "new" ? "Create New View" : "Edit View"}
            </DialogTitle>
          </DialogHeader>

          {mode === "list" && (
            <div className="text-sm text-muted-foreground">Select a view to edit or create a new one.</div>
          )}

          {(mode === "new" || mode === "edit") && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">View Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sales View"
                  className="h-8 text-xs"
                  autoFocus
                />
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
                  <p className="text-xs text-muted-foreground mb-2">Configure which fields to display in this view.</p>
                  <div className="space-y-2">
                    {formFieldIds.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No fields selected. Create the view and configure from the main interface.</p>
                    ) : (
                      <div className="border border-border rounded-lg p-2 space-y-1">
                        {formFieldIds.map((id) => (
                          <div key={id} className="flex items-center justify-between text-xs px-2 py-1 bg-muted/50 rounded">
                            <span>{id}</span>
                            <button type="button" onClick={() => setFormFieldIds((prev) => prev.filter((x) => x !== id))} className="text-muted-foreground hover:text-destructive">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* FILTERS TAB */}
                <TabsContent value="filters" className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">Add filters to automatically apply when this view is selected.</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
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
                          <button type="button" onClick={() => removeFilter(idx)} className="ml-auto p-0.5 hover:text-destructive text-muted-foreground">
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
                  <Button variant="outline" size="sm" onClick={addFilter} className="gap-1 text-xs w-full h-7">
                    <Plus className="w-3 h-3" /> Add Filter
                  </Button>
                </TabsContent>

                {/* ROLES TAB */}
                <TabsContent value="roles" className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">Restrict this view to specific user roles. Leave empty for all.</p>
                  <div className="flex gap-1">
                    <Input value={roleInput} onChange={(e) => setRoleInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const r = roleInput.trim(); if (r && !formRoles.includes(r)) setFormRoles((p) => [...p, r]); setRoleInput(""); } }}
                      placeholder="e.g. admin, manager…" className="h-7 text-xs flex-1" />
                    <Button type="button" variant="outline" size="sm" onClick={() => { const r = roleInput.trim(); if (r && !formRoles.includes(r)) setFormRoles((p) => [...p, r]); setRoleInput(""); }} className="h-7 text-xs gap-1 px-2">
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
                          <button type="button" onClick={() => setFormRoles((p) => p.filter((x) => x !== r))} className="hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)} className="text-xs" size="sm">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !formName.trim()} className="text-xs gap-2" size="sm">
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