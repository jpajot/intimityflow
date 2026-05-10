import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Loader2, RefreshCw } from "lucide-react";

const EMPTY_FORM = { code: "", label: "", sequence: "", is_active: true, description: "" };

export default function RFQRounds() {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const load = async () => {
    setLoading(true);
    const result = await base44.entities.RFQRound.list("sequence", 200);
    setRounds(result);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (round) => {
    setEditing(round);
    setForm({
      code: round.code || "",
      label: round.label || "",
      sequence: round.sequence ?? "",
      is_active: round.is_active ?? true,
      description: round.description || "",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.code.trim() || !form.label.trim() || form.sequence === "") {
      setFormError("Code, label and sequence are required.");
      return;
    }
    // Uniqueness check on code
    const duplicate = rounds.find(
      (r) => r.code.toLowerCase() === form.code.trim().toLowerCase() && r.id !== editing?.id
    );
    if (duplicate) {
      setFormError(`Code "${form.code.trim().toUpperCase()}" is already used by another round.`);
      return;
    }
    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      label: form.label.trim(),
      sequence: Number(form.sequence),
      is_active: form.is_active,
      description: form.description || null,
    };
    if (editing) {
      await base44.entities.RFQRound.update(editing.id, payload);
    } else {
      await base44.entities.RFQRound.create(payload);
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const toggleActive = async (round) => {
    await base44.entities.RFQRound.update(round.id, { is_active: !round.is_active });
    load();
  };

  const sorted = [...rounds].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Settings</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight mt-0.5">RFQ Rounds</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage quotation round types used in RFQ workflows.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="w-3.5 h-3.5" />
          Add Round
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
          <RefreshCw className="w-10 h-10 opacity-25" />
          <p className="text-sm font-medium">No RFQ rounds defined yet.</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={openNew}>
            <Plus className="w-3.5 h-3.5" />
            Add first round
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-20">Seq</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-28">Code</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Label</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-24">Active</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${!r.is_active ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">{r.sequence}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono font-semibold text-xs tracking-widest">{r.code}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-foreground">
                    {r.label}
                    {r.description && (
                      <span className="block text-xs text-muted-foreground">{r.description}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Switch checked={!!r.is_active} onCheckedChange={() => toggleActive(r)} />
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Round" : "Add Round"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rfqr-code">Code <span className="text-destructive">*</span></Label>
                <Input
                  id="rfqr-code"
                  value={form.code}
                  onChange={(e) => { setForm((f) => ({ ...f, code: e.target.value.toUpperCase() })); setFormError(""); }}
                  placeholder="R1"
                  className="font-mono uppercase tracking-widest"
                  maxLength={10}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rfqr-seq">Sequence <span className="text-destructive">*</span></Label>
                <Input
                  id="rfqr-seq"
                  type="number"
                  min={1}
                  value={form.sequence}
                  onChange={(e) => setForm((f) => ({ ...f, sequence: e.target.value }))}
                  placeholder="1"
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rfqr-label">Label <span className="text-destructive">*</span></Label>
              <Input
                id="rfqr-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Round 1"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rfqr-desc">Description</Label>
              <Input
                id="rfqr-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="rfqr-active"
                checked={!!form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="rfqr-active" className="cursor-pointer">Active</Label>
            </div>

            {formError && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.code || !form.label || form.sequence === ""}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              {editing ? "Save Changes" : "Add Round"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}