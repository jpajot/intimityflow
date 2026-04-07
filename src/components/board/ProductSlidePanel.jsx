import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, Save, ExternalLink } from "lucide-react";

const PRODUCT_TYPES = ["Product", "Material"];
const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Dresses", "Footwear", "Accessories", "Other"];

export default function ProductSlidePanel({ open, mode, entityType, entityId, prefill, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: "Product", name: "", category: "", sub_category: "",
    customer_need: "", description: "", images: [],
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lovData, setLovData] = useState({ subCategories: [], customerNeeds: [] });

  // Load existing entity if editing
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && entityId) {
      setLoading(true);
      base44.entities.Product.filter({ id: entityId }).then((res) => {
        if (res[0]) setForm({ ...res[0] });
        setLoading(false);
      });
    } else {
      // Prefill from canvas
      setForm({
        type: "Product",
        name: prefill?.name || "",
        category: prefill?.category || "",
        sub_category: "",
        customer_need: "",
        description: prefill?.description || "",
        images: prefill?.imageUrl ? [prefill.imageUrl] : [],
      });
    }
  }, [open, mode, entityId, prefill]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.name || !form.type) return;
    setSaving(true);
    let saved;
    if (mode === "edit" && entityId) {
      const { id, created_date, updated_date, created_by, ...data } = form;
      saved = await base44.entities.Product.update(entityId, data);
      saved = { ...form, id: entityId };
    } else {
      saved = await base44.entities.Product.create({
        type: form.type,
        name: form.name,
        category: form.category || "Other",
        sub_category: form.sub_category || "",
        customer_need: form.customer_need || "",
        description: form.description,
        images: form.images,
      });
    }
    setSaving(false);
    onSaved(saved);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Slide panel */}
      <div className="fixed top-0 right-0 h-full w-[420px] z-50 bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <p className="text-xs text-muted-foreground">{mode === "edit" ? "Edit" : "Create"}</p>
            <p className="font-semibold">{entityType === "Product" ? "Product / Style" : "Colorway"}</p>
          </div>
          <div className="flex items-center gap-2">
            {mode === "edit" && entityId && (
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Open full page"
                onClick={() => window.open(`/products/${entityId}`, "_blank")}>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Image preview */}
              {form.images?.[0] && (
                <div className="w-full aspect-video rounded-lg border border-border overflow-hidden bg-muted/40">
                  <img src={form.images[0]} alt="" className="w-full h-full object-contain" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={form.type || "Product"} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
                <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Summer Jacket" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={form.category || ""} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Sub-category</Label>
                <Input value={form.sub_category || ""} onChange={(e) => set("sub_category", e.target.value)} placeholder="e.g. Lightweight" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Customer Need</Label>
                <Input value={form.customer_need || ""} onChange={(e) => set("customer_need", e.target.value)} placeholder="e.g. Casual everyday" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Describe the product…" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Image URL</Label>
                <Input value={form.images?.[0] || ""} onChange={(e) => set("images", e.target.value ? [e.target.value] : [])} placeholder="https://…" />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-3 flex gap-2">
          <Button onClick={handleSave} disabled={!form.name || saving} className="flex-1 gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {mode === "edit" ? "Save Changes" : "Create Product"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </>
  );
}