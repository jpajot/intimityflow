import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus } from "lucide-react";

export default function ColorPalettesViewsMenu({ activeSection, activeViewId, onViewSelect, onManageClick }) {
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadViews = async () => {
      setLoading(true);
      const pageKey = activeSection === "technical" ? "technical_colors" : "commercial_colors";
      const loaded = await base44.entities.ListViewConfig.filter({ page_key: pageKey });
      setViews(loaded);
      setLoading(false);
    };
    loadViews();
  }, [activeSection]);

  const handleDelete = async (viewId) => {
    await base44.entities.ListViewConfig.delete(viewId);
    setViews((prev) => prev.filter((v) => v.id !== viewId));
    if (activeViewId === viewId) onViewSelect("default");
  };

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Select View</p>
      <div className="space-y-2">
        <button
          onClick={() => onViewSelect("default")}
          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeViewId === "default" ? "bg-primary text-primary-foreground" : "hover:bg-muted border border-border"
          }`}
        >
          Default View
        </button>
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-2">Loading...</p>
        ) : (
          views.map((v) => (
            <div key={v.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted">
              <button onClick={() => onViewSelect(v.id)} className="flex-1 text-left text-sm">
                {v.name}
              </button>
              <button
                onClick={() => onManageClick(v)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(v.id)}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      <Button
        onClick={onManageClick}
        variant="outline"
        className="w-full gap-2 text-xs"
      >
        <Plus className="w-3.5 h-3.5" /> Manage Views
      </Button>
    </div>
  );
}