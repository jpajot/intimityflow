import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Ban } from "lucide-react";
import ComponentColorwayPicker from "./ComponentColorwayPicker.jsx";

/**
 * BOMVariantCellEditor
 * Renders a single cell in the BOM matrix for a given (line × column) intersection.
 *
 * Key invariant: only FKs for axes the BOMLine actually varies on are written.
 *   - varies_by_color  → product_color_id keyed cell, component_product_color_id set via picker
 *   - varies_by_size   → size_id keyed cell, quantity grading
 *   - varies_by_color_and_more → product_color_and_more_id keyed cell
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
  bomType,
  onUpsertVariant,
}) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  const isNA = variant?.is_not_applicable === true;

  // Build a payload that ONLY sets the FK for the current column axis.
  // All other axis FKs are explicitly null to avoid cross-axis contamination.
  const buildPayload = (overrides = {}) => {
    const base = { bom_line_id: line.id };

    // Set the column-axis FK — only if the line actually varies on that axis
    if (columnAxis === "color" && line.varies_by_color) {
      base.product_color_id = col.id;
      base.size_id = null;
      base.product_color_and_more_id = null;
    } else if (columnAxis === "size" && line.varies_by_size) {
      base.size_id = col.size_id || col.id;
      base.product_color_id = null;
      base.product_color_and_more_id = null;
    } else if (columnAxis === "color_and_more" && line.varies_by_color_and_more) {
      base.product_color_and_more_id = col.id;
      base.product_color_id = null;
      base.size_id = null;
    } else {
      // Axis mismatch with line's varies_by flags — do not write
      console.warn("BOMVariantCellEditor: axis/line flag mismatch, skipping write", { columnAxis, line });
      return null;
    }

    return { ...base, ...overrides };
  };

  const safeUpsert = (overrides = {}) => {
    const payload = buildPayload(overrides);
    if (payload) onUpsertVariant(payload);
  };

  const handleMarkNA = () => safeUpsert({ is_not_applicable: true, quantity: null });
  const handleClearNA = () => safeUpsert({ is_not_applicable: false });

  const handleQtyBlur = () => {
    const val = parseFloat(qty);
    if (!isNaN(val)) {
      safeUpsert({ quantity: val, is_not_applicable: false });
    }
    setEditing(false);
  };

  const handleQtyKeyDown = (e) => {
    if (e.key === "Enter") e.target.blur();
    if (e.key === "Escape") setEditing(false);
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

  // ── Color axis: colorway chip + picker ─────────────────────────────────────
  if (columnAxis === "color") {
    const compColorId = variant?.component_product_color_id;
    const compColor = compColorId ? allProductColors.find((pc) => pc.id === compColorId) : null;
    const cellQty = variant?.quantity;
    const baseQty = line.base_quantity;
    const isGraded = cellQty != null && cellQty !== baseQty;

    // Component product ID comes from the BOMLine
    const componentProductId = line.component_product_id;

    return (
      <div className="flex flex-col items-center gap-1 py-1 relative">
        {/* Color chip — click opens picker */}
        {!isReadOnly ? (
          <button
            ref={triggerRef}
            type="button"
            onClick={() => {
              if (!showPicker && triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                setPickerPos({
                  top: rect.bottom + window.scrollY + 6,
                  left: rect.left + window.scrollX + rect.width / 2,
                });
              }
              setShowPicker((v) => !v);
            }}
            className={`w-10 h-10 rounded-md border-2 flex items-center justify-center transition-colors hover:border-primary ${
              compColor ? "border-border" : "border-dashed border-muted-foreground/40 hover:border-primary/60"
            }`}
            style={{ backgroundColor: compColor?.color_hex || undefined }}
            title={compColor ? `Component: ${compColor.color_name}` : "Click to assign component colorway"}
          >
            {!compColor && <span className="text-[9px] text-muted-foreground text-center leading-tight px-0.5">—</span>}
          </button>
        ) : (
          <div
            className={`w-10 h-10 rounded-md border-2 flex items-center justify-center ${
              compColor ? "border-border" : "border-dashed border-muted-foreground/40"
            }`}
            style={{ backgroundColor: compColor?.color_hex || undefined }}
            title={compColor?.color_name || "No component colorway"}
          >
            {!compColor && <span className="text-[9px] text-muted-foreground text-center leading-tight px-0.5">—</span>}
          </div>
        )}

        {/* Quantity override */}
        {!isReadOnly ? (
          <Input
            type="number"
            className={`h-5 w-14 text-[10px] text-center px-1 ${isGraded ? "border-amber-400 text-amber-700 font-semibold" : ""}`}
            placeholder={baseQty != null ? String(baseQty) : "qty"}
            defaultValue={cellQty ?? ""}
            onBlur={(e) => {
              const val = parseFloat(e.target.value);
              safeUpsert({ quantity: isNaN(val) ? null : val });
            }}
          />
        ) : (
          cellQty != null && (
            <span className={`text-[10px] ${isGraded ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
              {isGraded ? `Δ ${cellQty}` : cellQty} {uom}
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

        {/* Component colorway picker — rendered in a portal to escape table overflow */}
        {showPicker && createPortal(
          <div
            className="fixed z-[9999]"
            style={{ top: pickerPos.top, left: pickerPos.left, transform: "translateX(-50%)" }}
          >
            <ComponentColorwayPicker
              componentProductId={componentProductId}
              bomType={bomType}
              currentColorId={compColorId}
              techColors={techColors}
              commColors={commColors}
              onSelect={(selectedColorId) => {
                safeUpsert({ component_product_color_id: selectedColorId, is_not_applicable: false });
                setShowPicker(false);
              }}
              onClear={() => {
                safeUpsert({ component_product_color_id: null });
                setShowPicker(false);
              }}
              onClose={() => setShowPicker(false)}
            />
          </div>,
          document.body
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