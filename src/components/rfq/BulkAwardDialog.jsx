import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

const STATUS_CONFIG = {
  READY: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  INVALID: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  CONFLICT: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" },
};

export default function BulkAwardDialog({
  open,
  onOpenChange,
  selectedLineIds,
  lines,
  responses,
  rfq,
  productMap,
  stepMap,
  supplierMap,
  currencyMap,
  onConfirmed,
}) {
  const [awarding, setAwarding] = useState(false);

  // Pre-check 1+2: validate each line has exactly one submitted response
  // Pre-check 3: detect scope conflicts
  const analysis = useMemo(() => {
    const ready = [];
    const invalid = [];
    const conflict = [];
    const scopeMap = {}; // (project, product, color, pcam, step) -> [lines with that scope]

    selectedLineIds.forEach((lineId) => {
      const line = lines.find((l) => l.id === lineId);
      if (!line) return;

      const lineResponses = responses.filter((r) => r.rfq_line_id === lineId && r.status === 'submitted');

      if (lineResponses.length === 0) {
        invalid.push({
          lineId,
          reason: 'No submitted responses',
          product: productMap[line.product_id],
          step: stepMap[line.routing_step_id],
        });
        return;
      }

      if (lineResponses.length > 1) {
        invalid.push({
          lineId,
          reason: 'Multiple submitted responses — award individually',
          product: productMap[line.product_id],
          step: stepMap[line.routing_step_id],
        });
        return;
      }

      // Scope tuple (without supplier)
      const scopeKey = `${rfq.project_id}|${line.product_id}|${line.product_color_id || 'null'}|${line.product_color_and_more_id || 'null'}|${line.routing_step_id}`;

      if (!scopeMap[scopeKey]) scopeMap[scopeKey] = [];
      scopeMap[scopeKey].push({ lineId, line, response: lineResponses[0] });
    });

    // Check for conflicts: same scope tuple but different suppliers
    Object.entries(scopeMap).forEach(([scope, items]) => {
      if (items.length > 1) {
        const suppliers = new Set(items.map((it) => it.line.recipient_supplier_id));
        if (suppliers.size > 1) {
          items.forEach(({ lineId, line }) => {
            conflict.push({
              lineId,
              reason: 'Conflicts with another line on same scope (different suppliers)',
              product: productMap[line.product_id],
              step: stepMap[line.routing_step_id],
            });
          });
        }
      }
    });

    // Remaining lines are READY
    selectedLineIds.forEach((lineId) => {
      if (!invalid.some((i) => i.lineId === lineId) && !conflict.some((c) => c.lineId === lineId)) {
        const line = lines.find((l) => l.id === lineId);
        const lineResponses = responses.filter((r) => r.rfq_line_id === lineId && r.status === 'submitted');
        if (lineResponses.length === 1) {
          ready.push({
            lineId,
            line,
            response: lineResponses[0],
            product: productMap[line.product_id],
            step: stepMap[line.routing_step_id],
            supplier: supplierMap[line.recipient_supplier_id],
          });
        }
      }
    });

    return { ready, invalid, conflict };
  }, [selectedLineIds, lines, responses, rfq.project_id, productMap, stepMap, supplierMap]);

  const handleBulkAward = async () => {
    setAwarding(true);
    try {
      // Award all READY lines in sequence
      for (const item of analysis.ready) {
        await base44.functions.invoke('awardRFQResponse', {
          rfq_line_id: item.lineId,
          response_id: item.response.id,
          rfq_id: rfq.id,
        });
      }
      onOpenChange(false);
      onConfirmed(analysis.ready.length);
    } catch (error) {
      alert(`Error during bulk award: ${error.message}`);
    }
    setAwarding(false);
  };

  const summaryText = `${analysis.ready.length} ready · ${analysis.invalid.length} invalid · ${analysis.conflict.length} in conflict`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Award {selectedLineIds.length} lines</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Summary badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-green-100 text-green-700">{analysis.ready.length} ready</Badge>
            {analysis.invalid.length > 0 && (
              <Badge className="bg-red-100 text-red-700">{analysis.invalid.length} invalid</Badge>
            )}
            {analysis.conflict.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700">{analysis.conflict.length} in conflict</Badge>
            )}
          </div>

          {/* Results table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="space-y-1">
              {/* READY */}
              {analysis.ready.length > 0 && (
                <div>
                  <div className="bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 border-b border-green-200/50">
                    Ready to Award ({analysis.ready.length})
                  </div>
                  {analysis.ready.map((item) => (
                    <div key={item.lineId} className="px-3 py-2 border-b border-border/50 last:border-0 flex items-start gap-2 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.product?.code} — {item.step?.step_type}</p>
                        <p className="text-muted-foreground text-[10px]">{item.supplier?.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* INVALID */}
              {analysis.invalid.length > 0 && (
                <div>
                  <div className="bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 border-b border-red-200/50">
                    Invalid ({analysis.invalid.length})
                  </div>
                  {analysis.invalid.map((item) => (
                    <div key={item.lineId} className="px-3 py-2 border-b border-border/50 last:border-0 flex items-start gap-2 text-xs">
                      <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.product?.code} — {item.step?.step_type}</p>
                        <p className="text-red-600 text-[10px]">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CONFLICT */}
              {analysis.conflict.length > 0 && (
                <div>
                  <div className="bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 border-b border-amber-200/50">
                    In Conflict ({analysis.conflict.length})
                  </div>
                  {analysis.conflict.map((item) => (
                    <div key={item.lineId} className="px-3 py-2 border-b border-border/50 last:border-0 flex items-start gap-2 text-xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.product?.code} — {item.step?.step_type}</p>
                        <p className="text-amber-600 text-[10px]">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <p className="text-xs text-muted-foreground">
            Deselect conflicting lines and re-open this dialog to proceed.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={awarding}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkAward}
            disabled={awarding || analysis.ready.length === 0}
            className="gap-2"
          >
            {awarding && <Loader2 className="w-4 h-4 animate-spin" />}
            Award {analysis.ready.length} line{analysis.ready.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}