import { ArrowRight } from "lucide-react";

const STATUS_STYLES = {
  inherited: "bg-slate-100 text-slate-600 border-slate-200",
  overridden: "bg-amber-100 text-amber-700 border-amber-200",
  removed: "bg-red-100 text-red-700 border-red-200",
  active: "bg-green-100 text-green-700 border-green-200",
};

export default function BOLEditorTab({ bol, operations, bom, isReadOnly, onReload }) {
  if (!bol) {
    return (
      <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">No BOL created yet for this production BOM.</p>
        <p className="text-xs text-muted-foreground mt-1">Select a routing to generate operations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border p-4 space-y-1">
        <p className="text-xs text-muted-foreground">Bill of Labor — {operations.length} operations</p>
        {bol.source_routing_snapshot_at && (
          <p className="text-xs text-muted-foreground">Last synced: {new Date(bol.source_routing_snapshot_at).toLocaleDateString()}</p>
        )}
      </div>

      {/* Horizontal step sequence */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {operations.map((op, idx) => (
            <div key={op.id} className="flex items-start gap-2">
              <div className="w-48 bg-card border border-border rounded-lg p-3 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">[{op.sequence}]</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_STYLES[op.operation_status] || STATUS_STYLES.inherited}`}>
                    {op.operation_status || "inherited"}
                  </span>
                </div>
                <p className="text-sm font-medium leading-tight">{op.description || op.step_type || "Operation"}</p>
                {op.lead_time_override_days && (
                  <p className="text-xs text-muted-foreground">{op.lead_time_override_days} days</p>
                )}
                {op.unit_cost_override && (
                  <p className="text-xs text-muted-foreground">
                    {op.unit_cost_override} {op.currency_override || ""}
                  </p>
                )}
              </div>
              {idx < operations.length - 1 && (
                <div className="flex items-center h-full pt-6">
                  <ArrowRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {operations.length === 0 && (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No operations. Sync from routing to populate.</p>
        </div>
      )}
    </div>
  );
}