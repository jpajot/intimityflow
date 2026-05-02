import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "requested", label: "Requested", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "in_progress", label: "In Progress", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "submitted_for_approval", label: "Submitted for Approval", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "approved", label: "Approved", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "obsolete", label: "Obsolete", color: "bg-gray-100 text-gray-500 border-gray-200" },
];

export default function BulkColorwayStatusModal({ open, onClose, colorVariants, onUpdated }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [targetStatus, setTargetStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen) => {
    if (!isOpen) {
      setSelectedIds([]);
      setTargetStatus("");
      setNotes("");
      onClose();
    }
  };

  const toggleId = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelectedIds((prev) => prev.length === colorVariants.length ? [] : colorVariants.map((cv) => cv.id));
  };

  const handleSave = async () => {
    if (!targetStatus || selectedIds.length === 0) return;
    setSaving(true);
    const now = new Date().toISOString();
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}

    const historyEntry = { status: targetStatus, changed_at: now, changed_by: user?.email || "", notes };

    const updates = await Promise.all(
      selectedIds.map(async (id) => {
        const cv = colorVariants.find((c) => c.id === id);
        const prevHistory = cv?.status_history || [];
        await base44.entities.ProductColor.update(id, {
          colorway_status: targetStatus,
          status_history: [...prevHistory, historyEntry],
        });
        return { id, colorway_status: targetStatus, status_history: [...prevHistory, historyEntry] };
      })
    );

    setSaving(false);
    onUpdated(updates);
    handleOpen(false);
  };

  const selectedStatus = STATUS_OPTIONS.find((s) => s.value === targetStatus);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Change Colorway Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target status */}
          <div className="space-y-2">
            <Label className="text-xs">New Status *</Label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setTargetStatus(s.value)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    targetStatus === s.value
                      ? `${s.color} ring-2 ring-offset-1 ring-current`
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Colorway selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Select Colorways *</Label>
              <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
                {selectedIds.length === colorVariants.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
              {colorVariants.map((cv) => (
                <label key={cv.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors">
                  <Checkbox checked={selectedIds.includes(cv.id)} onCheckedChange={() => toggleId(cv.id)} />
                  <div className="w-4 h-4 rounded-sm shrink-0 border border-border/50" style={{ backgroundColor: cv.color_hex || "#ccc" }} />
                  <span className="text-sm flex-1">{cv.color_name}</span>
                  {cv.colorway_code && <span className="text-[10px] font-mono text-muted-foreground">{cv.colorway_code}</span>}
                  {cv.colorway_status && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-muted text-muted-foreground">
                      {cv.colorway_status.replace(/_/g, " ")}
                    </span>
                  )}
                </label>
              ))}
            </div>
            {selectedIds.length > 0 && (
              <p className="text-xs text-muted-foreground">{selectedIds.length} colorway{selectedIds.length > 1 ? "s" : ""} selected</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Reason for status change…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!targetStatus || selectedIds.length === 0 || saving}
            className="gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Apply to {selectedIds.length > 0 ? selectedIds.length : "—"} colorway{selectedIds.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}