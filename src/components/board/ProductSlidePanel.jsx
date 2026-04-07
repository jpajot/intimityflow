import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, Save, ExternalLink, Upload } from "lucide-react";

const PRODUCT_TYPES = ["Product", "Material"];

export default function ProductSlidePanel({ open, mode, entityType, entityId, prefill, projectId, onClose, onSaved }) {
  const [form, setForm] = useState({
    type: "Product", name: "", category: "", sub_category: "",
    customer_need: "", description: "", images: [],
    creation_project_id: "", project_ids: [],
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [customerNeeds, setCustomerNeeds] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    base44.entities.Project.list("name", 500).then(setProjects);
    // Load LOV data
    base44.entities.TypeOfLOV.list("code", 200).then(async (types) => {
      const catType = types.find((t) => t.code === "Category");
      const subCatType = types.find((t) => t.code === "SubCategory" || t.code === "Sub-Types");
      const cnType = types.find((t) => t.code === "CustomerNeed" || t.code === "Customer Need");
      const [cats, subs, cns] = await Promise.all([
        catType ? base44.entities.ListOfValues.filter({ type_of_lov_id: catType.id }) : Promise.resolve([]),
        subCatType ? base44.entities.ListOfValues.filter({ type_of_lov_id: subCatType.id }) : Promise.resolve([]),
        cnType ? base44.entities.ListOfValues.filter({ type_of_lov_id: cnType.id }) : Promise.resolve([]),
      ]);
      setCategories(cats.map((c) => c.name));
      setSubCategories(subs);
      setCustomerNeeds(cns.map((c) => c.name));
    });
  }, []);

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
        creation_project_id: projectId || "",
        project_ids: projectId ? [projectId] : [],
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
        creation_project_id: form.creation_project_id || "",
        project_ids: form.project_ids || [],
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
               <Select value={form.category || ""} onValueChange={(v) => { set("category", v); set("sub_category", ""); }}>
                 <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                 <SelectContent>
                   {(categories.length > 0 ? categories : ["Tops","Bottoms","Outerwear","Dresses","Footwear","Accessories","Other"]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                 </SelectContent>
               </Select>
              </div>

              <div className="space-y-1.5">
               <Label className="text-xs">Sub-category</Label>
               {subCategories.length > 0 ? (
                 <Select value={form.sub_category || ""} onValueChange={(v) => set("sub_category", v)}>
                   <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                   <SelectContent>
                     {subCategories
                       .filter((s) => !s.depends_on_value_id || !form.category || true)
                       .map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                   </SelectContent>
                 </Select>
               ) : (
                 <Input value={form.sub_category || ""} onChange={(e) => set("sub_category", e.target.value)} placeholder="e.g. Lightweight" />
               )}
              </div>

              <div className="space-y-1.5">
               <Label className="text-xs">Customer Need</Label>
               {customerNeeds.length > 0 ? (
                 <Select value={form.customer_need || ""} onValueChange={(v) => set("customer_need", v)}>
                   <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                   <SelectContent>
                     {customerNeeds.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                   </SelectContent>
                 </Select>
               ) : (
                 <Input value={form.customer_need || ""} onChange={(e) => set("customer_need", e.target.value)} placeholder="e.g. Casual everyday" />
               )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Describe the product…" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Image</Label>
                <div className="flex gap-2">
                  <Input value={form.images?.[0] || ""} onChange={(e) => set("images", e.target.value ? [e.target.value] : [])} placeholder="https://…" className="flex-1" />
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setUploading(true);
                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                    set("images", [file_url]);
                    setUploading(false);
                    e.target.value = "";
                  }} />
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Creation Project</Label>
                <Select value={form.creation_project_id || ""} onValueChange={(v) => set("creation_project_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Linked Projects</Label>
                <Select
                  value=""
                  onValueChange={(v) => {
                    const ids = form.project_ids || [];
                    if (!ids.includes(v)) set("project_ids", [...ids, v]);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Add project…" /></SelectTrigger>
                  <SelectContent>
                    {projects.filter((p) => !(form.project_ids || []).includes(p.id)).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(form.project_ids || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(form.project_ids || []).map((id) => {
                      const proj = projects.find((p) => p.id === id);
                      return (
                        <span key={id} className="inline-flex items-center gap-1 bg-muted text-xs px-2 py-0.5 rounded-full">
                          {proj?.name || id}
                          <button type="button" onClick={() => set("project_ids", (form.project_ids || []).filter((x) => x !== id))} className="text-muted-foreground hover:text-destructive">×</button>
                        </span>
                      );
                    })}
                  </div>
                )}
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