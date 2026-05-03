import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Handles "Clear all resolutions", "Mark all cells NA", "Copy resolutions from another line".
 */
export default function BOMBulkLineActionDialog({
  open,
  onClose,
  action,   // "clear" | "markNA" | "copy"
  targetLine,
  sourceLine,  // for copy action
  bomLines,
  allProducts,
  colorVariants,
  styleSizes,
  bomLineVariants,
  onUpsertVariant,
  onVariantsDeleted,
  onDone,
}) {
  const [working, setWorking] = useState(false);
  const [copySourceId, setCopySourceId] = useState(null);

  const getLineName = (line) => {
    const comp = allProducts.find((p) => p.id === line?.component_product_id);
    return comp ? `${comp.code || ""} ${comp.name}`.trim() : line?.component_role || line?.id || "?";
  };

  const targetVariants = bomLineVariants.filter((v) => v.bom_line_id === targetLine?.id);

  const handleClear = async () => {
    setWorking(true);
    const ids = targetVariants.map((v) => v.id);
    await Promise.all(ids.map((vid) => base44.entities.BOMLineVariant.delete(vid)));
    onVariantsDeleted?.(ids);
    setWorking(false);
    onDone?.();
    onClose();
  };

  const handleMarkNA = async () => {
    setWorking(true);
    // For each parent colorway / size, upsert variant with is_not_applicable = true
    const dims = colorVariants.length > 0 ? colorVariants : styleSizes;
    for (const dim of dims) {
      const isColor = !!dim.color_name;
      await onUpsertVariant({
        bom_line_id: targetLine.id,
        ...(isColor ? { product_color_id: dim.id } : { size_id: dim.size_id || dim.id }),
        is_not_applicable: true,
      });
    }
    setWorking(false);
    onDone?.();
    onClose();
  };

  const handleCopy = async () => {
    if (!copySourceId) return;
    setWorking(true);
    const sourceVariants = bomLineVariants.filter((v) => v.bom_line_id === copySourceId);
    for (const sv of sourceVariants) {
      const { id, bom_line_id, created_date, updated_date, created_by, ...rest } = sv;
      await onUpsertVariant({ ...rest, bom_line_id: targetLine.id });
    }
    setWorking(false);
    onDone?.();
    onClose();
  };

  if (action === "copy") {
    const otherLines = bomLines.filter((l) => l.id !== targetLine?.id);
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Copy resolutions from another line</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Target: <strong>{getLineName(targetLine)}</strong>
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {otherLines.map((l) => (
              <button key={l.id} type="button"
                onClick={() => setCopySourceId(l.id)}
                className={`w-full text-left px-3 py-2 rounded text-xs border transition-colors ${
                  copySourceId === l.id ? "bg-primary/10 border-primary/30 text-primary" : "border-transparent hover:bg-muted"
                }`}>
                {getLineName(l)}
              </button>
            ))}
          </div>
          {copySourceId && (
            <p className="text-xs text-muted-foreground">
              Will copy {bomLineVariants.filter((v) => v.bom_line_id === copySourceId).length} variant record(s).
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" disabled={!copySourceId || working} onClick={handleCopy}>
              {working && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Copy resolutions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (action === "clear") {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Clear all resolutions</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Line: <strong>{getLineName(targetLine)}</strong>
          </p>
          <p className="text-sm">
            This will delete <strong>{targetVariants.length} variant record{targetVariants.length !== 1 ? "s" : ""}</strong> for this line. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={working || targetVariants.length === 0} onClick={handleClear}>
              {working && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Delete {targetVariants.length} record{targetVariants.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (action === "markNA") {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Mark all cells Not Applicable</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Line: <strong>{getLineName(targetLine)}</strong>
          </p>
          <p className="text-sm">
            All {colorVariants.length || styleSizes.length} dimension(s) on this line will be marked as N/A. Existing resolutions will be overwritten.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" variant="destructive" disabled={working} onClick={handleMarkNA}>
              {working && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Mark all N/A
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}