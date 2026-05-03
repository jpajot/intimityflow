import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

const AXIS_OPTIONS = [
  { value: "color", label: "Colorway" },
  { value: "size", label: "Size" },
  { value: "color_and_more", label: "Color & More" },
  { value: "supplier", label: "Supplier" },
];

export default function BOMExportDialog({
  open,
  onClose,
  bom,
  bomLines,
  bomLineVariants,
  colorVariants,
  styleSizes,
  allProducts,
  allSizes,
  columnAxis,
  showSourcing,
}) {
  const [format, setFormat] = useState("csv");
  const [includeSourcing, setIncludeSourcing] = useState(showSourcing);

  const getColumnLabel = (col) => {
    if (columnAxis === "color") return col.color_name || col.colorway_code || col.id;
    if (columnAxis === "size") {
      const s = allSizes.find((sz) => sz.id === (col.size_id || col.id));
      return s?.name || s?.size_code || col.id;
    }
    return col.name || col.id;
  };

  const columns = columnAxis === "color" ? colorVariants :
    columnAxis === "size" ? styleSizes.map((ss) => ({ ...ss, id: ss.size_id })) : colorVariants;

  const getVariant = (lineId, col) => {
    return bomLineVariants.find((v) => {
      if (v.bom_line_id !== lineId) return false;
      if (columnAxis === "color") return v.product_color_id === col.id;
      if (columnAxis === "size") return v.size_id === col.size_id || v.size_id === col.id;
      return false;
    });
  };

  const buildCSV = () => {
    const headers = ["Component", "Role", "Base Qty", "UOM", ...columns.map(getColumnLabel)];
    const rows = [headers.join(",")];
    for (const line of bomLines) {
      const comp = allProducts.find((p) => p.id === line.component_product_id);
      const name = comp ? `${comp.code || ""} ${comp.name}`.trim() : "?";
      const uom = line.uom || comp?.default_uom || "";
      const cells = columns.map((col) => {
        const v = getVariant(line.id, col);
        if (!v) return "";
        if (v.is_not_applicable) return "N/A";
        return v.quantity ?? line.base_quantity ?? "";
      });
      rows.push([name, line.component_role || "", line.base_quantity ?? "", uom, ...cells].map((c) => `"${c}"`).join(","));
    }
    return rows.join("\n");
  };

  const handleDownload = () => {
    const csv = buildCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BOM_${bom?.revision_code || "export"}_${columnAxis}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Export matrix</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Exporting {bomLines.length} line{bomLines.length !== 1 ? "s" : ""} × {columns.length} {AXIS_OPTIONS.find(o => o.value === columnAxis)?.label || columnAxis} column{columns.length !== 1 ? "s" : ""}.
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Format</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="xlsx" disabled>XLSX (coming soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <Checkbox checked={includeSourcing} onCheckedChange={setIncludeSourcing} />
            Include sourcing chain
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleDownload} className="gap-1">
            <Download className="w-3.5 h-3.5" />
            Download {format.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}