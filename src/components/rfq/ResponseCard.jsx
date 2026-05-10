import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Trophy, ChevronDown, ChevronUp } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

const STATUS_COLORS = {
  draft:        "bg-gray-100 text-gray-600 border-gray-200",
  submitted:    "bg-blue-100 text-blue-700 border-blue-200",
  under_review: "bg-amber-100 text-amber-700 border-amber-200",
  awarded:      "bg-green-100 text-green-700 border-green-200",
  rejected:     "bg-red-100 text-red-700 border-red-200",
  superseded:   "bg-gray-100 text-gray-400 border-gray-200",
};

function fmt(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d) ? dateStr : d.toLocaleDateString();
}

function fmtDateTime(dtStr) {
  if (!dtStr) return null;
  const d = new Date(dtStr);
  return isNaN(d) ? dtStr : d.toLocaleString();
}

export default function ResponseCard({ response, currencyMap, line, onEdit, onDeleted, onAward }) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const supplierCurrency = currencyMap[response.supplier_currency_id];
  const targetCurrency   = currencyMap[line._targetCurrencyId]; // injected by panel
  const isSameCurrency   = response.supplier_currency_id === line._targetCurrencyId;

  const canEdit   = response.status === "draft";
  const canDelete = !response.is_awarded && response.status !== "awarded";
  const canAward  = !line.awarded_response_id || line.awarded_response_id !== response.id;

  const hasNotes = response.supplier_notes || response.reviewer_notes;

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.RFQResponse.delete(response.id);

    // If line is "answered" and now has zero responses, reset to "pending"
    const remaining = await base44.entities.RFQResponse.filter({ rfq_line_id: line.id });
    if (remaining.length === 0 && line.status === "answered") {
      await base44.entities.RFQLine.update(line.id, { status: "pending" });
    }

    setDeleting(false);
    setShowDeleteConfirm(false);
    onDeleted();
  };

  const handleAward = () => {
    console.log("awardResponse", response.id);
    toast({ title: "Award flow coming next prompt", description: `Response ${response.id}` });
    onAward?.(response.id);
  };

  return (
    <div className="border border-border rounded-xl bg-card px-4 py-3 space-y-2.5">
      {/* ROW 1 — Cost */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <span className="text-base font-semibold font-mono">
            {response.total_cost_supplier_ccy?.toFixed(supplierCurrency?.decimal_places ?? 2) ?? "—"}{" "}
            <span className="text-sm font-medium">{supplierCurrency?.code || "?"}</span>
          </span>
          {!isSameCurrency && targetCurrency && response.total_cost_target_ccy != null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              = {response.total_cost_target_ccy?.toFixed(targetCurrency?.decimal_places ?? 2)} {targetCurrency.code}
              {" @ "}<span className="font-mono">{response.conversion_rate_used}</span>
              {response.conversion_rate_date && ` (${response.conversion_rate_date})`}
            </p>
          )}
        </div>
        {response.is_awarded && (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-semibold">
            <Trophy className="w-3 h-3" /> Awarded
          </span>
        )}
      </div>

      {/* ROW 2 — Meta */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {/* Status badge */}
        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium capitalize ${STATUS_COLORS[response.status] || "bg-muted text-muted-foreground border-border"}`}>
          {(response.status || "").replace(/_/g, " ")}
        </span>

        {/* Validity */}
        <span>
          {(response.valid_from || response.valid_until)
            ? `${fmt(response.valid_from) || "∞"} → ${fmt(response.valid_until) || "∞"}`
            : "—"}
        </span>

        {/* Qty */}
        <span>
          {(response.min_qty != null || response.max_qty != null)
            ? `${response.min_qty ?? "—"}–${response.max_qty ?? "—"} units`
            : "—"}
        </span>

        {/* Lead time */}
        {response.leadtime_days != null && (
          <span>{response.leadtime_days} days</span>
        )}

        {/* Submitted */}
        <span className="text-[10px]">
          {response.status === "draft" || !response.submitted_at
            ? "Not submitted yet"
            : `Submitted ${fmtDateTime(response.submitted_at)} by ${response.submitted_by || "?"}`}
        </span>
      </div>

      {/* ROW 3 — Notes (collapsible) */}
      {hasNotes && (
        <div>
          <button
            type="button"
            onClick={() => setNotesExpanded((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {notesExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Notes
          </button>
          {notesExpanded && (
            <div className="mt-1.5 space-y-1.5 text-xs text-muted-foreground">
              {response.supplier_notes && (
                <div>
                  <span className="font-medium text-foreground">Supplier notes:</span>{" "}
                  {response.supplier_notes}
                </div>
              )}
              {response.reviewer_notes && (
                <div>
                  <span className="font-medium text-foreground">Reviewer notes:</span>{" "}
                  {response.reviewer_notes}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ROW 4 — Actions */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1"
          disabled={!canEdit}
          onClick={() => onEdit(response)}
        >
          <Pencil className="w-3 h-3" /> Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={!canDelete}
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className="w-3 h-3" /> Delete
        </Button>
        {canAward && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            onClick={handleAward}
          >
            <Trophy className="w-3 h-3" /> Award
          </Button>
        )}
      </div>

      {/* Delete Confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(o) => { if (!o) setShowDeleteConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this response?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}