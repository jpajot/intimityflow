/**
 * Shared badge/label renderers for ECO fields.
 * Used by AllEcosPage, EcoDetailStub, and PendingReviewsPage.
 */

export const FLOW_CONFIG = {
  A_dev_bom_release:    { letter: "A", color: "bg-blue-100 text-blue-700 border-blue-300",     label: "Flow A — Dev BOM Release" },
  B_routing_change:     { letter: "B", color: "bg-purple-100 text-purple-700 border-purple-300", label: "Flow B — Routing Change" },
  C_sourcing_change:    { letter: "C", color: "bg-amber-100 text-amber-700 border-amber-300",   label: "Flow C — Sourcing Change" },
  D_component_revision: { letter: "D", color: "bg-green-100 text-green-700 border-green-300",   label: "Flow D — Component Revision" },
  manual:               { letter: "M", color: "bg-slate-100 text-slate-600 border-slate-300",   label: "Manual" },
  mixed:                { letter: "~", color: "bg-slate-200 text-slate-500 border-slate-400",   label: "Mixed" },
};

export const STATUS_CONFIG = {
  proposed:     { label: "Proposed",     color: "bg-slate-100 text-slate-600 border-slate-300" },
  under_review: { label: "Under Review", color: "bg-blue-100 text-blue-700 border-blue-300" },
  approved:     { label: "Approved",     color: "bg-teal-100 text-teal-700 border-teal-300" },
  applied:      { label: "Applied",      color: "bg-green-100 text-green-700 border-green-300" },
  rejected:     { label: "Rejected",     color: "bg-red-100 text-red-700 border-red-300" },
  cancelled:    { label: "Cancelled",    color: "bg-zinc-200 text-zinc-600 border-zinc-400" },
  closed:       { label: "Closed",       color: "bg-slate-200 text-slate-500 border-slate-400" },
};

export const PRIORITY_CONFIG = {
  low:      { label: "Low",      color: "bg-slate-100 text-slate-600 border-slate-300" },
  normal:   { label: "Normal",   color: "bg-blue-100 text-blue-700 border-blue-300" },
  high:     { label: "High",     color: "bg-orange-100 text-orange-700 border-orange-300" },
  critical: { label: "Critical", color: "bg-red-100 text-red-700 border-red-300" },
};

export const REASON_CONFIG = {
  quality:         { label: "Quality",         color: "bg-violet-100 text-violet-700 border-violet-300" },
  cost:            { label: "Cost",            color: "bg-amber-100 text-amber-700 border-amber-300" },
  supplier_change: { label: "Supplier Change", color: "bg-orange-100 text-orange-700 border-orange-300" },
  design_change:   { label: "Design Change",   color: "bg-blue-100 text-blue-700 border-blue-300" },
  regulatory:      { label: "Regulatory",      color: "bg-red-100 text-red-700 border-red-300" },
  sourcing_update: { label: "Sourcing Update", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  routing_update:  { label: "Routing Update",  color: "bg-purple-100 text-purple-700 border-purple-300" },
  other:           { label: "Other",           color: "bg-slate-100 text-slate-500 border-slate-300" },
};

export function FlowBadge({ value }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const cfg = FLOW_CONFIG[value] || { letter: "?", color: "bg-slate-100 text-slate-600 border-slate-300", label: value };
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold border ${cfg.color}`}
      title={cfg.label}
    >
      {cfg.letter}
    </span>
  );
}

export function StatusBadge({ value }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const cfg = STATUS_CONFIG[value] || { label: value, color: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export function PriorityBadge({ value }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const cfg = PRIORITY_CONFIG[value] || { label: value, color: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export function ReasonBadge({ value }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const cfg = REASON_CONFIG[value] || { label: value, color: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export function originLabel(origin) {
  if (!origin) return "—";
  return origin
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}