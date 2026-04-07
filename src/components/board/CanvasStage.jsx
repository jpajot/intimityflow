import { useState, useRef, useCallback } from "react";
import CanvasElement from "./CanvasElement";

const CANVAS_W = 1200;
const CANVAS_H = 675; // 16:9

export default function CanvasStage({ elements, onUpdateElements, onContextMenu }) {
  const [selectedId, setSelectedId] = useState(null);
  const containerRef = useRef(null);

  // Fit canvas to container
  const [scale, setScale] = useState(1);
  const outerRef = useRef(null);

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
    onUpdateElements(elements.map((el) => (el.id === id ? { ...el, ...changes } : el)));
  };

  const handleCanvasClick = (e) => {
    if (e.target === containerRef.current || e.target === outerRef.current) {
      setSelectedId(null);
    }
  };

  const selectedEl = elements.find((e) => e.id === selectedId) || null;

  return (
    <div
      ref={measureScale}
      className="flex-1 overflow-auto bg-muted/50 flex items-center justify-center"
      onClick={handleCanvasClick}
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
          ref={containerRef}
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            background: "white",
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {elements.map((el) => (
            <CanvasElement
              key={el.id}
              el={el}
              isSelected={el.id === selectedId}
              scale={scale}
              onSelect={setSelectedId}
              onUpdate={handleUpdate}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export { CANVAS_W, CANVAS_H };