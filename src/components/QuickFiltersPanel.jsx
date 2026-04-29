import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Filter } from "lucide-react";

const OPERATORS = [
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "is different than" },
];

export function applyQuickFilters(rows, filters) {
  if (!filters || filters.length === 0) return rows;
  const active = filters.filter((f) => f.field && f.value !== "");
  if (active.length === 0) return rows;

  return rows.filter((row) =>
    active.every((f) => {
      const raw = f.getValue ? f.getValue(row) : (row[f.field] ?? "");
      const val = String(raw ?? "").toLowerCase();
      const term = String(f.value ?? "").toLowerCase();
      switch (f.operator) {
        case "contains":     return val.includes(term);
        case "starts_with":  return val.startsWith(term);
        case "equals":       return val === term;
        case "not_equals":   return val !== term;
        default:             return val.includes(term);
      }
    })
  );
}

export default function QuickFiltersPanel({ fields = [], activeFilters = [], onApply }) {
  const [filters, setFilters] = useState(() =>
    activeFilters.length > 0
      ? activeFilters.map(({ getValue, ...rest }) => rest)
      : [{ field: "", operator: "contains", value: "" }]
  );

  const addRow = () => setFilters((prev) => [...prev, { field: "", operator: "contains", value: "" }]);

  const removeRow = (idx) =>
    setFilters((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [{ field: "", operator: "contains", value: "" }] : next;
    });

  const update = (idx, patch) =>
    setFilters((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const handleApply = () => {
    const active = filters.filter((f) => f.field && f.value !== "");
    // Attach getValue from fields definition
    const enriched = active.map((f) => {
      const def = fields.find((fd) => fd.id === f.field);
      return { ...f, getValue: def?.getValue };
    });
    onApply(enriched);
  };

  const handleClear = () => {
    setFilters([{ field: "", operator: "contains", value: "" }]);
    onApply([]);
  };

  const activeCount = filters.filter((f) => f.field && f.value !== "").length;

  return (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" /> Quick Filters
        </span>
        {activeCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {activeCount} active
          </span>
        )}
      </div>

      <div className="space-y-2">
        {filters.map((f, idx) => (
          <div key={idx} className="space-y-1">
            {/* Field selector */}
            <Select
              value={f.field || "none"}
              onValueChange={(v) => update(idx, { field: v === "none" ? "" : v })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select field…" />
              </SelectTrigger>
              <SelectContent className="z-[99999]" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                 <SelectItem value="none">Select field…</SelectItem>
                 {fields.map((fd) => (
                   <SelectItem key={fd.id} value={fd.id}>{fd.label}</SelectItem>
                 ))}
               </SelectContent>
            </Select>

            {f.field && (
              <div className="flex gap-1.5 items-center">
                {/* Operator */}
                <Select
                  value={f.operator}
                  onValueChange={(v) => update(idx, { operator: v })}
                >
                  <SelectTrigger className="h-7 text-xs w-36 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[99999]" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                     {OPERATORS.map((op) => (
                       <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                     ))}
                   </SelectContent>
                </Select>

                {/* Value */}
                <Input
                  value={f.value}
                  onChange={(e) => update(idx, { value: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
                  placeholder="Value…"
                  className="h-7 text-xs flex-1"
                />

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {!f.field && filters.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="text-[10px] text-muted-foreground hover:text-destructive underline-offset-2 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="w-3 h-3" /> Add condition
      </button>

      <div className="flex gap-2 pt-1 border-t border-border">
        <Button size="sm" className="flex-1 h-7 text-xs gap-1.5" onClick={handleApply}>
          <Filter className="w-3 h-3" /> Apply
        </Button>
        {activeCount > 0 && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}