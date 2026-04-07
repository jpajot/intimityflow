import { useEffect, useRef } from "react";
import { Trash2, Link2, ExternalLink, Plus, BoxSelect, Maximize2 } from "lucide-react";

export default function BoardContextMenu({ x, y, element, selectedIds = [], elements = [], onClose, onDelete, onLink, onEditLinked, onCreateProduct, onGroup, onUngroup }) {
  const ref = useRef(null);
  const isGroup = element?.type === "group";
  const multiSelected = selectedIds.length > 1;
  const hasLinked = !!element?.linkedEntityId;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const items = [
    !isGroup && { label: "Link to existing entity", icon: Link2, action: onLink },
    hasLinked && { label: "Open / edit linked record", icon: ExternalLink, action: onEditLinked },
    !hasLinked && { label: "Create product from this", icon: Plus, action: onCreateProduct },
    multiSelected && !isGroup && { label: `Group ${selectedIds.length} elements`, icon: BoxSelect, action: onGroup },
    isGroup && { label: "Ungroup", icon: Maximize2, action: onUngroup },
    null,
    { label: isGroup ? "Delete group" : "Delete element", icon: Trash2, action: onDelete, danger: true },
  ].filter(Boolean);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: x, top: y, zIndex: 1000 }}
      className="bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[210px]"
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} className="my-1 border-t border-border" />
        ) : (
          <button
            key={i}
            type="button"
            onClick={item.action}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-muted ${
              item.danger ? "text-destructive hover:bg-destructive/10" : "text-foreground"
            }`}
          >
            <item.icon className="w-3.5 h-3.5 shrink-0" />
            {item.label}
          </button>
        )
      )}
    </div>
  );
}