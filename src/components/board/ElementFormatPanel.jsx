import { useEffect, useRef } from "react";
import { Trash2, AlignLeft, AlignCenter, AlignRight, Bold, Type } from "lucide-react";

// Text style presets
const TEXT_PRESETS = [
  { label: "Title 1", fontSize: 32, bold: true },
  { label: "Title 2", fontSize: 24, bold: true },
  { label: "Title 3", fontSize: 18, bold: true },
  { label: "Body", fontSize: 14, bold: false },
  { label: "Caption", fontSize: 11, bold: false },
];

const BORDER_STYLES = ["solid", "dashed", "dotted"];

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground shrink-0 w-20">{label}</span>
      <div className="flex items-center gap-1 flex-1 justify-end">{children}</div>
    </div>
  );
}

function ColorInput({ value, onChange }) {
  return (
    <div className="relative w-7 h-7 rounded border border-border overflow-hidden cursor-pointer shrink-0">
      <div className="absolute inset-0" style={{ backgroundColor: value || "#ffffff" }} />
      <input
        type="color"
        value={value || "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </div>
  );
}

function NumberInput({ value, onChange, min = 1, max = 100, step = 1 }) {
  return (
    <input
      type="number"
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min} max={max} step={step}
      className="w-14 h-6 text-xs text-center border border-border rounded bg-background px-1 outline-none focus:ring-1 focus:ring-ring"
    />
  );
}

function IconBtn({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-6 h-6 rounded flex items-center justify-center transition-colors text-xs ${
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ── Text formatting panel ────────────────────────────────────────────────────
function TextFormatSection({ el, onUpdate }) {
  const s = el.style || {};

  const set = (key, val) => onUpdate(el.id, { style: { ...s, [key]: val } });

  return (
    <>
      {/* Text presets */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Text Style</p>
        <div className="flex flex-wrap gap-1">
          {TEXT_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onUpdate(el.id, { style: { ...s, fontSize: p.fontSize, bold: p.bold } })}
              className={`px-2 py-0.5 rounded border text-[11px] transition-colors ${
                s.fontSize === p.fontSize && !!s.bold === p.bold
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-3 border-t border-border/50" />

      {/* Font size */}
      <Row label="Font size">
        <NumberInput value={s.fontSize || 14} onChange={(v) => set("fontSize", v)} min={8} max={120} />
      </Row>

      {/* Alignment */}
      <Row label="Alignment">
        <IconBtn active={!s.align || s.align === "left"} onClick={() => set("align", "left")} title="Left">
          <AlignLeft className="w-3.5 h-3.5" />
        </IconBtn>
        <IconBtn active={s.align === "center"} onClick={() => set("align", "center")} title="Center">
          <AlignCenter className="w-3.5 h-3.5" />
        </IconBtn>
        <IconBtn active={s.align === "right"} onClick={() => set("align", "right")} title="Right">
          <AlignRight className="w-3.5 h-3.5" />
        </IconBtn>
      </Row>

      {/* Bold */}
      <Row label="Bold">
        <IconBtn active={!!s.bold} onClick={() => set("bold", !s.bold)} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </IconBtn>
      </Row>

      {/* Text color */}
      <Row label="Color">
        <ColorInput value={s.color || "#000000"} onChange={(v) => set("color", v)} />
      </Row>
    </>
  );
}

// ── Rect formatting panel ────────────────────────────────────────────────────
function RectFormatSection({ el, onUpdate }) {
  const s = el.style || {};
  const set = (key, val) => onUpdate(el.id, { style: { ...s, [key]: val } });

  // Parse hex + alpha from fill if rgba
  const fillHex = s.fill?.startsWith("#") ? s.fill.slice(0, 7) : "#e2e8f0";
  const opacity = s.opacity !== undefined ? s.opacity : 100;

  return (
    <>
      <div className="px-3 pt-2 pb-0.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Fill</p>
      </div>

      <Row label="Color">
        <ColorInput value={fillHex} onChange={(v) => set("fill", v)} />
      </Row>

      <Row label="Opacity %">
        <NumberInput value={opacity} onChange={(v) => set("opacity", v)} min={0} max={100} />
      </Row>

      <div className="mx-3 border-t border-border/50 my-1" />

      <div className="px-3 pb-0.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Outline</p>
      </div>

      <Row label="Color">
        <ColorInput value={s.borderColor || "#cbd5e1"} onChange={(v) => set("borderColor", v)} />
      </Row>

      <Row label="Width">
        <NumberInput value={s.borderWidth ?? 1} onChange={(v) => set("borderWidth", v)} min={0} max={20} />
      </Row>

      <Row label="Style">
        <div className="flex gap-1">
          {BORDER_STYLES.map((bs) => (
            <button
              key={bs}
              type="button"
              onClick={() => set("borderStyle", bs)}
              className={`px-2 py-0.5 rounded border text-[11px] capitalize transition-colors ${
                (s.borderStyle || "solid") === bs
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {bs}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Radius">
        <NumberInput value={s.radius ?? 4} onChange={(v) => set("radius", v)} min={0} max={100} />
      </Row>

      <div className="mx-3 border-t border-border/50 my-1" />

      <div className="px-3 pb-0.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Text inside</p>
      </div>

      <Row label="Font size">
        <NumberInput value={s.fontSize || 14} onChange={(v) => set("fontSize", v)} min={8} max={120} />
      </Row>

      <Row label="Color">
        <ColorInput value={s.color || "#000000"} onChange={(v) => set("color", v)} />
      </Row>
    </>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
export default function ElementFormatPanel({ x, y, element, selectedIds = [], onClose, onDelete, onUpdate }) {
  const ref = useRef(null);
  const isText = element?.type === "text";
  const isRect = element?.type === "rect";
  const showFormat = isText || isRect;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Clamp to viewport
  const panelW = 260;
  const left = Math.min(x, window.innerWidth - panelW - 8);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left, top: y, zIndex: 1000, width: panelW }}
      className="bg-popover border border-border rounded-lg shadow-xl py-1 overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {showFormat && (
        <>
          {isText && <TextFormatSection el={element} onUpdate={onUpdate} />}
          {isRect && <RectFormatSection el={element} onUpdate={onUpdate} />}
          <div className="mx-3 border-t border-border my-1" />
        </>
      )}

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