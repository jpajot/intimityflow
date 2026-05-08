/**
 * NewRevisionModal
 * Confirmation modal for creating a ProductRevision from the RevisionHistoryPanel.
 * Calls the existing createProductRevision backend function.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, GitCommit, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// ── Helpers ────────────────────────────────────────────────────────────────────

function targetTypeLabel(tt) {
  switch (tt) {
    case "product": return "Product";
    case "product_color": return "Color";
    case "product_color_size": return "Size";
    case "product_variant": return "Variant";
    case "product_attribute": return "Attribute";
    default: return tt || "—";
  }
}

// Spreadsheet column letter increment (mirrors backend logic for preview)
function nextRevisionCodePreview(existingCodes) {
  if (!existingCodes || existingCodes.length === 0) return "A";
  function codeToNum(code) {
    let n = 0;
    for (let i = 0; i < code.length; i++) n = n * 26 + (code.charCodeAt(i) - 64);
    return n;
  }
  function numToCode(n) {
    let result = "";
    while (n > 0) { n -= 1; result = String.fromCharCode((n % 26) + 65) + result; n = Math.floor(n / 26); }
    return result;
  }
  const sorted = [...existingCodes].sort((a, b) => a.length !== b.length ? a.length - b.length : a.localeCompare(b));
  return numToCode(codeToNum(sorted[sorted.length - 1]) + 1);
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function NewRevisionModal({
  open,
  onClose,
  onCreated,    // callback(revisionCode, isFirstRevision) after successful creation
  product,      // full product record
  targetType,   // "product" | "product_color" | ...
  targetId,     // the specific entity id (product.id for product, colorId for color)
  targetName,   // human-readable target name (e.g. "Pastel Yellow")
  currentRevisionCode, // e.g. "K" — null if no revisions yet
}) {
  const { toast } = useToast();
  const [contextNote, setContextNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form on open
  useEffect(() => {
    if (open) setContextNote("");
  }, [open]);

  const isFirstRevision = !currentRevisionCode;
  const nextCode = currentRevisionCode
    ? nextRevisionCodePreview([currentRevisionCode])
    : "A";

  // ── Modal title ───────────────────────────────────────────────────────────────
  const modalTitle = (() => {
    if (targetType === "product") return `Create new revision for Product: ${product?.name || "—"}`;
    if (targetType === "product_color") return `Create new revision for ${targetName || "Color"} on ${product?.name || "—"}`;
    return `Create new revision for ${targetTypeLabel(targetType)}: ${targetName || targetId?.slice(-6) || "—"}`;
  })();

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!product?.id || !targetType || !targetId) return;
    setSaving(true);
    try {
      const me = await base44.auth.me();
      const triggeredBy = me?.email || "unknown";
      const revisionContext = contextNote.trim() || `Manual revision created by ${triggeredBy}`;

      const res = await base44.functions.invoke("createProductRevision", {
        product_id: product.id,
        target_type: targetType,
        target_id: targetId,
        revision_context: revisionContext,
        before_snapshot: {},
        after_snapshot: {},
        triggered_by: triggeredBy,
      });

      const data = res.data;
      if (!data?.success) throw new Error(data?.error || "Unknown error");

      const { revision_code, is_first_revision } = data;

      toast({
        title: is_first_revision
          ? `Revision ${revision_code} created.`
          : `Revision ${revision_code} created. ECO auto-generated.`,
      });

      onCreated(revision_code, is_first_revision);
    } catch (err) {
      toast({
        title: "Failed to create revision",
        description: err?.response?.data?.error || err?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug">{modalTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* ── Context note ──────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-xs">Context note <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              value={contextNote}
              onChange={e => setContextNote(e.target.value.slice(0, 500))}
              placeholder="Briefly explain the reason for this revision (optional)."
              rows={3}
              disabled={saving}
            />
            <p className="text-[11px] text-muted-foreground">
              This note will appear in the revision history and on the auto-generated ECO.
              {contextNote.length > 400 && (
                <span className="ml-1 text-amber-600">{500 - contextNote.length} chars left</span>
              )}
            </p>
          </div>

          {/* ── Info panel ────────────────────────────────────────────────────── */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium text-[10px]">
                {targetTypeLabel(targetType)}
              </span>
              <span className="font-medium truncate">{targetName || product?.name}</span>
            </div>

            {isFirstRevision ? (
              <div className="flex items-start gap-1.5 text-muted-foreground">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
                <span>
                  First revision — will be created as <strong>"A"</strong>.
                  No ECO will be auto-generated for first revisions per system policy.
                </span>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Currently revision <strong>{currentRevisionCode}</strong> — bumping to <strong>{nextCode}</strong>.
              </p>
            )}
          </div>

          {/* ── Warning panel (non-first revisions only) ──────────────────────── */}
          {!isFirstRevision && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1 text-xs text-amber-800">
              <div className="flex items-center gap-1.5 font-semibold mb-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Creating this revision will:
              </div>
              <ol className="list-decimal list-inside space-y-0.5 leading-relaxed">
                <li>Mark the current revision <strong>{currentRevisionCode}</strong> as historical.</li>
                <li>Create a new revision <strong>{nextCode}</strong>.</li>
                <li>Auto-generate a Flow D ECO documenting this change.</li>
                <li>Create downstream review tasks for any artifact (BOM, BOL, etc.) affected by this change.</li>
              </ol>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={saving} className="gap-2 min-w-[120px]">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create revision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}