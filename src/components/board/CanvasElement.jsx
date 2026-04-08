import { useRef, useState } from "react";
import { Link2 } from "lucide-react";

const HANDLE_SIZE = 8;

export default function CanvasElement({ el, isSelected, scale, isGrouped, onSelect, onUpdate, onContextMenu }) {
  const dragStart = useRef(null);
  const resizeStart = useRef(null);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(el.id, e.ctrlKey || e.metaKey);
    if (isGrouped) return; // don't drag grouped children
    dragStart.current = { mx: e.clientX, my: e.clientY, x: el.x, y: el.y };
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
    resizeStart.current = { mx: e.clientX, my: e.clientY, x: el.x, y: el.y, w: el.width, h: el.height, corner };
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
    // Shift = lock aspect ratio
    if (e.shiftKey) {
      const ratio = w / h;
      if (corner === "se" || corner === "sw") { nh = nw / ratio; }
      else if (corner === "ne") { nw = nh * ratio; nx = x + w - nw; }
      else if (corner === "nw") { nh = nw / ratio; ny = y + h - nh; }
    }
    onUpdate(el.id, { x: nx, y: ny, width: nw, height: nh });
  };

  const onResizeUp = () => {
    resizeStart.current = null;
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", onResizeUp);
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    // inline editing handled inside TextContent / RectContent
  };

  return (
    <div
      style={{
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
        cursor: isGrouped ? "default" : "move",
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, el); }}
    >
      <ElementContent el={el} onUpdate={onUpdate} />

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
                width: HANDLE_SIZE, height: HANDLE_SIZE,
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

function ElementContent({ el, onUpdate }) {
  const fileRef = useRef(null);

  const handleImageClick = () => {
    if (!el.content) fileRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44Import(file);
    onUpdate(el.id, { content: file_url });
  };

  if (el.type === "image") {
    return (
      <>
        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {el.content ? (
          <img src={el.content} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} draggable={false} />
        ) : (
          <div
            className="w-full h-full border-2 border-dashed border-border rounded bg-muted/40 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground cursor-pointer hover:bg-muted/60 transition-colors"
            onClick={handleImageClick}
          >
            <span className="text-2xl">🖼</span>
            <span>Click to upload image</span>
          </div>
        )}
      </>
    );
  }

  if (el.type === "text") {
    return <TextContent el={el} onUpdate={onUpdate} />;
  }

  if (el.type === "rect") {
    return <RectContent el={el} onUpdate={onUpdate} />;
  }

  if (el.type === "product_card") {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'transparent', overflow: 'hidden' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'transparent' }}>
          {el.linkedImageUrl ? (
            <img src={el.linkedImageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} draggable={false} />
          ) : el.linkedHex ? (
            <div style={{ width: '100%', height: '100%', backgroundColor: el.linkedHex }} />
          ) : (
            <div className="text-xs text-muted-foreground text-center px-2">
              <Link2 className="w-4 h-4 mx-auto mb-1 opacity-40" />
              {el.linkedEntityId ? "Linked" : "Right-click to link"}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, padding: '6px 8px 10px 8px', borderTop: '1px solid hsl(var(--border))', backgroundColor: 'rgba(255,255,255,0.8)' }}>
          <p style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.6' }}>{el.linkedName || el.content || "Product Card"}</p>
          {el.linkedCode && <p style={{ fontSize: '10px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.6', color: 'hsl(var(--muted-foreground))' }}>{el.linkedCode}</p>}
        </div>
      </div>
    );
  }

  if (el.type === "group") {
    return <div className="w-full h-full rounded" />;
  }

  return null;
}

