import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, List, Search, Plus, Pencil } from "lucide-react";
import ColorwayCard from "./ColorwayCard";

function matchesFilter(cv, q) {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    cv.color_name?.toLowerCase().includes(lower) ||
    cv.colorway_code?.toLowerCase().includes(lower) ||
    cv.color_hex?.toLowerCase().includes(lower) ||
    cv.linked_color_type?.toLowerCase().includes(lower)
  );
}

export default function ColorwaySection({ colorVariants, onEdit, onAddNew, onAddFromLibrary }) {
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");

  const filtered = colorVariants.filter((cv) => matchesFilter(cv, search));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="font-semibold">Colorways ({colorVariants.length})</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter colorways…"
              className="pl-8 h-8 text-xs w-48"
            />
          </div>
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`px-2.5 py-1.5 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
              title="Gallery view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={onAddFromLibrary} className="gap-1.5 h-8 text-xs">
            From Library
          </Button>
          <Button variant="outline" size="sm" onClick={onAddNew} className="gap-1.5 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {colorVariants.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No color variants yet. Add one to get started.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No colorways match your filter.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((cv) => (
            <ColorwayCard key={cv.id} variant={cv} onEdit={() => onEdit(cv)} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Color</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Hex</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Library Link</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cv) => (
                    <tr key={cv.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="w-10 h-10 rounded-md overflow-hidden border border-border">
                          {cv.image_url ? (
                            <img src={cv.image_url} alt={cv.color_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full" style={{ backgroundColor: cv.color_hex || "#ccc" }} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{cv.color_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{cv.colorway_code || "—"}</td>
                      <td className="px-4 py-3">
                        {cv.color_hex ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: cv.color_hex }} />
                            <span className="font-mono text-xs text-muted-foreground">{cv.color_hex}</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {cv.linked_color_id ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {cv.linked_color_type === "technical" ? "TCX" : "COM"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onEdit(cv)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors"
                          title="Edit colorway"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}