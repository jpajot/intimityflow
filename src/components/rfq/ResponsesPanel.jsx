import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Loader2, MessageSquarePlus } from "lucide-react";
import ResponseCard from "./ResponseCard";
import AddResponseDialog from "./AddResponseDialog";

export default function ResponsesPanel({ line, rfq, productMap, stepMap, supplierMap, onClose, onLineChanged }) {
  const product  = productMap[line.product_id];
  const step     = stepMap[line.routing_step_id];
  const supplier = supplierMap[line.recipient_supplier_id];

  const [responses, setResponses] = useState([]);
  const [currencyMap, setCurrencyMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingResponse, setEditingResponse] = useState(null); // RFQResponse to edit
  const [showAddDialog, setShowAddDialog] = useState(false);

  const loadResponses = useCallback(async () => {
    setLoading(true);
    const [respList, currencies] = await Promise.all([
      base44.entities.RFQResponse.filter({ rfq_line_id: line.id }, "-created_date", 200),
      base44.entities.Currency.list("code", 200),
    ]);
    const cMap = Object.fromEntries(currencies.map((c) => [c.id, c]));
    setResponses(respList);
    setCurrencyMap(cMap);
    setLoading(false);
  }, [line.id]);

  useEffect(() => { loadResponses(); }, [loadResponses]);

  // Inject targetCurrencyId onto line for ResponseCard consumption
  const lineWithTarget = { ...line, _targetCurrencyId: rfq.target_currency_id };

  const handleDeleted = () => {
    loadResponses();
    onLineChanged?.();
  };

  const handleSaved = () => {
    setShowAddDialog(false);
    setEditingResponse(null);
    loadResponses();
    onLineChanged?.();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-30 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full z-40 flex flex-col bg-background border-l border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">
              Responses for {product?.code || "?"} / Step {step?.sequence}: {(step?.step_type || "").replace(/_/g, " ")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recipient: {supplier?.name || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add Response button */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8 w-full"
            onClick={() => setShowAddDialog(true)}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            Add Response
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : responses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">No responses yet for this line.</p>
              <p className="text-xs text-muted-foreground">Use Add Response to record one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {responses.map((resp) => (
                <ResponseCard
                  key={resp.id}
                  response={resp}
                  currencyMap={currencyMap}
                  line={lineWithTarget}
                  onEdit={(r) => setEditingResponse(r)}
                  onDeleted={handleDeleted}
                  onAward={null}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Response Dialog */}
      {showAddDialog && (
        <AddResponseDialog
          line={line}
          rfq={rfq}
          productMap={productMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          onSaved={handleSaved}
          onClose={() => setShowAddDialog(false)}
        />
      )}

      {/* Edit Response Dialog */}
      {editingResponse && (
        <AddResponseDialog
          line={line}
          rfq={rfq}
          productMap={productMap}
          stepMap={stepMap}
          supplierMap={supplierMap}
          existingResponse={editingResponse}
          onSaved={handleSaved}
          onClose={() => setEditingResponse(null)}
        />
      )}
    </>
  );
}