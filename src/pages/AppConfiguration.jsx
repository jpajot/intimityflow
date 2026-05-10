import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Settings2, Pencil, Check, X } from "lucide-react";

function ValueEditor({ config, currencies, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(config.value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(config.id, draft);
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(config.value);
    setEditing(false);
  };

  const displayValue = () => {
    if (config.value_type === "currency_id") {
      const cur = currencies.find((c) => c.id === config.value);
      return cur ? `${cur.code} — ${cur.name}` : config.value || "—";
    }
    return config.value || "—";
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-foreground truncate">{displayValue()}</span>
        <button
          type="button"
          onClick={() => { setDraft(config.value); setEditing(true); }}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title="Edit value"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {config.value_type === "currency_id" ? (
        <Select value={draft} onValueChange={setDraft}>
          <SelectTrigger className="h-8 text-xs w-56">
            <SelectValue placeholder="Select currency…" />
          </SelectTrigger>
          <SelectContent>
            {currencies.filter((c) => c.is_active).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="font-mono font-semibold mr-2">{c.code}</span>
                <span className="text-muted-foreground">{c.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-8 text-xs w-56"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
        />
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="shrink-0 text-green-600 hover:text-green-700 transition-colors disabled:opacity-50"
        title="Save"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
      <button
        type="button"
        onClick={handleCancel}
        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
        title="Cancel"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

const VALUE_TYPE_BADGE = {
  string: "bg-slate-100 text-slate-600",
  number: "bg-blue-100 text-blue-700",
  boolean: "bg-amber-100 text-amber-700",
  currency_id: "bg-emerald-100 text-emerald-700",
};

export default function AppConfiguration() {
  const [configs, setConfigs] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [cfgs, curs] = await Promise.all([
      base44.entities.AppConfig.list("key", 200),
      base44.entities.Currency.list("code", 200),
    ]);
    setConfigs(cfgs);
    setCurrencies(curs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (id, newValue) => {
    const me = await base44.auth.me();
    await base44.entities.AppConfig.update(id, {
      value: newValue,
      updated_by: me?.email || null,
      updated_at: new Date().toISOString(),
    });
    setConfigs((prev) =>
      prev.map((c) => c.id === id ? { ...c, value: newValue } : c)
    );
  };

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Settings</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight mt-0.5">App Configuration</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          System-level configuration values. Keys are managed by developers — edit values only.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-border rounded-xl text-muted-foreground">
          <Settings2 className="w-10 h-10 opacity-25" />
          <p className="text-sm font-medium">No configuration keys found.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
          {configs.map((cfg) => (
            <div key={cfg.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 hover:bg-muted/20 transition-colors">
              {/* Key + description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-foreground">{cfg.key}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${VALUE_TYPE_BADGE[cfg.value_type] || VALUE_TYPE_BADGE.string}`}>
                    {cfg.value_type}
                  </span>
                </div>
                {cfg.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                )}
                {cfg.updated_by && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Last updated by {cfg.updated_by}
                    {cfg.updated_at ? ` · ${new Date(cfg.updated_at).toLocaleDateString()}` : ""}
                  </p>
                )}
              </div>

              {/* Value editor */}
              <div className="shrink-0">
                <ValueEditor
                  config={cfg}
                  currencies={currencies}
                  onSave={handleSave}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}