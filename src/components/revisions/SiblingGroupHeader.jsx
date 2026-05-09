/**
 * SiblingGroupHeader
 * Collapsible header for a sibling target in the OTHER TARGETS section.
 */
import { ChevronRight } from "lucide-react";

function targetTypeLabel(tt) {
  switch (tt) {
    case "product": return "Product";
    case "product_color": return "Color";
    default: return tt || "—";
  }
}

export default function SiblingGroupHeader({ targetType, targetLabel, currentRevisionCode, revisionCount, expanded = false, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors text-left"
    >
      <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{targetTypeLabel(targetType)}</p>
        <p className="text-xs font-medium text-foreground truncate">{targetLabel}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-muted-foreground">{revisionCount} rev{revisionCount !== 1 ? "s" : ""}</span>
        {currentRevisionCode && currentRevisionCode !== "—" && (
          <span className="w-6 h-6 rounded border-2 border-border bg-card text-foreground font-mono font-bold flex items-center justify-center text-[10px]">
            {currentRevisionCode}
          </span>
        )}
      </div>
    </button>
  );
}