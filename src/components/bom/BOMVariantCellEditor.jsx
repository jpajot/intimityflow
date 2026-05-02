import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Ban } from "lucide-react";

/**
 * BOMVariantCellEditor
 * Renders a single cell in the BOM matrix for a given (line × column) intersection.
 * Supports color-axis (colorway picker) and size/color_and_more axes (quantity input).
 */
export default function BOMVariantCellEditor({
  variant,
  line,
  col,
  columnAxis,
  uom,
  isReadOnly,
  allProductColors,
  techColors,
  commColors,
  projectId,
  bomType,
  onUpsertVariant,
}) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState("");

  const isNA = variant?.is_not_applicable === true;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const buildPayload = (overrides = {}) => {
    const base = { bom_line_id: line.id };
    if (columnAxis === "color") base.product_color_id = col.id;
    else if (columnAxis === "size") base.size_id = col.size_id || col.id;
    else if (columnAxis === "color_and_more") base.product_color_and_more_id = col.id;
    return { ...base, ...overrides };
  };

  const handleMarkNA = () => {
    onUpsertVariant(buildPayload({ is_not_applicable: true, quantity: null }));
  };

  const handleClearNA = () => {
    onUpsertVariant(buildPayload({ is_not_applicable: false }));
  };

  const handleQtyBlur = () => {
    const val = parseFloat(qty);
    if (!isNaN(val)) {
      onUpsertVariant(buildPayload({ quantity: val, is_not_applicable: false }));
    }
    setEditing(false);
  };

  const handleQtyKeyDown = (e) => {
    if (e.key === "Enter") e.target.blur();
    if (e.key === "Escape") { setEditing(false); }
  };

  // ── N/A cell ───────────────────────────────────────────────────────────────
  if (isNA) {
    const naStyle = {
      background: "repeating-linear-gradient(-45deg, #f3f4f6, #f3f4f6 2px, #e5e7eb 2px, #e5e7eb 4px)",
    };
    return (
      <div
        className="relative w-full min-h-[36px] rounded border border-border flex items-center justify-center group"
        style={naStyle}
        title={variant?.na_reason || "Not Applicable"}
      >
        <span className="text-[10px] text-muted-foreground font-medium select-none">N/A</span>
        {!isReadOnly && (
          <button
            type="button"
            onClick={handleClearNA}
            className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 flex items-center justify-center bg-background/70 rounded text-[10px] text-foreground transition-opacity"
          >
            Clear N/A
          </button>
        )}
      </div>
    );
  }

  // ── Color axis: colorway chip ──────────────────────────────────────────────
  if (columnAxis === "color") {
    const compColorId = variant?.component_product_color_id;
    const compColor = compColorId ? allProductColors.find((pc) => pc.id === compColorId) : null;
    const qty = variant?.quantity;
    const baseQty = line.base_quantity;
    const isGraded = qty != null && qty !== baseQty;

    return (
      <div className="flex flex-col items-center gap-1 py-1">
        {/* Color chip */}
        <div
          className={`w-10 h-10 rounded-md border-2 flex items-center justify-center relative ${
            compColor ? "border-border" : "border-dashed border-muted-foreground/40"
          }`}
          style={{ backgroundColor: compColor?.color_hex || undefined }}
          title={compColor?.color_name || "No component colorway assigned"}
        >
          {!compColor && <span className="text-[9px] text-muted-foreground text-center leading-tight px-0.5">—</span>}
        </div>

        {/* Quantity override */}
        {!isReadOnly ? (
          <Input
            type="number"
            className={`h-5 w-14 text-[10px] text-center px-1 ${isGraded ? "border-amber-400 text-amber-700 font-semibold" : ""}`}
            placeholder={baseQty != null ? String(baseQty) : "qty"}
            defaultValue={qty ?? ""}
            onBlur={(e) => {
              const val = parseFloat(e.target.value);
              onUpsertVariant(buildPayload({ quantity: isNaN(val) ? null : val }));
            }}
          />
        ) : (
          qty != null && (
            <span className={`text-[10px] ${isGraded ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
              {isGraded ? `Δ ${qty}` : qty} {uom}
            </span>
          )
        )}

        {/* NA button */}
        {!isReadOnly && (
          <button
            type="button"
            onClick={handleMarkNA}
            className="text-[9px] text-muted-foreground/50 hover:text-destructive transition-colors"
            title="Mark as N/A"
          >
            <Ban className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  // ── Size / color_and_more axis: quantity cell ──────────────────────────────
  const cellQty = variant?.quantity;
  const baseQty = line.base_quantity;
  const isGraded = cellQty != null && cellQty !== baseQty;

  if (isReadOnly) {
    return (
      <div className="flex items-center justify-center min-h-[36px]">
        <span className={`text-xs ${isGraded ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
          {cellQty != null ? (isGraded ? `Δ ${cellQty}` : cellQty) : (baseQty ?? "—")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 py-1">
      {editing ? (
        <Input
          type="number"
          autoFocus
          className={`h-6 w-16 text-xs text-center ${isGraded ? "border-amber-400" : ""}`}
          defaultValue={cellQty ?? baseQty ?? ""}
          onChange={(e) => setQty(e.target.value)}
          onBlur={handleQtyBlur}
          onKeyDown={handleQtyKeyDown}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setQty(String(cellQty ?? baseQty ?? "")); setEditing(true); }}
          className={`w-16 h-6 rounded border text-xs text-center transition-colors hover:border-primary hover:bg-primary/5 ${
            isGraded ? "border-amber-300 bg-amber-50 text-amber-700 font-semibold" : "border-border bg-transparent text-muted-foreground"
          }`}
        >
          {cellQty != null ? (isGraded ? `Δ ${cellQty}` : cellQty) : (baseQty != null ? baseQty : "—")}
        </button>
      )}
      <button
        type="button"
        onClick={handleMarkNA}
        className="text-[9px] text-muted-foreground/50 hover:text-destructive transition-colors"
        title="Mark as N/A"
      >
        <Ban className="w-3 h-3" />
      </button>
    </div>
  );
}