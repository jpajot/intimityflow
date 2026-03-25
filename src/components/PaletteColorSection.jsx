import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, List, Search, X } from "lucide-react";

function matchesFilter(entry, q, getLabel, getHex) {
  if (!q) return true;
  const lower = q.toLowerCase();
  const label = getLabel(entry)?.toLowerCase() || "";
  const hex = getHex(entry)?.toLowerCase() || "";
  const type = entry.color_type?.toLowerCase() || "";
  return label.includes(lower) || hex.includes(lower) || type.includes(lower);
}

export default function PaletteColorSection({ paletteColors, getColorHex, getColorLabel, getColorCode, getColorSubType, onRemove, groupByType }) {
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");

  const filtered = paletteColors.filter((e) => matchesFilter(e, search, getColorLabel, getColorHex));

  const renderGridEntry = (entry) => {
    const hex = getColorHex(entry);
    const label = getColorLabel(entry);
    return (
      <div key={entry.id} className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
        <div className="h-16 w-full" style={{ backgroundColor: hex }} />
        <div className="p-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{label}</p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-1">{entry.color_type}</Badge>
          </div>
          <button onClick={() => onRemove(entry.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderGrouped = () =>
    ["technical", "commercial"].map((type) => {
      const entries = filtered.filter((e) => e.color_type === type);
      if (entries.length === 0) return null;
      return (
        <div key={type} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">{type === "technical" ? "Technical Colors" : "Commercial Colors"}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {entries.map(renderGridEntry)}
          </div>
        </div>
      );
    });

  return (
    <div className="space-y-4">
      {/* Controls */}
      {paletteColors.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter colors…"
              className="pl-8 h-8 text-xs w-44"
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
        </div>
      )}

      {/* Empty states */}
      {paletteColors.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No colors yet. Add technical or commercial colors to this palette.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No colors match your filter.</p>
        </div>
      ) : view === "grid" ? (
        groupByType ? (
          <div className="space-y-6">{renderGrouped()}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map(renderGridEntry)}
          </div>
        )
      ) : (
        /* List / table view */
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Color</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Name / Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Sub-type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Hex</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const hex = getColorHex(entry);
                  const label = getColorLabel(entry);
                  const code = getColorCode ? getColorCode(entry) : null;
                  const subType = getColorSubType ? getColorSubType(entry) : null;
                  return (
                    <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="w-10 h-10 rounded-md border border-border" style={{ backgroundColor: hex }} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{label}</p>
                        {code && <p className="text-xs text-muted-foreground font-mono">{code}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px]">{entry.color_type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{subType || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: hex }} />
                          <span className="font-mono text-xs text-muted-foreground">{hex}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => onRemove(entry.id)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                          title="Remove from palette">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}