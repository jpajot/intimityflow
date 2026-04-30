import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function BOMVariantCellEditor({
  variant, line, col, uom, isReadOnly, isEditing, onEdit, onSave, onCancel,
}) {
  const [draft, setDraft] = useState("");
  const effectiveQty = variant?.quantity ?? line.base_quantity;
  const hasOverride = variant && variant.quantity != null;
  const isMissing = !variant && (line.varies_by_color || line.varies_by_size || line.varies_by_color_and_more);

  const startEdit = () => {
    if (isReadOnly) return;
    setDraft(String(effectiveQty ?? ""));
    onEdit();
  };

  const commit = () => {
    const val = parseFloat(draft);
    if (!isNaN(val)) onSave(val);
    else onCancel();
  };

  if (isEditing) {
    return (
      <Input
        autoFocus
        type="number"
        className="h-6 w-14 text-xs text-center mx-auto"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onCancel(); }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className={`w-full min-w-[60px] px-1.5 py-1 rounded text-xs transition-colors
        ${isMissing ? "border border-destructive/40 bg-destructive/5 text-destructive" :
          hasOverride ? "bg-white border border-border text-foreground font-medium" :
          "text-muted-foreground hover:bg-muted/50"}
        ${isReadOnly ? "cursor-default" : "cursor-text hover:border-primary/40"}`}
      title={hasOverride ? "Override value" : isMissing ? "Variant missing" : "Inherits from base quantity"}
    >
      {isMissing && !effectiveQty ? (
        <span className="text-[9px] text-destructive/60">—</span>
      ) : (
        <span>
          {effectiveQty ?? "—"}
          {uom && <span className="text-[9px] text-muted-foreground ml-0.5"> {uom}</span>}
        </span>
      )}
    </button>
  );
}