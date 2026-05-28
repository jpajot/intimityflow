import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Loader2, ChevronDown, ChevronRight, FlaskConical, AlertCircle, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  WORKFLOW_STATUS_OPTIONS,
  getWorkflowStatusStyle,
  getWorkflowStatusLabel,
} from "./sampleStepUtils";
import { CONFORMITY_OPTIONS, SAMPLE_TYPE_OPTIONS } from "./sampleUtils";

// ── Constants ────────────────────────────────────────────────────────────────

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const DONE_STATUSES = new Set(["received", "partially_received"]);

function isOverdue(step) {
  if (!step.due_date) return false;
  if (DONE_STATUSES.has(step.workflow_status)) return false;
  return new Date(step.due_date + "T00:00:00") < TODAY;
}

// ── Inline Editors (reused from SampleStepsPanel pattern) ───────────────────

function StepInlineDropdown({ value, options, placeholder = "—", onCommit }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-left text-xs flex items-center gap-1 hover:text-primary transition-colors group min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="truncate">
            {value
              ? (options.find((o) => o.value === value)?.renderSelected?.() ?? options.find((o) => o.value === value)?.label ?? value)
              : <span className="text-muted-foreground/40">{placeholder}</span>}
          </span>
          <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px] max-h-64 overflow-y-auto">
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

