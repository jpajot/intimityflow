import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Loader2, Link2, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { colorToHex, tcxDisplayName } from "../lib/pantone-tcx";


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

  const [technicalColors, setTechnicalColors] = useState([]);
  const [commercialColors, setCommercialColors] = useState([]);
  const [loadingLib, setLoadingLib] = useState(false);
  const [showLibLink, setShowLibLink] = useState(!!(variant?.linked_color_id));
  const [colorSearch, setColorSearch] = useState("");

  useEffect(() => {
    if (showLibLink && technicalColors.length === 0) loadLibrary();
  }, [showLibLink]);

  const loadLibrary = async () => {
    setLoadingLib(true);
    const [tech, comm] = await Promise.all([
      base44.entities.TechnicalColor.list("code", 2000),
      base44.entities.CommercialColor.list("code", 2000),
    ]);
    setTechnicalColors(tech);
    setCommercialColors(comm);
    setLoadingLib(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, image_url: file_url }));
    setUploading(false);
  };

  const handleLinkColor = (type, id) => {
    let autoHex = "";
    let autoName = "";
    if (type === "technical") {
      const tech = technicalColors.find((t) => t.id === id);
      if (tech) { autoHex = colorToHex(tech); autoName = tech.name; }
    } else if (type === "commercial") {
      const comm = commercialColors.find((c) => c.id === id);
      if (comm) {
        autoName = comm.color_name;
        const tech = technicalColors.find((t) => t.id === comm.main_technical_color_id);
        if (tech) autoHex = colorToHex(tech);
      }
    }
    setForm((f) => ({
      ...f,
      linked_color_type: type,
      linked_color_id: id,
      color_hex: autoHex || f.color_hex,
      color_name: f.color_name || autoName,
      colorway_code: type === "commercial" ? (commercialColors.find(c => c.id === id)?.code || f.colorway_code) : f.colorway_code,
    }));
  };

  const handleUnlink = () => {
    setForm((f) => ({ ...f, linked_color_type: "", linked_color_id: "" }));
  };

  const filteredTech = technicalColors.filter(
    (c) => !colorSearch || c.code?.toLowerCase().includes(colorSearch.toLowerCase()) || c.name?.toLowerCase().includes(colorSearch.toLowerCase())
  );
  const filteredComm = commercialColors.filter(
    (c) => !colorSearch || c.code?.toLowerCase().includes(colorSearch.toLowerCase()) || c.color_name?.toLowerCase().includes(colorSearch.toLowerCase())
  );

  const linkedLabel = () => {
    if (!form.linked_color_id) return null;
    if (form.linked_color_type === "technical") {
      const t = technicalColors.find((c) => c.id === form.linked_color_id);
      return t ? tcxDisplayName(t) : form.linked_color_id;
    }
    if (form.linked_color_type === "commercial") {
      const c = commercialColors.find((c) => c.id === form.linked_color_id);
      return c ? `${c.code} - ${c.color_name}` : form.linked_color_id;
    }
    return null;
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
        <div className="flex items-center justify-between">
          <Label className="text-xs">Link to Color Library</Label>
          {!showLibLink ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setShowLibLink(true)}>
              <Link2 className="w-3 h-3" /> Link
            </Button>
          ) : form.linked_color_id ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-destructive" onClick={handleUnlink}>
              <Unlink className="w-3 h-3" /> Unlink
            </Button>
          ) : null}
        </div>

        {form.linked_color_id ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-accent rounded-lg border border-primary/20">
            <div className="w-5 h-5 rounded-sm border border-border" style={{ backgroundColor: form.color_hex }} />
            <span className="text-xs font-medium">{linkedLabel()}</span>
            <Badge variant="secondary" className="text-[10px] ml-auto">{form.linked_color_type}</Badge>
          </div>
        ) : showLibLink && (
          <div className="border border-border rounded-lg overflow-hidden">
            {loadingLib ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <div className="p-2 border-b border-border">
                  <Input value={colorSearch} onChange={(e) => setColorSearch(e.target.value)} placeholder="Search colors…" className="h-8 text-xs" />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredTech.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">Technical Colors</div>
                      {filteredTech.map((t) => (
                        <button key={t.id} type="button" onClick={() => handleLinkColor("technical", t.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted text-left transition-colors">
                          <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: colorToHex(t) }} />
                          <span className="text-xs">{tcxDisplayName(t)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {filteredComm.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">Commercial Colors</div>
                      {filteredComm.map((c) => {
                        const tech = technicalColors.find((t) => t.id === c.main_technical_color_id);
                        const hex = tech ? colorToHex(tech) : "#ccc";
                        return (
                          <button key={c.id} type="button" onClick={() => handleLinkColor("commercial", c.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted text-left transition-colors">
                            <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: hex }} />
                            <span className="text-xs">{c.code} - {c.color_name}</span>
                            <Badge variant="outline" className="text-[10px] ml-auto">{c.sub_type}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {filteredTech.length === 0 && filteredComm.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No colors in library yet</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

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