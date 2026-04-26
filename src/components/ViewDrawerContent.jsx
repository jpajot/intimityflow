import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Trash2, Loader2, X, Badge } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ViewDrawerContent({ pageKey, activeViewId, onSelectView, actionItems = [] }) {
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [mode, setMode] = useState("list");
  const [editingView, setEditingView] = useState(null);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.ListViewConfig.filter({ page_key: pageKey }).then((data) => {
      setViews(data);
      setLoading(false);
    });
  }, [pageKey]);

  const openNew = () => {
    setFormName("");
    setEditingView(null);
    setMode("new");
    setShowDialog(true);
  };

  const openEdit = (view) => {
    setFormName(view.name);
    setEditingView(view);
    setMode("edit");
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    
    const data = {
      page_key: pageKey,
      name: formName.trim(),
      column_ids: editingView?.column_ids || [],
      filters_config: editingView?.filters_config || {},
      allowed_roles: editingView?.allowed_roles || [],
    };

    if (editingView) {
      await base44.entities.ListViewConfig.update(editingView.id, { name: formName.trim() });
      setViews(views.map((v) => v.id === editingView.id ? { ...v, name: formName.trim() } : v));
    } else {
      const created = await base44.entities.ListViewConfig.create(data);
      setViews([...views, created]);
    }
    
    setSaving(false);
    setShowDialog(false);
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

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          {actionItems.map((item, idx) => (
            <Button
              key={idx}
              onClick={item.onClick}
              variant={item.variant || "outline"}
              size="sm"
              className="w-full gap-2 text-xs justify-start"
            >
              {item.icon && <item.icon className="w-3.5 h-3.5" />}
              {item.label}
            </Button>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {mode === "new" ? "Create New View" : "Edit View"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
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
            <p className="text-xs text-muted-foreground">
              {mode === "new"
                ? "Create a new saved view. Configure columns, filters, and display options from the main interface."
                : "Edit the name of this view."}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              className="text-xs"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formName.trim()}
              className="text-xs gap-2"
              size="sm"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              {mode === "new" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}