import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronDown } from "lucide-react";

const AXIS_OPTIONS = [
  { value: "color", label: "Colorway" },
  { value: "size", label: "Size" },
  { value: "color_and_more", label: "Color & More" },
  { value: "supplier", label: "Supplier" },
];

const DEFAULT_GROUPS = { view: true, lines: true, bom: true, export: true };

function CollapsibleGroup({ label, expanded, onToggle, children }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-1 group"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          {label}
        </span>
        {expanded
          ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground" />
        }
      </button>
      {expanded && <div className="mt-2 space-y-1">{children}</div>}
    </div>
  );
}

function ActionButton({ label, onClick, disabled, disabledReason, destructive }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors
        ${disabled
          ? "text-muted-foreground/50 cursor-not-allowed"
          : destructive
            ? "text-destructive hover:bg-destructive/10"
            : "text-foreground hover:bg-muted"
        }`}
    >
      {label}
      {disabled && disabledReason && (
        <span className="ml-1 text-[10px] text-muted-foreground/40">(coming soon)</span>
      )}
    </button>
  );
}

export default function BOMOptionsContent({
  // View props
  matrixColumnAxis,
  matrixSecondaryAxis,
  showSourcing,
  onColumnAxisChange,
  onSecondaryAxisChange,
  onShowSourcingChange,
  // BOM state
  bom,
  bomLines,
  isReadOnly,
  // Group state
  groupsExpanded,
  onGroupToggle,
  // Action handlers (passed from parent)
  onAddLine,
  onAutoResolveTCX,
  onAutoResolveNameMatch,
  onAutoResolveSizes,
  onClearResolutions,
  onCopyResolutions,
  onMarkAllNA,
  onCreateRevision,
  onCreateProductionBOM,
  onMarkObsolete,
  onRefreshSourcing,
  onExportMatrix,
  // Close sidebar
  onClose,
}) {
  const expanded = groupsExpanded || DEFAULT_GROUPS;

  const isProduction = bom?.bom_type === "production";
  const isDev = bom?.bom_type === "development";
  const isReleased = bom?.status === "released";
  const canCreateProd = isDev && isReleased;
  const isNotTerminal = bom && !["superseded", "obsolete"].includes(bom.status);

  const wrap = (fn) => () => { fn?.(); onClose?.(); };

  // Lines group actions
  const linesActions = !isReadOnly ? [
    { label: "Add component line", onClick: wrap(onAddLine) },
    { label: "Auto-resolve colorways by linked TechnicalColor", onClick: wrap(onAutoResolveTCX) },
    { label: "Auto-resolve colorways by name match", onClick: wrap(onAutoResolveNameMatch) },
    { label: "Auto-resolve sizes by size code", onClick: wrap(onAutoResolveSizes) },
    { label: "Apply size grading rule across row", disabled: true, disabledReason: "Grading rule engine not yet built" },
    { label: "Clear all resolutions in row", onClick: wrap(onClearResolutions), destructive: true },
    { label: "Copy resolutions from another line", onClick: wrap(onCopyResolutions) },
    { label: "Mark all cells in row Not Applicable", onClick: wrap(onMarkAllNA), destructive: true },
  ] : [];

  // BOM group actions
  const bomActions = [
    ...(isNotTerminal ? [{ label: "Create new revision", onClick: wrap(onCreateRevision) }] : []),
    ...(canCreateProd ? [{ label: "Create production BOM from this dev BOM", onClick: wrap(onCreateProductionBOM) }] : []),
    { label: "Refresh sourcing", onClick: wrap(onRefreshSourcing) },
    ...(isReleased ? [{ label: "Mark obsolete", onClick: wrap(onMarkObsolete), destructive: true }] : []),
  ];

  return (
    <div className="space-y-3">
      {/* VIEW GROUP */}
      <CollapsibleGroup label="View" expanded={expanded.view} onToggle={() => onGroupToggle("view")}>
        <div className="space-y-2 px-1">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Column axis</label>
            <Select value={matrixColumnAxis} onValueChange={onColumnAxisChange}>
              <SelectTrigger className="h-7 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ zIndex: 99999 }} position="popper">
                {AXIS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Group by (secondary)</label>
            <Select
              value={matrixSecondaryAxis || "__none__"}
              onValueChange={(v) => onSecondaryAxisChange(v === "__none__" ? null : v)}
            >
              <SelectTrigger className="h-7 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ zIndex: 99999 }} position="popper">
                <SelectItem value="__none__">— none —</SelectItem>
                {AXIS_OPTIONS.filter((o) => o.value !== matrixColumnAxis).map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="text-xs text-foreground cursor-pointer" htmlFor="sourcing-toggle-opts">
              Show sourcing chain in cells
            </label>
            <Switch
              id="sourcing-toggle-opts"
              checked={showSourcing}
              onCheckedChange={onShowSourcingChange}
            />
          </div>
        </div>
      </CollapsibleGroup>

      {/* LINES GROUP */}
      {linesActions.length > 0 && (
        <>
          <div className="border-t border-border" />
          <CollapsibleGroup label="Lines" expanded={expanded.lines} onToggle={() => onGroupToggle("lines")}>
            {linesActions.map((a, i) => (
              <ActionButton key={i} {...a} />
            ))}
          </CollapsibleGroup>
        </>
      )}

      {/* BOM GROUP */}
      {bomActions.length > 0 && (
        <>
          <div className="border-t border-border" />
          <CollapsibleGroup label="BOM" expanded={expanded.bom} onToggle={() => onGroupToggle("bom")}>
            {bomActions.map((a, i) => (
              <ActionButton key={i} {...a} />
            ))}
          </CollapsibleGroup>
        </>
      )}

      {/* EXPORT GROUP */}
      <>
        <div className="border-t border-border" />
        <CollapsibleGroup label="Export" expanded={expanded.export} onToggle={() => onGroupToggle("export")}>
          <ActionButton label="Export matrix" onClick={wrap(onExportMatrix)} />
        </CollapsibleGroup>
      </>
    </div>
  );
}