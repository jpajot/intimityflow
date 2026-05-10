import { useState, useMemo, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, X, MoreVertical, Trash2, Filter, Pencil, MessageSquarePlus, Download, Upload } from "lucide-react";
import DataTable from "@/components/DataTable";
import QuickFiltersPanel, { applyQuickFilters } from "@/components/QuickFiltersPanel";
import ViewDrawerContent from "@/components/ViewDrawerContent";
import RFQLineBuilderDialog from "./RFQLineBuilderDialog";
import AddResponseDialog from "./AddResponseDialog";
import ResponsesPanel from "./ResponsesPanel";
import ExportTodoDialog from "./ExportTodoDialog";
import ImportResponsesDialog from "./ImportResponsesDialog";
import { usePageOptions } from "@/lib/PageOptionsContext";

// ── constants ──────────────────────────────────────────────────────────────────
const LINE_STATUS_COLORS = {
  pending:   "bg-gray-100 text-gray-600 border-gray-200",
  answered:  "bg-blue-100 text-blue-700 border-blue-200",
  awarded:   "bg-green-100 text-green-700 border-green-200",
  declined:  "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
};

// ── helpers ────────────────────────────────────────────────────────────────────
function makeQfFields(productMap, supplierMap, stepMap) {
  return [
    {
      id: "product",
      label: "Product",
      getValue: (r) => `${productMap[r.product_id]?.code || ""} ${productMap[r.product_id]?.name || ""}`.trim(),
    },
    {
      id: "status",
      label: "Status",
      getValue: (r) => r.status || "",
    },
    {
      id: "supplier",
      label: "Recipient Supplier",
      getValue: (r) => supplierMap[r.recipient_supplier_id]?.name || "",
    },
    {
      id: "step_type",
      label: "Routing Step",
      getValue: (r) => stepMap[r.routing_step_id]?.step_type || "",
    },
    {
      id: "granularity",
      label: "Granularity",
      getValue: (r) => {
        if (r.product_color_and_more_id) return "PCAM";
        if (r.product_color_id) return "ProductColor";
        return "Product";
      },
    },
  ];
}

