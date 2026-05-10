import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Check, X, Minus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ROW_STATUS = {
  READY: "ready",
  SKIP: "skip",
  INVALID: "invalid",
};

const STATUS_CONFIG = {
  [ROW_STATUS.READY]: { icon: Check, color: "bg-green-50 border-green-200 text-green-700" },
  [ROW_STATUS.SKIP]: { icon: Minus, color: "bg-gray-50 border-gray-200 text-gray-600" },
  [ROW_STATUS.INVALID]: { icon: X, color: "bg-red-50 border-red-200 text-red-700" },
};

export default function ImportResponsesDialog({ rfq, rfqLines, currencies, onClose, onImportSuccess }) {
  const [step, setStep] = useState("picker"); // picker | preview | importing
  const [file, setFile] = useState(null);
  const [filename, setFilename] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  // Build line lookup by id (faster validation)
  const lineMap = {};
  for (const line of rfqLines) lineMap[line.id] = line;

  // Parse the uploaded file
  const handleFilePicked = async (file_) => {
    if (!file_ || !file_.name.endsWith(".xlsx")) {
      toast({ title: "Invalid file", description: "Only .xlsx files are supported.", variant: "destructive" });
      return;
    }

    try {
      const buffer = await file_.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets["Lines"];
      if (!ws) {
        toast({ title: "Invalid sheet", description: "No 'Lines' sheet found.", variant: "destructive" });
        return;
      }

      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (data.length < 2) {
        toast({ title: "Empty file", description: "File must have header row and at least one data row.", variant: "destructive" });
        return;
      }

      // Skip rows 0 (header) and 1 (helper text), start from row 2 (data)
      const rows = data.slice(2).map((row, idx) => {
        const lineId = row[0] ? String(row[0]).trim() : "";
        const validFrom = row[9] || "";
        const validUntil = row[10] || "";
        const minQty = row[11];
        const maxQty = row[12];
        const leadTimeDays = row[13];
        const supplierCcy = row[14] ? String(row[14]).trim().toUpperCase() : "";
        const totalCost = row[15];
        const supplierNotes = row[16] || "";

        let status = ROW_STATUS.READY;
        let reason = "";

        // Step 1: Validate line exists & belongs to this RFQ
        if (!lineId) {
          status = ROW_STATUS.INVALID;
          reason = "Line ID is required (column A).";
        } else if (!lineMap[lineId]) {
          status = ROW_STATUS.INVALID;
          reason = "Line not found in this RFQ.";
        }

        // Step 4: Skip if both currency & cost are empty
        if (status === ROW_STATUS.READY && !supplierCcy && !totalCost) {
          status = ROW_STATUS.SKIP;
        }

        // Step 5: Validate both cost & currency present
        if (status === ROW_STATUS.READY && (supplierCcy || totalCost)) {
          if (!supplierCcy || totalCost === "") {
            status = ROW_STATUS.INVALID;
            reason = "Both Supplier Currency and Total Cost are required.";
          }
        }

        // Step 6: Resolve currency
        let currencyId = "";
        if (status === ROW_STATUS.READY && supplierCcy) {
          const curr = currencies.find((c) => c.code.toUpperCase() === supplierCcy && c.is_active);
          if (!curr) {
            status = ROW_STATUS.INVALID;
            reason = `Unknown currency code: ${supplierCcy}`;
          } else {
            currencyId = curr.id;
          }
        }

        return {
          rowIdx: idx + 2,
          lineId,
          validFrom: validFrom ? String(validFrom) : "",
          validUntil: validUntil ? String(validUntil) : "",
          minQty: minQty ? Number(minQty) : null,
          maxQty: maxQty ? Number(maxQty) : null,
          leadTimeDays: leadTimeDays ? Number(leadTimeDays) : null,
          supplierCcy,
          totalCost: totalCost ? Number(totalCost) : null,
          supplierNotes: String(supplierNotes),
          status,
          reason,
          currencyId,
        };
      });

      // Step 7: Check conversion rates (deferred to import, so we mark ready here but validate on import)
      // For now, store the rows for preview

      setFile(file_);
      setFilename(file_.name);
      setParsedRows(rows);
      setStep("preview");
    } catch (err) {
      toast({ title: "Parse error", description: err.message, variant: "destructive" });
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const readyRows = parsedRows.filter((r) => r.status === ROW_STATUS.READY);
      const user = await base44.auth.me();
      let importedCount = 0;

      for (const row of readyRows) {
        const line = lineMap[row.lineId];
        const supCurr = currencies.find((c) => c.id === row.currencyId);

        // Fetch conversion rate (same logic as Add Response dialog)
        let targetCurrId = rfq.target_currency_id;
        let conversionRate = null;
        let conversionRateId = null;
        let conversionRateDate = null;
        let totalCostTarget = row.totalCost;

        if (supCurr && supCurr.id !== targetCurrId) {
          // Find conversion rate
          const rates = await base44.entities.CurrencyConversionRate.filter({
            source_currency_id: supCurr.id,
            target_currency_id: targetCurrId,
            effective_date: { $lte: new Date().toISOString().split("T")[0] },
          }, "-effective_date", 1);

          if (rates.length === 0) {
            // Mark as invalid if no rate found
            toast({
              title: "Conversion rate missing",
              description: `No rate found for ${supCurr.code} → ${rfq.target_currency_id}`,
              variant: "destructive",
            });
            continue;
          }

          conversionRate = rates[0];
          conversionRateId = rates[0].id;
          conversionRateDate = rates[0].effective_date;
          totalCostTarget = row.totalCost * rates[0].rate;
        } else if (supCurr && supCurr.id === targetCurrId) {
          // Same currency, no conversion needed
          conversionRate = 1;
          totalCostTarget = row.totalCost;
        }

        // Create RFQResponse
        const response = await base44.entities.RFQResponse.create({
          rfq_line_id: row.lineId,
          valid_from: row.validFrom || null,
          valid_until: row.validUntil || null,
          min_qty: row.minQty,
          max_qty: row.maxQty,
          leadtime_days: row.leadTimeDays,
          supplier_currency_id: row.currencyId,
          total_cost_supplier_ccy: row.totalCost,
          total_cost_target_ccy: totalCostTarget,
          conversion_rate_used: conversionRate.rate || conversionRate,
          conversion_rate_id: conversionRateId,
          conversion_rate_date: conversionRateDate,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          submitted_by: user?.email || "",
          is_awarded: false,
          supplier_notes: row.supplierNotes || null,
          reviewer_notes: `Imported from ${filename} on ${new Date().toLocaleDateString()}`,
        });

        // Update line status if it was pending
        if (line.status === "pending") {
          await base44.entities.RFQLine.update(line.id, { status: "answered" });
        }

        importedCount++;
      }

      setImporting(false);
      toast({ title: "Success", description: `Imported ${importedCount} response(s).` });
      onImportSuccess();
      onClose();
    } catch (err) {
      setImporting(false);
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    }
  };

  const readyCount = parsedRows.filter((r) => r.status === ROW_STATUS.READY).length;
  const skipCount = parsedRows.filter((r) => r.status === ROW_STATUS.SKIP).length;
  const invalidCount = parsedRows.filter((r) => r.status === ROW_STATUS.INVALID).length;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Responses</DialogTitle>
        </DialogHeader>

        {step === "picker" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) handleFilePicked(f);
              }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFilePicked(f);
                }}
                className="hidden"
              />
              <p className="text-sm font-medium">Drop your filled .xlsx file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="bg-muted/50 p-3 rounded text-xs space-y-1">
              <p>
                <strong>{readyCount}</strong> ready · <strong>{skipCount}</strong> skipped · <strong>{invalidCount}</strong> invalid
              </p>
            </div>

            <div className="max-h-80 overflow-y-auto border border-border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left w-8"></th>
                    <th className="px-2 py-2 text-left">Row</th>
                    <th className="px-2 py-2 text-left">Line ID</th>
                    <th className="px-2 py-2 text-left">Currency</th>
                    <th className="px-2 py-2 text-left">Total Cost</th>
                    <th className="px-2 py-2 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row) => {
                    const cfg = STATUS_CONFIG[row.status];
                    const Icon = cfg.icon;
                    return (
                      <tr key={row.rowIdx} className={`border-t border-border ${cfg.color}`}>
                        <td className="px-2 py-1.5">
                          <Icon className="w-3.5 h-3.5" />
                        </td>
                        <td className="px-2 py-1.5">{row.rowIdx}</td>
                        <td className="px-2 py-1.5 font-mono">{row.lineId}</td>
                        <td className="px-2 py-1.5">{row.supplierCcy}</td>
                        <td className="px-2 py-1.5">{row.totalCost}</td>
                        <td className="px-2 py-1.5 text-[10px]">{row.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {invalidCount > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded p-2 flex gap-2 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Fix invalid rows and re-upload to proceed.</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("picker")} disabled={importing}>
                Pick different file
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || readyCount === 0 || invalidCount > 0}
                className="gap-2"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                {importing ? "Importing..." : `Import ${readyCount} response${readyCount !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}