import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlaskConical, X, ChevronDown, ChevronRight, Search, MoreHorizontal, Route, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import GenerateSampleRoutingDialog from "./GenerateSampleRoutingDialog";
import SampleStepsPanel from "./SampleStepsPanel";
import WorkflowStatusBadge from "./WorkflowStatusBadge";
import { computeParentWorkflowStatus } from "./sampleStepUtils";
import {
  derivePhase,
  SAMPLE_TYPE_OPTIONS,
  CONFORMITY_OPTIONS,
} from "./sampleUtils";

// ── Filter chip ───────────────────────────────────────────────────────────────
function FilterChip({ label, active, children }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap
            ${active
              ? "bg-primary/10 border-primary/30 text-primary font-medium"
              : "bg-background border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"}`}
        >
          {label}
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[170px]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Phase chip ────────────────────────────────────────────────────────────────
function PhaseChip({ phase }) {
  if (!phase) return null;
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
      style={
        phase === "production"
          ? { color: "#059669", backgroundColor: "#d1fae5", borderColor: "#6ee7b7" }
          : { color: "#6B7280", backgroundColor: "#f3f4f6", borderColor: "#d1d5db" }
      }
    >
      {phase === "production" ? "Production" : "Development"}
    </span>
  );
}

// ── Inline dropdown ────────────────────────────────────────────────────────────
function InlineDropdown({ value, options, placeholder = "—", onCommit }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-left text-xs flex items-center gap-1 hover:text-primary transition-colors group"
        >
          <span>{value ? (options.find((o) => o.value === value)?.label ?? value) : <span className="text-muted-foreground/40">{placeholder}</span>}</span>
          <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px] max-h-60 overflow-y-auto">
        <DropdownMenuItem onSelect={() => onCommit(null)}>
          <span className="text-muted-foreground italic text-xs">— Clear —</span>
        </DropdownMenuItem>
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => onCommit(o.value)} className={value === o.value ? "bg-primary/10" : ""}>
            {o.render ? o.render() : <span className="text-xs">{o.label}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Inline number input ────────────────────────────────────────────────────────
function InlineNumberInput({ value, onCommit }) {
  const [local, setLocal] = useState(value != null ? String(value) : "");
  const initialRef = useRef(value);

  const commit = () => {
    const parsed = local.trim() === "" ? null : Number(local);
    const numeric = isNaN(parsed) ? null : parsed;
    if (numeric !== initialRef.current) onCommit(numeric);
    initialRef.current = numeric;
  };

  return (
    <Input
      type="number"
      min={1}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className="h-6 w-20 text-xs px-1.5"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ── Inline notes ───────────────────────────────────────────────────────────────
function InlineNotes({ value, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value || "");
  const initialRef = useRef(value || "");

  const commit = () => {
    setEditing(false);
    if (local !== initialRef.current) { onCommit(local || null); initialRef.current = local; }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-left truncate max-w-[160px] text-muted-foreground hover:text-foreground transition-colors"
        title={local || "Click to add notes"}
      >
        {local || <span className="text-muted-foreground/30 italic">Add notes…</span>}
      </button>
    );
  }

  return (
    <textarea
      autoFocus
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") e.currentTarget.blur(); }}
      rows={2}
      className="text-xs border border-input rounded p-1 w-40 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SamplesDataTable({
  samples,
  columnSet,
  onRowUpdate,
  onRowDelete,
  onRoutingGenerated,
  onStepUpdate,            // (stepId, updates) => Promise<void>
  suppliersArray = [],     // Supplier[] — for step inline editing
  currentUser = null,      // { email } — for audit fields
  emptyState,
  // Reference data
  colorsMap = {},
  pcamsMap = {},
  sizesMap = {},
  projectsMap = {},
  rfqsMap = {},
  productsMap = {},
  colorsByProduct = {},
  pcamsByColor = {},
  sizesByProduct = {},
}) {
  const navigate = useNavigate();

  // ── Dialog state ──────────────────────────────────────────────────────────────
  const [routingDialogSample, setRoutingDialogSample] = useState(null);

  // ── Local optimistic rows ─────────────────────────────────────────────────────
  const [localRows, setLocalRows] = useState(samples);
  useEffect(() => { setLocalRows(samples); }, [samples]);

  // ── Expansion state ───────────────────────────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState(new Set());

  // ── Steps cache { [sampleId]: SampleStep[] | "loading" } ─────────────────────
  const [stepsCache, setStepsCache] = useState({});

  const fetchSteps = useCallback(async (sampleId) => {
    setStepsCache((prev) => ({ ...prev, [sampleId]: "loading" }));
    const steps = await base44.entities.SampleStep.filter({ sample_id: sampleId }, "sequence", 200);
    setStepsCache((prev) => ({ ...prev, [sampleId]: steps }));
  }, []);

  const toggleExpand = useCallback((sampleId, hasRouting) => {
    if (!hasRouting) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sampleId)) {
        next.delete(sampleId);
      } else {
        next.add(sampleId);
        // Fetch if not already loaded
        if (!stepsCache[sampleId] || stepsCache[sampleId] === "loading") {
          fetchSteps(sampleId);
        }
      }
      return next;
    });
  }, [stepsCache, fetchSteps]);

  // When stepsCache updates due to a step update, keep expanded rows updated
  const handleStepUpdate = useCallback(async (stepId, updates) => {
    if (!onStepUpdate) return;
    await onStepUpdate(stepId, updates);
    // Find which sample this step belongs to and refetch
    for (const [sampleId, steps] of Object.entries(stepsCache)) {
      if (Array.isArray(steps) && steps.some((s) => s.id === stepId)) {
        fetchSteps(sampleId);
        break;
      }
    }
  }, [onStepUpdate, stepsCache, fetchSteps]);

  // ── Filters ───────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    sampleType: [], phase: [], conformity: [], colorIds: [], hasRouting: "all", searchText: "",
  });

  const resetFilters = () => setFilters({ sampleType: [], phase: [], conformity: [], colorIds: [], hasRouting: "all", searchText: "" });

  const isFiltered =
    filters.sampleType.length > 0 || filters.phase.length > 0 || filters.conformity.length > 0 ||
    filters.colorIds.length > 0 || filters.hasRouting !== "all" || filters.searchText.trim() !== "";

  // ── Color options ─────────────────────────────────────────────────────────────
  const colorOptions = useMemo(() => {
    const ids = [...new Set(localRows.map((r) => r.product_color_id).filter(Boolean))];
    return ids.map((id) => colorsMap[id]).filter(Boolean).sort((a, b) => (a.color_name || "").localeCompare(b.color_name || ""));
  }, [localRows, colorsMap]);

  // ── Filtered rows ─────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let list = localRows;
    if (filters.sampleType.length > 0) list = list.filter((r) => filters.sampleType.includes(r.sample_type));
    if (filters.phase.length > 0) list = list.filter((r) => filters.phase.includes(r.phase));
    if (filters.conformity.length > 0) list = list.filter((r) => filters.conformity.includes(r.conformity_status));
    if (filters.colorIds.length > 0) list = list.filter((r) => filters.colorIds.includes(r.product_color_id));
    if (filters.hasRouting === "with") list = list.filter((r) => !!r.linked_routing_id);
    if (filters.hasRouting === "without") list = list.filter((r) => !r.linked_routing_id);
    if (filters.searchText.trim()) {
      const q = filters.searchText.toLowerCase();
      list = list.filter((r) => {
        const prod = productsMap[r.product_id];
        return (
          (r.code || "").toLowerCase().includes(q) ||
          (prod?.code || "").toLowerCase().includes(q) ||
          (prod?.name || "").toLowerCase().includes(q) ||
          (r.notes || "").toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [localRows, filters, productsMap]);

  // ── Optimistic sample update ──────────────────────────────────────────────────
  const handleUpdate = useCallback(async (rowId, updates) => {
    if (updates.sample_type) updates.phase = derivePhase(updates.sample_type);
    const prev = localRows.find((r) => r.id === rowId);
    setLocalRows((rows) => rows.map((r) => r.id === rowId ? { ...r, ...updates } : r));
    try {
      await onRowUpdate(rowId, updates);
    } catch {
      setLocalRows((rows) => rows.map((r) => r.id === rowId ? prev : r));
      toast.error("Failed to update sample. Please retry.");
    }
  }, [localRows, onRowUpdate]);

  // ── Inline editor option builders ─────────────────────────────────────────────
  const makeColorOptions = (row) =>
    (colorsByProduct[row.product_id] || Object.values(colorsMap).filter((c) => c.product_id === row.product_id))
      .map((c) => ({
        value: c.id,
        label: c.colorway_code ? `${c.colorway_code} — ${c.color_name}` : c.color_name,
        render: () => (
          <span className="flex items-center gap-2 text-xs">
            {c.color_hex && <span className="w-3 h-3 rounded-full border border-border shrink-0" style={{ backgroundColor: c.color_hex }} />}
            {c.colorway_code ? `${c.colorway_code} — ${c.color_name}` : c.color_name}
          </span>
        ),
      }));

  const makePcamOptions = (row) =>
    (pcamsByColor[row.product_color_id] || Object.values(pcamsMap).filter((pc) => pc.product_color_id === row.product_color_id))
      .map((pc) => ({ value: pc.id, label: pc.name || String(pc.sequence) }));

  const makeSizeOptions = (row) =>
    (sizesByProduct[row.product_id] || []).map((s) => ({ value: s.id, label: s.code || s.name }));

  const conformityDropdownOptions = CONFORMITY_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
    render: () => <span className={`text-[10px] px-1.5 py-0.5 rounded border ${o.style}`}>{o.label}</span>,
  }));

  // ── Column definitions ─────────────────────────────────────────────────────────

  // Expansion chevron column
  const expandCol = {
    id: "_expand",
    label: "",
    width: 32,
    sortKey: null,
    render: (r) => {
      if (!r.linked_routing_id) return <span className="w-5 h-5 block" />;
      const isExpanded = expandedIds.has(r.id);
      const isLoadingSteps = stepsCache[r.id] === "loading";
      return (
        <button
          type="button"
          className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => { e.stopPropagation(); toggleExpand(r.id, !!r.linked_routing_id); }}
          title={isExpanded ? "Collapse steps" : "Expand steps"}
        >
          {isLoadingSteps
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : isExpanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />
          }
        </button>
      );
    },
  };

  const codeCol = {
    id: "code", label: "Code", width: 130, sortKey: (r) => r.code || "",
    render: (r) => <span className="font-mono text-xs text-primary">{r.code || "—"}</span>,
  };

  const productCol = {
    id: "product", label: "Product", width: 200, sortKey: (r) => productsMap[r.product_id]?.code || "",
    render: (r) => {
      const prod = productsMap[r.product_id];
      if (!prod) return <span className="text-xs text-muted-foreground/40">—</span>;
      return (
        <button type="button" onClick={() => navigate(`/products/${prod.id}`)} className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center">
            {prod.images?.[0]
              ? <img src={prod.images[0]} alt="" className="w-full h-full object-contain" />
              : <span className="text-[9px] font-mono text-muted-foreground">{(prod.code || "").slice(0, 4)}</span>}
          </div>
          <div className="min-w-0">
            <span className="font-mono text-[10px] text-muted-foreground block">{prod.code}</span>
            <span className="text-xs font-medium truncate block max-w-[120px]">{prod.name}</span>
          </div>
        </button>
      );
    },
  };

  const projectCol = {
    id: "project", label: "Project", width: 160, sortKey: (r) => projectsMap[r.project_id]?.name || "",
    render: (r) => {
      const proj = projectsMap[r.project_id];
      if (!proj) return <span className="text-xs text-muted-foreground/40">—</span>;
      return (
        <button type="button" onClick={() => navigate(`/projects/${proj.id}`)} className="text-xs text-foreground hover:underline truncate block max-w-[140px]">
          {proj.name}
        </button>
      );
    },
  };

  const rfqCol = {
    id: "rfq", label: "RFQ", width: 110, sortKey: (r) => rfqsMap[r.rfq_id]?.code || "",
    render: (r) => {
      const rfq = rfqsMap[r.rfq_id];
      return rfq
        ? <span className="font-mono text-xs text-muted-foreground">{rfq.code}</span>
        : <span className="text-xs text-muted-foreground/40">—</span>;
    },
  };

  const sampleTypeCol = {
    id: "sample_type", label: "Type", width: 140, sortKey: (r) => r.sample_type || "",
    render: (r) => (
      <InlineDropdown
        value={r.sample_type}
        options={SAMPLE_TYPE_OPTIONS}
        placeholder="—"
        onCommit={(v) => { if (v) handleUpdate(r.id, { sample_type: v }); }}
      />
    ),
  };

  const phaseCol = {
    id: "phase", label: "Phase", width: 110, sortKey: (r) => r.phase || "",
    render: (r) => <PhaseChip phase={r.phase} />,
  };

  const colorCol = {
    id: "color", label: "Color", width: 150, sortKey: (r) => colorsMap[r.product_color_id]?.color_name || "",
    render: (r) => (
      <InlineDropdown
        value={r.product_color_id}
        options={makeColorOptions(r)}
        placeholder="—"
        onCommit={(v) => handleUpdate(r.id, { product_color_id: v, product_color_and_more_id: null })}
      />
    ),
  };

  const variationCol = {
    id: "variation", label: "Variation", width: 130, sortKey: (r) => pcamsMap[r.product_color_and_more_id]?.name || "",
    render: (r) => {
      const opts = makePcamOptions(r);
      if (!r.product_color_id) return <span className="text-xs text-muted-foreground/30 cursor-not-allowed" title="Pick a color first">—</span>;
      return (
        <InlineDropdown value={r.product_color_and_more_id} options={opts} placeholder="—" onCommit={(v) => handleUpdate(r.id, { product_color_and_more_id: v })} />
      );
    },
  };

  const sizeCol = {
    id: "size", label: "Size", width: 100, sortKey: (r) => sizesMap[r.size_id]?.code || "",
    render: (r) => (
      <InlineDropdown value={r.size_id} options={makeSizeOptions(r)} placeholder="—" onCommit={(v) => handleUpdate(r.id, { size_id: v })} />
    ),
  };

  const qtyCol = {
    id: "qty", label: "Req. Qty", width: 90, sortKey: (r) => r.requested_quantity ?? -1,
    render: (r) => <InlineNumberInput value={r.requested_quantity} onCommit={(v) => handleUpdate(r.id, { requested_quantity: v })} />,
  };

  const conformityCol = {
    id: "conformity", label: "Conformity", width: 140, sortKey: (r) => r.conformity_status || "",
    render: (r) => (
      <InlineDropdown
        value={r.conformity_status}
        options={conformityDropdownOptions}
        placeholder="—"
        onCommit={(v) => { if (v) handleUpdate(r.id, { conformity_status: v }); }}
      />
    ),
  };

  // Workflow Status — read-only, derived from children steps (Section E)
  const workflowStatusCol = {
    id: "workflow_status", label: "Workflow Status", width: 140, sortKey: (r) => {
      const steps = stepsCache[r.id];
      return Array.isArray(steps) ? computeParentWorkflowStatus(steps) || "" : "";
    },
    render: (r) => {
      if (!r.linked_routing_id) return <span className="text-xs text-muted-foreground/40">—</span>;
      const steps = stepsCache[r.id];
      if (!Array.isArray(steps)) return <span className="text-xs text-muted-foreground/40">—</span>;
      const status = computeParentWorkflowStatus(steps);
      return <WorkflowStatusBadge status={status} />;
    },
  };

  const createdCol = {
    id: "created_date", label: "Created", width: 110, sortKey: (r) => r.created_date || "",
    render: (r) => r.created_date
      ? <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_date), { addSuffix: true })}</span>
      : <span className="text-xs text-muted-foreground/40">—</span>,
  };

  const actionsCol = {
    id: "actions", label: "", width: 44, sortKey: null,
    render: (r) => {
      if (r.linked_routing_id) return null;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuItem onSelect={() => setRoutingDialogSample(r)} className="gap-2 text-xs">
              <Route className="w-3.5 h-3.5" />
              Generate Sample Routing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  };

  // rfqCol variant that shows "Standalone" when no RFQ
  const rfqWithStandaloneCol = {
    id: "rfq", label: "RFQ", width: 120, sortKey: (r) => rfqsMap[r.rfq_id]?.code || "",
    render: (r) => {
      const rfq = rfqsMap[r.rfq_id];
      return rfq
        ? <span className="font-mono text-xs text-muted-foreground">{rfq.code}</span>
        : <span className="text-xs text-muted-foreground/40 italic">Standalone</span>;
    },
  };

  // Section F column sets (with Workflow Status between Conformity and Created)
  const productColumns = [expandCol, codeCol, projectCol, rfqCol, sampleTypeCol, phaseCol, colorCol, variationCol, sizeCol, qtyCol, conformityCol, workflowStatusCol, createdCol, actionsCol];
  const rfqColumns    = [expandCol, codeCol, productCol, sampleTypeCol, phaseCol, colorCol, variationCol, sizeCol, qtyCol, conformityCol, workflowStatusCol, createdCol, actionsCol];
  const projectColumns = [expandCol, codeCol, productCol, rfqWithStandaloneCol, sampleTypeCol, phaseCol, colorCol, variationCol, sizeCol, qtyCol, conformityCol, workflowStatusCol, createdCol, actionsCol];
  const columns = columnSet === "rfq_context" ? rfqColumns : columnSet === "project_context" ? projectColumns : productColumns;

  // ── Total column count for "colspan" in expansion rows ────────────────────────
  const colCount = columns.length;

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (localRows.length === 0) {
    const Icon = emptyState?.icon || FlaskConical;
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
        <Icon className="w-10 h-10 opacity-25" />
        <p className="text-sm font-semibold text-foreground/70">{emptyState?.title || "No samples yet"}</p>
        {emptyState?.body && <p className="text-xs text-center max-w-xs">{emptyState.body}</p>}
        {emptyState?.ctaLabel && emptyState?.ctaOnClick && (
          <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={emptyState.ctaOnClick}>
            {emptyState.ctaLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip label={filters.sampleType.length ? `Type (${filters.sampleType.length})` : "Sample Type"} active={filters.sampleType.length > 0}>
          {SAMPLE_TYPE_OPTIONS.map((o) => (
            <DropdownMenuCheckboxItem key={o.value} checked={filters.sampleType.includes(o.value)}
              onCheckedChange={(c) => setFilters((f) => ({ ...f, sampleType: c ? [...f.sampleType, o.value] : f.sampleType.filter((v) => v !== o.value) }))}>
              {o.label}
            </DropdownMenuCheckboxItem>
          ))}
        </FilterChip>

        <FilterChip label={filters.phase.length ? `Phase (${filters.phase.length})` : "Phase"} active={filters.phase.length > 0}>
          {[{ value: "development", label: "Development" }, { value: "production", label: "Production" }].map((o) => (
            <DropdownMenuCheckboxItem key={o.value} checked={filters.phase.includes(o.value)}
              onCheckedChange={(c) => setFilters((f) => ({ ...f, phase: c ? [...f.phase, o.value] : f.phase.filter((v) => v !== o.value) }))}>
              {o.label}
            </DropdownMenuCheckboxItem>
          ))}
        </FilterChip>

        <FilterChip label={filters.conformity.length ? `Conformity (${filters.conformity.length})` : "Conformity"} active={filters.conformity.length > 0}>
          {CONFORMITY_OPTIONS.map((o) => (
            <DropdownMenuCheckboxItem key={o.value} checked={filters.conformity.includes(o.value)}
              onCheckedChange={(c) => setFilters((f) => ({ ...f, conformity: c ? [...f.conformity, o.value] : f.conformity.filter((v) => v !== o.value) }))}>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${o.style}`}>{o.label}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </FilterChip>

        {colorOptions.length > 0 && (
          <FilterChip label={filters.colorIds.length ? `Color (${filters.colorIds.length})` : "Color"} active={filters.colorIds.length > 0}>
            {colorOptions.map((c) => (
              <DropdownMenuCheckboxItem key={c.id} checked={filters.colorIds.includes(c.id)}
                onCheckedChange={(chk) => setFilters((f) => ({ ...f, colorIds: chk ? [...f.colorIds, c.id] : f.colorIds.filter((id) => id !== c.id) }))}>
                <span className="flex items-center gap-1.5 text-xs">
                  {c.color_hex && <span className="w-3 h-3 rounded-full border border-border shrink-0" style={{ backgroundColor: c.color_hex }} />}
                  {c.colorway_code || c.color_name}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </FilterChip>
        )}

        <FilterChip label={filters.hasRouting !== "all" ? `Routing: ${filters.hasRouting === "with" ? "With" : "Without"}` : "Routing"} active={filters.hasRouting !== "all"}>
          {[{ value: "all", label: "All" }, { value: "with", label: "With routing" }, { value: "without", label: "Without routing" }].map((o) => (
            <DropdownMenuItem key={o.value} onSelect={() => setFilters((f) => ({ ...f, hasRouting: o.value }))} className={filters.hasRouting === o.value ? "bg-primary/10" : ""}>
              {o.label}
            </DropdownMenuItem>
          ))}
        </FilterChip>

        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <Input value={filters.searchText} onChange={(e) => setFilters((f) => ({ ...f, searchText: e.target.value }))} placeholder="Search…" className="h-7 pl-6 pr-6 text-xs w-40" />
          {filters.searchText && (
            <button type="button" onClick={() => setFilters((f) => ({ ...f, searchText: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {isFiltered && (
          <button type="button" onClick={resetFilters} className="text-[11px] text-muted-foreground hover:text-destructive underline-offset-2 hover:underline transition-colors">
            Clear filters
          </button>
        )}
      </div>

      {/* ── No-match state ── */}
      {filteredRows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 border border-dashed border-border rounded-xl text-muted-foreground">
          <p className="text-sm">No samples match the current filters</p>
          <Button size="sm" variant="ghost" onClick={resetFilters}>Clear filters</Button>
        </div>
      )}

      {/* ── Table with expandable rows ── */}
      {filteredRows.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            {/* Header */}
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground whitespace-nowrap"
                    style={{ width: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.map((row) => {
                const isExpanded = expandedIds.has(row.id);
                return (
                  <>
                    {/* Parent row */}
                    <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                      {columns.map((col) => (
                        <td key={col.id} className="px-3 py-2.5 align-middle" style={{ width: col.width }}>
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                    {/* Expansion panel */}
                    {isExpanded && (
                      <tr key={`${row.id}_expand`}>
                        <td colSpan={colCount} className="p-0 bg-muted/10 border-t border-b border-primary/10">
                          <SampleStepsPanel
                            sample={row}
                            suppliersArray={suppliersArray}
                            stepsCache={stepsCache}
                            onFetchSteps={fetchSteps}
                            onStepUpdate={handleStepUpdate}
                            currentUser={currentUser}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Generate Sample Routing Dialog ── */}
      {routingDialogSample && (
        <GenerateSampleRoutingDialog
          open={!!routingDialogSample}
          onClose={() => setRoutingDialogSample(null)}
          sample={routingDialogSample}
          onGenerated={(newRouting) => {
            setRoutingDialogSample(null);
            if (onRoutingGenerated) onRoutingGenerated(newRouting);
          }}
        />
      )}
    </div>
  );
}