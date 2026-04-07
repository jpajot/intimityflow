import { useState, useRef, useEffect } from "react";
import { Link2, Edit2 } from "lucide-react";

const HANDLE_SIZE = 8;

export default function CanvasElement({ el, isSelected, scale, onSelect, onUpdate, onContextMenu }) {
  const ref = useRef(null);
  const dragStart = useRef(null);
  const resizeStart = useRef(null);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(el.id);
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      x: el.x,
      y: el.y,
    };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragUp);
  };

  const onDragMove = (e) => {
    if (!dragStart.current) return;
    const dx = (e.clientX - dragStart.current.mx) / scale;
    const dy = (e.clientY - dragStart.current.my) / scale;
    onUpdate(el.id, { x: dragStart.current.x + dx, y: dragStart.current.y + dy });
  };

  const onDragUp = () => {
    dragStart.current = null;
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragUp);
  };

  const handleResizeDown = (e, corner) => {
    e.stopPropagation();
    e.preventDefault();
    resizeStart.current = {
      mx: e.clientX,
      my: e.clientY,
      x: el.x, y: el.y,
      w: el.width, h: el.height,
      corner,
    };
    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeUp);
  };

  const onResizeMove = (e) => {
    if (!resizeStart.current) return;
    const { mx, my, x, y, w, h, corner } = resizeStart.current;
    const dx = (e.clientX - mx) / scale;
    const dy = (e.clientY - my) / scale;
    let nx = x, ny = y, nw = w, nh = h;
    if (corner === "se") { nw = Math.max(60, w + dx); nh = Math.max(30, h + dy); }
    else if (corner === "sw") { nx = x + dx; nw = Math.max(60, w - dx); nh = Math.max(30, h + dy); }
    else if (corner === "ne") { ny = y + dy; nw = Math.max(60, w + dx); nh = Math.max(30, h - dy); }
    else if (corner === "nw") { nx = x + dx; ny = y + dy; nw = Math.max(60, w - dx); nh = Math.max(30, h - dy); }
    onUpdate(el.id, { x: nx, y: ny, width: nw, height: nh });
  };

  const onResizeUp = () => {
    resizeStart.current = null;
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", onResizeUp);
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (el.type === "text") {
      const newText = prompt("Edit text:", el.content || "");
      if (newText !== null) onUpdate(el.id, { content: newText });
    }
  };

  const style = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    cursor: "move",
    userSelect: "none",
    boxSizing: "border-box",
    outline: isSelected ? "2px solid hsl(var(--primary))" : "none",
    outlineOffset: "1px",
  };

  return (
    <div
      ref={ref}
      style={style}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(el.id); onContextMenu(e, el); }}
    >
      <ElementContent el={el} />

      {/* Resize handles */}
      {isSelected && (
        <>
          {[["nw", 0, 0], ["ne", "100%", 0], ["sw", 0, "100%"], ["se", "100%", "100%"]].map(([corner, l, t]) => (
            <div
              key={corner}
              onMouseDown={(e) => handleResizeDown(e, corner)}
              style={{
                position: "absolute",
                left: typeof l === "number" ? l - HANDLE_SIZE / 2 : undefined,
                right: l === "100%" ? -HANDLE_SIZE / 2 : undefined,
                top: typeof t === "number" ? t - HANDLE_SIZE / 2 : undefined,
                bottom: t === "100%" ? -HANDLE_SIZE / 2 : undefined,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: "hsl(var(--primary))",
                border: "1.5px solid white",
                borderRadius: 2,
                cursor: `${corner}-resize`,
                zIndex: 10,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

function ElementContent({ el }) {
  if (el.type === "image") {
    return el.content ? (
      <img src={el.content} alt="" className="w-full h-full object-contain" draggable={false} />
    ) : (
      <div className="w-full h-full border-2 border-dashed border-border rounded bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
        Double-click to set URL
      </div>
    );
  }

  if (el.type === "text") {
    return (
      <div
        className="w-full h-full overflow-hidden"
        style={{
          fontSize: el.style?.fontSize || 14,
          fontWeight: el.style?.bold ? "bold" : "normal",
          color: el.style?.color || "inherit",
          textAlign: el.style?.align || "left",
          padding: 6,
          lineHeight: 1.4,
        }}
      >
        {el.content || <span className="text-muted-foreground italic text-xs">Double-click to edit</span>}
      </div>
    );
  }

  if (el.type === "rect") {
    return (
      <div
        className="w-full h-full rounded"
        style={{
          backgroundColor: el.style?.fill || "hsl(var(--muted))",
          border: `${el.style?.borderWidth || 1}px solid ${el.style?.borderColor || "hsl(var(--border))"}`,
          borderRadius: el.style?.radius || 4,
        }}
      />
    );
  }

  if (el.type === "product_card") {
    return (
      <div className="w-full h-full border border-border rounded-lg bg-card flex flex-col overflow-hidden">
        <div className="flex-1 bg-muted/40 flex items-center justify-center">
          {el.linkedImageUrl ? (
            <img src={el.linkedImageUrl} alt="" className="w-full h-full object-contain" draggable={false} />
          ) : (
            <div className="text-xs text-muted-foreground text-center px-2">
              <Link2 className="w-4 h-4 mx-auto mb-1 opacity-40" />
              {el.linkedEntityId ? "Linked" : "Right-click to link"}
            </div>
          )}
        </div>
        <div className="px-2 py-1.5 border-t border-border shrink-0">
          <p className="text-xs font-medium truncate">{el.linkedName || el.content || "Product Card"}</p>
          {el.linkedCode && <p className="text-[10px] text-muted-foreground font-mono truncate">{el.linkedCode}</p>}
        </div>
      </div>
    );
  }

  return null;
}