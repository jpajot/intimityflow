import { useState, useRef, useCallback, useEffect } from "react";
import CanvasElement from "./CanvasElement";

const CANVAS_W = 1200;
const CANVAS_H = 675; // 16:9

export default function CanvasStage({ elements, onUpdateElements, onContextMenu }) {
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
      if (ctrlHeld) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  };

  const handleCanvasMouseDown = (e) => {
    // Only deselect if clicking directly on the canvas background (not on a child element)
    if (e.target === e.currentTarget) {
      setSelectedIds(new Set());
    }
  };

  const handleContextMenu = (e, element) => {
    e.preventDefault();
    // If multiple selected, pass all ids
    const ids = selectedIds.has(element.id) ? [...selectedIds] : [element.id];
    if (!selectedIds.has(element.id)) setSelectedIds(new Set([element.id]));
    onContextMenu(e, element, ids);
  };

  return (
    <div
      ref={measureScale}
      className="flex-1 overflow-auto bg-muted/50 flex items-center justify-center"
      onMouseDown={handleCanvasMouseDown}
    >
      <div
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
          {elements.map((el) => (
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