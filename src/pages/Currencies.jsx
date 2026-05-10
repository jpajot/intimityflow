import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Loader2, Coins } from "lucide-react";

const EMPTY_FORM = { code: "", name: "", symbol: "", decimal_places: 2, is_active: true, notes: "" };

export default function Currencies() {
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = new
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    const result = await base44.entities.Currency.list("-created_date", 200);
    setCurrencies(result);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (currency) => {
    setEditing(currency);
    setForm({
      code: currency.code || "",
      name: currency.name || "",
      symbol: currency.symbol || "",
      decimal_places: currency.decimal_places ?? 2,
      is_active: currency.is_active ?? true,
      notes: currency.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.symbol.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      decimal_places: Number(form.decimal_places) || 0,
    };
    if (editing) {
      await base44.entities.Currency.update(editing.id, payload);
    } else {
      await base44.entities.Currency.create(payload);
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const toggleActive = async (currency) => {
    await base44.entities.Currency.update(currency.id, { is_active: !currency.is_active });
    load();
  };

  const sorted = [...currencies].sort((a, b) => a.code?.localeCompare(b.code));

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Settings</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight mt-0.5">Currencies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage ISO 4217 currencies used across the system.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="w-3.5 h-3.5" />
          Add Currency
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
          <Coins className="w-10 h-10 opacity-25" />
          <p className="text-sm font-medium">No currencies added yet.</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={openNew}>
            <Plus className="w-3.5 h-3.5" />
            Add first currency
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-24">Code</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-20">Symbol</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-24">Decimals</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-24">Active</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className={`border-b border-border last:border-0 transition-colors hover:bg-muted/20 ${!c.is_active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2.5">
                    <span className="font-mono font-semibold text-xs tracking-widest text-foreground">{c.code}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-foreground">{c.name}</td>
                  <td className="px-4 py-2.5 text-sm font-medium text-foreground">{c.symbol}</td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">{c.decimal_places ?? 2}</td>
                  <td className="px-4 py-2.5">
                    <Switch
                      checked={!!c.is_active}
                      onCheckedChange={() => toggleActive(c)}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Currency" : "Add Currency"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-code">Code <span className="text-destructive">*</span></Label>
                <Input
                  id="c-code"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase().slice(0, 3) }))}
                  placeholder="EUR"
                  maxLength={3}
                  className="font-mono uppercase tracking-widest"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-symbol">Symbol <span className="text-destructive">*</span></Label>
                <Input
                  id="c-symbol"
                  value={form.symbol}
                  onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                  placeholder="€"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Euro"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-dec">Decimal Places</Label>
                <Input
                  id="c-dec"
                  type="number"
                  min={0}
                  max={8}
                  value={form.decimal_places}
                  onChange={(e) => setForm((f) => ({ ...f, decimal_places: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <div className="flex items-center gap-2 h-9">
                  <Switch
                    id="c-active"
                    checked={!!form.is_active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                  />
                  <Label htmlFor="c-active" className="cursor-pointer">Active</Label>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-notes">Notes</Label>
              <Input
                id="c-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.code || !form.name || !form.symbol}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              {editing ? "Save Changes" : "Add Currency"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}