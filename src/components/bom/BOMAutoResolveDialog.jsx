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
  const [step, setStep] = useState("resolving"); // resolving | confirm | applying | done
  const [matches, setMatches] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [applying, setApplying] = useState(false);

  const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const runResolve = async () => {
    setStep("resolving");
    if (!line) return;

    const compColors = allProductColors.filter((pc) => pc.product_id === line.component_product_id);

    if (mode === "tcx") {
      const found = [];
      const notFound = [];
      for (const parentCw of colorVariants) {
        const parentTcxId = parentCw.linked_tech_color_id;
        if (!parentTcxId) { notFound.push(parentCw); continue; }
        const compMatch = compColors.find((cc) => cc.linked_tech_color_id === parentTcxId);
        if (compMatch) {
          found.push({ parentCw, compColor: compMatch });
        } else {
          notFound.push(parentCw);
        }
      }
      setMatches(found);
      setUnmatched(notFound);
    } else if (mode === "name") {
      const found = [];
      const notFound = [];
      for (const parentCw of colorVariants) {
        const pn = normalize(parentCw.color_name);
        const compMatch = compColors.find((cc) => {
          const cn = normalize(cc.color_name);
          return cn === pn || cn.includes(pn) || pn.includes(cn);
        });
        if (compMatch) {
          found.push({ parentCw, compColor: compMatch });
        } else {
          notFound.push(parentCw);
        }
      }
      setMatches(found);
      setUnmatched(notFound);
    } else if (mode === "size") {
      const found = [];
      const notFound = [];
      const compSizes = await base44.entities.StyleSize.filter({ product_id: line.component_product_id });
      for (const ss of styleSizes) {
        const parentSize = allSizes.find((s) => s.id === ss.size_id);
        const compSizeMatch = compSizes.find((cs) => {
          const compSize = allSizes.find((s) => s.id === cs.size_id);
          return compSize && normalize(compSize.size_code || compSize.name) === normalize(parentSize?.size_code || parentSize?.name);
        });
        if (compSizeMatch) {
          found.push({ parentSize: ss, compSize: compSizeMatch });
        } else {
          notFound.push(ss);
        }
      }
      setMatches(found);
      setUnmatched(notFound);
    }
    setStep("confirm");
  };

  // Kick off on open
  useState(() => { if (open && line) runResolve(); }, [open, line]);
  if (open && step === "resolving" && line && matches.length === 0 && unmatched.length === 0) {
    runResolve();
  }

  const applyMatches = async () => {
    setApplying(true);
    setStep("applying");
    for (const m of matches) {
      if (mode === "size") {
        await onUpsertVariant({
          bom_line_id: line.id,
          size_id: m.parentSize.size_id,
          component_size_id: m.compSize.size_id,
        });
      } else {
        await onUpsertVariant({
          bom_line_id: line.id,
          product_color_id: m.parentCw.id,
          component_product_color_id: m.compColor.id,
        });
      }
    }
    setApplying(false);
    setStep("done");
    onDone?.();
  };

  const modeLabel = mode === "tcx" ? "TechnicalColor" : mode === "name" ? "name match" : "size code";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setStep("resolving"); setMatches([]); setUnmatched([]); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Auto-resolve by {modeLabel}</DialogTitle>
        </DialogHeader>

        {step === "resolving" && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Scanning colorways…
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span><strong>{matches.length}</strong> match{matches.length !== 1 ? "es" : ""} found</span>
            </div>
            {unmatched.length > 0 && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                <span><strong>{unmatched.length}</strong> unmatched — will remain unresolved</span>
              </div>
            )}
            {matches.length === 0 && (
              <p className="text-muted-foreground text-xs">No matches found. Nothing will be applied.</p>
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
          <Button variant="outline" size="sm" onClick={onClose}>
            {step === "done" ? "Close" : "Cancel"}
          </Button>
          {step === "confirm" && matches.length > 0 && (
            <Button size="sm" onClick={applyMatches} disabled={applying}>
              Apply {matches.length} match{matches.length !== 1 ? "es" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}