// ── main ───────────────────────────────────────────────────────────────────────
export default function RFQCostsTab({ rfqId, projectId, rfq, lines, refData, onLinesChange, locked = false }) {
  const { products, colors, pcams, steps, suppliers } = refData;
  const { setOptions } = usePageOptions();

  const [showBuilder, setShowBuilder] = useState(false);
  const [responseTarget, setResponseTarget] = useState(null); // line to add response to (quick add from kebab)
  const [panelLine, setPanelLine] = useState(null);           // line whose responses panel is open
  const [responseCounts, setResponseCounts] = useState({});   // { [lineId]: count }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [quickFilters, setQuickFilters] = useState([]);
  const [showQF, setShowQF] = useState(false);
  const [showManageViews, setShowManageViews] = useState(false);
  const [activeViewId, setActiveViewId] = useState("default");
  const [columnIds, setColumnIds] = useState(null); // null = use all columns
  const [pinnedCols, setPinnedCols] = useState(["product"]);

  // ── Lookup maps ───────────────────────────────────────────────────────────────
  const productMap  = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const colorMap    = useMemo(() => Object.fromEntries(colors.map((c) => [c.id, c])), [colors]);
  const pcamMap     = useMemo(() => Object.fromEntries(pcams.map((p) => [p.id, p])), [pcams]);
  const stepMap     = useMemo(() => Object.fromEntries(steps.map((s) => [s.id, s])), [steps]);
  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers]);

  // ── Load response counts for all lines ───────────────────────────────────
  useEffect(() => {
    if (lines.length === 0) { setResponseCounts({}); return; }
    base44.entities.RFQResponse.filter({ rfq_line_id: { $in: lines.map((l) => l.id) } }, "-created_date", 5000)
      .then((responses) => {
        const counts = {};
        for (const r of responses) {
          counts[r.rfq_line_id] = (counts[r.rfq_line_id] || 0) + 1;
        }
        setResponseCounts(counts);
      });
  }, [lines]);

  const getGranularity = (line) => {
    if (line.product_color_and_more_id) return "PCAM";
    if (line.product_color_id) return "ProductColor";
    return "Product";
  };

  const getGranLabel = (line) => {
    if (line.product_color_and_more_id) {
      const c = colorMap[line.product_color_id];
      const pc = pcamMap[line.product_color_and_more_id];
      return c && pc ? `${c.color_name} › ${pc.name}` : "PCAM";
    }
    if (line.product_color_id) {
      const c = colorMap[line.product_color_id];
      return c ? c.color_name : "Color";
    }
    return "";
  };

  // ── Columns for DataTable ─────────────────────────────────────────────────────
  const handleQtyBlur = useCallback(async (line, newVal) => {
    const qty = parseFloat(newVal);
    if (isNaN(qty) || qty === line.forecasted_qty) return;
    await base44.entities.RFQLine.update(line.id, { forecasted_qty: qty });
    onLinesChange();
  }, [onLinesChange]);

  const columns = useMemo(() => [
    {
      id: "product",
      label: "Product",
      width: 200,
      sortKey: (r) => productMap[r.product_id]?.code || "",
      render: (r) => {
        const prod = productMap[r.product_id];
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center">
              {prod?.images?.[0]
                ? <img src={prod.images[0]} alt="" className="w-full h-full object-contain" />
                : <span className="text-[9px] font-mono text-muted-foreground">{(prod?.code || "").slice(0, 4)}</span>}
            </div>
            <div className="min-w-0">
              <span className="font-mono text-[10px] text-muted-foreground block">{prod?.code}</span>
              <span className="text-xs font-medium truncate block">{prod?.name}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: "granularity",
      label: "Granularity",
      width: 160,
      sortKey: (r) => getGranularity(r),
      render: (r) => (
        <div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            {getGranularity(r)}
          </span>
          {getGranLabel(r) && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]">{getGranLabel(r)}</p>
          )}
        </div>
      ),
    },
    {
      id: "step",
      label: "Routing Step",
      width: 160,
      sortKey: (r) => (stepMap[r.routing_step_id]?.sequence || 0).toString().padStart(5, "0"),
      render: (r) => {
        const s = stepMap[r.routing_step_id];
        return s
          ? <span className="text-xs">Step {s.sequence}: {s.step_type?.replace(/_/g, " ")}</span>
          : <span className="text-xs text-muted-foreground/40">—</span>;
      },
    },
    {
      id: "supplier",
      label: "Recipient Supplier",
      width: 160,
      sortKey: (r) => supplierMap[r.recipient_supplier_id]?.name || "",
      render: (r) => {
        const sup = supplierMap[r.recipient_supplier_id];
        const step = stepMap[r.routing_step_id];
        const isAlt = step?.supplier_id && r.recipient_supplier_id !== step.supplier_id;
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs">{sup?.name || <span className="text-muted-foreground/40">—</span>}</span>
            {isAlt && (
              <span className="text-[9px] px-1 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 font-semibold uppercase">alt</span>
            )}
          </div>
        );
      },
    },
    {
      id: "qty",
      label: "Fcst. Qty",
      width: 130,
      sortKey: (r) => r.forecasted_qty ?? 0,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {locked ? (
            <span className="text-xs font-mono">{r.forecasted_qty ?? 0}</span>
          ) : (
            <Input
              type="number"
              min={0}
              defaultValue={r.forecasted_qty ?? 0}
              onBlur={(e) => handleQtyBlur(r, e.target.value)}
              className="h-7 w-20 text-xs"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <span className="text-[10px] text-muted-foreground shrink-0">{r.forecasted_qty_uom || ""}</span>
        </div>
      ),
    },
    {
      id: "status",
      label: "Status",
      width: 110,
      sortKey: (r) => r.status || "",
      render: (r) => (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${LINE_STATUS_COLORS[r.status] || "bg-muted text-muted-foreground border-border"}`}>
          {(r.status || "").replace(/_/g, " ")}
        </span>
      ),
    },
    {
      id: "responses",
      label: "Responses",
      width: 110,
      sortKey: (r) => responseCounts[r.id] || 0,
      render: (r) => {
        const count = responseCounts[r.id] || 0;
        const isOpen = panelLine?.id === r.id;
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setPanelLine(isOpen ? null : r); }}
            className={`flex items-center gap-1.5 transition-colors ${isOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold border ${count > 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-muted text-muted-foreground border-border"}`}>
              {count}
            </span>
            <span className="text-[10px] underline underline-offset-2">View</span>
          </button>
        );
      },
    },
    {
      id: "actions",
      label: "",
      width: 44,
      render: (r) => {
        const canDelete = !locked && r.status === "pending";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setResponseTarget(r)}>
                <MessageSquarePlus className="w-3.5 h-3.5 mr-2" />
                Add Response
              </DropdownMenuItem>
              {canDelete && (
                <DropdownMenuItem onClick={() => setDeleteTarget(r)} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Remove line
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [productMap, colorMap, pcamMap, stepMap, supplierMap, handleQtyBlur, responseCounts, panelLine]);

  // ── filter fields for QuickFiltersPanel ──────────────────────────────────────
  const qfFields = useMemo(() => makeQfFields(productMap, supplierMap, stepMap), [productMap, supplierMap, stepMap]);

  // ── Filtered rows (search + quick filters) ────────────────────────────────────
  const filteredLines = useMemo(() => {
    let list = lines;

    // Text search across product code/name, supplier, step type, status
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((r) => {
        const prod = productMap[r.product_id];
        const sup  = supplierMap[r.recipient_supplier_id];
        const step = stepMap[r.routing_step_id];
        return (
          (prod?.code || "").toLowerCase().includes(q) ||
          (prod?.name || "").toLowerCase().includes(q) ||
          (sup?.name  || "").toLowerCase().includes(q) ||
          (step?.step_type || "").toLowerCase().includes(q) ||
          (r.status || "").toLowerCase().includes(q)
        );
      });
    }

    // Quick filters (from QuickFiltersPanel)
    list = applyQuickFilters(list, quickFilters);

    return list;
  }, [lines, searchText, quickFilters, productMap, supplierMap, stepMap]);

  // ── View field definitions for Manage Views ───────────────────────────────────
  const ALL_FIELDS = [
    { id: "product",    label: "Product" },
    { id: "granularity",label: "Granularity" },
    { id: "step",       label: "Routing Step" },
    { id: "supplier",   label: "Recipient Supplier" },
    { id: "qty",        label: "Fcst. Qty" },
    { id: "status",     label: "Status" },
    { id: "responses",  label: "Responses" },
    { id: "actions",    label: "Actions" },
  ];

  // Load saved view column config when activeViewId changes
  useEffect(() => {
    if (activeViewId === "default") { setColumnIds(null); return; }
    base44.entities.ListViewConfig.filter({ id: activeViewId }).then((results) => {
      const v = results[0];
      setColumnIds(v?.column_ids?.length ? v.column_ids : null);
    });
  }, [activeViewId]);

  // ── Page Options — register on mount ─────────────────────────────────────────
  const toggleQF = useCallback(() => { setShowQF((v) => !v); setShowManageViews(false); }, []);
  const toggleMV = useCallback(() => { setShowManageViews((v) => !v); setShowQF(false); }, []);

  useEffect(() => {
    setOptions({
      items: [
        ...(!locked ? [
          {
            label: "Add Lines",
            icon: Plus,
            onClick: () => setShowBuilder(true),
          },
          {
            label: "Export ToDo",
            icon: Download,
            onClick: () => setShowExportDialog(true),
          },
          {
            label: "Import Responses",
            icon: Upload,
            onClick: () => setShowImportDialog(true),
          },
          { divider: true },
        ] : []),
        {
          label: "Quick Filters",
          icon: Filter,
          onClick: toggleQF,
          custom: true,
          badge: quickFilters.length > 0 ? quickFilters.length : null,
        },
        { divider: true },
        {
          label: "Manage Views",
          icon: Pencil,
          onClick: toggleMV,
          custom: true,
        },
      ],
      customContent: showQF
        ? () => (
            <QuickFiltersPanel
              fields={qfFields}
              activeFilters={quickFilters}
              onApply={(f) => { setQuickFilters(f); }}
            />
          )
        : showManageViews
        ? () => (
            <ViewDrawerContent
              pageKey="rfq_costs_tab"
              activeViewId={activeViewId}
              onSelectView={(id) => { setActiveViewId(id); setShowManageViews(false); }}
              allFields={ALL_FIELDS}
              currentViewType="list"
            />
          )
        : null,
    });
  }, [showQF, showManageViews, quickFilters, qfFields, activeViewId, toggleQF, toggleMV, setOptions, setShowBuilder, locked]);

  // Clear options on unmount
  useEffect(() => () => setOptions(null), [setOptions]);

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await base44.entities.RFQLine.delete(deleteTarget.id);
    setDeleteTarget(null);
    setDeleting(false);
    onLinesChange();
  };

  const handlePinColumn = useCallback((colId) => {
    setPinnedCols((prev) =>
      prev.includes(colId) ? prev.filter((c) => c !== colId) : [...prev, colId]
    );
  }, []);

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">
          {filteredLines.length !== lines.length
            ? `${filteredLines.length} / ${lines.length} line${lines.length !== 1 ? "s" : ""}`
            : `${lines.length} line${lines.length !== 1 ? "s" : ""}`}
        </span>

        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8"
            onClick={() => setShowExportDialog(true)}
          >
            <Download className="w-3.5 h-3.5" /> Export ToDo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8"
            onClick={() => setShowImportDialog(true)}
          >
            <Upload className="w-3.5 h-3.5" /> Import Responses
          </Button>
          {/* Inline search when open */}
          {showSearch && (
            <div className="relative">
              <Input
                autoFocus
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search product, supplier, step…"
                className="h-8 text-xs pr-7 w-56"
              />
              {searchText && (
                <button type="button" onClick={() => setSearchText("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Search toggle */}
          <button
            type="button"
            onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchText(""); }}
            className={`p-1.5 rounded-md transition-colors border ${showSearch ? "bg-primary/10 border-primary/30 text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            title="Search lines"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active quick filter badge */}
      {quickFilters.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Filter className="w-3 h-3" /> {quickFilters.length} quick filter{quickFilters.length > 1 ? "s" : ""} active
          </span>
          <button
            type="button"
            onClick={() => { setQuickFilters([]); setShowQF(false); }}
            className="text-[10px] text-muted-foreground hover:text-destructive underline-offset-2 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {lines.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
          <p className="text-sm font-medium">No lines yet.</p>
          <p className="text-xs">Click <strong>+ Add Lines</strong> to start building this RFQ.</p>
        </div>
      )}

      {/* ── DataTable ── */}
      {lines.length > 0 && (
        <DataTable
          columns={columnIds ? columns.filter((c) => columnIds.includes(c.id)) : columns}
          rows={filteredLines}
          fixedColumns={pinnedCols}
          onPinColumn={handlePinColumn}
        />
      )}

      {/* ── Responses Side Panel ── */}
      {panelLine && rfq && (
        <ResponsesPanel
          line={panelLine}
          rfq={rfq}
          productMap={productMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          onClose={() => setPanelLine(null)}
          onLineChanged={() => {
            onLinesChange();
            // Refresh counts after any change in the panel
            base44.entities.RFQResponse.filter({ rfq_line_id: { $in: lines.map((l) => l.id) } }, "-created_date", 5000)
              .then((responses) => {
                const counts = {};
                for (const r of responses) counts[r.rfq_line_id] = (counts[r.rfq_line_id] || 0) + 1;
                setResponseCounts(counts);
              });
          }}
        />
      )}

      {/* ── Add Response Dialog (from kebab menu) ── */}
      {responseTarget && rfq && (
        <AddResponseDialog
          line={responseTarget}
          rfq={rfq}
          productMap={productMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          onSaved={() => { setResponseTarget(null); onLinesChange(); }}
          onClose={() => setResponseTarget(null)}
        />
      )}

      {/* ── Export Todo Dialog ── */}
      {showExportDialog && (
        <ExportTodoDialog
          rfq={rfq}
          lines={lines}
          productMap={productMap}
          colorMap={colorMap}
          pcamMap={pcamMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* ── Import Responses Dialog ── */}
      {showImportDialog && (
        <ImportResponsesDialog
          rfq={rfq}
          rfqLines={lines}
          currencies={refData.currencies || []}
          onClose={() => setShowImportDialog(false)}
          onImportSuccess={() => onLinesChange()}
        />
      )}

      {/* ── Line Builder Dialog ── */}
      {showBuilder && (
        <RFQLineBuilderDialog
          rfqId={rfqId}
          projectId={projectId}
          existingLines={lines}
          onSaved={() => { setShowBuilder(false); onLinesChange(); }}
          onClose={() => setShowBuilder(false)}
        />
      )}

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this line?</AlertDialogTitle>
            <AlertDialogDescription>This will delete the RFQ line. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}