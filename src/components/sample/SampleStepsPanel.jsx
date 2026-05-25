import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import WorkflowStatusBadge from "./WorkflowStatusBadge";
import SampleStepsBulkToolbar from "./SampleStepsBulkToolbar";
import {
  WORKFLOW_STATUS_OPTIONS,
  getWorkflowStatusStyle,
} from "./sampleStepUtils";
import { CONFORMITY_OPTIONS } from "./sampleUtils";
import { useNavigate } from "react-router-dom";

// ── Inline step editors ───────────────────────────────────────────────────────

function StepInlineDropdown({ value, options, placeholder = "—", onCommit }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-left text-xs flex items-center gap-1 hover:text-primary transition-colors group min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="truncate">{value ? (options.find((o) => o.value === value)?.renderSelected?.() ?? options.find((o) => o.value === value)?.label ?? value) : <span className="text-muted-foreground/40">{placeholder}</span>}</span>
          <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px] max-h-64 overflow-y-auto">
        <DropdownMenuItem onSelect={() => onCommit(null)}>
          <span className="text-muted-foreground italic text-xs">— Clear —</span>
        </DropdownMenuItem>
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => onCommit(o.value)}
            className={value === o.value ? "bg-primary/10" : ""}
          >
            {o.render ? o.render() : <span className="text-xs">{o.label}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StepNumberInput({ value, min, onCommit }) {
  const [local, setLocal] = useState(value != null ? String(value) : "");
  const initialRef = useRef(value);
  useEffect(() => { setLocal(value != null ? String(value) : ""); initialRef.current = value; }, [value]);

  const commit = () => {
    const parsed = local.trim() === "" ? null : Number(local);
    const numeric = isNaN(parsed) ? null : parsed;
    if (numeric !== initialRef.current) { onCommit(numeric); initialRef.current = numeric; }
  };

  return (
    <Input
      type="number"
      min={min}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className="h-6 w-20 text-xs px-1.5"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function StepDatePicker({ value, onCommit }) {
  const [open, setOpen] = useState(false);
  const display = value ? format(new Date(value + "T00:00:00"), "yyyy-MM-dd") : "—";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-xs text-left hover:text-primary transition-colors group flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <span className={value ? "" : "text-muted-foreground/40"}>{display}</span>
          <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value + "T00:00:00") : undefined}
          onSelect={(d) => {
            onCommit(d ? format(d, "yyyy-MM-dd") : null);
            setOpen(false);
          }}
          initialFocus
        />
        {value && (
          <div className="p-2 border-t">
            <button
              type="button"
              className="text-xs text-destructive hover:underline"
              onClick={() => { onCommit(null); setOpen(false); }}
            >
              Clear date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function StepNotesCell({ value, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value || "");
  const initialRef = useRef(value || "");
  useEffect(() => { setLocal(value || ""); initialRef.current = value || ""; }, [value]);

  const commit = () => {
    setEditing(false);
    if (local !== initialRef.current) { onCommit(local || null); initialRef.current = local; }
  };

  if (editing) {
    return (
      <textarea
        autoFocus
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") e.currentTarget.blur(); }}
        rows={2}
        className="text-xs border border-input rounded p-1 w-36 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  const display = local ? (local.length > 30 ? local.slice(0, 30) + "…" : local) : null;
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-xs text-left text-muted-foreground hover:text-foreground transition-colors max-w-[130px] truncate"
      title={local || "Click to add notes"}
    >
      {display || <span className="text-muted-foreground/30 italic">Add…</span>}
    </button>
  );
}

// ── Conformity badge options ──────────────────────────────────────────────────
const conformityOptions = CONFORMITY_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  render: () => <span className={`text-[10px] px-1.5 py-0.5 rounded border ${o.style}`}>{o.label}</span>,
  renderSelected: () => <span className={`text-[10px] px-1.5 py-0.5 rounded border ${o.style}`}>{o.label}</span>,
}));

const workflowOptions = WORKFLOW_STATUS_OPTIONS.map((o) => {
  const style = getWorkflowStatusStyle(o.value);
  return {
    value: o.value,
    label: o.label,
    render: () => (
      <span
        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
        style={{ backgroundColor: style.background, color: style.color }}
      >
        {o.label}
      </span>
    ),
    renderSelected: () => (
      <span
        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
        style={{ backgroundColor: style.background, color: style.color }}
      >
        {o.label}
      </span>
    ),
  };
});

// ── Main panel ────────────────────────────────────────────────────────────────
export default function SampleStepsPanel({
  sample,
  suppliersArray,
  stepsCache,              // { [sampleId]: SampleStep[] | "loading" }
  onFetchSteps,            // (sampleId) => void — triggers a load/refetch
  onStepUpdate,            // (stepId, updates) => Promise<void>
  onBulkStepUpdate,        // (stepIds[], updates) => Promise<void>
  currentUser,
}) {
  const navigate = useNavigate();
  const sampleId = sample.id;

  // Local optimistic steps
  const rawSteps = stepsCache[sampleId];
  const isLoading = rawSteps === "loading" || rawSteps === undefined;
  const steps = Array.isArray(rawSteps) ? rawSteps : [];

  // Per-panel selection state
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === steps.length && steps.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(steps.map((s) => s.id)));
    }
  };

  // Clear selection on panel steps change
  useEffect(() => { setSelectedIds(new Set()); }, [sampleId]);

  // ── Optimistic step update ───────────────────────────────────────────────────
  const [localSteps, setLocalSteps] = useState(steps);
  useEffect(() => { setLocalSteps(steps); }, [rawSteps]);

  const handleStepUpdate = useCallback(async (stepId, updates) => {
    const prev = localSteps.find((s) => s.id === stepId);
    setLocalSteps((curr) => curr.map((s) => s.id === stepId ? { ...s, ...updates } : s));
    try {
      await onStepUpdate(stepId, updates);
    } catch {
      setLocalSteps((curr) => curr.map((s) => s.id === stepId ? prev : s));
      toast.error("Failed to update step.");
    }
  }, [localSteps, onStepUpdate]);

  // ── Bulk update ──────────────────────────────────────────────────────────────
  const handleBulkAction = useCallback(async (updatesFactory) => {
    const ids = [...selectedIds];
    const now = new Date().toISOString();
    const updates = updatesFactory(now);
    const prevMap = {};
    ids.forEach((id) => { prevMap[id] = localSteps.find((s) => s.id === id); });
    setLocalSteps((curr) => curr.map((s) => ids.includes(s.id) ? { ...s, ...updates } : s));
    setSelectedIds(new Set());
    try {
      await Promise.all(ids.map((id) => onStepUpdate(id, updates)));
      toast.success(`${ids.length} step${ids.length !== 1 ? "s" : ""} updated`);
      onFetchSteps(sampleId);
    } catch {
      setLocalSteps((curr) => curr.map((s) => prevMap[s.id] ? prevMap[s.id] : s));
      toast.error("Bulk update failed. Please retry.");
    }
  }, [selectedIds, localSteps, onStepUpdate, onFetchSteps, sampleId]);

  const handleBulkSupplier = (supplierId) => handleBulkAction(() => ({ supplier_id: supplierId }));
  const handleBulkDueDate = (date) => handleBulkAction(() => ({ due_date: date }));
  const handleBulkStatus = (status) => handleBulkAction((now) => ({
    workflow_status: status,
    workflow_status_changed_at: now,
    workflow_status_changed_by: currentUser?.email || null,
  }));

  // ── Resolve supplier name ────────────────────────────────────────────────────
  const suppliersMap = {};
  suppliersArray.forEach((s) => { suppliersMap[s.id] = s; });

  const supplierOptions = suppliersArray.map((s) => ({
    value: s.id,
    label: `${s.code || ""} ${s.name}`.trim(),
    render: () => (
      <span className="text-xs flex gap-1.5">
        <span className="font-mono text-muted-foreground">{s.code}</span>
        {s.name}
      </span>
    ),
  }));

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-6 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading steps…
      </div>
    );
  }

  if (localSteps.length === 0) {
    return (
      <div className="py-4 px-6 text-xs text-muted-foreground flex items-center gap-3">
        <span>No steps defined yet. Steps can be added from the Sample Routing in Product → Suppliers → Section B.</span>
        <button
          type="button"
          onClick={() => navigate(`/products/${sample.product_id}`)}
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline whitespace-nowrap"
        >
          Open Sample Routing <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const allSelected = selectedIds.size === localSteps.length && localSteps.length > 0;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="pl-8 pr-2 pb-3 space-y-2">
      {/* Panel header */}
      <div className="flex items-center justify-between pt-1 pb-0.5">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          {localSteps.length} step{localSteps.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => onFetchSteps(sampleId)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh steps"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Bulk toolbar */}
      <SampleStepsBulkToolbar
        selectedCount={selectedIds.size}
        suppliersArray={suppliersArray}
        onChangeSupplier={handleBulkSupplier}
        onChangeDueDate={handleBulkDueDate}
        onChangeStatus={handleBulkStatus}
      />

      {/* Sub-table */}
      <div className="border border-border rounded-lg overflow-hidden border-l-2 border-l-muted-foreground/20">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="w-8 px-2 py-1.5 text-left">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  className="h-3 w-3"
                  data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                />
              </th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-10">Seq</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-32">Step Type</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-44">Supplier</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-24">Lead Time</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-28">Due Date</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-20">Req. Qty</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-32">Workflow</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-32">Conformity</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {localSteps.map((step) => {
              const supplier = suppliersMap[step.supplier_id];
              const isSelected = selectedIds.has(step.id);

              return (
                <tr
                  key={step.id}
                  className={`transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}
                >
                  {/* Checkbox */}
                  <td className="px-2 py-2">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRow(step.id)}
                      className="h-3 w-3"
                    />
                  </td>

                  {/* Seq — read only */}
                  <td className="px-2 py-2 font-mono text-muted-foreground">
                    {step.sequence}
                  </td>

                  {/* Step Type — read only */}
                  <td className="px-2 py-2 text-foreground">
                    {step.step_type
                      ? step.step_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                      : <span className="text-muted-foreground/40">—</span>
                    }
                  </td>

                  {/* Supplier — editable */}
                  <td className="px-2 py-2">
                    <StepInlineDropdown
                      value={step.supplier_id}
                      options={supplierOptions}
                      placeholder="—"
                      onCommit={(v) => handleStepUpdate(step.id, { supplier_id: v })}
                    />
                  </td>

                  {/* Lead Time — editable */}
                  <td className="px-2 py-2">
                    <StepNumberInput
                      value={step.lead_time_days}
                      min={0}
                      onCommit={(v) => handleStepUpdate(step.id, { lead_time_days: v })}
                    />
                  </td>

                  {/* Due Date — editable */}
                  <td className="px-2 py-2">
                    <StepDatePicker
                      value={step.due_date}
                      onCommit={(v) => handleStepUpdate(step.id, { due_date: v })}
                    />
                  </td>

                  {/* Requested Qty — editable */}
                  <td className="px-2 py-2">
                    <StepNumberInput
                      value={step.requested_quantity}
                      min={1}
                      onCommit={(v) => handleStepUpdate(step.id, { requested_quantity: v })}
                    />
                  </td>

                  {/* Workflow Status — editable */}
                  <td className="px-2 py-2">
                    <StepInlineDropdown
                      value={step.workflow_status}
                      options={workflowOptions}
                      placeholder="—"
                      onCommit={(v) => {
                        if (!v) return;
                        const now = new Date().toISOString();
                        handleStepUpdate(step.id, {
                          workflow_status: v,
                          workflow_status_changed_at: now,
                          workflow_status_changed_by: currentUser?.email || null,
                        });
                      }}
                    />
                  </td>

                  {/* Conformity Status — editable */}
                  <td className="px-2 py-2">
                    <StepInlineDropdown
                      value={step.conformity_status}
                      options={conformityOptions}
                      placeholder="—"
                      onCommit={(v) => {
                        if (!v) return;
                        const now = new Date().toISOString();
                        handleStepUpdate(step.id, {
                          conformity_status: v,
                          conformity_assessed_at: now,
                          conformity_assessed_by: currentUser?.email || null,
                        });
                      }}
                    />
                  </td>

                  {/* Notes — editable */}
                  <td className="px-2 py-2">
                    <StepNotesCell
                      value={step.notes}
                      onCommit={(v) => handleStepUpdate(step.id, { notes: v })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}