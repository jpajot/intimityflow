import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Check, X, Loader2 } from "lucide-react";

/**
 * ComponentSizePicker
 * Popover for picking a component size for the size_mapping axis.
 * Lists the component product's active StyleSize records.
 */
export default function ComponentSizePicker({
  componentProductId,
  currentSizeId,      // currently resolved component_size_id (or baseSizeId if inherited)
  baseSizeId,         // base_component_size_id from the BOMLine
  allSizes,
  onSelect,           // (sizeId) => void
  onClear,            // () => void — resets to base
  onClose,
}) {
  const [compSizes, setCompSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const ss = await base44.entities.StyleSize.filter({ product_id: componentProductId });
      if (!cancelled) {
        setCompSizes(ss.filter((s) => s.active !== false));
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [componentProductId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const getSizeName = (sizeId) => {
    const s = allSizes.find((sz) => sz.id === sizeId);
    return s ? (s.name || s.size_code || sizeId) : sizeId;
  };

  const getSizeCode = (sizeId) => {
    const s = allSizes.find((sz) => sz.id === sizeId);
    return s?.size_code || "";
  };

  return (
    <div
      ref={ref}
      className="bg-popover border border-border rounded-lg shadow-xl w-52 overflow-hidden"
      style={{ maxHeight: 280 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
        <span className="text-xs font-semibold text-foreground">Pick component size</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Size list */}
      <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : compSizes.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">No sizes found for this component.</p>
        ) : (
          compSizes.map((ss) => {
            const isActive = ss.size_id === currentSizeId;
            const isBase = ss.size_id === baseSizeId;
            return (
              <button
                key={ss.size_id}
                type="button"
                onClick={() => onSelect(ss.size_id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left
                  ${isActive ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="font-medium">{getSizeName(ss.size_id)}</span>
                  {getSizeCode(ss.size_id) && (
                    <span className="text-muted-foreground text-[10px]">{getSizeCode(ss.size_id)}</span>
                  )}
                  {isBase && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-500">base</span>
                  )}
                </span>
                {isActive && <Check className="w-3 h-3 shrink-0" />}
              </button>
            );
          })
        )}
      </div>

      {/* Footer: reset */}
      {!loading && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={onClear}
            className="w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left"
          >
            Reset to base size
          </button>
        </div>
      )}
    </div>
  );
}