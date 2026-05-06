import { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Ban, GripVertical, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import BOMVariantCellEditor from "./BOMVariantCellEditor.jsx";
import ComponentSupplierPicker from "./ComponentSupplierPicker.jsx";
import { createPortal } from "react-dom";

/**
 * BOMGroupedMatrix — renders the BOM matrix with a cross-product of two column axes.
 * Primary axis spans top-row headers; secondary axis labels appear on bottom row.
 * Cells resolve through both dimensions simultaneously.
 *
 * Supported combos: Color×Supplier, Size×Supplier, Color×Size, ColorAndMore×Supplier, etc.
 */

const NA_STYLE = {
  background: "repeating-linear-gradient(-45deg,#f3f4f6,#f3f4f6 2px,#e5e7eb 2px,#e5e7eb 4px)",
};

export default function BOMGroupedMatrix({
  bom,
  bomLines,
  bomLineVariants,
  colorVariants,
  styleSizes,
  colorAndMores,
  allProducts,
  allProductColors,
  techColors,
  commColors,
  lovValues,
  allSizes,
  isReadOnly,
  columnAxis,      // primary
  secondaryAxis,   // secondary
  onUpdateLine,
  onDeleteLine,
  onUpsertVariant,
  getUom,
  onAddLine,
  showSourcing,
}) {
  // Parent product's approved vendors (needed when supplier is one of the axes)
  const [parentVendors, setParentVendors] = useState([]);
  const [parentSupplierMap, setParentSupplierMap] = useState({});
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [openPicker, setOpenPicker] = useState(null);
  // Cache for supplier lookups: key = "asId:productId", value = { as, supplier }
  const [supplierCache, setSupplierCache] = useState({});
  // Measure row-1 height so row-2 th's can use top: <row1Height>px
  const row1Ref = useRef(null);
  const [row1Height, setRow1Height] = useState(0);

  useEffect(() => {
    if (!row1Ref.current) return;
    const ro = new ResizeObserver(() => {
      setRow1Height(row1Ref.current?.getBoundingClientRect().height || 0);
    });
    ro.observe(row1Ref.current);
    setRow1Height(row1Ref.current.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);

  const needsSupplierData = columnAxis === "supplier" || secondaryAxis === "supplier";

  useEffect(() => {
    if (!needsSupplierData || !bom?.product_id) return;
    setVendorsLoading(true);
    let cancelled = false;
    const load = async () => {
      const asList = await base44.entities.ApprovedSupplier.filter({
        product_id: bom.product_id, status: "active",
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
      setVendorsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [needsSupplierData, bom?.product_id]);

  // Build primary and secondary member arrays
  const primaryMembers = useMemo(() => {
    if (columnAxis === "color") return colorVariants;
    if (columnAxis === "size") return styleSizes.map((ss) => {
      const sz = allSizes.find((s) => s.id === ss.size_id);
      return { id: ss.size_id, size_id: ss.size_id, label: sz?.name || sz?.size_code || ss.size_id };
    });
    if (columnAxis === "color_and_more") return colorAndMores;
    if (columnAxis === "supplier") return parentVendors;
    return [];
  }, [columnAxis, colorVariants, styleSizes, colorAndMores, parentVendors, allSizes]);

  const secondaryMembers = useMemo(() => {
    if (secondaryAxis === "color") return colorVariants;
    if (secondaryAxis === "size") return styleSizes.map((ss) => {
      const sz = allSizes.find((s) => s.id === ss.size_id);
      return { id: ss.size_id, size_id: ss.size_id, label: sz?.name || sz?.size_code || ss.size_id };
    });
    if (secondaryAxis === "color_and_more") return colorAndMores;
    if (secondaryAxis === "supplier") return parentVendors;
    return [];
  }, [secondaryAxis, colorVariants, styleSizes, colorAndMores, parentVendors, allSizes]);

  const getMemberLabel = (member, axis) => {
    if (axis === "color") return member.color_name || member.colorway_code || "—";
    if (axis === "size") return member.label || member.id;
    if (axis === "color_and_more") return member.name || member.sequence || "—";
    if (axis === "supplier") {
      const sup = parentSupplierMap[member.supplier_id];
      return sup?.name || member.supplier_id;
    }
    return member.id;
  };

  // No filtering in grouped matrix view
  const filteredLines = bomLines;

  // Resolve a variant for a (line, primaryMember, secondaryMember) cell
  const getVariant = (lineId, primaryMember, secondaryMember) => {
    return bomLineVariants.find((v) => {
      if (v.bom_line_id !== lineId) return false;
      // Primary axis match
      const primaryMatch = (() => {
        if (columnAxis === "color") return v.product_color_id === primaryMember.id;
        if (columnAxis === "size") return v.size_id === primaryMember.id || v.size_id === primaryMember.size_id;
        if (columnAxis === "color_and_more") return v.product_color_and_more_id === primaryMember.id;
        if (columnAxis === "supplier") return v.parent_approved_supplier_id === primaryMember.id;
        return false;
      })();
      // Secondary axis match
      const secondaryMatch = (() => {
        if (secondaryAxis === "color") return v.product_color_id === secondaryMember.id;
        if (secondaryAxis === "size") return v.size_id === secondaryMember.id || v.size_id === secondaryMember.size_id;
        if (secondaryAxis === "color_and_more") return v.product_color_and_more_id === secondaryMember.id;
        if (secondaryAxis === "supplier") return v.parent_approved_supplier_id === secondaryMember.id;
        return false;
      })();
      return primaryMatch && secondaryMatch;
    });
  };

  // Build the payload keys for a grouped cell upsert
  const buildGroupedPayload = (line, primaryMember, secondaryMember, overrides = {}) => {
    const base = { bom_line_id: line.id };
    // Primary axis FK
    if (columnAxis === "color") base.product_color_id = primaryMember.id;
    else if (columnAxis === "size") base.size_id = primaryMember.size_id || primaryMember.id;
    else if (columnAxis === "color_and_more") base.product_color_and_more_id = primaryMember.id;
    else if (columnAxis === "supplier") base.parent_approved_supplier_id = primaryMember.id;
    // Secondary axis FK
    if (secondaryAxis === "color") base.product_color_id = secondaryMember.id;
    else if (secondaryAxis === "size") base.size_id = secondaryMember.size_id || secondaryMember.id;
    else if (secondaryAxis === "color_and_more") base.product_color_and_more_id = secondaryMember.id;
    else if (secondaryAxis === "supplier") base.parent_approved_supplier_id = secondaryMember.id;
    return { ...base, ...overrides };
  };

  const handleMarkNA = (line, pm, sm) => {
    onUpsertVariant(buildGroupedPayload(line, pm, sm, { is_not_applicable: true }));
  };

  const handleClearNA = (line, pm, sm) => {
    onUpsertVariant(buildGroupedPayload(line, pm, sm, { is_not_applicable: false }));
  };

  const roleValues = useMemo(() => lovValues.filter((v) => v.category === "bom_line_role"), [lovValues]);

  if (vendorsLoading) {
    return <div className="text-xs text-muted-foreground py-8 text-center">Loading grouped matrix…</div>;
  }

  const totalCols = primaryMembers.length * secondaryMembers.length;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-xs border-collapse">
          <thead>
            {/* Top row — primary axis spanning labels */}
            <tr ref={row1Ref} className="border-b border-border/50">
              <th style={{ position: "sticky", top: 0, left: 0, zIndex: 30, background: "hsl(var(--muted))" }} className="px-2 py-2 w-8" rowSpan={2}></th>
              <th style={{ position: "sticky", top: 0, left: 32, zIndex: 30, background: "hsl(var(--muted))" }} className="px-3 py-2 text-left font-semibold text-muted-foreground min-w-[220px]" rowSpan={2}>Component</th>
              <th style={{ position: "sticky", top: 0, zIndex: 20, background: "hsl(var(--muted))" }} className="px-3 py-2 text-left font-semibold text-muted-foreground w-20" rowSpan={2}>Base Qty</th>
              <th style={{ position: "sticky", top: 0, zIndex: 20, background: "hsl(var(--muted))" }} className="px-3 py-2 text-left font-semibold text-muted-foreground w-16" rowSpan={2}>UOM</th>
              {primaryMembers.map((pm) => (
                <th
                  key={pm.id}
                  colSpan={secondaryMembers.length}
                  style={{ position: "sticky", top: 0, zIndex: 20, background: "hsl(var(--muted))" }}
                  className="px-2 py-1.5 text-center font-semibold text-muted-foreground border-l border-border/50"
                >
                  <div className="truncate max-w-[180px] mx-auto text-xs" title={getMemberLabel(pm, columnAxis)}>
                    {getMemberLabel(pm, columnAxis)}
                  </div>
                  {columnAxis === "color" && pm.color_hex && (
                    <div className="w-3 h-3 rounded-full mx-auto mt-0.5 border border-border/50" style={{ backgroundColor: pm.color_hex }} />
                  )}
                  {columnAxis === "supplier" && (
                    <div className="flex justify-center gap-1 mt-0.5">
                      {pm.is_primary ? (
                        <span className="text-[9px] px-1 py-0 rounded bg-primary/10 text-primary border border-primary/20">Primary</span>
                      ) : (
                        <span className="text-[9px] px-1 py-0 rounded bg-muted text-muted-foreground border border-border">Alt {pm.rank}</span>
                      )}
                    </div>
                  )}
                </th>
              ))}
              <th style={{ position: "sticky", top: 0, zIndex: 20, background: "hsl(var(--muted))" }} className="w-8" rowSpan={2}></th>
            </tr>
            {/* Bottom row — secondary axis labels */}
            <tr className="border-b border-border">
              {primaryMembers.map((pm) =>
                secondaryMembers.map((sm) => (
                  <th
                    key={`${pm.id}__${sm.id}`}
                    style={{ position: "sticky", top: row1Height, zIndex: 20, background: "hsl(var(--muted))" }}
                    className="px-2 py-1.5 text-center font-medium text-muted-foreground/80 min-w-[100px] border-l border-border/30 text-[10px]"
                  >
                    <div className="truncate max-w-[100px] mx-auto" title={getMemberLabel(sm, secondaryAxis)}>
                      {getMemberLabel(sm, secondaryAxis)}
                    </div>
                    {secondaryAxis === "color" && sm.color_hex && (
                      <div className="w-2 h-2 rounded-full mx-auto mt-0.5 border border-border/50" style={{ backgroundColor: sm.color_hex }} />
                    )}
                    {secondaryAxis === "supplier" && (
                      <div className="flex justify-center mt-0.5">
                        {sm.is_primary
                          ? <span className="text-[8px] px-0.5 rounded bg-primary/10 text-primary">P</span>
                          : <span className="text-[8px] px-0.5 rounded bg-muted text-muted-foreground">{sm.rank}</span>}
                      </div>
                    )}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {filteredLines.length === 0 ? (
              <tr>
                <td colSpan={4 + totalCols + 1} className="px-4 py-12 text-center text-muted-foreground">
                  {bomLines.length === 0 ? (
                    <div className="space-y-2">
                      <p>No component lines yet.</p>
                      {!isReadOnly && (
                        <Button size="sm" variant="outline" onClick={onAddLine} className="gap-1">
                          <Plus className="w-3.5 h-3.5" /> Add Component Line
                        </Button>
                      )}
                    </div>
                  ) : "No results match your search."}
                </td>
              </tr>
            ) : filteredLines.map((line) => {
              const comp = allProducts.find((p) => p.id === line.component_product_id);
              const roleLabel = roleValues.find((v) => v.name === line.component_role)?.name || line.component_role || "—";
              const uom = getUom(line);

              return (
                <tr key={line.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors group">
                  <td className="px-2 py-2 sticky left-0 bg-card z-10">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 cursor-grab" />
                  </td>
                  <td className="px-3 py-2 sticky left-8 bg-card z-10 min-w-[220px]">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {comp?.images?.[0] && (
                          <img src={comp.images[0]} alt="" className="w-6 h-6 rounded object-cover border border-border shrink-0" />
                        )}
                        <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">{roleLabel}</span>
                      </div>
                      <div>
                        <span className="font-medium text-foreground text-xs">
                          {comp ? `${comp.code || ""} ${comp.name}`.trim()
                            : <span className="text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Missing</span>}
                        </span>
                      </div>
                      {/* variation flags */}
                      <div className="flex gap-1 flex-wrap">
                        {line.varies_by_color && <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded">×color</span>}
                        {line.varies_by_size && <span className="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">×size</span>}
                        {line.varies_by_color_and_more && <span className="text-[10px] px-1 py-0.5 bg-orange-100 text-orange-700 rounded">×more</span>}
                        {line.varies_by_supplier && <span className="text-[10px] px-1 py-0.5 bg-pink-100 text-pink-700 rounded">×supplier</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 w-20">
                    {isReadOnly
                      ? <span className="text-foreground text-xs">{line.base_quantity ?? "—"}</span>
                      : <Input type="number" className="h-6 w-16 text-xs" value={line.base_quantity ?? ""}
                          onChange={(e) => onUpdateLine(line.id, { base_quantity: parseFloat(e.target.value) || null })} />
                    }
                  </td>
                  <td className="px-3 py-2 w-16">
                    <span className="text-[10px] text-muted-foreground">{uom}</span>
                  </td>

                  {/* Grouped cells */}
                  {primaryMembers.map((pm) =>
                    secondaryMembers.map((sm) => {
                      const variant = getVariant(line.id, pm, sm);
                      const isNA = variant?.is_not_applicable === true;
                      const pickerKey = `${line.id}__${pm.id}__${sm.id}`;
                      const isPickerOpen = openPicker?.key === pickerKey;

                      // Determine if the supplier axis is secondary (most common grouped case)
                      const supplierAxisIsSecondary = secondaryAxis === "supplier";
                      const supplierAxisIsPrimary = columnAxis === "supplier";
                      const colorAxisIsPrimary = columnAxis === "color";
                      const colorAxisIsSecondary = secondaryAxis === "color";

                      // For Color×Supplier: color is primary, supplier is secondary
                      // The cell editor should handle size/color/cam axes via BOMVariantCellEditor for the primary
                      // For supplier secondary: show a supplier cell
                      const showSupplierCell = supplierAxisIsSecondary || supplierAxisIsPrimary;

                      // The parent vendor for this cell
                      const parentVendor = supplierAxisIsSecondary ? sm : supplierAxisIsPrimary ? pm : null;
                      // The color for this cell
                      const colorMember = colorAxisIsPrimary ? pm : colorAxisIsSecondary ? sm : null;

                      if (isNA) {
                        return (
                          <td key={`${pm.id}__${sm.id}`} className="px-1.5 py-2 text-center min-w-[100px] align-top border-l border-border/20">
                            <div
                              className="relative rounded border border-border min-h-[36px] flex items-center justify-center group/na"
                              style={NA_STYLE}
                              title="Not applicable"
                            >
                              <span className="text-[10px] text-muted-foreground font-medium select-none">N/A</span>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleClearNA(line, pm, sm)}
                                  className="absolute inset-0 w-full h-full opacity-0 group-hover/na:opacity-100 flex items-center justify-center bg-background/70 rounded text-[10px] text-foreground transition-opacity"
                                >
                                  Clear N/A
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      }

                      // Supplier cell (when supplier is one of the axes)
                      if (showSupplierCell && parentVendor) {
                        // For Color×Supplier: primary axis = color, passed as col to BOMVariantCellEditor
                        // The supplier sub-cell: show component supplier picker
                        const compSupplierAsId = variant?.approved_supplier_id;
                        const isEditable = line.varies_by_supplier && !isReadOnly;

                        return (
                          <td
                            key={`${pm.id}__${sm.id}`}
                            className={`px-1.5 py-2 text-center min-w-[100px] align-top border-l border-border/20 ${isEditable ? "cursor-pointer hover:bg-primary/5" : ""}`}
                          >
                            <div className="space-y-0.5">
                              {/* Color chip if color is the other axis */}
                              {colorMember && (
                                <div className="flex justify-center mb-1">
                                  {(() => {
                                    // Resolve component color from the flat-color variant
                                    const colorVariant = bomLineVariants.find(
                                      (v) => v.bom_line_id === line.id && v.product_color_id === colorMember.id && !v.parent_approved_supplier_id
                                    );
                                    const compColorId = colorVariant?.component_product_color_id || variant?.component_product_color_id;
                                    const compColor = compColorId ? allProductColors.find((pc) => pc.id === compColorId) : null;
                                    return compColor ? (
                                      <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: compColor.color_hex }} title={compColor.color_name} />
                                    ) : (
                                      <div className="w-5 h-5 rounded border-dashed border border-muted-foreground/30" />
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Supplier info */}
                                              <SupplierCellContent
                                                approvedSupplierId={compSupplierAsId}
                                                componentProductId={line.component_product_id}
                                                isDefault={!compSupplierAsId}
                                                supplierCache={supplierCache}
                                                onCacheUpdate={setSupplierCache}
                                              />

                              {/* Controls */}
                              {isEditable && (
                                <div className="flex justify-center gap-1 mt-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setOpenPicker({
                                        key: pickerKey,
                                        lineId: line.id,
                                        primaryMember: pm,
                                        secondaryMember: sm,
                                        currentApprovedSupplierId: compSupplierAsId || null,
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
                                    onClick={() => handleMarkNA(line, pm, sm)}
                                    className="text-[9px] text-muted-foreground/50 hover:text-destructive transition-colors"
                                    title="Mark as N/A"
                                  >
                                    <Ban className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                              {!isEditable && !isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkNA(line, pm, sm)}
                                  className="text-[9px] text-muted-foreground/40 hover:text-destructive transition-colors mt-0.5"
                                  title="Mark as N/A"
                                >
                                  <Ban className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      }

                      // Non-supplier grouped cell: use BOMVariantCellEditor for the primary axis
                      // and show a small secondary label
                      const primaryCol = pm;
                      return (
                        <td key={`${pm.id}__${sm.id}`} className="px-1.5 py-2 text-center min-w-[100px] align-top border-l border-border/20">
                          <BOMVariantCellEditor
                            variant={variant}
                            line={line}
                            col={primaryCol}
                            columnAxis={columnAxis}
                            uom={uom}
                            isReadOnly={isReadOnly}
                            allProductColors={allProductColors}
                            techColors={techColors}
                            commColors={commColors}
                            bomType={bom?.bom_type}
                            onUpsertVariant={(payload) => onUpsertVariant({
                              ...payload,
                              ...(secondaryAxis === "size" ? { size_id: sm.size_id || sm.id } : {}),
                              ...(secondaryAxis === "color" ? { product_color_id: sm.id } : {}),
                              ...(secondaryAxis === "color_and_more" ? { product_color_and_more_id: sm.id } : {}),
                            })}
                          />
                        </td>
                      );
                    })
                  )}

                  <td className="px-2 py-2 w-8">
                    {!isReadOnly && (
                      <button type="button" onClick={() => onDeleteLine(line.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
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

      {/* Legend — sticky footer */}
      <div className="shrink-0 flex gap-4 text-[10px] text-muted-foreground flex-wrap items-center px-2 py-1.5 border-t border-border bg-background">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={NA_STYLE} />N/A
        </span>
        <span className="flex items-center gap-1 text-amber-600">Δ = quantity graded</span>
      </div>

      {/* Component Supplier Picker portal */}
      {openPicker && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpenPicker(null)} />
          <div className="fixed z-[9999]" style={{ top: openPicker.top, left: openPicker.left, transform: "translateX(-50%)" }}>
            <ComponentSupplierPicker
              componentProductId={openPicker.componentProductId}
              currentApprovedSupplierId={openPicker.currentApprovedSupplierId}
              onSelect={(asId) => {
                const line = bomLines.find((l) => l.id === openPicker.lineId);
                if (!line) return;
                onUpsertVariant(buildGroupedPayload(line, openPicker.primaryMember, openPicker.secondaryMember, {
                  approved_supplier_id: asId,
                  is_not_applicable: false,
                }));
                setOpenPicker(null);
              }}
              onReset={() => {
                const line = bomLines.find((l) => l.id === openPicker.lineId);
                if (!line) return;
                onUpsertVariant(buildGroupedPayload(line, openPicker.primaryMember, openPicker.secondaryMember, {
                  approved_supplier_id: null,
                  is_not_applicable: false,
                }));
                setOpenPicker(null);
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

/** Tiny inline component to show resolved component supplier info in a grouped cell */
function SupplierCellContent({ approvedSupplierId, componentProductId, isDefault, supplierCache, onCacheUpdate }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!componentProductId) return;

    // Build cache key
    const cacheKey = approvedSupplierId ? `${approvedSupplierId}:${componentProductId}` : `primary:${componentProductId}`;
    const cached = supplierCache[cacheKey];

    if (cached) {
      setInfo(cached);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        let as = null;
        if (approvedSupplierId) {
          const asList = await base44.entities.ApprovedSupplier.filter({ id: approvedSupplierId });
          as = asList[0];
        } else {
          const asList = await base44.entities.ApprovedSupplier.filter({
            product_id: componentProductId,
            is_primary: true,
            status: "active",
          });
          as = asList[0];
        }

        if (cancelled || !as) {
          if (!cancelled) setInfo(null);
          return;
        }

        const sups = await base44.entities.Supplier.filter({ id: as.supplier_id });
        if (cancelled) return;

        const result = { as, supplier: sups[0] || null };
        setInfo(result);
        onCacheUpdate((prev) => ({ ...prev, [cacheKey]: result }));
      } catch {
        if (!cancelled) setInfo(null);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [approvedSupplierId, componentProductId, supplierCache, onCacheUpdate]);

  if (!info) {
    return (
      <div className="flex items-center justify-center gap-1 text-amber-600 text-[9px]">
        <AlertTriangle className="w-2.5 h-2.5" />
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className={`text-[9px] font-medium ${info.as?.is_primary ? "text-primary" : "text-foreground/80"}`}>
        {info.supplier?.name || "—"}
      </div>
      {info.as?.supplier_reference && (
        <div className="font-mono text-[9px] text-muted-foreground">{info.as.supplier_reference}</div>
      )}
      {isDefault && <div className="text-[8px] text-muted-foreground/60 italic">(default)</div>}
    </div>
  );
}