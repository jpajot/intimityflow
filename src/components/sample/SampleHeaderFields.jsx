import { useState, useEffect, useRef } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ChevronDown } from "lucide-react";
import { SAMPLE_TYPE_OPTIONS, CONFORMITY_OPTIONS, derivePhase } from "./sampleUtils";

// ── Generic inline dropdown ────────────────────────────────────────────────────
function InlineDropdown({ value, options, placeholder = "—", onCommit, renderValue }) {
  const selected = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-left flex items-center gap-1 hover:text-primary transition-colors group"
        >
          {selected
            ? (renderValue ? renderValue(selected) : <span>{selected.label}</span>)
            : <span className="text-muted-foreground/50">{placeholder}</span>}
          <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px] max-h-60 overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => onCommit(o.value)}
            className={value === o.value ? "bg-primary/10" : ""}
          >
            {o.render ? o.render() : <span className="text-sm">{o.label}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Inline number ────────────────────────────────────────────────────────────
function InlineNumber({ value, onCommit, placeholder = "—" }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value != null ? String(value) : "");
  const ref = useRef(null);
  useEffect(() => { setLocal(value != null ? String(value) : ""); }, [value]);

  const commit = () => {
    setEditing(false);
    const parsed = local.trim() === "" ? null : Number(local);
    const numeric = isNaN(parsed) ? null : parsed;
    if (numeric !== value) onCommit(numeric);
  };

  if (editing) {
    return (
      <Input
        ref={ref}
        autoFocus
        type="number"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setEditing(false); setLocal(value != null ? String(value) : ""); } }}
        className="h-7 w-24 text-sm px-2"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex items-center gap-1 hover:text-primary transition-colors group"
    >
      <span>{value != null ? value : <span className="text-muted-foreground/50">{placeholder}</span>}</span>
      <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0" />
    </button>
  );
}

// ── Inline textarea (notes) ──────────────────────────────────────────────────
function InlineNotes({ value, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value || "");
  useEffect(() => { setLocal(value || ""); }, [value]);

  const commit = () => {
    setEditing(false);
    if (local !== (value || "")) onCommit(local || null);
  };

  if (editing) {
    return (
      <textarea
        autoFocus
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") e.currentTarget.blur(); }}
        rows={3}
        className="text-sm border border-input rounded p-2 w-full resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="Add notes…"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      {value || <span className="italic text-muted-foreground/40">Click to add notes…</span>}
    </button>
  );
}

// ── Color picker option helper ────────────────────────────────────────────────
function buildColorOptions(colors) {
  return colors.map((c) => ({
    value: c.id,
    label: c.colorway_code || c.id,
    render: () => (
      <span className="flex items-center gap-2 text-sm">
        {c.hex_code && (
          <span
            className="w-4 h-4 rounded-sm border border-border inline-block shrink-0"
            style={{ backgroundColor: `#${c.hex_code.replace("#", "")}` }}
          />
        )}
        <span className="font-mono text-muted-foreground text-xs">{c.colorway_code}</span>
        {c.name && <span>{c.name}</span>}
      </span>
    ),
    renderValue: () => (
      <span className="flex items-center gap-1.5">
        {c.hex_code && (
          <span
            className="w-3.5 h-3.5 rounded-sm border border-border inline-block shrink-0"
            style={{ backgroundColor: `#${c.hex_code.replace("#", "")}` }}
          />
        )}
        <span className="font-mono text-sm">{c.colorway_code}</span>
      </span>
    ),
  }));
}

// ── Exported field editors ────────────────────────────────────────────────────

export { InlineDropdown, InlineNumber, InlineNotes, buildColorOptions };

// ── Sample Type field ────────────────────────────────────────────────────────
export function SampleTypeField({ value, onChange }) {
  const sampleTypeOptions = SAMPLE_TYPE_OPTIONS.map((o) => ({ ...o }));
  return (
    <InlineDropdown
      value={value}
      options={sampleTypeOptions}
      placeholder="Select type"
      onCommit={(v) => onChange(v, derivePhase(v))}
    />
  );
}

// ── Color field ──────────────────────────────────────────────────────────────
export function ColorField({ value, colors, onChange }) {
  const options = buildColorOptions(colors);
  return (
    <InlineDropdown
      value={value}
      options={options}
      placeholder="No color"
      onCommit={onChange}
      renderValue={(opt) => opt.render?.() ?? <span className="font-mono text-sm">{opt.label}</span>}
    />
  );
}

// ── PCAM field ───────────────────────────────────────────────────────────────
export function PcamField({ value, pcams, onChange }) {
  const options = pcams.map((p) => ({ value: p.id, label: p.name || p.id }));
  return (
    <InlineDropdown
      value={value}
      options={options}
      placeholder="No variation"
      onCommit={onChange}
    />
  );
}

// ── Size field ────────────────────────────────────────────────────────────────
export function SizeField({ value, sizes, onChange }) {
  const options = sizes.map((s) => ({ value: s.id, label: s.name || s.id }));
  return (
    <InlineDropdown
      value={value}
      options={options}
      placeholder="No size"
      onCommit={onChange}
    />
  );
}

// ── Qty field ─────────────────────────────────────────────────────────────────
export function QtyField({ value, onChange }) {
  return <InlineNumber value={value} onCommit={onChange} placeholder="—" />;
}

// ── Conformity field ──────────────────────────────────────────────────────────
export function ConformityField({ value, onChange }) {
  const options = CONFORMITY_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
    render: () => <span className={`text-xs px-1.5 py-0.5 rounded border ${o.style}`}>{o.label}</span>,
  }));
  const current = CONFORMITY_OPTIONS.find((o) => o.value === value);
  return (
    <InlineDropdown
      value={value}
      options={options}
      placeholder="Not assessed"
      onCommit={onChange}
      renderValue={() =>
        current ? (
          <span className={`text-xs px-1.5 py-0.5 rounded border ${current.style}`}>{current.label}</span>
        ) : null
      }
    />
  );
}

// ── Notes field ───────────────────────────────────────────────────────────────
export function NotesField({ value, onChange }) {
  return <InlineNotes value={value} onCommit={onChange} />;
}