import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, AlignStartVertical, AlignCenterVertical, AlignEndVertical, Strikethrough, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, AlignHorizontalJustifyStart, AlignHorizontalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalJustifyEnd, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TEXT_PRESETS = [
  { label: "Title 1", value: "title1", fontSize: 32, bold: true },
  { label: "Title 2", value: "title2", fontSize: 24, bold: true },
  { label: "Title 3", value: "title3", fontSize: 18, bold: true },
  { label: "Body",    value: "body",   fontSize: 14, bold: false },
  { label: "Caption", value: "caption",fontSize: 11, bold: false },
];

function matchPreset(s) {
  return TEXT_PRESETS.find((p) => p.fontSize === s?.fontSize && !!s?.bold === p.bold)?.value || "";
}

function IconBtn({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-7 h-7 rounded flex items-center justify-center transition-colors shrink-0 ${
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground border border-border"
      }`}
    >
      {children}
    </button>
  );
}

function ColorSwatch({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
      <div className="relative w-7 h-7 rounded border border-border overflow-hidden cursor-pointer shrink-0">
        <div className="absolute inset-0" style={{ backgroundColor: value || "#ffffff" }} />
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </div>
    </div>
  );
}

function NumStepper({ label, value, onChange, min = 1, max = 200, suffix }) {
  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
      <div className="relative flex items-center">
        <input
          type="number"
          value={value ?? ""}
          min={min} max={max}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) onChange(v);
          }}
          className={`h-7 text-xs text-center border border-border rounded bg-background outline-none focus:ring-1 focus:ring-ring ${suffix ? "w-14 pr-5 pl-1" : "w-14 px-1"}`}
        />
        {suffix && <span className="absolute right-1.5 text-[10px] text-muted-foreground pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
}

const SEP = () => <div className="w-px h-5 bg-border mx-1 shrink-0" />;

// ── Text toolbar ─────────────────────────────────────────────────────────────
function TextToolbar({ el, onUpdate }) {
  const s = el.style || {};
  const set = (key, val) => onUpdate(el.id, { style: { ...s, [key]: val } });

  return (
    <>
      {/* Style preset dropdown */}
      <Select
        value={matchPreset(s)}
        onValueChange={(v) => {
          const p = TEXT_PRESETS.find((x) => x.value === v);
          if (p) onUpdate(el.id, { style: { ...s, fontSize: p.fontSize, bold: p.bold } });
        }}
      >
        <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="Style…" /></SelectTrigger>
        <SelectContent>
          {TEXT_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <SEP />

      <NumStepper label="Size" value={s.fontSize || 14} onChange={(v) => set("fontSize", v)} min={6} max={200} />

      <SEP />

      <IconBtn active={!!s.bold} onClick={() => set("bold", !s.bold)} title="Bold">
        <Bold className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={!!s.italic} onClick={() => set("italic", !s.italic)} title="Italic">
        <Italic className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={!!s.underline} onClick={() => set("underline", !s.underline)} title="Underline">
        <Underline className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={!!s.strikethrough} onClick={() => set("strikethrough", !s.strikethrough)} title="Strikethrough">
        <Strikethrough className="w-3.5 h-3.5" />
      </IconBtn>

      <SEP />

      <IconBtn active={!s.align || s.align === "left"} onClick={() => set("align", "left")} title="Align Left">
        <AlignLeft className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={s.align === "center"} onClick={() => set("align", "center")} title="Align Center">
        <AlignCenter className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={s.align === "right"} onClick={() => set("align", "right")} title="Align Right">
        <AlignRight className="w-3.5 h-3.5" />
      </IconBtn>

      <SEP />

      <IconBtn active={!s.verticalAlign || s.verticalAlign === "top"} onClick={() => set("verticalAlign", "top")} title="Align Top">
        <AlignStartVertical className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={s.verticalAlign === "middle"} onClick={() => set("verticalAlign", "middle")} title="Align Middle">
        <AlignCenterVertical className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={s.verticalAlign === "bottom"} onClick={() => set("verticalAlign", "bottom")} title="Align Bottom">
        <AlignEndVertical className="w-3.5 h-3.5" />
      </IconBtn>

      <SEP />

      <ColorSwatch label="Color" value={s.color || "#000000"} onChange={(v) => set("color", v)} />
    </>
  );
}

// ── Rect toolbar ─────────────────────────────────────────────────────────────
const BORDER_STYLE_OPTIONS = [
  { value: "solid",  label: "Solid",  dash: "none" },
  { value: "dashed", label: "Dashed", dash: "8 4" },
  { value: "dotted", label: "Dotted", dash: "2 4" },
];

function BorderStylePicker({ value, onChange }) {
  const current = BORDER_STYLE_OPTIONS.find((o) => o.value === (value || "solid")) || BORDER_STYLE_OPTIONS[0];
  return (
    <Select value={current.value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-10 px-1 text-xs flex items-center justify-center">
        <BorderLine dash={current.dash} />
      </SelectTrigger>
      <SelectContent>
        {BORDER_STYLE_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <div className="flex items-center gap-2">
              <BorderLine dash={o.dash} />
              <span className="text-xs">{o.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BorderLine({ dash }) {
  return (
    <svg width="40" height="10" viewBox="0 0 40 10">
      <line
        x1="2" y1="5" x2="38" y2="5"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={dash === "none" ? undefined : dash}
        strokeLinecap="round"
      />
    </svg>
  );
}

function RectToolbar({ el, onUpdate }) {
  const s = el.style || {};
  const set = (key, val) => onUpdate(el.id, { style: { ...s, [key]: val } });

  return (
    <>
      <ColorSwatch label="Fill" value={s.fill?.slice(0, 7) || "#e2e8f0"} onChange={(v) => set("fill", v)} />

      <SEP />

      <NumStepper value={s.opacity ?? 100} onChange={(v) => set("opacity", v)} min={0} max={100} suffix="%" />

      <SEP />

      <ColorSwatch label="Border" value={s.borderColor || "#cbd5e1"} onChange={(v) => set("borderColor", v)} />

      <NumStepper value={s.borderWidth ?? 1} onChange={(v) => set("borderWidth", v)} min={0} max={20} />

      <BorderStylePicker value={s.borderStyle || "solid"} onChange={(v) => set("borderStyle", v)} />

      <SEP />

      <NumStepper label="Radius" value={s.radius ?? 4} onChange={(v) => set("radius", v)} min={0} max={200} />

      <SEP />

      <NumStepper label="Text size" value={s.fontSize || 14} onChange={(v) => set("fontSize", v)} min={6} max={200} />
      <IconBtn active={!!s.bold} onClick={() => set("bold", !s.bold)} title="Bold">
        <Bold className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={!!s.italic} onClick={() => set("italic", !s.italic)} title="Italic">
        <Italic className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={!!s.underline} onClick={() => set("underline", !s.underline)} title="Underline">
        <Underline className="w-3.5 h-3.5" />
      </IconBtn>
      <SEP />
      <IconBtn active={!s.textAlign || s.textAlign === "left"} onClick={() => set("textAlign", "left")} title="Align Left">
        <AlignLeft className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={s.textAlign === "center"} onClick={() => set("textAlign", "center")} title="Align Center">
        <AlignCenter className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={s.textAlign === "right"} onClick={() => set("textAlign", "right")} title="Align Right">
        <AlignRight className="w-3.5 h-3.5" />
      </IconBtn>
      <SEP />
      <IconBtn active={!s.textVerticalAlign || s.textVerticalAlign === "top"} onClick={() => set("textVerticalAlign", "top")} title="Align Top">
        <AlignStartVertical className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={s.textVerticalAlign === "middle"} onClick={() => set("textVerticalAlign", "middle")} title="Align Middle">
        <AlignCenterVertical className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={s.textVerticalAlign === "bottom"} onClick={() => set("textVerticalAlign", "bottom")} title="Align Bottom">
        <AlignEndVertical className="w-3.5 h-3.5" />
      </IconBtn>
      <ColorSwatch value={s.color || "#000000"} onChange={(v) => set("color", v)} />
    </>
  );
}

// ── Multi-select alignment toolbar ───────────────────────────────────────────
function MultiSelectToolbar({ elements, selectedIds, onUpdateElements }) {
  const sel = elements.filter((e) => selectedIds.includes(e.id));
  if (sel.length < 2) return null;

  const minX = Math.min(...sel.map((e) => e.x));
  const maxX = Math.max(...sel.map((e) => e.x + e.width));
  const minY = Math.min(...sel.map((e) => e.y));
  const maxY = Math.max(...sel.map((e) => e.y + e.height));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const align = (fn) => {
    const updated = sel.reduce((acc, e) => ({ ...acc, [e.id]: fn(e) }), {});
    onUpdateElements(elements.map((e) => updated[e.id] ? { ...e, ...updated[e.id] } : e));
  };

  const distribute = (axis) => {
    const sorted = [...sel].sort((a, b) => a[axis] - b[axis]);
    const totalSpan = (axis === "x" ? maxX - minX : maxY - minY);
    const totalSize = sorted.reduce((s, e) => s + (axis === "x" ? e.width : e.height), 0);
    const gap = (totalSpan - totalSize) / (sorted.length - 1);
    let pos = axis === "x" ? minX : minY;
    const updated = {};
    sorted.forEach((e) => {
      updated[e.id] = { [axis]: pos };
      pos += (axis === "x" ? e.width : e.height) + gap;
    });
    onUpdateElements(elements.map((e) => updated[e.id] ? { ...e, ...updated[e.id] } : e));
  };

  return (
    <div className="border-b border-border bg-card shrink-0 px-3 py-1.5 flex items-center gap-2 overflow-x-auto">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
        Align ({sel.length})
      </span>
      <IconBtn onClick={() => align((e) => ({ x: minX }))} title="Align Left"><AlignHorizontalJustifyStart className="w-3.5 h-3.5" /></IconBtn>
      <IconBtn onClick={() => align((e) => ({ x: centerX - e.width / 2 }))} title="Align Center"><AlignHorizontalJustifyCenter className="w-3.5 h-3.5" /></IconBtn>
      <IconBtn onClick={() => align((e) => ({ x: maxX - e.width }))} title="Align Right"><AlignHorizontalJustifyEnd className="w-3.5 h-3.5" /></IconBtn>
      <SEP />
      <IconBtn onClick={() => align((e) => ({ y: minY }))} title="Align Top"><AlignVerticalJustifyStart className="w-3.5 h-3.5" /></IconBtn>
      <IconBtn onClick={() => align((e) => ({ y: centerY - e.height / 2 }))} title="Align Middle"><AlignVerticalJustifyCenter className="w-3.5 h-3.5" /></IconBtn>
      <IconBtn onClick={() => align((e) => ({ y: maxY - e.height }))} title="Align Bottom"><AlignVerticalJustifyEnd className="w-3.5 h-3.5" /></IconBtn>
      <SEP />
      <IconBtn onClick={() => distribute("x")} title="Distribute Horizontally"><AlignHorizontalDistributeCenter className="w-3.5 h-3.5" /></IconBtn>
      <IconBtn onClick={() => distribute("y")} title="Distribute Vertically"><AlignVerticalDistributeCenter className="w-3.5 h-3.5" /></IconBtn>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function FormatToolbar({ elements, selectedId, selectedIds = [], onUpdate, onUpdateElements }) {
  const multiSelect = selectedIds.length > 1;
  const el = elements.find((e) => e.id === selectedId);

  if (multiSelect) {
    return <MultiSelectToolbar elements={elements} selectedIds={selectedIds} onUpdateElements={onUpdateElements} />;
  }

  if (!el || (el.type !== "text" && el.type !== "rect")) return null;

  return (
    <div className="border-b border-border bg-card shrink-0 px-3 py-1.5 flex items-center gap-2 overflow-x-auto">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
        {el.type === "text" ? "Text" : "Shape"}
      </span>
      {el.type === "text" && <TextToolbar el={el} onUpdate={onUpdate} />}
      {el.type === "rect" && <RectToolbar el={el} onUpdate={onUpdate} />}
    </div>
  );
}