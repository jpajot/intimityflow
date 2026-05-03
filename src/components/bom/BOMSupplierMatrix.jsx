import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Ban, ExternalLink, GripVertical, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import ComponentSupplierPicker from "./ComponentSupplierPicker.jsx";

/**
 * Supplier Matrix — Rows = BOMLines, Columns = parent product's ApprovedSuppliers (vendors).
 * Cells show the resolved component supplier for each (BOMLine × Parent Vendor) intersection.
 * Mirrors the Color/Size matrix pattern exactly:
 *   - column = parent product dimension (vendor)
 *   - cell value = component's supplier picked for that vendor scenario
 */
export default function BOMSupplierMatrix({
  bom, bomLines, bomLineVariants, allProducts, lovValues,
  isReadOnly, onDeleteLine, onUpdateLine, onUpsertVariant, getUom,
}) {
  const navigate = useNavigate();

  // Parent product's approved vendors (columns)
  const [parentVendors, setParentVendors] = useState([]);
  const [parentSupplierMap, setParentSupplierMap] = useState({}); // { [supplierId]: Supplier }
  const [parentVendorsLoading, setParentVendorsLoading] = useState(true);

  // Component-level supplier data (row defaults)
  const [compSupplierData, setCompSupplierData] = useState({}); // { [productId]: { as[], supplierMap } }
  const [compLoading, setCompLoading] = useState(true);

  // Picker state
  const [openPicker, setOpenPicker] = useState(null); // { lineId, parentVendorId, triggerRect }

  const search = ""; // passed from parent toolbar; internal search not needed here

  // ── Load parent product's vendors (columns) ───────────────────────────────
  useEffect(() => {
    if (!bom?.product_id) { setParentVendorsLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      const asList = await base44.entities.ApprovedSupplier.filter({
        product_id: bom.product_id,
        status: "active",
      });
      const sorted = asList.sort((a, b) => (a.rank || 99) - (b.rank || 99));
      if (cancelled) return;
      const ids = [...new Set(sorted.map((a) => a.supplier_id).filter(Boolean))];
      const sups = await Promise.all(
        ids.map((sid) => base44.entities.Supplier.filter({ id: sid }).then((r) => r[0]).catch(() => null))
      );
      if (cancelled) return;
      const map = {};
      sups.filter(Boolean).forEach((s) => { map[s.id] = s; });
      setParentVendors(sorted);
      setParentSupplierMap(map);
      setParentVendorsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [bom?.product_id]);

  // ── Load component-level default suppliers (row defaults) ─────────────────
  const componentProductIds = useMemo(
    () => [...new Set(bomLines.map((l) => l.component_product_id).filter(Boolean))],
    [bomLines]
  );

  useEffect(() => {
    if (componentProductIds.length === 0) { setCompLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      const results = {};
      await Promise.all(componentProductIds.map(async (pid) => {
        const asList = await base44.entities.ApprovedSupplier.filter({ product_id: pid, status: "active" });
        const sorted = asList.sort((a, b) => (a.rank || 99) - (b.rank || 99));
        const ids = [...new Set(sorted.map((a) => a.supplier_id).filter(Boolean))];
        const sups = await Promise.all(
          ids.map((sid) => base44.entities.Supplier.filter({ id: sid }).then((r) => r[0]).catch(() => null))
        );
        const map = {};
        sups.filter(Boolean).forEach((s) => { map[s.id] = s; });
        results[pid] = { approvedSuppliers: sorted, supplierMap: map };
      }));
      if (!cancelled) { setCompSupplierData(results); setCompLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [componentProductIds.join(",")]);

  // ── Cell resolution ───────────────────────────────────────────────────────
  // Returns { approvedSupplier, supplier, isDefault, isNA } for a (line, parentVendor) cell
  const resolveCell = (line, parentVendor) => {
    const variant = bomLineVariants.find(
      (v) => v.bom_line_id === line.id && v.parent_approved_supplier_id === parentVendor.id
    );

    if (variant?.is_not_applicable) return { isNA: true };

    if (variant?.approved_supplier_id) {
      const compData = compSupplierData[line.component_product_id];
      const as = compData?.approvedSuppliers.find((a) => a.id === variant.approved_supplier_id);
      const supplier = as ? compData?.supplierMap[as.supplier_id] : null;
      return { approvedSupplier: as, supplier, isDefault: false, isNA: false, variant };
    }

    // Row-level default: component's primary approved supplier
    const compData = compSupplierData[line.component_product_id];
    const primaryAs = compData?.approvedSuppliers.find((a) => a.is_primary);
    if (primaryAs) {
      const supplier = compData?.supplierMap[primaryAs.supplier_id];
      return { approvedSupplier: primaryAs, supplier, isDefault: true, isNA: false, variant: null };
    }

    return { approvedSupplier: null, supplier: null, isDefault: true, isNA: false, variant: null };
  };

  const handleMarkNA = (line, parentVendor) => {
    onUpsertVariant({
      bom_line_id: line.id,
      parent_approved_supplier_id: parentVendor.id,
      product_color_id: null,
      size_id: null,
      product_color_and_more_id: null,
      approved_supplier_id: null,
      is_not_applicable: true,
    });
  };

  const handleClearNA = (line, parentVendor) => {
    const variant = bomLineVariants.find(
      (v) => v.bom_line_id === line.id && v.parent_approved_supplier_id === parentVendor.id
    );
    if (variant) {
      onUpsertVariant({
        bom_line_id: line.id,
        parent_approved_supplier_id: parentVendor.id,
        product_color_id: null,
        size_id: null,
        product_color_and_more_id: null,
        is_not_applicable: false,
      });
    }
  };

  const handleSelectSupplier = (line, parentVendor, approvedSupplierId) => {
    onUpsertVariant({
      bom_line_id: line.id,
      parent_approved_supplier_id: parentVendor.id,
      product_color_id: null,
      size_id: null,
      product_color_and_more_id: null,
      approved_supplier_id: approvedSupplierId,
      is_not_applicable: false,
    });
    setOpenPicker(null);
  };

  const handleResetSupplier = (line, parentVendor) => {
    onUpsertVariant({
      bom_line_id: line.id,
      parent_approved_supplier_id: parentVendor.id,
      product_color_id: null,
      size_id: null,
      product_color_and_more_id: null,
      approved_supplier_id: null,
      is_not_applicable: false,
    });
    setOpenPicker(null);
  };

  const isLoading = parentVendorsLoading || compLoading;

  if (isLoading) {
    return <div className="text-xs text-muted-foreground py-8 text-center">Loading supplier matrix…</div>;
  }

  const roleValues = lovValues.filter((v) => v.category === "bom_line_role");

  // Empty state — parent product has no vendors
  if (parentVendors.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center space-y-2">
        <p className="text-sm text-muted-foreground font-medium">Parent product has no approved vendors.</p>
        <p className="text-xs text-muted-foreground">Define vendors in the Product's Suppliers tab to use the Supplier matrix.</p>
        {bom?.product_id && (
          <button
            type="button"
            onClick={() => navigate(`/products/${bom.product_id}`)}
            className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto mt-2"
          >
            Open parent Product Suppliers tab <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-auto">
      <table className="w-full text-xs min-w-[600px]">
        <thead className="sticky top-0 z-10 bg-muted/60">
          <tr className="border-b border-border">
            <th className="px-2 py-2.5 w-8 sticky left-0 bg-muted/60 z-20"></th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground sticky left-8 bg-muted/60 z-20 min-w-[220px]">
              Component
            </th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-16">UOM</th>
            {parentVendors.map((pv) => {
              const sup = parentSupplierMap[pv.supplier_id];
              return (
                <th key={pv.id} className="px-2 py-2.5 text-center font-semibold text-muted-foreground min-w-[160px]">
                  <div className="truncate max-w-[160px] mx-auto font-medium" title={sup?.name}>
                    {sup?.name || pv.supplier_id}
                  </div>
                  {pv.supplier_reference && (
                    <div className="text-[9px] font-mono text-muted-foreground">{pv.supplier_reference}</div>
                  )}
                  <div className="flex justify-center gap-1 mt-0.5 flex-wrap">
                    {pv.is_primary ? (
                      <span className="text-[9px] px-1.5 py-0 rounded bg-primary/10 text-primary font-medium border border-primary/20">Primary</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0 rounded bg-muted text-muted-foreground border border-border">Alt · rank {pv.rank}</span>
                    )}
                    {sup?.country && (
                      <span className="text-[9px] text-muted-foreground">{sup.country}</span>
                    )}
                  </div>
                </th>
              );
            })}
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {bomLines.map((line) => {
            const comp = allProducts.find((p) => p.id === line.component_product_id);
            const roleLabel = roleValues.find((v) => v.name === line.component_role)?.name || line.component_role || "—";
            const uom = getUom(line);
            const compData = compSupplierData[line.component_product_id];
            const hasAnyCompSupplier = (compData?.approvedSuppliers.length || 0) > 0;

            return (
              <tr key={line.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors group">
                {/* Drag handle */}
                <td className="px-2 py-2 sticky left-0 bg-card z-10">
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 cursor-grab" />
                </td>

                {/* Component label */}
                <td className="px-3 py-2 sticky left-8 bg-card z-10 min-w-[220px]">
                  <div className="space-y-0.5">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">{roleLabel}</span>
                    <div className="font-medium text-foreground text-xs">
                      {comp ? `${comp.code || ""} ${comp.name}`.trim() : (
                        <span className="text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Missing</span>
                      )}
                    </div>
                    {/* varies_by_supplier toggle */}
                    <div className="flex gap-1 flex-wrap items-center">
                      {line.varies_by_color && <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded">×color</span>}
                      {line.varies_by_size && <span className="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">×size</span>}
                      {line.varies_by_color_and_more && <span className="text-[10px] px-1 py-0.5 bg-orange-100 text-orange-700 rounded">×more</span>}
                      {!isReadOnly ? (
                        <button
                          type="button"
                          onClick={() => onUpdateLine(line.id, { varies_by_supplier: !line.varies_by_supplier })}
                          className={`text-[10px] px-1 py-0.5 rounded border transition-colors ${
                            line.varies_by_supplier
                              ? "bg-pink-100 text-pink-700 border-pink-300"
                              : "bg-muted text-muted-foreground border-border hover:bg-pink-50 hover:text-pink-600"
                          }`}
                          title="Toggle per-supplier variation"
                        >
                          ×supplier
                        </button>
                      ) : (
                        line.varies_by_supplier && <span className="text-[10px] px-1 py-0.5 bg-pink-100 text-pink-700 rounded">×supplier</span>
                      )}
                    </div>
                  </div>
                </td>

                <td className="px-3 py-2 w-16 text-muted-foreground text-[10px]">{uom}</td>

                {/* One cell per parent vendor */}
                {parentVendors.map((pv) => {
                  const resolved = resolveCell(line, pv);

                  // NA cell
                  if (resolved.isNA) {
                    const naStyle = {
                      background: "repeating-linear-gradient(-45deg,#f3f4f6,#f3f4f6 2px,#e5e7eb 2px,#e5e7eb 4px)",
                    };
                    return (
                      <td key={pv.id} className="px-2 py-2 text-center min-w-[160px] align-top">
                        <div
                          className="relative rounded border border-border min-h-[36px] flex items-center justify-center group/na"
                          style={naStyle}
                          title="Not applicable"
                        >
                          <span className="text-[10px] text-muted-foreground font-medium select-none">N/A</span>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleClearNA(line, pv)}
                              className="absolute inset-0 w-full h-full opacity-0 group-hover/na:opacity-100 flex items-center justify-center bg-background/70 rounded text-[10px] text-foreground transition-opacity"
                            >
                              Clear N/A
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  }

                  // No component supplier at all
                  if (!resolved.approvedSupplier && !hasAnyCompSupplier) {
                    return (
                      <td key={pv.id} className="px-2 py-2 text-center min-w-[160px] align-top">
                        <div className="flex items-center justify-center gap-1 text-amber-600 text-[10px]">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <button
                            type="button"
                            onClick={() => navigate(`/products/${line.component_product_id}`)}
                            className="underline hover:text-amber-800"
                          >
                            No suppliers
                          </button>
                        </div>
                      </td>
                    );
                  }

                  const { approvedSupplier: as, supplier, isDefault } = resolved;
                  const isEditable = line.varies_by_supplier && !isReadOnly;
                  const cost = as?.unit_cost != null ? `${as.unit_cost} ${as.currency || ""}`.trim() : null;
                  const lt = as?.lead_time_days != null ? `${as.lead_time_days}d` : null;
                  const pickerKey = `${line.id}__${pv.id}`;
                  const isPickerOpen = openPicker?.key === pickerKey;

                  return (
                    <td
                      key={pv.id}
                      className={`px-2 py-2 text-center min-w-[160px] align-top relative ${isEditable ? "cursor-pointer hover:bg-primary/5" : ""}`}
                    >
                      <div className="space-y-0.5">
                        {/* Supplier name */}
                        <div className={`text-[10px] font-medium ${as?.is_primary ? "text-primary" : "text-foreground/80"}`}>
                          {supplier?.name || (as ? as.supplier_id : "—")}
                          {as?.is_primary && !isDefault && (
                            <span className="ml-1 text-[9px] text-muted-foreground font-normal">(primary)</span>
                          )}
                        </div>
                        {/* Reference */}
                        {as?.supplier_reference && (
                          <div className="font-mono text-[10px] text-muted-foreground">{as.supplier_reference}</div>
                        )}
                        {/* Cost + lead time */}
                        <div className="flex justify-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                          {cost && <span>{cost}</span>}
                          {lt && <span>{lt}</span>}
                        </div>
                        {/* Default indicator */}
                        {isDefault && as && (
                          <div className="text-[9px] text-muted-foreground/60 italic">(default)</div>
                        )}
                        {/* Edit / NA controls */}
                        {isEditable && (
                          <div className="flex justify-center gap-1 mt-1">
                            <button
                              type="button"
                              ref={(el) => {
                                if (!el) return;
                              }}
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setOpenPicker({
                                  key: pickerKey,
                                  lineId: line.id,
                                  parentVendorId: pv.id,
                                  currentApprovedSupplierId: resolved.variant?.approved_supplier_id || null,
                                  componentProductId: line.component_product_id,
                                  top: rect.bottom + window.scrollY + 6,
                                  left: rect.left + window.scrollX + rect.width / 2,
                                });
                              }}
                              className="text-[9px] px-1.5 py-0.5 rounded border border-border bg-background hover:bg-primary/5 hover:border-primary/30 text-muted-foreground hover:text-primary transition-colors"
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkNA(line, pv)}
                              className="text-[9px] text-muted-foreground/50 hover:text-destructive transition-colors"
                              title="Mark as N/A"
                            >
                              <Ban className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {/* NA button for read-only cells (varies_by_supplier = false) when editable BOM */}
                        {!isEditable && !isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleMarkNA(line, pv)}
                            className="text-[9px] text-muted-foreground/40 hover:text-destructive transition-colors mt-0.5"
                            title="Mark as N/A"
                          >
                            <Ban className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}

                {/* Delete line */}
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

      {/* Component Supplier Picker portal */}
      {openPicker && createPortal(
        <>
          {/* Click-away backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setOpenPicker(null)}
          />
          <div
            className="fixed z-[9999]"
            style={{ top: openPicker.top, left: openPicker.left, transform: "translateX(-50%)" }}
          >
            <ComponentSupplierPicker
              componentProductId={openPicker.componentProductId}
              currentApprovedSupplierId={openPicker.currentApprovedSupplierId}
              onSelect={(asId) => {
                const line = bomLines.find((l) => l.id === openPicker.lineId);
                const pv = parentVendors.find((v) => v.id === openPicker.parentVendorId);
                if (line && pv) handleSelectSupplier(line, pv, asId);
              }}
              onReset={() => {
                const line = bomLines.find((l) => l.id === openPicker.lineId);
                const pv = parentVendors.find((v) => v.id === openPicker.parentVendorId);
                if (line && pv) handleResetSupplier(line, pv);
              }}
              onClose={() => setOpenPicker(null)}
            />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}