import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, ArrowLeftRight, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const today = () => format(new Date(), "yyyy-MM-dd");

const EMPTY_FORM = {
  from_currency_id: "",
  to_currency_id: "",
  rate: "",
  effective_date: today(),
  source: "",
  notes: "",
};

function CurrencySelect({ id, value, onChange, currencies, placeholder }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder || "Select currency…"} />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="font-mono font-semibold mr-2">{c.code}</span>
            <span className="text-muted-foreground">{c.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function CurrencyConversionRates() {
  const [rates, setRates] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState(null);

  // Filters
  const [filterFrom, setFilterFrom] = useState("__all__");
  const [filterTo, setFilterTo] = useState("__all__");

  // Sort
  const [sortField, setSortField] = useState("effective_date");
  const [sortDir, setSortDir] = useState("desc");

  const load = async () => {
    setLoading(true);
    const [r, c] = await Promise.all([
      base44.entities.CurrencyConversionRate.list("-effective_date", 500),
      base44.entities.Currency.list("code", 200),
    ]);
    setRates(r);
    setCurrencies(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activeCurrencies = useMemo(() => currencies.filter((c) => c.is_active), [currencies]);

  const currencyMap = useMemo(() => {
    const m = {};
    currencies.forEach((c) => { m[c.id] = c; });
    return m;
  }, [currencies]);

  // Filtered + sorted rows
  const displayRates = useMemo(() => {
    let rows = rates;
    if (filterFrom !== "__all__") rows = rows.filter((r) => r.from_currency_id === filterFrom);
    if (filterTo !== "__all__") rows = rows.filter((r) => r.to_currency_id === filterTo);

    return [...rows].sort((a, b) => {
      let av, bv;
      if (sortField === "effective_date") { av = a.effective_date || ""; bv = b.effective_date || ""; }
      else if (sortField === "from") { av = currencyMap[a.from_currency_id]?.code || ""; bv = currencyMap[b.from_currency_id]?.code || ""; }
      else if (sortField === "to") { av = currencyMap[a.to_currency_id]?.code || ""; bv = currencyMap[b.to_currency_id]?.code || ""; }
      else if (sortField === "rate") { av = a.rate ?? 0; bv = b.rate ?? 0; }
      else { av = ""; bv = ""; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rates, filterFrom, filterTo, sortField, sortDir, currencyMap]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, effective_date: today() });
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (rate) => {
    setEditing(rate);
    setForm({
      from_currency_id: rate.from_currency_id || "",
      to_currency_id: rate.to_currency_id || "",
      rate: rate.rate ?? "",
      effective_date: rate.effective_date || today(),
      source: rate.source || "",
      notes: rate.notes || "",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.from_currency_id || !form.to_currency_id || form.rate === "" || !form.effective_date) {
      setFormError("All required fields must be filled.");
      return;
    }
    if (form.from_currency_id === form.to_currency_id) {
      setFormError("From and To currencies must be different.");
      return;
    }
    // Uniqueness check (from, to, effective_date)
    const duplicate = rates.find(
      (r) =>
        r.from_currency_id === form.from_currency_id &&
        r.to_currency_id === form.to_currency_id &&
        r.effective_date === form.effective_date &&
        r.id !== editing?.id
    );
    if (duplicate) {
      setFormError("A rate for this From → To pair on this date already exists.");
      return;
    }
    setSaving(true);
    const payload = {
      from_currency_id: form.from_currency_id,
      to_currency_id: form.to_currency_id,
      rate: Number(form.rate),
      effective_date: form.effective_date,
      source: form.source || null,
      notes: form.notes || null,
    };
    if (editing) {
      await base44.entities.CurrencyConversionRate.update(editing.id, payload);
    } else {
      await base44.entities.CurrencyConversionRate.create(payload);
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await base44.entities.CurrencyConversionRate.delete(deleteTarget.id);
    setDeleteTarget(null);
    load();
  };

  const filterCurrencies = [{ id: "__all__", code: "All", name: "" }, ...currencies];

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Link to="/currencies" className="hover:text-foreground transition-colors">Currencies</Link>
            <ChevronRight className="w-3 h-3" />
            <span>Conversion Rates</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight mt-0.5">Conversion Rates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage exchange rates between currencies.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="w-3.5 h-3.5" />
          Add Rate
        </Button>
      </div>

      {/* Quick filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">From:</span>
          <Select value={filterFrom} onValueChange={setFilterFrom}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterCurrencies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="font-mono font-semibold">{c.code}</span>
                  {c.name && <span className="text-muted-foreground ml-1">{c.name}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">To:</span>
          <Select value={filterTo} onValueChange={setFilterTo}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterCurrencies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="font-mono font-semibold">{c.code}</span>
                  {c.name && <span className="text-muted-foreground ml-1">{c.name}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(filterFrom !== "__all__" || filterTo !== "__all__") && (
          <button type="button" onClick={() => { setFilterFrom("__all__"); setFilterTo("__all__"); }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{displayRates.length} rate{displayRates.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : rates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
          <ArrowLeftRight className="w-10 h-10 opacity-25" />
          <p className="text-sm font-medium">No conversion rates added yet.</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={openNew}>
            <Plus className="w-3.5 h-3.5" />
            Add first rate
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[
                  { field: "from", label: "From" },
                  { field: "to", label: "To" },
                  { field: "rate", label: "Rate" },
                  { field: "effective_date", label: "Effective Date" },
                  { field: "source", label: "Source", noSort: true },
                ].map(({ field, label, noSort }) => (
                  <th key={field} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {noSort ? label : (
                      <button type="button" onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        {label} <SortIcon field={field} />
                      </button>
                    )}
                  </th>
                ))}
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {displayRates.map((r) => {
                const from = currencyMap[r.from_currency_id];
                const to = currencyMap[r.to_currency_id];
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-semibold text-xs">{from?.code ?? "—"}</span>
                      {from && <span className="text-[11px] text-muted-foreground ml-1.5">{from.symbol}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-semibold text-xs">{to?.code ?? "—"}</span>
                      {to && <span className="text-[11px] text-muted-foreground ml-1.5">{to.symbol}</span>}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-sm tabular-nums">{r.rate}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.effective_date}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.source || "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button type="button" onClick={() => openEdit(r)} className="text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(r)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Conversion Rate" : "Add Conversion Rate"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ccr-from">From <span className="text-destructive">*</span></Label>
                <CurrencySelect
                  id="ccr-from"
                  value={form.from_currency_id}
                  onChange={(v) => { setForm((f) => ({ ...f, from_currency_id: v })); setFormError(""); }}
                  currencies={activeCurrencies}
                  placeholder="From…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ccr-to">To <span className="text-destructive">*</span></Label>
                <CurrencySelect
                  id="ccr-to"
                  value={form.to_currency_id}
                  onChange={(v) => { setForm((f) => ({ ...f, to_currency_id: v })); setFormError(""); }}
                  currencies={activeCurrencies}
                  placeholder="To…"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ccr-rate">Rate <span className="text-destructive">*</span></Label>
                <Input
                  id="ccr-rate"
                  type="number"
                  step="any"
                  min="0"
                  value={form.rate}
                  onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                  placeholder="e.g. 1.08"
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ccr-date">Effective Date <span className="text-destructive">*</span></Label>
                <Input
                  id="ccr-date"
                  type="date"
                  value={form.effective_date}
                  onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ccr-source">Source</Label>
              <Input
                id="ccr-source"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                placeholder="ECB, Manual, OpenExchangeRates…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ccr-notes">Notes</Label>
              <Input
                id="ccr-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
              />
            </div>

            {formError && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.from_currency_id || !form.to_currency_id || form.rate === "" || !form.effective_date}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              {editing ? "Save Changes" : "Add Rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversion rate?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (() => {
                const from = currencyMap[deleteTarget.from_currency_id];
                const to = currencyMap[deleteTarget.to_currency_id];
                return `${from?.code ?? "?"} → ${to?.code ?? "?"} on ${deleteTarget.effective_date} (rate ${deleteTarget.rate}) will be permanently deleted.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}