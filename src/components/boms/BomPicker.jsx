import { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Search, ChevronDown, X, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const STATUS_BADGE = {
  released: "bg-green-100 text-green-700 border-green-300",
  draft: "bg-slate-100 text-slate-600 border-slate-300",
  in_review: "bg-blue-100 text-blue-700 border-blue-300",
  superseded: "bg-purple-100 text-purple-600 border-purple-300",
  obsolete: "bg-red-100 text-red-600 border-red-300",
};

function statusOrder(status) {
  if (status === "released") return 0;
  if (status === "in_review") return 1;
  if (status === "draft") return 2;
  if (status === "superseded") return 3;
  return 4;
}

export default function BomPicker({ label, value, onChange, allBoms, allProducts, loading }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showHistorical, setShowHistorical] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const productMap = useMemo(() => {
    const m = {};
    allProducts.forEach(p => { m[p.id] = p; });
    return m;
  }, [allProducts]);

  const filteredBoms = useMemo(() => {
    const activeStatuses = ["released", "draft", "in_review"];
    const allowed = showHistorical ? [...activeStatuses, "superseded"] : activeStatuses;
    const q = search.toLowerCase();
    return allBoms
      .filter(b => allowed.includes(b.status))
      .filter(b => {
        if (!q) return true;
        const prod = productMap[b.product_id];
        const name = prod ? `${prod.code || ""} ${prod.name}`.toLowerCase() : "";
        return name.includes(q) || (b.revision_code || "").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const so = statusOrder(a.status) - statusOrder(b.status);
        if (so !== 0) return so;
        const da = new Date(a.released_at || a.created_date || 0);
        const db = new Date(b.released_at || b.created_date || 0);
        return db - da;
      });
  }, [allBoms, allProducts, search, showHistorical, productMap]);

  const selected = value ? allBoms.find(b => b.id === value) : null;
  const selectedProduct = selected ? productMap[selected.product_id] : null;

  const handleSelect = (bom) => {
    onChange(bom.id);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors
          ${open ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-muted-foreground/40"}
          bg-background`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
        ) : (
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div>
              <p className="text-sm font-medium text-foreground truncate">
                {selectedProduct ? `${selectedProduct.code || ""} ${selectedProduct.name}`.trim() : selected.product_id}
              </p>
              <p className="text-xs text-muted-foreground">
                Rev {selected.revision_code} · v{selected.version} · {selected.bom_type}
              </p>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">{label}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selected && (
            <button type="button" onClick={handleClear}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search product, revision…"
                className="w-full pl-7 pr-3 py-1.5 text-sm bg-muted/30 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredBoms.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">No BOMs found.</p>
            ) : filteredBoms.map(bom => {
              const prod = productMap[bom.product_id];
              const isSelected = bom.id === value;
              return (
                <button
                  key={bom.id}
                  type="button"
                  onClick={() => handleSelect(bom)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                    ${isSelected ? "bg-primary/10" : "hover:bg-muted/50"}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {prod ? `${prod.code || ""} ${prod.name}`.trim() : bom.product_id}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Rev {bom.revision_code} · v{bom.version} · {bom.bom_type}
                      {bom.released_at ? ` · ${new Date(bom.released_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${STATUS_BADGE[bom.status] || "bg-muted text-muted-foreground border-border"}`}>
                    {bom.status}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Toggle historical */}
          <div className="border-t border-border px-3 py-2 flex items-center justify-between">
            <label className="text-[11px] text-muted-foreground cursor-pointer">Show historical BOMs</label>
            <Switch checked={showHistorical} onCheckedChange={setShowHistorical} className="scale-75 origin-right" />
          </div>
        </div>
      )}
    </div>
  );
}