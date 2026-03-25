import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, X, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const emptyForm = { name: "", description: "", color_hex: "#000000", image_url: "" };

export default function MoreVariationsSection({ productId, colorVariants }) {
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = existing
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadVariations();
  }, [productId]);

  const loadVariations = async () => {
    setLoading(true);
    const all = await base44.entities.ProductColorAndMore.list("-created_date", 500);
    // filter to those whose parent ProductColor belongs to this product
    const colorIds = colorVariants.map((cv) => cv.id);
    setVariations(all.filter((v) => colorIds.includes(v.product_color_id)));
    setLoading(false);
  };

  const openNew = () => { setForm(emptyForm); setEditing({}); };
  const openEdit = (v) => { setForm({ name: v.name, description: v.description || "", color_hex: v.color_hex || "#000000", image_url: v.image_url || "" }); setEditing(v); };
  const closeDialog = () => setEditing(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, image_url: file_url }));
    setUploading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editing?.id) {
      const updated = await base44.entities.ProductColorAndMore.update(editing.id, form);
      setVariations((prev) => prev.map((v) => v.id === editing.id ? { ...v, ...form } : v));
    } else {
      // Need a parent_color_id — use first colorway if available
      const parentId = form.product_color_id || colorVariants[0]?.id;
      const created = await base44.entities.ProductColorAndMore.create({ ...form, product_color_id: parentId });
      setVariations((prev) => [created, ...prev]);
    }
    setSaving(false);
    closeDialog();
  };

  const handleDelete = async () => {
    await base44.entities.ProductColorAndMore.delete(editing.id);
    setVariations((prev) => prev.filter((v) => v.id !== editing.id));
    closeDialog();
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">More Variations ({variations.length})</h3>
        <Button variant="outline" size="sm" onClick={openNew} className="gap-1.5 h-8 text-xs">
          <Plus className="w-3.5 h-3.5" /> Add Variation
        </Button>
      </div>

      {variations.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No variations yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {variations.map((v) => {
            const parentColor = colorVariants.find((cv) => cv.id === v.product_color_id);
            return (
              <div key={v.id} className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {v.image_url ? (
                    <img src={v.image_url} alt={v.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full" style={{ backgroundColor: v.color_hex || "#ccc" }} />
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(v)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 w-6 h-6 rounded-md bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm truncate">{v.name}</p>
                  {parentColor && <p className="text-xs text-muted-foreground truncate mt-0.5">↳ {parentColor.color_name}</p>}
                  {v.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Variation" : "New Variation"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Parent Colorway</Label>
              <Select
                value={form.product_color_id || colorVariants[0]?.id || ""}
                onValueChange={(v) => setForm((f) => ({ ...f, product_color_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select colorway…" /></SelectTrigger>
                <SelectContent>
                  {colorVariants.map((cv) => (
                    <SelectItem key={cv.id} value={cv.id}>{cv.color_name}{cv.colorway_code ? ` (${cv.colorway_code})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Size XL variant" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Color</Label>
              <div className="flex gap-2">
                <input type="color" value={form.color_hex} onChange={(e) => setForm((f) => ({ ...f, color_hex: e.target.value }))} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <Input value={form.color_hex} onChange={(e) => setForm((f) => ({ ...f, color_hex: e.target.value }))} className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Image</Label>
              <div className="flex items-center gap-4">
                {form.image_url && (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                    <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setForm((f) => ({ ...f, image_url: "" }))} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Uploading…" : "Upload"}
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing?.id ? "Update" : "Add"} Variation
              </Button>
              {editing?.id && (
                <Button type="button" variant="destructive" onClick={handleDelete}>Delete</Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}