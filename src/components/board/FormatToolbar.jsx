import { AlignLeft, AlignCenter, AlignRight, Bold } from "lucide-react";
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
      <span className="text-[11px] text-muted-foreground">{label}</span>
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

function NumStepper({ label, value, onChange, min = 1, max = 200 }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        min={min} max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(v);
        }}
        className="w-14 h-7 text-xs text-center border border-border rounded bg-background px-1 outline-none focus:ring-1 focus:ring-ring"
      />
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

      {/* Bold */}
      <IconBtn active={!!s.bold} onClick={() => set("bold", !s.bold)} title="Bold">
        <Bold className="w-3.5 h-3.5" />
      </IconBtn>

      <SEP />

      {/* Alignment */}
      <IconBtn active={!s.align || s.align === "left"} onClick={() => set("align", "left")} title="Left">
        <AlignLeft className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={s.align === "center"} onClick={() => set("align", "center")} title="Center">
        <AlignCenter className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn active={s.align === "right"} onClick={() => set("align", "right")} title="Right">
        <AlignRight className="w-3.5 h-3.5" />
      </IconBtn>

      <SEP />

      <ColorSwatch label="Color" value={s.color || "#000000"} onChange={(v) => set("color", v)} />
    </>
  );
}

// ── Rect toolbar ─────────────────────────────────────────────────────────────
const BORDER_STYLES = ["solid", "dashed", "dotted"];

function RectToolbar({ el, onUpdate }) {
  const s = el.style || {};
  const set = (key, val) => onUpdate(el.id, { style: { ...s, [key]: val } });

  return (
    <>
      <ColorSwatch label="Fill" value={s.fill?.slice(0, 7) || "#e2e8f0"} onChange={(v) => set("fill", v)} />

      <SEP />

      <NumStepper label="Opacity%" value={s.opacity ?? 100} onChange={(v) => set("opacity", v)} min={0} max={100} />

      <SEP />

      <ColorSwatch label="Border" value={s.borderColor || "#cbd5e1"} onChange={(v) => set("borderColor", v)} />

      <NumStepper label="Width" value={s.borderWidth ?? 1} onChange={(v) => set("borderWidth", v)} min={0} max={20} />

      {/* Border style */}
      <div className="flex items-center gap-1 ml-1">
        {BORDER_STYLES.map((bs) => (
          <button
            key={bs}
            type="button"
            onClick={() => set("borderStyle", bs)}
            className={`px-2 h-7 rounded border text-[11px] capitalize transition-colors ${
              (s.borderStyle || "solid") === bs
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-border hover:bg-muted"
            }`}
          >
            {bs}
          </button>
        ))}
      </div>

      <SEP />

      <NumStepper label="Radius" value={s.radius ?? 4} onChange={(v) => set("radius", v)} min={0} max={200} />

      <SEP />

      <NumStepper label="Text size" value={s.fontSize || 14} onChange={(v) => set("fontSize", v)} min={6} max={200} />
      <ColorSwatch label="Text" value={s.color || "#000000"} onChange={(v) => set("color", v)} />
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function FormatToolbar({ elements, selectedId, onUpdate }) {
  const el = elements.find((e) => e.id === selectedId);
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