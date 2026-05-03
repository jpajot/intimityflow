import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Auto-resolve component colorways by TechnicalColor (TCX) match or name match.
 * Shows a confirmation dialog with match results before applying.
 */
export default function BOMAutoResolveDialog({
  open,
  onClose,
  mode, // "tcx" | "name" | "size"
  line,
  colorVariants,       // parent product colorways
  allProductColors,    // all product colors (to find component colorways)
  techColors,
  allSizes,
  styleSizes,          // parent style sizes
  bomLineVariants,
  onUpsertVariant,
  onDone,
}) {
  const [step, setStep] = useState("idle"); // idle | resolving | confirm | applying | done
  const [matches, setMatches] = useState([]);
  const [skipped, setSkipped] = useState([]);   // already resolved or NA
  const [baseSame, setBaseSame] = useState([]);  // match == base size, no variant needed
  const [unmatched, setUnmatched] = useState([]);
  const [hasRun, setHasRun] = useState(false);

  const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const getSizeName = (sizeId) => {
    const s = (allSizes || []).find((sz) => sz.id === sizeId);
    return s ? (s.name || s.size_code || sizeId) : sizeId;
  };

  const runResolve = async () => {
    setStep("resolving");
    setHasRun(true);
    if (!line) return;

    const lineVariants = (bomLineVariants || []).filter((v) => v.bom_line_id === line.id);
    const compColors = allProductColors.filter((pc) => pc.product_id === line.component_product_id);

    if (mode === "tcx") {
      const found = [], notFound = [], skip = [];
      for (const parentCw of colorVariants) {
        const existing = lineVariants.find((v) => v.product_color_id === parentCw.id);
        if (existing?.component_product_color_id || existing?.is_not_applicable) { skip.push(parentCw); continue; }
        const parentTcxId = parentCw.linked_tech_color_id;
        if (!parentTcxId) { notFound.push(parentCw); continue; }
        const compMatch = compColors.find((cc) => cc.linked_tech_color_id === parentTcxId);
        compMatch ? found.push({ parentCw, compColor: compMatch }) : notFound.push(parentCw);
      }
      setMatches(found); setUnmatched(notFound); setSkipped(skip); setBaseSame([]);
    } else if (mode === "name") {
      const found = [], notFound = [], skip = [];
      for (const parentCw of colorVariants) {
        const existing = lineVariants.find((v) => v.product_color_id === parentCw.id);
        if (existing?.component_product_color_id || existing?.is_not_applicable) { skip.push(parentCw); continue; }
        const pn = normalize(parentCw.color_name);
        const compMatch = compColors.find((cc) => {
          const cn = normalize(cc.color_name);
          return cn === pn || cn.includes(pn) || pn.includes(cn);
        });
        compMatch ? found.push({ parentCw, compColor: compMatch }) : notFound.push(parentCw);
      }
      setMatches(found); setUnmatched(notFound); setSkipped(skip); setBaseSame([]);
    } else if (mode === "size") {
      const found = [], notFound = [], skip = [], sameAsBase = [];
      const compStyleSizes = await base44.entities.StyleSize.filter({ product_id: line.component_product_id });
      const activeCompSizes = compStyleSizes.filter((s) => s.active !== false);

      for (const ss of styleSizes) {
        const existing = lineVariants.find((v) => v.size_id === ss.size_id);
        if (existing?.component_size_id || existing?.is_not_applicable) { skip.push(ss); continue; }

        const parentSize = allSizes.find((s) => s.id === ss.size_id);
        const compSizeMatch = activeCompSizes.find((cs) => {
          const compSize = allSizes.find((s) => s.id === cs.size_id);
          return compSize && normalize(compSize.size_code || compSize.name) === normalize(parentSize?.size_code || parentSize?.name);
        });

        if (!compSizeMatch) { notFound.push(ss); continue; }

        // Skip if the matched component size is the same as the base — no override needed
        if (compSizeMatch.size_id === line.base_component_size_id) {
          sameAsBase.push({ ss, compSizeId: compSizeMatch.size_id });
          continue;
        }

        found.push({ parentSize: ss, compSize: compSizeMatch });
      }
      setMatches(found); setUnmatched(notFound); setSkipped(skip); setBaseSame(sameAsBase);
    }
    setStep("confirm");
  };

  // Kick off once when dialog opens
  if (open && step === "idle" && !hasRun && line) {
    runResolve();
  }

  const applyMatches = async () => {
    setStep("applying");
    for (const m of matches) {
      if (mode === "size") {
        await onUpsertVariant({
          bom_line_id: line.id,
          size_id: m.parentSize.size_id,
          component_size_id: m.compSize.size_id,
          product_color_id: null,
          product_color_and_more_id: null,
        });
      } else {
        await onUpsertVariant({
          bom_line_id: line.id,
          product_color_id: m.parentCw.id,
          component_product_color_id: m.compColor.id,
        });
      }
    }
    setStep("done");
    onDone?.();
  };

  const handleClose = () => {
    setStep("idle"); setMatches([]); setSkipped([]); setBaseSame([]); setUnmatched([]); setHasRun(false);
    onClose();
  };

  const modeLabel = mode === "tcx" ? "TechnicalColor" : mode === "name" ? "name match" : "size code";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Auto-resolve by {modeLabel}</DialogTitle>
        </DialogHeader>

        {(step === "idle" || step === "resolving") && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Scanning…
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-2 text-sm">
            <div className={`flex items-center gap-2 ${matches.length > 0 ? "text-green-700" : "text-muted-foreground"}`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span><strong>{matches.length}</strong> {mode === "size" ? "size mapping" : "colorway"} match{matches.length !== 1 ? "es" : ""} to write</span>
            </div>
            {mode === "size" && baseSame.length > 0 && (
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <span className="w-4 h-4 shrink-0 flex items-center justify-center">—</span>
                <span><strong>{baseSame.length}</strong> cell{baseSame.length !== 1 ? "s" : ""} inherit the base size (no variant needed)</span>
              </div>
            )}
            {skipped.length > 0 && (
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <span className="w-4 h-4 shrink-0 flex items-center justify-center">↷</span>
                <span><strong>{skipped.length}</strong> already resolved or marked N/A (skipped)</span>
              </div>
            )}
            {unmatched.length > 0 && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span><strong>{unmatched.length}</strong> unmatched — will remain unresolved</span>
              </div>
            )}
            {mode === "size" && matches.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground bg-muted/40 rounded p-2 leading-relaxed">
                {matches.map((m) => `${getSizeName(m.parentSize.size_id)} → ${getSizeName(m.compSize.size_id)}`).join(", ")}
              </div>
            )}
            {matches.length === 0 && (
              <p className="text-muted-foreground text-xs pt-1">Nothing to apply.</p>
            )}
          </div>
        )}

        {step === "applying" && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Applying {matches.length} match{matches.length !== 1 ? "es" : ""}…
          </div>
        )}

        {step === "done" && (
          <div className="flex items-center gap-2 py-4 text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4" /> Applied {matches.length} resolution{matches.length !== 1 ? "s" : ""}.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>
            {step === "done" ? "Close" : "Cancel"}
          </Button>
          {step === "confirm" && matches.length > 0 && (
            <Button size="sm" onClick={applyMatches}>
              Apply {matches.length} match{matches.length !== 1 ? "es" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}