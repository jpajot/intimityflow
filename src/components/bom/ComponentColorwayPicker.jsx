import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X } from "lucide-react";
import ColorwayStatusBadge from "./ColorwayStatusBadge";

/**
 * Popover-style picker for selecting a component colorway (ProductColor)
 * for a BOM matrix cell (Case 1: column axis = color).
 *
 * Props:
 *   componentProductId  - the component product whose colorways to browse
 *   projectId           - BOM's project (for default filtering)
 *   bomType             - "development" | "production" (affects default status filter)
 *   currentColorId      - currently resolved component_product_color_id
 *   techColors          - full TechnicalColor[] (pass-through from parent, avoids refetch)
 *   commColors          - full CommercialColor[] (pass-through from parent)
 *   onSelect(colorId)   - called with new ProductColor.id
 *   onClear()           - called to remove the resolution
 *   onClose()           - called to close the picker without changes
 */
export default function ComponentColorwayPicker({
  componentProductId,
  projectId,
  bomType,
  currentColorId,
  techColors = [],
  commColors = [],
  onSelect,
  onClear,
  onClose,
}) {
  const [colorways, setColorways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState([]); // empty = show all relevant
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState(currentColorId || null);

  // Default status filter based on BOM type
  const defaultHidden = bomType === "production" ? [] : ["obsolete"];

  useEffect(() => {
    if (!componentProductId) { setLoading(false); return; }
    base44.entities.ProductColor.filter({ product_id: componentProductId }).then((cws) => {
      setColorways(cws);
      setLoading(false);
    });
  }, [componentProductId]);

  const filtered = useMemo(() => {
    let list = colorways;

    // Project filter (unless showAll)
    if (!showAll && projectId) {
      const linked = list.filter((c) => (c.project_ids || []).includes(projectId));
      if (linked.length > 0) list = linked;
    }

    // Status filter
    const hiddenStatuses = statusFilter.length > 0 ? [] : defaultHidden;
    if (hiddenStatuses.length > 0) {
      list = list.filter((c) => !hiddenStatuses.includes(c.colorway_status || "approved"));
    }
    if (statusFilter.length > 0) {
      list = list.filter((c) => statusFilter.includes(c.colorway_status || "approved"));
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.color_name?.toLowerCase().includes(q) ||
          c.colorway_code?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [colorways, search, statusFilter, showAll, projectId]);

  const getTcxChips = (colorway) => {
    if (!colorway) return [];
    if (colorway.linked_color_type === "commercial" && colorway.linked_color_id) {
      const comm = commColors.find((c) => c.id === colorway.linked_color_id);
      if (comm) {
        const ids = comm.linked_technical_color_ids || [];
        if (ids.length > 0) {
          return ids.map((tid) => techColors.find((t) => t.id === tid)).filter(Boolean);
        }
        if (comm.main_technical_color_id) {
          const t = techColors.find((t) => t.id === comm.main_technical_color_id);
          return t ? [t] : [];
        }
      }
    }
    if (colorway.linked_tech_color_id) {
      const t = techColors.find((t) => t.id === colorway.linked_tech_color_id);
      return t ? [t] : [];
    }
    return [];
  };

  const STATUS_OPTIONS = [
    { value: "requested", label: "Requested" },
    { value: "in_progress", label: "In Progress" },
    { value: "submitted_for_approval", label: "Submitted" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "obsolete", label: "Obsolete" },
  ];

  const toggleStatus = (val) => {
    setStatusFilter((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );
  };

  return (
    <div className="w-72 bg-popover border border-border rounded-xl shadow-xl flex flex-col overflow-hidden max-h-[420px]">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">Pick Component Colorway</p>
          <button type="button" onClick={onClose} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search colorways…"
            className="h-7 text-xs pl-7"
            autoFocus
          />
        </div>
        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1 mt-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleStatus(s.value)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                statusFilter.includes(s.value)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {!showAll && projectId && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-[10px] text-primary hover:underline mt-1"
          >
            Show all colorways (not just project-linked)
          </button>
        )}
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No colorways found.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((cw) => {
              const chips = getTcxChips(cw);
              const isSelected = selected === cw.id;
              return (
                <button
                  key={cw.id}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : cw.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50 ${
                    isSelected ? "bg-primary/10" : ""
                  }`}
                >
                  {/* Swatch */}
                  <div
                    className="w-7 h-7 rounded border border-border shrink-0"
                    style={{ backgroundColor: cw.color_hex || "#e5e7eb" }}
                  />
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium truncate">{cw.color_name}</span>
                      {cw.colorway_code && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {cw.colorway_code}
                        </span>
                      )}
                      <ColorwayStatusBadge status={cw.colorway_status || "approved"} compact />
                    </div>
                    {/* TCX chips */}
                    {chips.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {chips.map((tc) => (
                          <span
                            key={tc.id}
                            className="inline-flex items-center gap-1 text-[9px] px-1 py-0.5 rounded border border-border bg-muted/40"
                            title={tc.name}
                          >
                            <span
                              className="w-2 h-2 rounded-full border border-border/40 shrink-0"
                              style={{ backgroundColor: tc.hex || "#e5e7eb" }}
                            />
                            {tc.code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border flex gap-2 shrink-0">
        <Button
          size="sm"
          className="flex-1 h-7 text-xs"
          disabled={!selected}
          onClick={() => { if (selected) onSelect(selected); }}
        >
          Select
        </Button>
        {currentColorId && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClear}>
            Clear
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}