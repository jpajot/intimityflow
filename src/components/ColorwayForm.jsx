import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2, Link2, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { tcxDisplayName } from "../lib/pantone-tcx";
import ColorLibrarySinglePickerModal from "./ColorLibrarySinglePickerModal";


export default function ColorwayForm({ variant, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState({
    color_name: variant?.color_name || "",
    colorway_code: variant?.colorway_code || "",
    color_hex: variant?.color_hex || "#000000",
    image_url: variant?.image_url || "",
    linked_color_type: variant?.linked_color_type || "",
    linked_color_id: variant?.linked_color_id || "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLibPicker, setShowLibPicker] = useState(false);

  // Store enough info to display linked color label without re-fetching
  const [linkedLabel, setLinkedLabel] = useState(variant?.linked_color_id ? "Linked color" : "");

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, image_url: file_url }));
    setUploading(false);
  };

  const handleLinkColor = (type, id, hex, name, code) => {
    setForm((f) => ({
      ...f,
      linked_color_type: type,
      linked_color_id: id,
      color_hex: hex || f.color_hex,
      color_name: f.color_name || name,
      colorway_code: type === "commercial" ? (code || f.colorway_code) : f.colorway_code,
    }));
    setLinkedLabel(type === "commercial" ? `${code} - ${name}` : name);
  };

  const handleUnlink = () => {
    setForm((f) => ({ ...f, linked_color_type: "", linked_color_id: "" }));
    setLinkedLabel("");
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
        <h4 className="font-semibold text-sm">{variant ? "Edit Colorway" : "New Colorway"}</h4>
        {onCancel && (
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Colorway Name</Label>
          <Input value={form.color_name} onChange={(e) => setForm((f) => ({ ...f, color_name: e.target.value }))} placeholder="e.g. Midnight Blue" required />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Colorway Code</Label>
          <Input value={form.colorway_code} onChange={(e) => setForm((f) => ({ ...f, colorway_code: e.target.value }))} placeholder="e.g. COM-001" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Color</Label>
          <div className="flex gap-2">
            <input type="color" value={form.color_hex} onChange={(e) => setForm((f) => ({ ...f, color_hex: e.target.value }))} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
            <Input value={form.color_hex} onChange={(e) => setForm((f) => ({ ...f, color_hex: e.target.value }))} className="flex-1" />
          </div>
        </div>
      </div>

      {/* Color Library Link */}
      <div className="space-y-2">
        <Label className="text-xs">Link to Color Library</Label>
        {form.linked_color_id ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-accent rounded-lg border border-primary/20">
            <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: form.color_hex }} />
            <span className="text-xs font-medium flex-1">{linkedLabel}</span>
            <Badge variant="secondary" className="text-[10px]">{form.linked_color_type}</Badge>
            <button type="button" onClick={handleUnlink} className="text-destructive hover:text-destructive/80 ml-1">
              <Unlink className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setShowLibPicker(true)}>
            <Link2 className="w-3.5 h-3.5" /> Link to Color Library
          </Button>
        )}
      </div>

      <ColorLibrarySinglePickerModal
        open={showLibPicker}
        onClose={() => setShowLibPicker(false)}
        onSelect={handleLinkColor}
      />

      {/* Image */}
      <div className="space-y-2">
        <Label className="text-xs">Product Image</Label>
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