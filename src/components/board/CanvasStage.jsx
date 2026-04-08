import { useState, useRef, useCallback, useEffect } from "react";
import CanvasElement from "./CanvasElement";

const CANVAS_W = 1200;
const CANVAS_H = 675; // 16:9

export default function CanvasStage({ elements, onUpdateElements, onContextMenu, onDropProductCard, onSelectionChange }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const outerRef = useRef(null);
  const [scale, setScale] = useState(1);

  const measureScale = useCallback((node) => {
    if (!node) return;
    outerRef.current = node;
    const ro = new ResizeObserver(() => {
      const { width, height } = node.getBoundingClientRect();
      const s = Math.min((width - 40) / CANVAS_W, (height - 40) / CANVAS_H);
      setScale(Math.max(0.2, s));
    });
    ro.observe(node);
  }, []);

  const handleUpdate = (id, changes) => {
    const el = elements.find((e) => e.id === id);
    // If moving a group, also move all child elements by the same delta
    if (el?.type === "group" && changes.x !== undefined && changes.y !== undefined) {
      const dx = changes.x - el.x;
      const dy = changes.y - el.y;
      onUpdateElements(
        elements.map((e) => {
          if (e.id === id) return { ...e, ...changes };
          if (el.childIds?.includes(e.id)) return { ...e, x: e.x + dx, y: e.y + dy };
          return e;
        })
      );
    } else {
      onUpdateElements(elements.map((e) => (e.id === id ? { ...e, ...changes } : e)));
    }
  };

  const handleSelect = (id, ctrlHeld) => {
    setSelectedIds((prev) => {
      const next = ctrlHeld
        ? (() => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; })()
        : new Set([id]);
      const arr = [...next];
      onSelectionChange?.(arr.length === 1 ? arr[0] : null, arr);
      return next;
    });
  };

  const handleCanvasMouseDown = (e) => {
    // Deselect when clicking on the outer container or directly on the white slide
    const isOuterBg = e.target === e.currentTarget;
    const isSlide = e.target.hasAttribute && e.target.hasAttribute('data-board-slide');
    if (isOuterBg || isSlide) {
      setSelectedIds(new Set());
      onSelectionChange?.(null, []);
    }
  };

  const handleContextMenu = (e, element) => {
    e.preventDefault();
    const ids = selectedIds.has(element.id) ? [...selectedIds] : [element.id];
    if (!selectedIds.has(element.id)) setSelectedIds(new Set([element.id]));
    onContextMenu(e, element, ids);
  };

  const handleDragOver = (e) => {
    if (e.dataTransfer.types.includes("application/product-card")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = (e) => {
    const raw = e.dataTransfer.getData("application/product-card");
    if (!raw) return;
    const data = JSON.parse(raw);
    // Convert client coords to canvas coords
    const outerRect = outerRef.current?.getBoundingClientRect();
    const canvasW = CANVAS_W * scale;
    const canvasH = CANVAS_H * scale;
    const offsetX = outerRect ? (outerRect.width - canvasW) / 2 : 0;
    const offsetY = outerRect ? (outerRect.height - canvasH) / 2 : 0;
    const x = (e.clientX - (outerRect?.left || 0) - offsetX) / scale;
    const y = (e.clientY - (outerRect?.top || 0) - offsetY) / scale;
    onDropProductCard({ ...data, x: Math.max(0, x - 100), y: Math.max(0, y - 120) });
  };

  return (
    <div
      ref={measureScale}
      className="flex-1 overflow-auto bg-muted/50 flex items-center justify-center"
      onMouseDown={handleCanvasMouseDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        data-scale-wrapper
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {/* White slide */}
        <div
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            background: "white",
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            position: "relative",
            overflow: "hidden",
          }}
          data-board-slide
        >
          {[...elements].sort((a, b) => a.type === "group" ? -1 : 1).map((el) => (
            <CanvasElement
              key={el.id}
              el={el}
              isSelected={selectedIds.has(el.id)}
              scale={scale}
              onSelect={handleSelect}
              onUpdate={handleUpdate}
              onContextMenu={handleContextMenu}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export { CANVAS_W, CANVAS_H };