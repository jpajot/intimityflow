import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X } from "lucide-react";

/**
 * Popover picker for selecting a component's ApprovedSupplier for a Supplier matrix cell.
 *
 * Props:
 *   componentProductId  - the component product whose approved suppliers to list
 *   currentApprovedSupplierId - currently selected component ApprovedSupplier.id (or null)
 *   onSelect(approvedSupplierId) - called with the ApprovedSupplier.id chosen
 *   onReset()           - called to clear the override (revert to row default)
 *   onClose()           - called to close without changes
 */
export default function ComponentSupplierPicker({
  componentProductId,
  currentApprovedSupplierId,
  onSelect,
  onReset,
  onClose,
}) {
  const [approvedSuppliers, setApprovedSuppliers] = useState([]);
  const [supplierMap, setSupplierMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(currentApprovedSupplierId || null);

  useEffect(() => {
    if (!componentProductId) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      const asList = await base44.entities.ApprovedSupplier.filter({
        product_id: componentProductId,
        status: "active",
      });
      const sorted = asList.sort((a, b) => (a.rank || 99) - (b.rank || 99));
      if (cancelled) return;
      const ids = [...new Set(sorted.map((a) => a.supplier_id).filter(Boolean))];
      const sups = await Promise.all(
        ids.map((sid) => base44.entities.Supplier.filter({ id: sid }).then((r) => r[0]).catch(() => null))
      );
      if (cancelled) return;
      const map = {};
      sups.filter(Boolean).forEach((s) => { map[s.id] = s; });
      setApprovedSuppliers(sorted);
      setSupplierMap(map);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [componentProductId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return approvedSuppliers;
    const q = search.toLowerCase();
    return approvedSuppliers.filter((as) => {
      const sup = supplierMap[as.supplier_id];
      return (
        sup?.name?.toLowerCase().includes(q) ||
        sup?.code?.toLowerCase().includes(q) ||
        as.supplier_reference?.toLowerCase().includes(q)
      );
    });
  }, [approvedSuppliers, supplierMap, search]);

  return (
    <div className="w-72 bg-popover border border-border rounded-xl shadow-xl flex flex-col overflow-hidden max-h-[380px]">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">Pick Component Supplier</p>
          <button type="button" onClick={onClose} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="h-7 text-xs pl-7"
            autoFocus
          />
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {approvedSuppliers.length === 0
              ? "No active suppliers approved for this component. Add suppliers in the Product's Suppliers tab."
              : "No suppliers match your search."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((as) => {
              const sup = supplierMap[as.supplier_id];
              const isSelected = selected === as.id;
              const cost = as.unit_cost != null ? `${as.unit_cost} ${as.currency || ""}`.trim() : null;
              const lt = as.lead_time_days != null ? `${as.lead_time_days}d` : null;
              return (
                <button
                  key={as.id}
                  type="button"
                  onClick={() => setSelected(isSelected ? null : as.id)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50 ${isSelected ? "bg-primary/10" : ""}`}
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium truncate">{sup?.name || as.supplier_id}</span>
                      {as.is_primary ? (
                        <span className="text-[9px] px-1 py-0 rounded bg-primary/10 text-primary font-medium border border-primary/20">Primary</span>
                      ) : (
                        <span className="text-[9px] px-1 py-0 rounded bg-muted text-muted-foreground border border-border">Alt {as.rank}</span>
                      )}
                      {sup?.country && <span className="text-[9px] text-muted-foreground">{sup.country}</span>}
                    </div>
                    {as.supplier_reference && (
                      <div className="font-mono text-[10px] text-muted-foreground">{as.supplier_reference}</div>
                    )}
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      {cost && <span>{cost}</span>}
                      {lt && <span>{lt} lead</span>}
                    </div>
                  </div>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
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
        {currentApprovedSupplierId && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onReset}>
            Reset to default
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}