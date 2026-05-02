/**
 * Small status badge for ProductColor.colorway_status.
 * Used in BOM matrix cells, colorway pickers, and colorway lists.
 */
const STATUS_CONFIG = {
  requested:               { dot: "bg-orange-400",  label: "Requested",              text: "text-orange-700",  bg: "bg-orange-50  border-orange-200" },
  in_progress:             { dot: "bg-blue-400",    label: "In Progress",             text: "text-blue-700",    bg: "bg-blue-50    border-blue-200"   },
  submitted_for_approval:  { dot: "bg-purple-400",  label: "Submitted",               text: "text-purple-700",  bg: "bg-purple-50  border-purple-200" },
  approved:                { dot: "bg-green-400",   label: "Approved",                text: "text-green-700",   bg: "bg-green-50   border-green-200"  },
  rejected:                { dot: "bg-red-400",     label: "Rejected",                text: "text-red-700",     bg: "bg-red-50     border-red-200"    },
  obsolete:                { dot: "bg-slate-400",   label: "Obsolete",                text: "text-slate-500",   bg: "bg-slate-50   border-slate-200"  },
};

export default function ColorwayStatusBadge({ status, compact = false }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["approved"];
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${cfg.text} ${cfg.bg}`}
        title={cfg.label}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 ${cfg.text}`} title={cfg.label}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
    </span>
  );
}

export { STATUS_CONFIG };