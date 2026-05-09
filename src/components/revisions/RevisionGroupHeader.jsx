/**
 * RevisionGroupHeader
 * Card showing the current revision for a target (Product or ProductColor).
 * Used as the "header" in both CURRENT and expanded OTHER TARGETS sections.
 */
import { Link } from "react-router-dom";
import { GitCommit } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function relTime(val) {
  if (!val) return "";
  try { return formatDistanceToNow(new Date(val), { addSuffix: true }); } catch { return ""; }
}

function targetTypeLabel(tt) {
  switch (tt) {
    case "product": return "Product";
    case "product_color": return "Color";
    default: return tt || "—";
  }
}

export default function RevisionGroupHeader({ targetType, targetLabel, currentRevision, ecoIds = [], ecoRecords = {} }) {
  if (!currentRevision) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        No revision recorded yet for {targetLabel}.
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-green-300 bg-green-50/40 px-4 py-3 space-y-2">
      <div className="flex items-start gap-3">
        {/* Large revision letter badge */}
        <div className="w-10 h-10 rounded-lg border-2 border-green-500 bg-green-100 text-green-800 font-mono font-bold text-base flex items-center justify-center shrink-0">
          {currentRevision.revision_code}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Type label + name + Current badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-green-700">
              {targetTypeLabel(targetType)}
            </span>
            <span className="font-semibold text-sm text-foreground truncate">{targetLabel}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300 font-medium shrink-0">
              Current
            </span>
          </div>

          {/* Context */}
          {currentRevision.revision_context && (
            <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
              {currentRevision.revision_context}
            </p>
          )}

          {/* Metadata */}
          <p className="text-[11px] text-muted-foreground">
            {currentRevision.created_by ? currentRevision.created_by.split("@")[0] : "system"}
            {" · "}
            {relTime(currentRevision.created_at || currentRevision.created_date)}
          </p>

          {/* ECO badges */}
          {ecoIds.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {ecoIds.map(ecoId => {
                const eco = ecoRecords[ecoId];
                return eco ? (
                  <Link key={ecoId} to={`/change-management/ecos/${ecoId}`}>
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300 font-medium hover:bg-blue-200 transition-colors cursor-pointer">
                      <GitCommit className="w-2.5 h-2.5" />
                      {eco.eco_number}
                    </span>
                  </Link>
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}