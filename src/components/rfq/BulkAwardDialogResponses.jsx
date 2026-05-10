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
  DUPLICATE: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" },
  SCOPE_CONFLICT: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
};

export default function BulkAwardDialogResponses({
  open,
  onOpenChange,
  selectedResponseIds,
  responses,
  lines,
  rfqs,
  productMap,
  stepMap,
  supplierMap,
  currencyMap,
  onConfirmed,
}) {
  const [awarding, setAwarding] = useState(false);

  // Pre-check analysis
  const analysis = useMemo(() => {
    const ready = [];
    const invalid = [];
    const duplicates = [];
    const scopeConflicts = [];
    const scopeMap = {}; // (project, product, color, pcam, step) -> response ids

    selectedResponseIds.forEach((responseId) => {
      const response = responses.find((r) => r.id === responseId);
      if (!response) return;

      const line = lines.find((l) => l.id === response.rfq_line_id);
      if (!line) {
        invalid.push({
          responseId,
          reason: "Line not found",
          product: "—",
          step: "—",
        });
        return;
      }

      // Pre-check 1: awardable
      if (response.is_awarded || !["submitted", "under_review", "rejected"].includes(response.status)) {
        invalid.push({
          responseId,
          reason: "Not awardable (already awarded or invalid status)",
          product: productMap[line.product_id]?.code,
          step: stepMap[line.routing_step_id]?.step_type,
        });
        return;
      }

      const rfq = rfqs.find((r) => r.id === line.rfq_id);
      const scopeKey = `${rfq?.project_id}|${line.product_id}|${line.product_color_id || "null"}|${line.product_color_and_more_id || "null"}|${line.routing_step_id}`;

      // Pre-check 2: duplicate line detection
      const responsesByLine = selectedResponseIds
        .map((id) => responses.find((r) => r.id === id))
        .filter((r) => r && !invalid.some((i) => i.responseId === r.id))
        .filter((r) => r && r.rfq_line_id === response.rfq_line_id);

      if (responsesByLine.length > 1) {
        duplicates.push({
          responseId,
          reason: "Multiple responses selected on same line",
          product: productMap[line.product_id]?.code,
          step: stepMap[line.routing_step_id]?.step_type,
        });
        return;
      }

      // Pre-check 3: scope conflict detection
      if (!scopeMap[scopeKey]) scopeMap[scopeKey] = [];
      scopeMap[scopeKey].push(responseId);
    });

    // Check for scope conflicts
    Object.entries(scopeMap).forEach(([scope, respIds]) => {
      if (respIds.length > 1) {
        respIds.forEach((respId) => {
          const response = responses.find((r) => r.id === respId);
          const line = lines.find((l) => l.id === response.rfq_line_id);
          scopeConflicts.push({
            responseId: respId,
            reason: "Scope conflict: multiple responses on same step/product (cannot award both)",
            product: productMap[line.product_id]?.code,
            step: stepMap[line.routing_step_id]?.step_type,
          });
        });
      }
    });

    // Remaining are READY
    selectedResponseIds.forEach((responseId) => {
      if (
        !invalid.some((i) => i.responseId === responseId) &&
        !duplicates.some((d) => d.responseId === responseId) &&
        !scopeConflicts.some((s) => s.responseId === responseId)
      ) {
        const response = responses.find((r) => r.id === responseId);
        const line = lines.find((l) => l.id === response.rfq_line_id);
        const rfq = rfqs.find((r) => r.id === line.rfq_id);
        const sup = supplierMap[line.recipient_supplier_id];
        const curr = currencyMap[rfq?.target_currency_id];

        ready.push({
          responseId,
          response,
          line,
          product: productMap[line.product_id],
          step: stepMap[line.routing_step_id],
          supplier: sup,
          cost: response.total_cost_target_ccy ? `${response.total_cost_target_ccy.toFixed(curr?.decimal_places ?? 2)} ${curr?.code || "?"}` : "—",
        });
      }
    });

    return { ready, invalid, duplicates, scopeConflicts };
  }, [selectedResponseIds, responses, lines, rfqs, productMap, stepMap, supplierMap, currencyMap]);

  const handleBulkAward = async () => {
    setAwarding(true);
    try {
      let awardedCount = 0;
      let supersededCount = 0;

      for (const item of analysis.ready) {
        const result = await base44.functions.invoke('awardRFQResponse', {
          rfq_line_id: item.line.id,
          response_id: item.response.id,
          rfq_id: item.line.rfq_id,
        });

        if (result.data?.success) {
          awardedCount++;
          if (result.data?.prior_cost_superseded) supersededCount++;
        }
      }

      onOpenChange(false);
      onConfirmed(awardedCount);
    } catch (error) {
      alert(`Error during bulk award: ${error.message}`);
    }
    setAwarding(false);
  };

  const hasConflicts = analysis.invalid.length > 0 || analysis.duplicates.length > 0 || analysis.scopeConflicts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Award {selectedResponseIds.length} response{selectedResponseIds.length !== 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Summary badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-green-100 text-green-700">{analysis.ready.length} ready</Badge>
            {analysis.invalid.length > 0 && (
              <Badge className="bg-red-100 text-red-700">{analysis.invalid.length} invalid</Badge>
            )}
            {analysis.duplicates.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700">{analysis.duplicates.length} duplicate</Badge>
            )}
            {analysis.scopeConflicts.length > 0 && (
              <Badge className="bg-red-100 text-red-700">{analysis.scopeConflicts.length} scope conflict</Badge>
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
                    <div key={item.responseId} className="px-3 py-2 border-b border-border/50 last:border-0 flex items-start gap-2 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.product?.code} — {item.step?.step_type}</p>
                        <p className="text-muted-foreground text-[10px]">{item.supplier?.name} — {item.cost}</p>
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
                    <div key={item.responseId} className="px-3 py-2 border-b border-border/50 last:border-0 flex items-start gap-2 text-xs">
                      <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.product} — {item.step}</p>
                        <p className="text-red-600 text-[10px]">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* DUPLICATES */}
              {analysis.duplicates.length > 0 && (
                <div>
                  <div className="bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 border-b border-amber-200/50">
                    Duplicate Line ({analysis.duplicates.length})
                  </div>
                  {analysis.duplicates.map((item) => (
                    <div key={item.responseId} className="px-3 py-2 border-b border-border/50 last:border-0 flex items-start gap-2 text-xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.product} — {item.step}</p>
                        <p className="text-amber-600 text-[10px]">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SCOPE CONFLICTS */}
              {analysis.scopeConflicts.length > 0 && (
                <div>
                  <div className="bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 border-b border-red-200/50">
                    Scope Conflict ({analysis.scopeConflicts.length})
                  </div>
                  {analysis.scopeConflicts.map((item) => (
                    <div key={item.responseId} className="px-3 py-2 border-b border-border/50 last:border-0 flex items-start gap-2 text-xs">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.product} — {item.step}</p>
                        <p className="text-red-600 text-[10px]">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          {hasConflicts && (
            <p className="text-xs text-muted-foreground">
              Deselect conflicting responses and re-open this dialog to proceed.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={awarding}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkAward}
            disabled={awarding || analysis.ready.length === 0 || hasConflicts}
            className="gap-2"
          >
            {awarding && <Loader2 className="w-4 h-4 animate-spin" />}
            Award {analysis.ready.length} response{analysis.ready.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}