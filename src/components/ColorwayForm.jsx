import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { colorToHex } from "../lib/pantone-tcx";

function InlineColorPicker({ label, value, options, getHex, getLabel, onSelect, onClear, placeholder }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return options.slice(0, 60);
    return options.filter((o) => getLabel(o).toLowerCase().includes(q)).slice(0, 60);
  }, [options, search, getLabel]);

  const selected = value ? options.find((o) => o.id === value) : null;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
          <div className="w-4 h-4 rounded-sm border border-border shrink-0" style={{ backgroundColor: getHex(selected) }} />
          <span className="text-sm flex-1">{getLabel(selected)}</span>
          <button type="button" onClick={onClear} className="text-muted-foreground hover:text-destructive">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 h-9 rounded-md border border-input bg-transparent text-sm text-muted-foreground hover:bg-muted transition-colors text-left"
          >
            <span className="flex-1">{placeholder}</span>
            <ChevronDown className="w-4 h-4 opacity-50" />
          </button>
          {open && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
              <div className="p-2 border-b border-border">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="h-7 text-xs"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No results</p>
                )}
                {filtered.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { onSelect(o); setOpen(false); setSearch(""); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted text-left transition-colors"
                  >
                    <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: getHex(o) }} />
                    <span className="text-xs">{getLabel(o)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ColorwayForm({ variant, onSave, onCancel, onDelete, existingColorways = [] }) {
  const [form, setForm] = useState({
    color_name: variant?.color_name || "",
    colorway_code: variant?.colorway_code || "",
    color_hex: variant?.color_hex || "#000000",
    image_url: variant?.image_url || "",
    linked_tech_color_id: variant?.linked_tech_color_id || "",
    linked_color_type: variant?.linked_color_type || "",
    linked_color_id: variant?.linked_color_id || "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [techColors, setTechColors] = useState([]);
  const [commColors, setCommColors] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.TechnicalColor.list("code", 2000),
      base44.entities.CommercialColor.list("code", 2000),
    ]).then(([tc, cc]) => { setTechColors(tc); setCommColors(cc); });
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, image_url: file_url }));
    setUploading(false);
  };

  const handleSelectTech = (tech) => {
    setForm((f) => ({
      ...f,
      linked_tech_color_id: tech.id,
      color_hex: colorToHex(tech) || f.color_hex,
    }));
  };

  const handleSelectComm = (comm) => {
    const mainTech = techColors.find((t) => t.id === comm.main_technical_color_id);
    setForm((f) => ({
      ...f,
      linked_color_type: "commercial",
      linked_color_id: comm.id,
      color_name: f.color_name || comm.color_name || "",
      colorway_code: comm.code || f.colorway_code,
      color_hex: mainTech ? colorToHex(mainTech) : f.color_hex,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.colorway_code && form.colorway_code.trim() !== "") {
      const duplicate = existingColorways.find(
        (cv) => cv.colorway_code === form.colorway_code.trim() && cv.id !== variant?.id
      );
      if (duplicate) {
        alert("There is already a colorway with this code, please give another colorway code");
        return;
      }
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const getTechHex = (t) => colorToHex(t) || "#ccc";
  const getTechLabel = (t) => `${t.code} – ${t.name}`;
  const getCommHex = (c) => {
    const t = techColors.find((t) => t.id === c.main_technical_color_id);
    return t ? colorToHex(t) : "#ccc";
  };
  const getCommLabel = (c) => `${c.code} – ${c.color_name}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-5">
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-sm">{variant ? "Edit Colorway" : "New Colorway"}</h4>
        {onCancel && (
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Colorway Name</Label>
          <Input value={form.color_name} onChange={(e) => setForm((f) => ({ ...f, color_name: e.target.value }))} placeholder="e.g. Midnight Blue" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Colorway Code</Label>
          <Input value={form.colorway_code} onChange={(e) => setForm((f) => ({ ...f, colorway_code: e.target.value }))} placeholder="e.g. COM-001" />
        </div>
      </div>

      <InlineColorPicker
        label="Link to Technical Color"
        value={form.linked_tech_color_id}
        options={techColors}
        getHex={getTechHex}
        getLabel={getTechLabel}
        onSelect={handleSelectTech}
        onClear={() => setForm((f) => ({ ...f, linked_tech_color_id: "" }))}
        placeholder="Search technical colors…"
      />

      <InlineColorPicker
        label="Link to Commercial Color"
        value={form.linked_color_id}
        options={commColors}
        getHex={getCommHex}
        getLabel={getCommLabel}
        onSelect={handleSelectComm}
        onClear={() => setForm((f) => ({ ...f, linked_color_type: "", linked_color_id: "" }))}
        placeholder="Search commercial colors…"
      />

      <div className="space-y-1.5">
        <Label className="text-xs">Color</Label>
        <div className="flex gap-2">
          <input type="color" value={form.color_hex} onChange={(e) => setForm((f) => ({ ...f, color_hex: e.target.value }))} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
          <Input value={form.color_hex} onChange={(e) => setForm((f) => ({ ...f, color_hex: e.target.value }))} className="flex-1" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Colorway Image</Label>
        <div className="flex items-center gap-4">
          {form.image_url && (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
              <img src={form.image_url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Uploading..." : "Upload Image"}
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={saving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {variant ? "Update" : "Add"} Colorway
        </Button>
        {variant && onDelete && (
          <Button type="button" variant="destructive" onClick={onDelete}>Delete</Button>
        )}
      </div>
    </form>
  );
}