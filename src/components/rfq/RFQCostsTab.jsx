import { useState, useMemo } from "react";
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
import { Plus, MoreVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import RFQLineBuilderDialog from "./RFQLineBuilderDialog";

// ── Status badge ───────────────────────────────────────────────────────────────
const LINE_STATUS_COLORS = {
  pending:   "bg-gray-100 text-gray-600 border-gray-200",
  answered:  "bg-blue-100 text-blue-700 border-blue-200",
  awarded:   "bg-green-100 text-green-700 border-green-200",
  declined:  "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
};

// ── Sort helper ────────────────────────────────────────────────────────────────
function useSortState(defaultKey = "product") {
  const [sort, setSort] = useState({ key: defaultKey, dir: "asc" });
  const toggle = (key) => setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  return [sort, toggle];
}

function SortIcon({ active, dir }) {
  if (!active) return <ChevronUp className="w-3 h-3 opacity-20" />;
  return dir === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RFQCostsTab({ rfqId, projectId, lines, refData, onLinesChange }) {
  const { products, colors, pcams, steps, suppliers } = refData;

  const [sort, toggleSort] = useSortState("product");
  const [showBuilder, setShowBuilder] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Quick filter state (scoped to this RFQ's data)
  const [filterSupplierIds, setFilterSupplierIds] = useState([]);
  const [filterStepTypes, setFilterStepTypes] = useState([]);
  const [filterGrans, setFilterGrans] = useState([]);

  // ── Lookup helpers ────────────────────────────────────────────────────────────
  const productMap   = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const colorMap     = useMemo(() => Object.fromEntries(colors.map((c) => [c.id, c])), [colors]);
  const pcamMap      = useMemo(() => Object.fromEntries(pcams.map((p) => [p.id, p])), [pcams]);
  const stepMap      = useMemo(() => Object.fromEntries(steps.map((s) => [s.id, s])), [steps]);
  const supplierMap  = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers]);

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
    return "—";
  };

  // ── Quick filter options (scoped to THIS RFQ's lines) ────────────────────────
  const qfSuppliers = useMemo(() => {
    const seen = new Set(lines.map((l) => l.recipient_supplier_id).filter(Boolean));
    return suppliers.filter((s) => seen.has(s.id));
  }, [lines, suppliers]);

  const qfStepTypes = useMemo(() => {
    const seen = new Set(lines.map((l) => stepMap[l.routing_step_id]?.step_type).filter(Boolean));
    return [...seen];
  }, [lines, stepMap]);

  const qfGranOptions = ["Product", "ProductColor", "PCAM"];

  const toggleFilter = (arr, setArr, val) =>
    setArr((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);

  // ── Filtered & sorted lines ───────────────────────────────────────────────────
  const displayLines = useMemo(() => {
    let list = [...lines];

    if (filterSupplierIds.length > 0)
      list = list.filter((l) => filterSupplierIds.includes(l.recipient_supplier_id));
    if (filterStepTypes.length > 0)
      list = list.filter((l) => filterStepTypes.includes(stepMap[l.routing_step_id]?.step_type));
    if (filterGrans.length > 0)
      list = list.filter((l) => filterGrans.includes(getGranularity(l)));

    list.sort((a, b) => {
      let av = "", bv = "";
      if (sort.key === "product") {
        av = productMap[a.product_id]?.code || "";
        bv = productMap[b.product_id]?.code || "";
      } else if (sort.key === "step") {
        av = (stepMap[a.routing_step_id]?.sequence || 0).toString().padStart(5, "0");
        bv = (stepMap[b.routing_step_id]?.sequence || 0).toString().padStart(5, "0");
      } else if (sort.key === "supplier") {
        av = supplierMap[a.recipient_supplier_id]?.name || "";
        bv = supplierMap[b.recipient_supplier_id]?.name || "";
      } else if (sort.key === "status") {
        av = a.status || "";
        bv = b.status || "";
      }
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [lines, sort, filterSupplierIds, filterStepTypes, filterGrans, productMap, stepMap, supplierMap]);

  // ── Inline qty update ─────────────────────────────────────────────────────────
  const handleQtyBlur = async (line, newVal) => {
    const qty = parseFloat(newVal);
    if (isNaN(qty) || qty === line.forecasted_qty) return;
    await base44.entities.RFQLine.update(line.id, { forecasted_qty: qty });
    onLinesChange();
  };

  // ── Delete line ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await base44.entities.RFQLine.delete(deleteTarget.id);
    setDeleteTarget(null);
    setDeleting(false);
    onLinesChange();
  };

  const hasFilters = filterSupplierIds.length > 0 || filterStepTypes.length > 0 || filterGrans.length > 0;

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3">
        <Button size="sm" className="gap-1.5" onClick={() => setShowBuilder(true)}>
          <Plus className="w-3.5 h-3.5" />
          Add Lines
        </Button>
        <span className="text-xs text-muted-foreground">{lines.length} line{lines.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── Quick Filters ── */}
      {(qfSuppliers.length > 0 || qfStepTypes.length > 0) && (
        <div className="flex flex-wrap gap-2 items-center">
          {/* Supplier filter */}
          {qfSuppliers.map((s) => (
            <button key={s.id} type="button"
              onClick={() => toggleFilter(filterSupplierIds, setFilterSupplierIds, s.id)}
              className={`text-[10px] px-2 py-1 rounded border font-medium transition-colors ${filterSupplierIds.includes(s.id) ? "bg-primary/10 text-primary border-primary/30 ring-1 ring-inset ring-primary/30" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
              {s.name}
            </button>
          ))}

          {qfSuppliers.length > 0 && qfStepTypes.length > 0 && <span className="text-border">|</span>}

          {/* Step type filter */}
          {qfStepTypes.map((t) => (
            <button key={t} type="button"
              onClick={() => toggleFilter(filterStepTypes, setFilterStepTypes, t)}
              className={`text-[10px] px-2 py-1 rounded border font-medium capitalize transition-colors ${filterStepTypes.includes(t) ? "bg-primary/10 text-primary border-primary/30 ring-1 ring-inset ring-primary/30" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
              {t.replace(/_/g, " ")}
            </button>
          ))}

          {(qfSuppliers.length > 0 || qfStepTypes.length > 0) && <span className="text-border">|</span>}

          {/* Granularity filter */}
          {qfGranOptions.map((g) => (
            <button key={g} type="button"
              onClick={() => toggleFilter(filterGrans, setFilterGrans, g)}
              className={`text-[10px] px-2 py-1 rounded border font-medium transition-colors ${filterGrans.includes(g) ? "bg-primary/10 text-primary border-primary/30 ring-1 ring-inset ring-primary/30" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
              {g}
            </button>
          ))}

          {hasFilters && (
            <button type="button"
              onClick={() => { setFilterSupplierIds([]); setFilterStepTypes([]); setFilterGrans([]); }}
              className="text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {lines.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
          <p className="text-sm font-medium">No lines yet.</p>
          <p className="text-xs">Click <strong>+ Add Lines</strong> to start building this RFQ.</p>
        </div>
      )}

      {/* ── Table ── */}
      {lines.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <Th label="Product"    sortKey="product"  sort={sort} onSort={toggleSort} />
                <Th label="Granularity" />
                <Th label="Routing Step" sortKey="step" sort={sort} onSort={toggleSort} />
                <Th label="Recipient"  sortKey="supplier" sort={sort} onSort={toggleSort} />
                <Th label="Fcst. Qty" />
                <Th label="Status"    sortKey="status"   sort={sort} onSort={toggleSort} />
                <th className="px-3 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayLines.map((line) => {
                const prod     = productMap[line.product_id];
                const step     = stepMap[line.routing_step_id];
                const supplier = supplierMap[line.recipient_supplier_id];
                const isAlt    = step?.supplier_id && line.recipient_supplier_id !== step.supplier_id;

                return (
                  <tr key={line.id} className="hover:bg-muted/30 transition-colors">
                    {/* Product */}
                    <td className="px-3 py-2.5 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                          {prod?.images?.[0]
                            ? <img src={prod.images[0]} alt="" className="w-full h-full object-contain" />
                            : <span className="text-[9px] font-mono text-muted-foreground">{(prod?.code || "").slice(0, 4)}</span>}
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] text-muted-foreground block">{prod?.code}</span>
                          <span className="font-medium truncate block">{prod?.name}</span>
                        </div>
                      </div>
                    </td>

                    {/* Granularity */}
                    <td className="px-3 py-2.5 min-w-[120px]">
                      <div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          {getGranularity(line)}
                        </span>
                        {getGranLabel(line) && getGranLabel(line) !== "—" && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]">{getGranLabel(line)}</p>
                        )}
                      </div>
                    </td>

                    {/* Routing Step */}
                    <td className="px-3 py-2.5 min-w-[140px]">
                      {step
                        ? <span>Step {step.sequence}: {step.step_type?.replace(/_/g, " ")}</span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>

                    {/* Recipient Supplier */}
                    <td className="px-3 py-2.5 min-w-[130px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{supplier?.name || <span className="text-muted-foreground/40">—</span>}</span>
                        {isAlt && (
                          <span className="text-[9px] px-1 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 font-semibold uppercase">alt</span>
                        )}
                      </div>
                    </td>

                    {/* Forecasted Qty */}
                    <td className="px-3 py-2.5 min-w-[110px]">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          defaultValue={line.forecasted_qty ?? 0}
                          onBlur={(e) => handleQtyBlur(line, e.target.value)}
                          className="h-7 w-20 text-xs"
                        />
                        <span className="text-[10px] text-muted-foreground shrink-0">{line.forecasted_qty_uom || ""}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${LINE_STATUS_COLORS[line.status] || "bg-muted text-muted-foreground border-border"}`}>
                        {(line.status || "").replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5">
                      {line.status === "pending" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDeleteTarget(line)} className="text-destructive focus:text-destructive">
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Remove line
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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

function Th({ label, sortKey, sort, onSort }) {
  const active = sort && sort.key === sortKey;
  return (
    <th
      className={`px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap ${sortKey ? "cursor-pointer select-none hover:text-foreground" : ""}`}
      onClick={sortKey ? () => onSort(sortKey) : undefined}>
      <div className="flex items-center gap-1">
        {label}
        {sortKey && <SortIcon active={active} dir={sort?.dir} />}
      </div>
    </th>
  );
}