import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const MARKETS = ["Spain", "France", "Germany", "Italy"];
const MARKET_VOLUME_KEYS = {
  Spain: "volume_spain",
  France: "volume_france",
  Germany: "volume_germany",
  Italy: "volume_italy",
};

export default function ColorVariantForm({ variant, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState({
    color_name: variant?.color_name || "",
    color_hex: variant?.color_hex || "#000000",
    image_url: variant?.image_url || "",
    markets: variant?.markets || [],
    volume_spain: variant?.volume_spain || 0,
    volume_france: variant?.volume_france || 0,
    volume_germany: variant?.volume_germany || 0,
    volume_italy: variant?.volume_italy || 0,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, image_url: file_url }));
    setUploading(false);
  };

  const toggleMarket = (market) => {
    setForm((f) => {
      const markets = f.markets.includes(market)
        ? f.markets.filter((m) => m !== market)
        : [...f.markets, market];
      const volumeKey = MARKET_VOLUME_KEYS[market];
      const updates = { markets };
      if (!markets.includes(market)) {
        updates[volumeKey] = 0;
      }
      return { ...f, ...updates };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-5">
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-sm">
          {variant ? "Edit Color Variant" : "New Color Variant"}
        </h4>
        {onCancel && (
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Color Name</Label>
          <Input
            value={form.color_name}
            onChange={(e) => setForm((f) => ({ ...f, color_name: e.target.value }))}
            placeholder="e.g. Midnight Blue"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Color</Label>
          <div className="flex gap-2">
            <input
              type="color"
              value={form.color_hex}
              onChange={(e) => setForm((f) => ({ ...f, color_hex: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer"
            />
            <Input
              value={form.color_hex}
              onChange={(e) => setForm((f) => ({ ...f, color_hex: e.target.value }))}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Product Image</Label>
        <div className="flex items-center gap-4">
          {form.image_url ? (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
              <img src={form.image_url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : null}
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Uploading..." : "Upload Image"}
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-xs">Markets & Volumes</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MARKETS.map((market) => (
            <div
              key={market}
              className={`rounded-lg border p-3 transition-colors ${
                form.markets.includes(market) ? "border-primary bg-accent" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.markets.includes(market)}
                  onCheckedChange={() => toggleMarket(market)}
                />
                <span className="text-sm font-medium">{market}</span>
              </div>
              {form.markets.includes(market) && (
                <div className="mt-2 pl-6">
                  <Input
                    type="number"
                    min={0}
                    value={form[MARKET_VOLUME_KEYS[market]]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [MARKET_VOLUME_KEYS[market]]: parseInt(e.target.value) || 0,
                      }))
                    }
                    placeholder="Est. volume"
                    className="h-8 text-sm"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">Estimated units</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={saving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {variant ? "Update" : "Add"} Color Variant
        </Button>
        {variant && onDelete && (
          <Button type="button" variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}