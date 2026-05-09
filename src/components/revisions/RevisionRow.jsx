/**
 * RevisionRow
 * Expandable row for a prior (non-current) revision.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, GitCommit } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function relTime(val) {
  if (!val) return "";
  try { return formatDistanceToNow(new Date(val), { addSuffix: true }); } catch { return ""; }
}

export default function RevisionRow({ revision, defaultExpanded = false, ecoIds = [], ecoRecords = {} }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
        <span className="font-mono font-bold text-sm text-foreground shrink-0">{revision.revision_code}</span>
        <span className="text-[11px] text-muted-foreground truncate flex-1">
          {revision.revision_context || "—"}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">{relTime(revision.created_at || revision.created_date)}</span>
        {ecoIds.length > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-300 shrink-0">ECO</span>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 py-3 bg-background border-t border-border space-y-2.5">
          {revision.revision_context && (
            <div>
              <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Context</p>
              <p className="text-xs text-foreground leading-snug bg-muted/20 rounded px-2 py-1.5 border border-border">
                {revision.revision_context}
              </p>
            </div>
          )}
          {revision.field_diffs?.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Fields Changed</p>
              <p className="text-xs text-foreground bg-muted/20 rounded px-2 py-1.5 border border-border">
                {revision.field_diffs.map(d => d.field).join(", ")}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-muted-foreground">Created by</span>
              <p className="font-medium text-foreground">{revision.created_by ? revision.created_by.split("@")[0] : "system"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Date</span>
              <p className="font-medium text-foreground">{relTime(revision.created_at || revision.created_date)}</p>
            </div>
          </div>
          {ecoIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
              {ecoIds.map(ecoId => {
                const eco = ecoRecords[ecoId];
                return eco ? (
                  <Link key={ecoId} to={`/change-management/ecos/${ecoId}`}>
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300 font-medium hover:bg-blue-200 transition-colors cursor-pointer">
                      <GitCommit className="w-2.5 h-2.5" />{eco.eco_number}
                    </span>
                  </Link>
                ) : null;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}