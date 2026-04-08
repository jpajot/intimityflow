import { useEffect, useRef } from "react";
import { Trash2, Plus } from "lucide-react";

export default function ElementFormatPanel({ x, y, element, onClose, onDelete, onCreateProduct }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const panelW = 220;
  const left = Math.min(x, window.innerWidth - panelW - 8);
  const top = Math.min(y, window.innerHeight - 120);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left, top, zIndex: 1000, width: panelW }}
      className="bg-popover border border-border rounded-lg shadow-xl py-1 overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {onCreateProduct && (
        <button
          type="button"
          onClick={onCreateProduct}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          Create product from this
        </button>
      )}
      {onCreateProduct && <div className="mx-3 border-t border-border" />}
      <button
        type="button"
        onClick={onDelete}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5 shrink-0" />
        Delete element
      </button>
    </div>
  );
}