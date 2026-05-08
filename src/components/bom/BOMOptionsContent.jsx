import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, Plus } from "lucide-react";
import BOMQuickFilterGroup from "./BOMQuickFilterGroup.jsx";

const AXIS_OPTIONS = [
  { value: "color", label: "Colorway" },
  { value: "size", label: "Size" },
  { value: "color_and_more", label: "Color & More" },
  { value: "supplier", label: "Supplier" },
];

// All groups collapsed by default
const DEFAULT_GROUPS = { view: false, quick_filter: false, lines: false, bom: false, export: false };

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
          ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
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
      title={disabled ? disabledReason : label}
      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors overflow-hidden
        ${disabled
          ? "text-muted-foreground/50 cursor-not-allowed"
          : destructive
            ? "text-destructive hover:bg-destructive/10"
            : "text-foreground hover:bg-muted"
        }`}
    >
      <span className="block truncate">{label}</span>
    </button>
  );
}

export default function BOMOptionsContent({
  matrixColumnAxis,
  matrixSecondaryAxis,
  showSourcing,
  onColumnAxisChange,
  onSecondaryAxisChange,
  onShowSourcingChange,
  showRevisionSnapshots,
  onShowRevisionSnapshotsChange,
  bom,
  bomLines,
  isReadOnly,
  groupsExpanded,
  onGroupToggle,
  onAddLine,
  onAutoResolveTCX,
  onAutoResolveNameMatch,
  onAutoResolveSizes,
  onClearResolutions,
  onCopyResolutions,
  onMarkAllNA,
  onCreateVersion,
  onCreateRevision,
  onCreateProductionBOM,
  onMarkObsolete,
  onRefreshSourcing,
  onExportMatrix,
  onClose,
  // Quick filter props
  filterConfig,
  onFilterChange,
  colorVariants,
  styleSizes,
  colorAndMores,
  techColors,
  commColors,
  projects,
  allSizes,
}) {
  const expanded = { ...DEFAULT_GROUPS, ...groupsExpanded };

  const isProduction = bom?.bom_type === "production";
  const isDev = bom?.bom_type === "development";
  const isReleased = bom?.status === "released";
  const canCreateProd = isDev && isReleased; // only visible when dev BOM is released
  const isNotTerminal = bom && !["superseded", "obsolete"].includes(bom.status);

  // Option A: close sidebar first, then open the action pop-up
  const wrap = (fn) => () => { onClose?.(); setTimeout(() => fn?.(), 50); };

  // Lines group: "Add line" is promoted — only 7 remaining actions
  const linesActions = !isReadOnly ? [
    { label: "Auto-resolve colorways by linked TechnicalColor", onClick: wrap(onAutoResolveTCX) },
    { label: "Auto-resolve colorways by name match", onClick: wrap(onAutoResolveNameMatch) },
    { label: "Auto-resolve sizes by size code", onClick: wrap(onAutoResolveSizes) },
    { label: "Apply size grading rule across row", disabled: true, disabledReason: "Grading rule engine not yet built" },
    { label: "Clear all resolutions in row", onClick: wrap(onClearResolutions), destructive: true },
    { label: "Copy resolutions from another line", onClick: wrap(onCopyResolutions) },
    { label: "Mark all cells in row Not Applicable", onClick: wrap(onMarkAllNA), destructive: true },
  ] : [];

  const canCreateVersion = bom && ["draft", "in_review"].includes(bom.status);

  const bomActions = [
    ...(canCreateVersion ? [{ label: "Create new version", onClick: wrap(onCreateVersion) }] : []),
    ...(isNotTerminal ? [{ label: "Create new revision", onClick: wrap(onCreateRevision) }] : []),
    ...(canCreateProd ? [{ label: "Create production BOM from this dev BOM", onClick: wrap(onCreateProductionBOM) }] : []),
    { label: "Refresh sourcing", onClick: wrap(onRefreshSourcing) },
    ...(isReleased ? [{ label: "Mark obsolete", onClick: wrap(onMarkObsolete), destructive: true }] : []),
  ];

  return (
    // Fixed width — never grows with content
    <div style={{ width: 288 }} className="space-y-3">

      {/* PROMOTED: Add component line — always visible at top when editable */}
      {!isReadOnly && (
        <>
          <Button
            size="sm"
            className="w-full gap-1.5 h-8 text-xs"
            onClick={wrap(onAddLine)}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Add component line</span>
          </Button>
          <div className="border-t border-border" />
        </>
      )}

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
              Show sourcing chain
            </label>
            <Switch
              id="sourcing-toggle-opts"
              checked={showSourcing}
              onCheckedChange={onShowSourcingChange}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="text-xs text-foreground cursor-pointer" htmlFor="revision-snapshots-toggle-opts">
              Show revision snapshots
            </label>
            <Switch
              id="revision-snapshots-toggle-opts"
              checked={showRevisionSnapshots}
              onCheckedChange={onShowRevisionSnapshotsChange}
            />
          </div>
        </div>
      </CollapsibleGroup>

      {/* QUICK FILTER GROUP */}
      <div className="border-t border-border" />
      <BOMQuickFilterGroup
        expanded={expanded.quick_filter}
        onToggle={() => onGroupToggle("quick_filter")}
        filterConfig={filterConfig}
        onFilterChange={onFilterChange}
        columnAxis={matrixColumnAxis}
        secondaryAxis={matrixSecondaryAxis}
        colorVariants={colorVariants || []}
        styleSizes={styleSizes || []}
        colorAndMores={colorAndMores || []}
        techColors={techColors || []}
        commColors={commColors || []}
        projects={projects || []}
        allSizes={allSizes || []}
      />

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
          <ActionButton label="Export matrix as CSV" onClick={wrap(onExportMatrix)} />
        </CollapsibleGroup>
      </>
    </div>
  );
}