function StepDatePickerCell({ value, isOverdueFlag, onCommit }) {
  const [open, setOpen] = useState(false);
  const display = value ? format(new Date(value + "T00:00:00"), "yyyy-MM-dd") : "—";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`text-xs text-left hover:text-primary transition-colors group flex items-center gap-1 ${isOverdueFlag ? "text-red-600 font-medium" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className={!value ? "text-muted-foreground/40" : ""}>{display}</span>
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

// ── Options builders ─────────────────────────────────────────────────────────

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
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: style.background, color: style.color }}>
        {o.label}
      </span>
    ),
    renderSelected: () => (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: style.background, color: style.color }}>
        {o.label}
      </span>
    ),
  };
});

// ── Group summary chips ───────────────────────────────────────────────────────

function GroupSummaryChips({ steps }) {
  const statusCounts = {};
  let overdueCount = 0;

  steps.forEach((s) => {
    const st = s.workflow_status || "created";
    statusCounts[st] = (statusCounts[st] || 0) + 1;
    if (isOverdue(s)) overdueCount++;
  });

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {WORKFLOW_STATUS_OPTIONS.filter((o) => statusCounts[o.value] > 0).map((o) => {
        const style = getWorkflowStatusStyle(o.value);
        return (
          <span
            key={o.value}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: style.background, color: style.color }}
          >
            {statusCounts[o.value]} {o.label.toLowerCase()}
          </span>
        );
      })}
      {overdueCount > 0 && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
          {overdueCount} overdue
        </span>
      )}
    </div>
  );
}

// ── Supplier Group ────────────────────────────────────────────────────────────

function SupplierGroup({ supplier, steps, samplesMap, productsMap, colorsMap, sizesMap, onStepUpdate, currentUser }) {
  const [collapsed, setCollapsed] = useState(false);
  const [localSteps, setLocalSteps] = useState(steps);

  // Sync when parent steps update (e.g. after filter/reload)
  useEffect(() => { setLocalSteps(steps); }, [steps]);

  const handleUpdate = useCallback(async (stepId, updates) => {
    const prev = localSteps.find((s) => s.id === stepId);
    setLocalSteps((curr) => curr.map((s) => s.id === stepId ? { ...s, ...updates } : s));
    try {
      await onStepUpdate(stepId, updates);
    } catch {
      setLocalSteps((curr) => curr.map((s) => s.id === stepId ? prev : s));
      toast.error("Failed to update step.");
    }
  }, [localSteps, onStepUpdate]);

  const supplierLabel = supplier
    ? `${supplier.name}${supplier.code ? ` · ${supplier.code}` : ""}`
    : "Unassigned";

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Group header */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {collapsed ? <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
          <span className="text-sm font-semibold truncate">{supplierLabel}</span>
          <span className="text-[10px] text-muted-foreground font-normal ml-1">{localSteps.length} step{localSteps.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
          <GroupSummaryChips steps={localSteps} />
        </div>
      </button>

      {/* Step rows */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/20 border-b border-border">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Sample</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Product</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Color / Size</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Step Type</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap w-16">Qty</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap w-28">Due Date</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap w-32">Workflow</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap w-32">Conformity</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {localSteps.map((step) => {
                const sample = samplesMap[step.sample_id];
                const product = sample ? productsMap[sample.product_id] : null;
                const color = sample ? colorsMap[sample.product_color_id] : null;
                const size = sample ? sizesMap[sample.size_id] : null;
                const isDone = DONE_STATUSES.has(step.workflow_status);
                const overdueFlag = isOverdue(step);
                const conformityOpt = CONFORMITY_OPTIONS.find((o) => o.value === step.conformity_status);

                const colorSizeParts = [color?.colorway_code, size?.name].filter(Boolean);

                return (
                  <tr
                    key={step.id}
                    className={`transition-colors hover:bg-muted/20 ${isDone ? "opacity-55" : ""}`}
                  >
                    {/* Sample Code */}
                    <td className="px-3 py-2">
                      {sample ? (
                        <Link
                          to={`/samples/${step.sample_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-[11px] text-primary hover:underline underline-offset-2"
                        >
                          {sample.code}
                        </Link>
                      ) : (
                        <span className="font-mono text-[11px] text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* Product */}
                    <td className="px-3 py-2 max-w-[160px]">
                      {product ? (
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono text-[10px] text-muted-foreground">{product.code}</span>
                          <span className="text-xs truncate">{product.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* Color / Size */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {colorSizeParts.length > 0 ? (
                        <span className="text-xs text-muted-foreground">{colorSizeParts.join(" / ")}</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* Step Type */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {step.step_type
                        ? step.step_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>

                    {/* Qty */}
                    <td className="px-3 py-2">
                      {step.requested_quantity != null
                        ? <span className="font-mono">{step.requested_quantity}</span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>

                    {/* Due Date — inline editable */}
                    <td className="px-3 py-2">
                      <StepDatePickerCell
                        value={step.due_date}
                        isOverdueFlag={overdueFlag}
                        onCommit={(v) => handleUpdate(step.id, { due_date: v })}
                      />
                    </td>

                    {/* Workflow Status — inline editable */}
                    <td className="px-3 py-2">
                      <StepInlineDropdown
                        value={step.workflow_status}
                        options={workflowOptions}
                        placeholder="—"
                        onCommit={(v) => {
                          if (!v) return;
                          const now = new Date().toISOString();
                          handleUpdate(step.id, {
                            workflow_status: v,
                            workflow_status_changed_at: now,
                            workflow_status_changed_by: currentUser?.email || null,
                          });
                        }}
                      />
                    </td>

                    {/* Conformity — inline editable */}
                    <td className="px-3 py-2">
                      <StepInlineDropdown
                        value={step.conformity_status}
                        options={conformityOptions}
                        placeholder="—"
                        onCommit={(v) => {
                          if (!v) return;
                          const now = new Date().toISOString();
                          handleUpdate(step.id, {
                            conformity_status: v,
                            conformity_assessed_at: now,
                            conformity_assessed_by: currentUser?.email || null,
                          });
                        }}
                      />
                    </td>

                    {/* Notes */}
                    <td className="px-3 py-2 max-w-[150px]">
                      {step.notes ? (
                        <span className="text-muted-foreground truncate block" title={step.notes}>
                          {step.notes.length > 30 ? step.notes.slice(0, 30) + "…" : step.notes}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({ filters, onFiltersChange, productsMap, suppliersMap, allSteps, samplesMap }) {
  const { workflowStatuses, conformityStatuses, overdueOnly, sampleTypes, productIds, supplierIds, search } = filters;

  const availableProducts = useMemo(() => {
    const ids = new Set(allSteps.map((s) => samplesMap[s.sample_id]?.product_id).filter(Boolean));
    return Object.values(productsMap).filter((p) => ids.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [allSteps, samplesMap, productsMap]);

  const availableSuppliers = useMemo(() => {
    const ids = new Set(allSteps.map((s) => s.supplier_id).filter(Boolean));
    return Object.values(suppliersMap).filter((s) => ids.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [allSteps, suppliersMap]);

  const hasFilters = workflowStatuses.length > 0 || conformityStatuses.length > 0 || overdueOnly || sampleTypes.length > 0 || productIds.length > 0 || supplierIds.length > 0 || search.trim();

  function toggleItem(key, value) {
    const current = filters[key];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onFiltersChange({ ...filters, [key]: next });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pb-2">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        placeholder="Search samples, products, steps…"
        className="h-7 text-xs px-2.5 border border-border rounded-md bg-background w-52 focus:outline-none focus:ring-1 focus:ring-ring"
      />

      {/* Workflow Status */}
      <MultiSelectChip
        label="Workflow"
        options={WORKFLOW_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        selected={workflowStatuses}
        onToggle={(v) => toggleItem("workflowStatuses", v)}
      />

      {/* Conformity */}
      <MultiSelectChip
        label="Conformity"
        options={CONFORMITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        selected={conformityStatuses}
        onToggle={(v) => toggleItem("conformityStatuses", v)}
      />

      {/* Sample Type */}
      <MultiSelectChip
        label="Sample Type"
        options={SAMPLE_TYPE_OPTIONS}
        selected={sampleTypes}
        onToggle={(v) => toggleItem("sampleTypes", v)}
      />

      {/* Products */}
      {availableProducts.length > 0 && (
        <MultiSelectChip
          label="Product"
          options={availableProducts.map((p) => ({ value: p.id, label: p.name || p.code }))}
          selected={productIds}
          onToggle={(v) => toggleItem("productIds", v)}
        />
      )}

      {/* Suppliers */}
      {availableSuppliers.length > 0 && (
        <MultiSelectChip
          label="Supplier"
          options={availableSuppliers.map((s) => ({ value: s.id, label: s.name }))}
          selected={supplierIds}
          onToggle={(v) => toggleItem("supplierIds", v)}
        />
      )}

      {/* Overdue toggle */}
      <button
        type="button"
        onClick={() => onFiltersChange({ ...filters, overdueOnly: !overdueOnly })}
        className={`h-7 px-2.5 text-xs rounded-md border transition-colors ${overdueOnly ? "bg-red-100 text-red-700 border-red-200" : "border-border text-muted-foreground hover:bg-muted"}`}
      >
        Overdue only
      </button>

      {/* Clear */}
      {hasFilters && (
        <button
          type="button"
          onClick={() => onFiltersChange({ workflowStatuses: [], conformityStatuses: [], overdueOnly: false, sampleTypes: [], productIds: [], supplierIds: [], search: "" })}
          className="h-7 px-2 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Clear filters
        </button>
      )}
    </div>
  );
}

function MultiSelectChip({ label, options, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  const activeCount = selected.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`h-7 px-2.5 text-xs rounded-md border transition-colors flex items-center gap-1 ${activeCount > 0 ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:bg-muted"}`}
        >
          {label}{activeCount > 0 && <span className="ml-0.5 font-semibold">({activeCount})</span>}
          <ChevronDown className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-0.5">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${selected.includes(o.value) ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
            >
              {selected.includes(o.value) && "✓ "}{o.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function SamplesTrackingBoard({ projectId, externalFilters }) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [samples, setSamples] = useState([]);
  const [steps, setSteps] = useState([]);
  const [productsMap, setProductsMap] = useState({});
  const [colorsMap, setColorsMap] = useState({});
  const [sizesMap, setSizesMap] = useState({});
  const [suppliersMap, setSuppliersMap] = useState({});

  const [filters, setFilters] = useState({
    workflowStatuses: [],
    conformityStatuses: [],
    overdueOnly: false,
    sampleTypes: [],
    productIds: [],
    supplierIds: [],
    search: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const projectSamples = await base44.entities.Sample.filter({ project_id: projectId }, "-created_date", 500);
    setSamples(projectSamples);

    if (projectSamples.length === 0) { setLoading(false); return; }

    const sampleIds = projectSamples.map((s) => s.id);
    const projectSteps = await base44.entities.SampleStep.filter({ sample_id: { $in: sampleIds } }, "due_date", 2000);
    setSteps(projectSteps);

    if (projectSteps.length === 0) { setLoading(false); return; }

    const productIds = [...new Set(projectSamples.map((s) => s.product_id).filter(Boolean))];
    const colorIds = [...new Set(projectSamples.map((s) => s.product_color_id).filter(Boolean))];
    const sizeIds = [...new Set(projectSamples.map((s) => s.size_id).filter(Boolean))];
    const supplierIds = [...new Set(projectSteps.map((s) => s.supplier_id).filter(Boolean))];

    const [allProds, allColors, allSizes, allSuppliers] = await Promise.all([
      productIds.length ? base44.entities.Product.list("code", 2000) : Promise.resolve([]),
      colorIds.length ? base44.entities.ProductColor.list("colorway_code", 2000) : Promise.resolve([]),
      sizeIds.length ? base44.entities.Size.list("name", 500) : Promise.resolve([]),
      supplierIds.length ? base44.entities.Supplier.list("name", 500) : Promise.resolve([]),
    ]);

    const pMap = {};
    allProds.filter((p) => productIds.includes(p.id)).forEach((p) => { pMap[p.id] = p; });
    setProductsMap(pMap);

    const cMap = {};
    allColors.filter((c) => colorIds.includes(c.id)).forEach((c) => { cMap[c.id] = c; });
    setColorsMap(cMap);

    const sMap = {};
    allSizes.filter((s) => sizeIds.includes(s.id)).forEach((s) => { sMap[s.id] = s; });
    setSizesMap(sMap);

    const supMap = {};
    allSuppliers.filter((s) => supplierIds.includes(s.id)).forEach((s) => { supMap[s.id] = s; });
    setSuppliersMap(supMap);

    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleStepUpdate = useCallback(async (stepId, updates) => {
    await base44.entities.SampleStep.update(stepId, updates);
    setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, ...updates } : s));
  }, []);

  const samplesMap = useMemo(() => {
    const m = {};
    samples.forEach((s) => { m[s.id] = s; });
    return m;
  }, [samples]);

  // ── Filter steps ──────────────────────────────────────────────────────────
  const activeFilters = externalFilters || filters;

  const filteredSteps = useMemo(() => {
    const searchLow = activeFilters.search.trim().toLowerCase();
    return steps.filter((step) => {
      const sample = samplesMap[step.sample_id];

      if (activeFilters.workflowStatuses.length > 0 && !activeFilters.workflowStatuses.includes(step.workflow_status)) return false;
      if (activeFilters.conformityStatuses.length > 0 && !activeFilters.conformityStatuses.includes(step.conformity_status)) return false;
      if (activeFilters.overdueOnly && !isOverdue(step)) return false;
      if (activeFilters.sampleTypes.length > 0 && (!sample || !activeFilters.sampleTypes.includes(sample.sample_type))) return false;
      if (activeFilters.productIds.length > 0 && (!sample || !activeFilters.productIds.includes(sample.product_id))) return false;
      if (activeFilters.supplierIds.length > 0 && !activeFilters.supplierIds.includes(step.supplier_id)) return false;

      if (searchLow) {
        const product = sample ? productsMap[sample.product_id] : null;
        const searchTargets = [
          sample?.code || "",
          product?.code || "",
          product?.name || "",
          step.step_type || "",
          step.notes || "",
        ].join(" ").toLowerCase();
        if (!searchTargets.includes(searchLow)) return false;
      }

      return true;
    });
  }, [steps, activeFilters, samplesMap, productsMap]);

  // ── Group by supplier ─────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const grouped = {};
    filteredSteps.forEach((step) => {
      const key = step.supplier_id || "__unassigned__";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(step);
    });

    // Sort steps within each group: due_date asc (nulls last), then sample code asc
    Object.values(grouped).forEach((groupSteps) => {
      groupSteps.sort((a, b) => {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        if (da !== db) return da - db;
        const ca = samplesMap[a.sample_id]?.code || "";
        const cb = samplesMap[b.sample_id]?.code || "";
        return ca.localeCompare(cb);
      });
    });

    // Sort groups: named suppliers alphabetically, Unassigned last
    const named = Object.keys(grouped)
      .filter((k) => k !== "__unassigned__")
      .sort((a, b) => (suppliersMap[a]?.name || "").localeCompare(suppliersMap[b]?.name || ""));

    const result = named.map((key) => ({ supplierId: key, supplier: suppliersMap[key] || null, steps: grouped[key] }));
    if (grouped["__unassigned__"]) {
      result.push({ supplierId: null, supplier: null, steps: grouped["__unassigned__"] });
    }
    return result;
  }, [filteredSteps, suppliersMap, samplesMap]);

  // ── Empty states ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (samples.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <FlaskConical className="w-10 h-10 opacity-20" />
        <p className="text-sm font-semibold text-foreground/70">No samples to track</p>
        <p className="text-xs text-center max-w-xs">Samples created in this project will appear here once they have steps.</p>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <FlaskConical className="w-10 h-10 opacity-20" />
        <p className="text-sm font-semibold text-foreground/70">No sample steps yet</p>
        <p className="text-xs text-center max-w-xs">Generate a sample routing on a sample to create trackable steps.</p>
      </div>
    );
  }

  const hasActiveFilters = activeFilters.workflowStatuses.length > 0 || activeFilters.conformityStatuses.length > 0 || activeFilters.overdueOnly || activeFilters.sampleTypes.length > 0 || activeFilters.productIds.length > 0 || activeFilters.supplierIds.length > 0 || activeFilters.search.trim();

  if (groups.length === 0 && hasActiveFilters) {
    return (
      <div className="space-y-3">
        <FilterBar filters={filters} onFiltersChange={setFilters} productsMap={productsMap} suppliersMap={suppliersMap} allSteps={steps} samplesMap={samplesMap} />
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <AlertCircle className="w-8 h-8 opacity-30" />
          <p className="text-sm font-semibold text-foreground/70">No steps match the current filters</p>
          <button type="button" onClick={() => setFilters({ workflowStatuses: [], conformityStatuses: [], overdueOnly: false, sampleTypes: [], productIds: [], supplierIds: [], search: "" })} className="text-xs text-primary underline underline-offset-2 hover:no-underline">
            Clear filters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FilterBar filters={filters} onFiltersChange={setFilters} productsMap={productsMap} suppliersMap={suppliersMap} allSteps={steps} samplesMap={samplesMap} />
      {groups.map((group) => (
        <SupplierGroup
          key={group.supplierId || "__unassigned__"}
          supplier={group.supplier}
          steps={group.steps}
          samplesMap={samplesMap}
          productsMap={productsMap}
          colorsMap={colorsMap}
          sizesMap={sizesMap}
          onStepUpdate={handleStepUpdate}
          currentUser={user}
        />
      ))}
    </div>
  );
}