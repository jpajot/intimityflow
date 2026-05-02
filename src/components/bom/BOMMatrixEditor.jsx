import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, GripVertical, Plus, AlertTriangle } from "lucide-react";
import BOMVariantCellEditor from "./BOMVariantCellEditor.jsx";

const AXIS_OPTIONS = [
  { value: "color", label: "Colorway" },
  { value: "size", label: "Size" },
  { value: "color_and_more", label: "Color & More" },
];

export default function BOMMatrixEditor({
  bom, bomLines, bomLineVariants, colorVariants, styleSizes, colorAndMores,
  allProducts, allProductColors, techColors, commColors,
  lovValues, isReadOnly, columnAxis, onColumnAxisChange,
  showAxisConfig, onUpdateLine, onDeleteLine, onUpsertVariant, getUom, onAddLine,
}) {
  const [search, setSearch] = useState("");

  // Determine column headers based on axis
  const columnHeaders = useMemo(() => {
    if (columnAxis === "color") return colorVariants;
    if (columnAxis === "size") return styleSizes.map((ss) => ({ id: ss.size_id, size_id: ss.size_id, label: ss.size_id }));
    if (columnAxis === "color_and_more") return colorAndMores;
    return colorVariants;
  }, [columnAxis, colorVariants, styleSizes, colorAndMores]);

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
                          projectId={bom?.project_id}
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