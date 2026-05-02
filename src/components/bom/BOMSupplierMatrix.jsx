import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, ExternalLink, GripVertical, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

/**
 * Case 4: Rows = BOMLine, Columns = ApprovedSupplier (for each component)
 */
export default function BOMSupplierMatrix({
  bom, bomLines, bomLineVariants, allProducts, lovValues,
  isReadOnly, onDeleteLine, onUpdateLine, onUpsertVariant, getUom,
}) {
  const navigate = useNavigate();
  const [supplierData, setSupplierData] = useState({}); // { [productId]: { approvedSuppliers, suppliers } }
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const componentProductIds = useMemo(() => {
    return [...new Set(bomLines.map((l) => l.component_product_id).filter(Boolean))];
  }, [bomLines]);

  useEffect(() => {
    if (componentProductIds.length === 0) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      const results = {};
      await Promise.all(componentProductIds.map(async (pid) => {
        const asList = await base44.entities.ApprovedSupplier.filter({ product_id: pid, status: "active" });
        const supplierIds = [...new Set(asList.map((a) => a.supplier_id).filter(Boolean))];
        let suppliers = [];
        if (supplierIds.length > 0) {
          suppliers = await Promise.all(supplierIds.map((sid) =>
            base44.entities.Supplier.filter({ id: sid }).then((r) => r[0]).catch(() => null)
          ));
          suppliers = suppliers.filter(Boolean);
        }
        results[pid] = { approvedSuppliers: asList.sort((a, b) => (a.rank || 99) - (b.rank || 99)), suppliers };
      }));
      if (!cancelled) { setSupplierData(results); setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [componentProductIds.join(",")]);

  // Build union of all unique suppliers across all lines
  const allSupplierCols = useMemo(() => {
    const seen = new Map();
    bomLines.forEach((line) => {
      const data = supplierData[line.component_product_id];
      if (!data) return;
      data.approvedSuppliers.forEach((as) => {
        if (!seen.has(as.supplier_id)) {
          const sup = data.suppliers.find((s) => s.id === as.supplier_id);
          seen.set(as.supplier_id, { supplierId: as.supplier_id, supplier: sup, minRank: as.rank || 99, isPrimary: as.is_primary });
        } else {
          const existing = seen.get(as.supplier_id);
          if ((as.rank || 99) < existing.minRank) {
            seen.set(as.supplier_id, { ...existing, minRank: as.rank || 99, isPrimary: as.is_primary });
          }
        }
      });
    });
    return [...seen.values()].sort((a, b) => a.minRank - b.minRank);
  }, [bomLines, supplierData]);

  const filteredLines = useMemo(() => {
    if (!search.trim()) return bomLines;
    const q = search.toLowerCase();
    return bomLines.filter((line) => {
      const comp = allProducts.find((p) => p.id === line.component_product_id);
      return comp?.name?.toLowerCase().includes(q) || comp?.code?.toLowerCase().includes(q);
    });
  }, [bomLines, search, allProducts]);

  if (loading) return <div className="text-xs text-muted-foreground py-8 text-center">Loading supplier data…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search component lines…" className="h-8 text-xs w-56" />
        <span className="text-xs text-muted-foreground ml-2">Showing supplier matrix</span>
      </div>

      <div className="rounded-xl border border-border overflow-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="sticky top-0 z-10 bg-muted/60">
            <tr className="border-b border-border">
              <th className="px-2 py-2.5 w-8 sticky left-0 bg-muted/60 z-20"></th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground sticky left-8 bg-muted/60 z-20 min-w-[200px]">Component</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-16">UOM</th>
              {allSupplierCols.map((col) => (
                <th key={col.supplierId} className="px-2 py-2.5 text-center font-semibold text-muted-foreground min-w-[140px]">
                  <div className="truncate max-w-[140px] mx-auto font-medium" title={col.supplier?.name}>
                    {col.supplier?.name || col.supplierId}
                  </div>
                  <div className="flex justify-center gap-1 mt-0.5">
                    {col.isPrimary && (
                      <span className="text-[9px] px-1 py-0 rounded bg-primary/10 text-primary font-medium">Primary</span>
                    )}
                    {!col.isPrimary && (
                      <span className="text-[9px] px-1 py-0 rounded bg-muted text-muted-foreground">Alt {col.minRank}</span>
                    )}
                    {col.supplier?.country && (
                      <span className="text-[9px] text-muted-foreground">{col.supplier.country}</span>
                    )}
                  </div>
                </th>
              ))}
              {allSupplierCols.length === 0 && <th className="px-3 py-2.5 text-muted-foreground">No active suppliers</th>}
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.map((line) => {
              const comp = allProducts.find((p) => p.id === line.component_product_id);
              const data = supplierData[line.component_product_id] || { approvedSuppliers: [], suppliers: [] };
              const hasSuppliers = data.approvedSuppliers.length > 0;
              const roleValues = lovValues.filter((v) => v.category === "bom_line_role");
              const roleLabel = roleValues.find((v) => v.name === line.component_role)?.name || line.component_role || "—";
              const uom = getUom(line);

              return (
                <tr key={line.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors group">
                  <td className="px-2 py-2 sticky left-0 bg-card z-10">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 cursor-grab" />
                  </td>
                  <td className="px-3 py-2 sticky left-8 bg-card z-10 min-w-[200px]">
                    <div className="space-y-0.5">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">{roleLabel}</span>
                      <div className="font-medium text-foreground text-xs">
                        {comp ? `${comp.code || ""} ${comp.name}`.trim() : <span className="text-destructive">Missing</span>}
                      </div>
                      {/* varies_by_supplier toggle */}
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => onUpdateLine(line.id, { varies_by_supplier: !line.varies_by_supplier })}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            line.varies_by_supplier
                              ? "bg-pink-100 text-pink-700 border-pink-300"
                              : "bg-muted text-muted-foreground border-border hover:bg-pink-50 hover:text-pink-600"
                          }`}
                        >
                          {line.varies_by_supplier ? "×supplier ON" : "×supplier OFF"}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 w-16 text-muted-foreground text-[10px]">{uom}</td>

                  {!hasSuppliers ? (
                    <td colSpan={allSupplierCols.length || 1} className="px-4 py-3">
                      <div className="flex items-center gap-2 text-amber-600 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>No suppliers approved for this component.</span>
                        <button
                          type="button"
                          onClick={() => navigate(`/products/${line.component_product_id}`)}
                          className="underline flex items-center gap-0.5 hover:text-amber-800"
                        >
                          Open sourcing <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </td>
                  ) : (
                    allSupplierCols.map((col) => {
                      const as = data.approvedSuppliers.find((a) => a.supplier_id === col.supplierId);
                      // Check if this line has a variant already assigned to this supplier
                      const assignedVariant = bomLineVariants.find(
                        (v) => v.bom_line_id === line.id && v.approved_supplier_id === as?.id
                      );

                      if (!as) {
                        // This supplier doesn't supply this component
                        return (
                          <td key={col.supplierId} className="px-2 py-2 text-center">
                            <span className="text-[10px] text-muted-foreground/40">—</span>
                          </td>
                        );
                      }

                      const isPrimary = as.is_primary;
                      const cost = as.unit_cost != null ? `${as.unit_cost} ${as.currency || ""}/${uom}`.trim() : null;
                      const lt = as.lead_time_days != null ? `${as.lead_time_days}d` : null;

                      const handleAssign = () => {
                        if (isReadOnly || !line.varies_by_supplier) return;
                        onUpsertVariant({
                          bom_line_id: line.id,
                          approved_supplier_id: as.id,
                          product_color_id: null,
                          size_id: null,
                          product_color_and_more_id: null,
                        });
                      };

                      return (
                        <td
                          key={col.supplierId}
                          className={`px-2 py-2 text-center min-w-[140px] align-top transition-colors ${
                            line.varies_by_supplier && !isReadOnly ? "cursor-pointer hover:bg-primary/5" : ""
                          } ${assignedVariant ? "bg-primary/5" : ""}`}
                          onClick={handleAssign}
                        >
                          <div className="space-y-0.5">
                            <div className={`text-[10px] font-medium ${isPrimary ? "text-primary" : "text-foreground/70"}`}>
                              {isPrimary ? "★ Primary" : `Alt ${as.rank}`}
                              {assignedVariant && (
                                <span className="ml-1 text-green-600">✓ assigned</span>
                              )}
                            </div>
                            {as.supplier_reference && (
                              <div className="font-mono text-[10px] text-foreground/80">{as.supplier_reference}</div>
                            )}
                            {cost && <div className="text-[10px] text-muted-foreground">{cost}</div>}
                            {lt && <div className="text-[10px] text-muted-foreground">{lt}</div>}
                            {!line.varies_by_supplier && (
                              <div className="text-[9px] text-muted-foreground/50 italic">read-only</div>
                            )}
                          </div>
                        </td>
                      );
                    })
                  )}

                  <td className="px-2 py-2 w-8">
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => onDeleteLine(line.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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