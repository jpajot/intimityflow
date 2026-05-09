import { GitCompare } from "lucide-react";

export default function BomComparePage() {
  return (
    <div className="px-4 py-4 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">BOM Compare</h1>
        <p className="text-sm text-muted-foreground mt-1">Compare two BOMs side-by-side. Coming in Prompt #21.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {["Left BOM", "Right BOM"].map((label) => (
          <div key={label} className="rounded-xl border border-dashed border-border bg-muted/20 p-6 flex flex-col items-center justify-center gap-3 opacity-50 pointer-events-none select-none">
            <GitCompare className="w-8 h-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Picker coming in Prompt #21</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}