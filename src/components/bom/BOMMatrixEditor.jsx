import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, GripVertical, Plus, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import BOMVariantCellEditor from "./BOMVariantCellEditor.jsx";

const AXIS_OPTIONS = [
  { value: "color", label: "Colorway" },
  { value: "size", label: "Size" },
  { value: "color_and_more", label: "Color & More" },
];

const SIZE_VARIATION_MODE_OPTIONS = [
  { value: "consumption_grading", label: "Consumption grading" },
  { value: "component_size_mapping", label: "Component size mapping" },
  { value: "base_size_with_optional_grading", label: "Base size + optional grading" },
  { value: "both", label: "Both" },
];

const BASE_SIZE_REQUIRED_MODES = ["base_size_with_optional_grading", "component_size_mapping"];

/**
 * Inline size-variation controls rendered below the component info when varies_by_size = true.
 */
function SizeVariationControls({ line, allSizes, styleSizes, isReadOnly, onUpdateLine }) {
  // Component's own active sizes
  const compSizes = useMemo(() => {
    // styleSizes passed in are for the PARENT product. We need component sizes.
    // They're loaded separately — passed as allSizes (full Size list) + compStyleSizeIds
    return [];
  }, []);

  const mode = line.size_variation_mode;
  const showBaseSizePicker = BASE_SIZE_REQUIRED_MODES.includes(mode);

  // Load component's active StyleSizes
  const [compStyleSizes, setCompStyleSizes] = useState([]);
  useEffect(() => {
    if (!line.component_product_id || !line.varies_by_size) return;
    base44.entities.StyleSize.filter({ product_id: line.component_product_id })
      .then((ss) => setCompStyleSizes(ss.filter((s) => s.active !== false)));
  }, [line.component_product_id, line.varies_by_size]);

  const getSizeName = (sizeId) => {
    const s = allSizes.find((sz) => sz.id === sizeId);
    return s?.name || s?.size_code || sizeId;
  };

  if (!line.varies_by_size) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-2 items-center">
      {/* Mode picker */}
      {!isReadOnly ? (
        <Select
          value={mode || ""}
          onValueChange={(v) => onUpdateLine(line.id, { size_variation_mode: v })}
        >
          <SelectTrigger className="h-6 text-[10px] w-44 border-green-300 bg-green-50 text-green-800 px-1.5">
            <SelectValue placeholder="Size variation mode…" />
          </SelectTrigger>
          <SelectContent>
            {SIZE_VARIATION_MODE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        mode && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
            {SIZE_VARIATION_MODE_OPTIONS.find((o) => o.value === mode)?.label || mode}
          </span>
        )
      )}

      {/* Base size picker */}
      {showBaseSizePicker && compStyleSizes.length > 0 && (
        !isReadOnly ? (
          <Select
            value={line.base_component_size_id || ""}
            onValueChange={(v) => onUpdateLine(line.id, { base_component_size_id: v || null })}
          >
            <SelectTrigger className="h-6 text-[10px] w-32 px-1.5">
              <SelectValue placeholder="Base size…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null} className="text-xs text-muted-foreground">— none —</SelectItem>
              {compStyleSizes.map((ss) => (
                <SelectItem key={ss.size_id} value={ss.size_id} className="text-xs">
                  {getSizeName(ss.size_id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          line.base_component_size_id && (
            <span className="text-[10px] text-muted-foreground">
              Base: {getSizeName(line.base_component_size_id)}
            </span>
          )
        )
      )}

      {/* Warning if mode requires base size but none set */}
      {showBaseSizePicker && !line.base_component_size_id && !isReadOnly && compStyleSizes.length > 0 && (
        <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
          <AlertTriangle className="w-2.5 h-2.5" /> Pick a base size
        </span>
      )}
    </div>
  );
}

export default function BOMMatrixEditor({
  bom, bomLines, bomLineVariants, colorVariants, styleSizes, colorAndMores,
  allProducts, allProductColors, techColors, commColors,
  lovValues, isReadOnly, columnAxis, onColumnAxisChange,
  showAxisConfig, onUpdateLine, onDeleteLine, onUpsertVariant, getUom, onAddLine,
  allSizes = [],
}) {
  const [search, setSearch] = useState("");

  // Resolve size records for column headers
  const columnHeaders = useMemo(() => {
    if (columnAxis === "color") return colorVariants;
    if (columnAxis === "size") {
      return styleSizes.map((ss) => {
        const sizeRecord = allSizes.find((s) => s.id === ss.size_id);
        return {
          id: ss.size_id,
          size_id: ss.size_id,
          label: sizeRecord?.name || sizeRecord?.size_code || ss.size_id,
        };
      });
    }
    if (columnAxis === "color_and_more") return colorAndMores;
    return colorVariants;
  }, [columnAxis, colorVariants, styleSizes, colorAndMores, allSizes]);

  const getColumnLabel = (col) => {
    if (columnAxis === "color") return col.color_name || col.colorway_code || "—";
    if (columnAxis === "size") return col.label || col.id;
    if (columnAxis === "color_and_more") return col.name || col.sequence || "—";
    return col.id;
  };

  const filteredLines = useMemo(() => {
    if (!search.trim()) return bomLines;
    const q = search.toLowerCase();
    return bomLines.filter((line) => {
      const comp = allProducts.find((p) => p.id === line.component_product_id);
      return (
        comp?.name?.toLowerCase().includes(q) ||
        comp?.code?.toLowerCase().includes(q) ||
        line.component_role?.toLowerCase().includes(q)
      );
    });
  }, [bomLines, search, allProducts]);

  const getVariantForCell = (lineId, col) => {
    return bomLineVariants.find((v) => {
      if (v.bom_line_id !== lineId) return false;
      if (columnAxis === "color") return v.product_color_id === col.id;
      if (columnAxis === "size") return v.size_id === col.id || v.size_id === col.size_id;
      if (columnAxis === "color_and_more") return v.product_color_and_more_id === col.id;
      return false;
    });
  };

  const uomLabel = (line) => {
    const u = getUom(line);
    const isOverride = line.uom_is_overridden;
    return (
      <span
        className={`text-[10px] ${isOverride ? "font-semibold text-amber-600" : "text-muted-foreground"}`}
        title={isOverride ? "UOM overridden on this line" : "Inherited from component"}
      >
        {u}{isOverride ? " ●" : ""}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search component lines…"
          className="h-8 text-xs w-56"
        />
        {showAxisConfig && (
          <div className="flex items-center gap-2 ml-auto bg-muted/60 border border-border rounded-lg px-3 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">Columns:</span>
            <Select value={columnAxis} onValueChange={onColumnAxisChange}>
              <SelectTrigger className="h-7 text-xs w-36 border-0 bg-transparent shadow-none p-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AXIS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Matrix table */}
      <div className="rounded-xl border border-border overflow-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="sticky top-0 z-10 bg-muted/60">
            <tr className="border-b border-border">
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-8 sticky left-0 bg-muted/60 z-20"></th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground sticky left-8 bg-muted/60 z-20 min-w-[220px]">
                Component
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-20">Base Qty</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-16">UOM</th>
              {columnHeaders.map((col) => (
                <th key={col.id} className="px-2 py-2.5 text-center font-semibold text-muted-foreground min-w-[96px]">
                  <div className="truncate max-w-[96px] mx-auto" title={getColumnLabel(col)}>
                    {getColumnLabel(col)}
                  </div>
                  {columnAxis === "color" && col.color_hex && (
                    <div className="w-3 h-3 rounded-full mx-auto mt-0.5 border border-border/50" style={{ backgroundColor: col.color_hex }} />
                  )}
                </th>
              ))}
              <th className="px-2 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.length === 0 ? (
              <tr>
                <td colSpan={5 + columnHeaders.length} className="px-4 py-12 text-center text-muted-foreground">
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
              const roleValues = lovValues.filter((v) => v.category === "bom_line_role");
              const roleLabel = roleValues.find((v) => v.name === line.component_role)?.name || line.component_role || "—";
              return (
                <tr key={line.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors group">
                  {/* Drag handle */}
                  <td className="px-2 py-2 sticky left-0 bg-card z-10">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 cursor-grab" />
                  </td>
                  {/* Component info */}
                  <td className="px-3 py-2 sticky left-8 bg-card z-10 min-w-[220px]">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {comp?.images?.[0] && (
                          <img src={comp.images[0]} alt="" className="w-6 h-6 rounded object-cover border border-border shrink-0" />
                        )}
                        <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">
                          {roleLabel}
                        </span>
                        {line.is_phantom && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px]">phantom</span>
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-foreground text-xs">
                          {comp ? `${comp.code || ""} ${comp.name}`.trim() : <span className="text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Missing</span>}
                        </span>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {line.varies_by_color && <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded">×color</span>}
                        {line.varies_by_size && <span className="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">×size</span>}
                        {line.varies_by_color_and_more && <span className="text-[10px] px-1 py-0.5 bg-orange-100 text-orange-700 rounded">×more</span>}
                        {line.varies_by_supplier && <span className="text-[10px] px-1 py-0.5 bg-pink-100 text-pink-700 rounded">×supplier</span>}
                      </div>
                      {/* Size variation controls */}
                      <SizeVariationControls
                        line={line}
                        allSizes={allSizes}
                        styleSizes={styleSizes}
                        isReadOnly={isReadOnly}
                        onUpdateLine={onUpdateLine}
                      />
                    </div>
                  </td>
                  {/* Base quantity */}
                  <td className="px-3 py-2 w-20">
                    {isReadOnly ? (
                      <span className="text-foreground text-xs">{line.base_quantity ?? "—"}</span>
                    ) : (
                      <Input
                        type="number"
                        className="h-6 w-16 text-xs"
                        value={line.base_quantity ?? ""}
                        onChange={(e) => onUpdateLine(line.id, { base_quantity: parseFloat(e.target.value) || null })}
                      />
                    )}
                  </td>
                  {/* UOM */}
                  <td className="px-3 py-2 w-16">
                    {uomLabel(line)}
                  </td>
                  {/* Variant cells */}
                  {columnHeaders.map((col) => {
                    const variant = getVariantForCell(line.id, col);
                    const uom = getUom(line);
                    return (
                      <td key={col.id} className="px-1.5 py-2 text-center min-w-[96px] align-top">
                        <BOMVariantCellEditor
                          variant={variant}
                          line={line}
                          col={col}
                          columnAxis={columnAxis}
                          uom={uom}
                          isReadOnly={isReadOnly}
                          allProductColors={allProductColors}
                          techColors={techColors}
                          commColors={commColors}
                          bomType={bom?.bom_type}
                          onUpsertVariant={onUpsertVariant}
                        />
                      </td>
                    );
                  })}
                  {/* Row actions */}
                  <td className="px-2 py-2 w-8">
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => onDeleteLine(line.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        title="Remove line"
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

      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-muted-foreground flex-wrap items-center">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border border-dashed border-amber-400 bg-amber-50/50 inline-block" />
          Missing resolution
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border border-border bg-card inline-block" />
          Resolved
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-3 h-3 rounded inline-block"
            style={{ background: "repeating-linear-gradient(-45deg, #f3f4f6, #f3f4f6 2px, #e5e7eb 2px, #e5e7eb 4px)" }}
          />
          N/A
        </span>
        <span className="flex items-center gap-1 text-amber-600">
          Δ = quantity graded (differs from base)
        </span>
      </div>
    </div>
  );
}