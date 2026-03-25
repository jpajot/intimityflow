import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Loader2, X, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PACK_CODES = ["E1", "E2", "96", "97"];

function generateSequence(existing) {
  const nums = existing
    .map((v) => parseInt(v.sequence || "0", 10))
    .filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return String(max + 1).padStart(4, "0");
}

const emptyForm = () => ({
  product_color_id: "",
  name: "",
  description: "",
  color_hex: "#000000",
  image_url: "",
  size_ids: [],
  pack_code: "",
  sequence: "",
});

export default function MoreVariationsSection({ productId, colorVariants }) {
  const [variations, setVariations] = useState([]);
  const [styleSizes, setStyleSizes] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadAll();
  }, [productId]);

  const loadAll = async () => {
    setLoading(true);
    const [allVars, ss, sz] = await Promise.all([
      base44.entities.ProductColorAndMore.list("-created_date", 500),
      base44.entities.StyleSize.filter({ product_id: productId }),
      base44.entities.Size.list("size_code", 500),
    ]);
    const colorIds = colorVariants.map((cv) => cv.id);
    setVariations(allVars.filter((v) => colorIds.includes(v.product_color_id)));
    setStyleSizes(ss);
    setSizes(sz);
    setLoading(false);
  };

  // Active style sizes (active !== false)
  const activeSizes = styleSizes.filter((ss) => ss.active !== false);

  const openNew = () => {
    const f = emptyForm();
    f.product_color_id = colorVariants[0]?.id || "";
    f.size_ids = activeSizes.map((ss) => ss.size_id);
    setForm(f);
    setEditing({});
  };

  const openEdit = (v) => {
    setForm({
      product_color_id: v.product_color_id || "",
      name: v.name || "",
      description: v.description || "",
      color_hex: v.color_hex || "#000000",
      image_url: v.image_url || "",
      size_ids: v.size_ids || [],
      pack_code: v.pack_code || "",
      sequence: v.sequence || "",
    });
    setEditing(v);
  };

  const closeDialog = () => setEditing(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, image_url: file_url }));
    setUploading(false);
  };

  const toggleSize = (sizeId) => {
    setForm((f) => ({
      ...f,
      size_ids: f.size_ids.includes(sizeId)
        ? f.size_ids.filter((id) => id !== sizeId)
        : [...f.size_ids, sizeId],
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...form };
    if (editing?.id) {
      await base44.entities.ProductColorAndMore.update(editing.id, data);
      setVariations((prev) => prev.map((v) => v.id === editing.id ? { ...v, ...data } : v));
    } else {
      data.sequence = generateSequence(variations);
      const created = await base44.entities.ProductColorAndMore.create(data);
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
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Seq.</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Colorway</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Pack Code</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Sizes</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {variations.map((v) => {
                const cw = colorVariants.find((cv) => cv.id === v.product_color_id);
                const vSizes = (v.size_ids || []).map((sid) => {
                  const ss = styleSizes.find((s) => s.size_id === sid);
                  const sz = sizes.find((s) => s.id === sid);
                  return sz?.size_code;
                }).filter(Boolean);
                return (
                  <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.sequence || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {cw?.color_hex && <div className="w-4 h-4 rounded-sm border border-border shrink-0" style={{ backgroundColor: cw.color_hex }} />}
                        <span className="text-xs">{cw?.color_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{v.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{v.pack_code || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{vSizes.join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => openEdit(v)} className="p-1.5 rounded-md hover:bg-muted transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Variation" : "New Variation"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {editing?.id && (
              <div className="space-y-1">
                <Label className="text-xs">Sequence</Label>
                <p className="text-sm font-mono text-muted-foreground">{form.sequence}</p>
              </div>
            )}

            {/* Colorway */}
            <div className="space-y-2">
              <Label className="text-xs">Colorway</Label>
              <Select value={form.product_color_id} onValueChange={(v) => setForm((f) => ({ ...f, product_color_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select colorway…" /></SelectTrigger>
                <SelectContent>
                  {colorVariants.map((cv) => (
                    <SelectItem key={cv.id} value={cv.id}>
                      <div className="flex items-center gap-2">
                        {cv.color_hex && <div className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: cv.color_hex }} />}
                        {cv.color_name}{cv.colorway_code ? ` (${cv.colorway_code})` : ""}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>

            {/* Pack Code */}
            <div className="space-y-2">
              <Label className="text-xs">Pack Code</Label>
              <Select value={form.pack_code || "none"} onValueChange={(v) => setForm((f) => ({ ...f, pack_code: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select pack code…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {PACK_CODES.map((pc) => <SelectItem key={pc} value={pc}>{pc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Group of sizes */}
            <div className="space-y-2">
              <Label className="text-xs">Group of Sizes</Label>
              {activeSizes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No active sizes on this style.</p>
              ) : (
                <div className="border border-border rounded-lg p-3 space-y-2">
                  {activeSizes.map((ss) => {
                    const sz = sizes.find((s) => s.id === ss.size_id);
                    const checked = form.size_ids.includes(ss.size_id);
                    return (
                      <div key={ss.size_id} className="flex items-center gap-2">
                        <Checkbox checked={checked} onCheckedChange={() => toggleSize(ss.size_id)} id={`sz-${ss.size_id}`} />
                        <label htmlFor={`sz-${ss.size_id}`} className="text-sm cursor-pointer">
                          {sz?.size_code || "?"} {sz?.name ? `— ${sz.name}` : ""}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Image */}
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