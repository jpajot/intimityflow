import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2, LayoutList } from "lucide-react";

const STORAGE_KEY = (pageKey) => `list_active_view_${pageKey}`;

export default function ViewSelector({ pageKey, allColumns, onColumnsChange }) {
  const [views, setViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(() => localStorage.getItem(STORAGE_KEY(pageKey)) || "default");
  const [showManage, setShowManage] = useState(false);
  const [mode, setMode] = useState("list"); // "list" | "new" | "edit"
  const [editingView, setEditingView] = useState(null);
  const [formName, setFormName] = useState("");
  const [formColumnIds, setFormColumnIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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
    } else {
      const view = list.find((v) => v.id === viewId);
      if (view) {
        const ordered = view.column_ids
          .map((id) => allColumns.find((c) => c.id === id))
          .filter(Boolean);
        onColumnsChange(ordered.length > 0 ? ordered : allColumns);
      }
    }
  }, [views, allColumns, onColumnsChange]);

  useEffect(() => {
    if (!loading) applyView(activeViewId);
  }, [loading, activeViewId, views]);

  const switchView = (viewId) => {
    setActiveViewId(viewId);
    localStorage.setItem(STORAGE_KEY(pageKey), viewId);
    applyView(viewId);
  };

  const openNew = () => {
    setFormName("");
    setFormColumnIds(allColumns.map((c) => c.id));
    setEditingView(null);
    setMode("new");
  };

  const openEdit = (view) => {
    setFormName(view.name);
    // merge: include cols from view + any new cols not in view at the end (unchecked)
    const inView = view.column_ids.filter((id) => allColumns.find((c) => c.id === id));
    const notInView = allColumns.map((c) => c.id).filter((id) => !inView.includes(id));
    setFormColumnIds([...inView, ...notInView]);
    setEditingView(view);
    setMode("edit");
  };

  const toggleCol = (id) => {
    setFormColumnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const data = { page_key: pageKey, name: formName.trim(), column_ids: formColumnIds };
    if (editingView) {
      await base44.entities.ListViewConfig.update(editingView.id, data);
      const updated = views.map((v) => v.id === editingView.id ? { ...v, ...data } : v);
      setViews(updated);
      if (activeViewId === editingView.id) applyView(editingView.id, updated);
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

  const activeLabel = activeViewId === "default"
    ? "Default"
    : views.find((v) => v.id === activeViewId)?.name || "Default";

  return (
    <div className="flex items-center gap-2">
      <LayoutList className="w-4 h-4 text-muted-foreground shrink-0" />
      <Select value={activeViewId} onValueChange={switchView}>
        <SelectTrigger className="h-8 text-xs w-36 border-dashed">
          <SelectValue>{activeLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Default</SelectItem>
          {views.map((v) => (
            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => { setMode("list"); setShowManage(true); }}>
        <Pencil className="w-3 h-3" /> Manage Views
      </Button>

      <Dialog open={showManage} onOpenChange={(o) => { if (!o) { setShowManage(false); setMode("list"); } }}>
        <DialogContent className="max-w-md">
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
                  {/* Default view */}
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                    <span className="flex-1 text-sm font-medium">Default</span>
                    <span className="text-xs text-muted-foreground">All columns</span>
                  </div>
                  {views.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border">
                      <span className="flex-1 text-sm font-medium">{v.name}</span>
                      <span className="text-xs text-muted-foreground">{v.column_ids.length} cols</span>
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
              <div className="space-y-1.5">
                <Label className="text-xs">Columns (check to include, drag to reorder)</Label>
                <div className="border border-border rounded-lg divide-y divide-border max-h-72 overflow-y-auto">
                  {formColumnIds.map((id, idx) => {
                    const col = allColumns.find((c) => c.id === id);
                    if (!col) return null;
                    const checked = formColumnIds.includes(id);
                    return (
                      <div key={id} className="flex items-center gap-2.5 px-3 py-2">
                        <Checkbox checked={checked} onCheckedChange={() => toggleCol(id)} id={`col-${id}`} />
                        <label htmlFor={`col-${id}`} className="flex-1 text-sm cursor-pointer">{col.label}</label>
                        <div className="flex gap-0.5">
                          <button type="button" onClick={() => moveCol(id, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button type="button" onClick={() => moveCol(id, 1)} disabled={idx === formColumnIds.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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