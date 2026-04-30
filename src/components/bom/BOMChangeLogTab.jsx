import { format } from "date-fns";

const CHANGE_TYPE_LABELS = {
  status_transition: "Status change",
  line_added: "Line added",
  line_removed: "Line removed",
  line_modified: "Line modified",
  variant_modified: "Variant updated",
  derived: "Derived from dev BOM",
  routing_synced: "Routing synced",
  routing_overridden: "Routing overridden",
  matrix_axis_changed: "Matrix axis changed",
  uom_overridden: "UOM override",
};

export default function BOMChangeLogTab({ changeLog, allProducts }) {
  if (changeLog.length === 0) {
    return (
      <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {changeLog.map((entry) => (
        <div key={entry.id} className="flex gap-3 px-4 py-3 bg-card rounded-lg border border-border text-sm">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{CHANGE_TYPE_LABELS[entry.change_type] || entry.change_type}</span>
              {entry.payload?.from && entry.payload?.to && (
                <span className="text-xs text-muted-foreground">
                  {entry.payload.from} → {entry.payload.to}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
              <span>{entry.triggered_by || "System"}</span>
              {entry.triggered_at && (
                <span>{format(new Date(entry.triggered_at), "dd MMM yyyy HH:mm")}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}