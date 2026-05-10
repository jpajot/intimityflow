import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";

export default function ExportTodoDialog({ rfq, lines, productMap, colorMap, pcamMap, stepMap, supplierMap, onClose }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Filter to pending & answered lines only
      const exportLines = lines.filter((l) => ["pending", "answered"].includes(l.status));

      // Build data rows
      const data = exportLines.map((line) => {
        const prod = productMap[line.product_id];
        const sup = supplierMap[line.recipient_supplier_id];
        const step = stepMap[line.routing_step_id];
        
        let granLabel = "Product";
        if (line.product_color_and_more_id) {
          const c = colorMap[line.product_color_id];
          const pc = pcamMap[line.product_color_and_more_id];
          granLabel = c && pc ? `PCAM: ${c.color_name} › ${pc.name}` : "PCAM";
        } else if (line.product_color_id) {
          const c = colorMap[line.product_color_id];
          granLabel = c ? `ProductColor: ${c.color_name}` : "ProductColor";
        }

        const stepLabel = step ? `Step ${step.sequence}: ${step.step_type}` : "—";

        return {
          "Line ID": line.id,
          "Product Code": prod?.code || "",
          "Product Name": prod?.name || "",
          "Granularity": granLabel,
          "Routing Step": stepLabel,
          "Recipient Supplier": sup?.name || "",
          "Forecasted Qty": line.forecasted_qty || "",
          "UOM": line.forecasted_qty_uom || "",
          "Buyer Notes": line.buyer_notes || "",
          "Valid From": "",
          "Valid Until": "",
          "Min Qty": "",
          "Max Qty": "",
          "Lead Time (days)": "",
          "Supplier Currency Code": "",
          "Total Cost (supplier ccy)": "",
          "Supplier Notes": "",
        };
      });

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);

      // Format header row (row 1) and row 2 (helper text)
      const readOnlyFields = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
      const inputFields = ["J", "K", "L", "M", "N", "O", "P", "Q"];

      // Row 1 (header) styling
      for (const col of readOnlyFields) {
        const cell = ws[`${col}1`];
        if (cell) {
          cell.fill = { type: "solid", fgColor: { rgb: "FFCCCCCC" } }; // gray
          cell.font = { bold: true };
        }
      }
      for (const col of inputFields) {
        const cell = ws[`${col}1`];
        if (cell) {
          cell.fill = { type: "solid", fgColor: { rgb: "FFFFFF99" } }; // yellow
          cell.font = { bold: true, color: { rgb: "FF0000FF" } }; // blue text
        }
      }

      // Row 2 (helper text)
      const helperText = "Fill columns J–Q only. Do not modify columns A–I. Column A is required for import matching.";
      ws["A2"] = { v: helperText, t: "s" };
      ws["A2"].font = { italic: true, color: { rgb: "FF808080" } };
      ws["A2"].alignment = { wrapText: true };
      ws.merge_cells = ["A2:Q2"];

      // Shift data rows down
      const newData = [
        [...Array(17)], // row 1 (headers)
        [...Array(17)], // row 2 (helper)
      ];
      for (let i = 0; i < data.length; i++) {
        const row = {};
        let colIdx = 0;
        for (const key of Object.keys(data[i])) {
          const col = String.fromCharCode(65 + colIdx);
          row[`${col}${i + 3}`] = { v: data[i][key], t: typeof data[i][key] === "number" ? "n" : "s" };
          colIdx++;
        }
        Object.assign(ws, row);
      }

      // Set column widths
      ws["!cols"] = [
        { wch: 36 }, // A: Line ID
        { wch: 12 }, // B: Product Code
        { wch: 20 }, // C: Product Name
        { wch: 24 }, // D: Granularity
        { wch: 20 }, // E: Routing Step
        { wch: 18 }, // F: Recipient Supplier
        { wch: 14 }, // G: Forecasted Qty
        { wch: 8 },  // H: UOM
        { wch: 20 }, // I: Buyer Notes
        { wch: 12 }, // J: Valid From
        { wch: 12 }, // K: Valid Until
        { wch: 10 }, // L: Min Qty
        { wch: 10 }, // M: Max Qty
        { wch: 14 }, // N: Lead Time
        { wch: 18 }, // O: Currency Code
        { wch: 16 }, // P: Total Cost
        { wch: 20 }, // Q: Supplier Notes
      ];

      // Append to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Lines");

      // Generate filename
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const filename = `${rfq.code}_ToDo_${today}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export RFQ Lines</DialogTitle>
        </DialogHeader>
        <div className="py-4 text-sm text-muted-foreground space-y-2">
          <p>
            Exporting <strong>{lines.filter((l) => ["pending", "answered"].includes(l.status)).length}</strong> open lines from <strong>{rfq.code}</strong>.
          </p>
          <p>
            Columns A–I are read-only metadata. Fill columns J–Q with cost data and re-upload.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting && <Loader2 className="w-4 h-4 animate-spin" />}
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}