function TextContent({ el, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef(null);

  const DEFAULT_TEXT = "Text block";

  const startEdit = () => {
    if (el.content === DEFAULT_TEXT) onUpdate(el.id, { content: "" });
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const stopEdit = () => setEditing(false);

  return (
    <div
      className="w-full h-full overflow-hidden flex flex-col"
      style={{
        padding: editing ? 0 : 6,
        justifyContent: el.style?.verticalAlign === "bottom" ? "flex-end" : el.style?.verticalAlign === "middle" ? "center" : "flex-start",
      }}
      onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          value={el.content || ""}
          onChange={(e) => onUpdate(el.id, { content: e.target.value })}
          onBlur={stopEdit}
          onKeyDown={(e) => { if (e.key === "Escape") stopEdit(); e.stopPropagation(); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full h-full bg-transparent resize-none outline-none p-1.5"
          style={{
            fontSize: el.style?.fontSize || 14,
            fontWeight: el.style?.bold ? "bold" : "normal",
            fontStyle: el.style?.italic ? "italic" : "normal",
            textDecoration: [el.style?.underline && "underline", el.style?.strikethrough && "line-through"].filter(Boolean).join(" ") || "none",
            color: el.style?.color || "inherit",
            textAlign: el.style?.align || "left",
            lineHeight: 1.4,
          }}
        />
      ) : (
        <div
          style={{
            fontSize: el.style?.fontSize || 14,
            fontWeight: el.style?.bold ? "bold" : "normal",
            fontStyle: el.style?.italic ? "italic" : "normal",
            textDecoration: [el.style?.underline && "underline", el.style?.strikethrough && "line-through"].filter(Boolean).join(" ") || "none",
            color: el.style?.color || "inherit",
            textAlign: el.style?.align || "left",
            lineHeight: 1.4,
          }}
        >
          {el.content || <span className="text-muted-foreground italic text-xs">Double-click to edit</span>}
        </div>
      )}
    </div>
  );
}

function RectContent({ el, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef(null);

  const startEdit = () => {
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const stopEdit = () => setEditing(false);

  return (
    <div
      className="w-full h-full relative flex"
      style={{
        backgroundColor: el.style?.fill || "hsl(var(--muted))",
        border: `${el.style?.borderWidth ?? 1}px ${el.style?.borderStyle || "solid"} ${el.style?.borderColor || "hsl(var(--border))"}`,
        borderRadius: el.style?.radius ?? 4,
        opacity: el.style?.opacity !== undefined ? el.style.opacity / 100 : 1,
        alignItems: el.style?.textVerticalAlign === "top" ? "flex-start" : el.style?.textVerticalAlign === "bottom" ? "flex-end" : "center",
        justifyContent: el.style?.textAlign === "right" ? "flex-end" : el.style?.textAlign === "center" ? "center" : "flex-start",
      }}
      onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          value={el.style?.text || ""}
          onChange={(e) => onUpdate(el.id, { style: { ...el.style, text: e.target.value } })}
          onBlur={stopEdit}
          onKeyDown={(e) => { if (e.key === "Escape") stopEdit(); e.stopPropagation(); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full h-full bg-transparent resize-none outline-none p-2"
          style={{
            fontSize: el.style?.fontSize || 14,
            color: el.style?.color || "inherit",
            borderRadius: el.style?.radius || 4,
            fontWeight: el.style?.bold ? "bold" : "normal",
            fontStyle: el.style?.italic ? "italic" : "normal",
            textDecoration: [el.style?.underline && "underline", el.style?.strikethrough && "line-through"].filter(Boolean).join(" ") || "none",
            textAlign: el.style?.textAlign || "left",
          }}
        />
      ) : (
        el.style?.text && (
          <p
            className="px-2 w-full break-words pointer-events-none select-none"
            style={{
              fontSize: el.style?.fontSize || 14,
              color: el.style?.color || "inherit",
              fontWeight: el.style?.bold ? "bold" : "normal",
              fontStyle: el.style?.italic ? "italic" : "normal",
              textDecoration: [el.style?.underline && "underline", el.style?.strikethrough && "line-through"].filter(Boolean).join(" ") || "none",
              textAlign: el.style?.textAlign || "left",
            }}
          >
            {el.style.text}
          </p>
        )
      )}
    </div>
  );
}

// Lazy import base44 to avoid circular issues inside ElementContent
async function base44Import(file) {
  const { base44 } = await import("@/api/base44Client");
  return base44.integrations.Core.UploadFile({ file });
}