import { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, AlertCircle } from "lucide-react";

export default function AwardConfirmDialog({
  open,
  onOpenChange,
  response,
  line,
  rfq,
  productMap,
  stepMap,
  supplierMap,
  currencyMap,
  priorCost,
  onConfirmed,
}) {
  const [awarding, setAwarding] = useState(false);

  const product = productMap[line?.product_id];
  const step = stepMap[line?.routing_step_id];
  const supplier = supplierMap[line?.recipient_supplier_id];
  const supplierCcy = currencyMap[response?.supplier_currency_id];
  const targetCcy = currencyMap[rfq?.target_currency_id];

  const handleAward = async () => {
    setAwarding(true);
    try {
      await base44.functions.invoke('awardRFQResponse', {
        rfq_line_id: line.id,
        response_id: response.id,
        rfq_id: rfq.id,
      });
      onOpenChange(false);
      onConfirmed();
    } catch (error) {
      alert(`Error awarding response: ${error.message}`);
    }
    setAwarding(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Award this response?</AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription asChild>
          <div className="space-y-3 text-sm">
            {/* Scope summary */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-xs">
              <div>
                <span className="text-muted-foreground">Product: </span>
                <span className="font-medium">{product?.code} — {product?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Step: </span>
                <span className="font-medium">{step?.step_type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Supplier: </span>
                <span className="font-medium">{supplier?.name}</span>
              </div>
            </div>

            {/* Cost summary */}
            <div className="bg-blue-50/50 rounded-lg p-3 space-y-1 text-xs border border-blue-200/50">
              <div className="font-semibold text-blue-900">
                {response?.total_cost_supplier_ccy} {supplierCcy?.code} = {response?.total_cost_target_ccy} {targetCcy?.code}
              </div>
              <div className="text-muted-foreground">
                Validity: {response?.valid_from ? new Date(response.valid_from).toLocaleDateString() : "—"} → {response?.valid_until ? new Date(response.valid_until).toLocaleDateString() : "—"}
              </div>
              <div className="text-muted-foreground">
                Lead time: {response?.leadtime_days ? `${response.leadtime_days} days` : "—"}
              </div>
            </div>

            {/* Prior cost warning */}
            {priorCost && (
              <div className="bg-amber-50/70 rounded-lg p-3 border border-amber-200/50 flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <p className="font-semibold">Existing cost will be superseded</p>
                  <p className="mt-1">
                    {priorCost.total_cost_target_ccy} {targetCcy?.code} from RFQ {priorCost.source_rfq?.code || "—"},
                    awarded {priorCost.awarded_at ? new Date(priorCost.awarded_at).toLocaleString() : "—"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={awarding}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleAward} disabled={awarding} className="gap-2">
            {awarding && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Award
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}