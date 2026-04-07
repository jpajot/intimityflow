import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

export default function PagesPanel({ pages, activePageId, onSelectPage, onAddPage, onDeletePage }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`shrink-0 border-r border-border bg-sidebar flex flex-col transition-all duration-200 ${collapsed ? "w-10" : "w-36"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-border shrink-0">
        {!collapsed && <span className="text-xs font-semibold text-muted-foreground">Pages</span>}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Pages list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto py-2 space-y-1 px-1.5">
          {pages.map((page, idx) => (
            <button
              key={page.id}
              type="button"
              onClick={() => onSelectPage(page.id)}
              className={`w-full text-left rounded-lg overflow-hidden border transition-all group ${
                activePageId === page.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              {/* Mini preview */}
              <div className="aspect-video bg-muted/60 flex items-center justify-center">
                <span className="text-[9px] text-muted-foreground">{idx + 1}</span>
              </div>
              <div className="px-2 py-1 flex items-center justify-between">
                <span className="text-[10px] truncate flex-1">{page.name || `Slide ${idx + 1}`}</span>
                {pages.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDeletePage(page.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add page */}
      {!collapsed && (
        <div className="shrink-0 px-1.5 pb-2">
          <Button variant="outline" size="sm" className="w-full h-7 gap-1 text-xs" onClick={onAddPage}>
            <Plus className="w-3 h-3" /> Add Slide
          </Button>
        </div>
      )}

      {/* Collapsed: add button */}
      {collapsed && (
        <div className="py-2 flex flex-col items-center gap-1">
          {pages.map((page, idx) => (
            <button
              key={page.id}
              type="button"
              onClick={() => onSelectPage(page.id)}
              className={`w-7 h-5 rounded text-[8px] border transition-all ${
                activePageId === page.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {idx + 1}
            </button>
          ))}
          <button type="button" onClick={onAddPage} className="w-7 h-5 rounded border border-dashed border-border flex items-center justify-center hover:border-primary text-muted-foreground">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}