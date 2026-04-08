import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, Save, ExternalLink, Upload } from "lucide-react";

// ─── Product Form ────────────────────────────────────────────────────────────
function ProductForm({ entityId, prefill, projectId, onSaved, onClose, mode, productType }) {
  const [form, setForm] = useState({
    type: "Product", name: "", category: "", sub_category: "",
    customer_need: "", description: "", images: [],
    creation_project_id: "", project_ids: [],
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [lovTypes, setLovTypes] = useState({});
  const [lovValues, setLovValues] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    base44.entities.Project.list("name", 500).then(setProjects);
    Promise.all([
      base44.entities.TypeOfLOV.list("code", 500),
      base44.entities.ListOfValues.list("name", 5000),
    ]).then(([types, values]) => {
      const typeMap = {};
      types.forEach((t) => (typeMap[t.code] = t.id));
      setLovTypes(typeMap);
      setLovValues(values);
    });
  }, []);

  useEffect(() => {
    if (mode === "edit" && entityId) {
      setLoading(true);
      base44.entities.Product.filter({ id: entityId }).then((res) => {
        if (res[0]) setForm({ ...res[0] });
        setLoading(false);
      });
    } else {
      setForm({
        type: productType || "Product", name: prefill?.name || "", category: "", sub_category: "",
        customer_need: "", description: prefill?.description || "",
        images: prefill?.imageUrl ? [prefill.imageUrl] : [],
        creation_project_id: projectId || "",
        project_ids: projectId ? [projectId] : [],
      });
    }
  }, [entityId, mode, prefill]);

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const getCategories = () => {
    const all = lovValues.filter((v) => v.type_of_lov_id === lovTypes["Category"]);
    const anyHasDep = all.some((v) => !!v.depends_on_value_id);
    if (!anyHasDep) return all;
    const categoryDepIds = new Set(all.map((v) => v.depends_on_value_id).filter(Boolean));
    const matchingTypeVal = lovValues.find((v) => categoryDepIds.has(v.id) && v.name === form.type);
    if (!matchingTypeVal) return all.filter((v) => !v.depends_on_value_id);
    return all.filter((v) => v.depends_on_value_id === matchingTypeVal.id);
  };
  const getSubCategories = () => {
    const catVal = lovValues.find((v) => v.type_of_lov_id === lovTypes["Category"] && v.name === form.category);
    if (!catVal) return [];
    return lovValues.filter((v) => v.type_of_lov_id === lovTypes["Sub-Category"] && v.depends_on_value_id === catVal.id);
  };
  const getCustomerNeeds = () => {
    const all = lovValues.filter((v) => v.type_of_lov_id === lovTypes["Customer Need"]);
    if (!all.some((v) => v.depends_on_value_id)) return all.map((v) => v.name);
    const subVal = lovValues.find((v) => v.type_of_lov_id === lovTypes["Sub-Category"] && v.name === form.sub_category);
    if (!subVal) return all.map((v) => v.name);
    return all.filter((v) => v.depends_on_value_id === subVal.id).map((v) => v.name);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    let saved;
    if (mode === "edit" && entityId) {
      const { id, created_date, updated_date, created_by, ...data } = form;
      await base44.entities.Product.update(entityId, data);
      saved = { ...form, id: entityId };
    } else {
      saved = await base44.entities.Product.create({
        type: form.type, name: form.name,
        category: form.category || "Other", sub_category: form.sub_category || "",
        customer_need: form.customer_need || "", description: form.description,
        images: form.images, creation_project_id: form.creation_project_id || "",
        project_ids: form.project_ids || [],
      });
    }
    setSaving(false);
    onSaved(saved);
    onClose();
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {form.images?.[0] && (
        <div className="w-full aspect-video rounded-lg border border-border overflow-hidden bg-muted/40">
          <img src={form.images[0]} alt="" className="w-full h-full object-contain" />
        </div>
      )}
      <Field label="Type">
        <Select value={form.type || "Product"} onValueChange={(v) => set("type", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["Product", "Material"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Name" required>
        <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Summer Jacket" />
      </Field>
      <Field label="Category">
        <Select value={form.category || ""} onValueChange={(v) => { set("category", v); set("sub_category", ""); set("customer_need", ""); }}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>{getCategories().map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Sub-category">
        <Select value={form.sub_category || ""} onValueChange={(v) => { set("sub_category", v); set("customer_need", ""); }} disabled={!form.category}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>{getSubCategories().map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      {form.type !== "Material" && (
        <Field label="Customer Need">
          <Select value={form.customer_need || ""} onValueChange={(v) => set("customer_need", v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>{getCustomerNeeds().map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      )}
      <Field label="Description">
        <Textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} rows={3} />
      </Field>
      <Field label="Image">
        <div className="flex gap-2">
          <Input value={form.images?.[0] || ""} onChange={(e) => set("images", e.target.value ? [e.target.value] : [])} placeholder="https://…" className="flex-1" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            set("images", [file_url]); e.target.value = "";
          }} />
          <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Field>
      <Field label="Creation Project">
        <Select value={form.creation_project_id || ""} onValueChange={(v) => set("creation_project_id", v)}>
          <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
          <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="pt-2">
        <Button onClick={handleSave} disabled={!form.name || saving} className="w-full gap-2">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {mode === "edit" ? "Save Changes" : "Create Product"}
        </Button>
      </div>
    </div>
  );
}

// ─── Technical Color Form ────────────────────────────────────────────────────
function TechnicalColorForm({ entityId, mode, onSaved, onClose }) {
  const [form, setForm] = useState({ code: "", name: "", hex: "", rgb: "", cmyk: "", color_group: "", color_sub_group: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lovTypes, setLovTypes] = useState({});
  const [lovValues, setLovValues] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.TypeOfLOV.list("code", 500),
      base44.entities.ListOfValues.list("name", 5000),
    ]).then(([types, values]) => {
      const typeMap = {};
      types.forEach((t) => (typeMap[t.code] = t.id));
      setLovTypes(typeMap);
      setLovValues(values);
    });
    if (mode === "edit" && entityId) {
      setLoading(true);
      base44.entities.TechnicalColor.filter({ id: entityId }).then((res) => {
        if (res[0]) setForm({ ...res[0] });
        setLoading(false);
      });
    }
  }, [entityId, mode]);

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const getColorGroups = () => lovValues.filter((v) => v.type_of_lov_id === lovTypes["ColorGroup"]);
  const getColorSubGroups = () => {
    const grpVal = lovValues.find((v) => v.type_of_lov_id === lovTypes["ColorGroup"] && v.name === form.color_group);
    if (!grpVal) return lovValues.filter((v) => v.type_of_lov_id === lovTypes["ColorSubGroup"]);
    return lovValues.filter((v) => v.type_of_lov_id === lovTypes["ColorSubGroup"] && v.depends_on_value_id === grpVal.id);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) return;
    setSaving(true);
    let saved;
    if (mode === "edit" && entityId) {
      const { id, created_date, updated_date, created_by, ...data } = form;
      await base44.entities.TechnicalColor.update(entityId, data);
      saved = { ...form, id: entityId };
    } else {
      saved = await base44.entities.TechnicalColor.create(form);
    }
    setSaving(false);
    onSaved(saved);
    onClose();
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {form.hex && (
        <div className="w-full h-24 rounded-lg border border-border" style={{ backgroundColor: form.hex }} />
      )}
      <Field label="Code" required>
        <Input value={form.code || ""} onChange={(e) => set("code", e.target.value)} placeholder="e.g. 11-0601 TCX" />
      </Field>
      <Field label="Name" required>
        <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Bright White" />
      </Field>
      <Field label="HEX">
        <div className="flex gap-2 items-center">
          <Input value={form.hex || ""} onChange={(e) => set("hex", e.target.value)} placeholder="#F4F5F0" className="flex-1" />
          {form.hex && <div className="w-8 h-8 rounded border border-border shrink-0" style={{ backgroundColor: form.hex }} />}
        </div>
      </Field>
      <Field label="RGB">
        <Input value={form.rgb || ""} onChange={(e) => set("rgb", e.target.value)} placeholder="244,245,240" />
      </Field>
      <Field label="CMYK">
        <Input value={form.cmyk || ""} onChange={(e) => set("cmyk", e.target.value)} placeholder="0,1,3,4" />
      </Field>
      <Field label="Color Group">
        <Select value={form.color_group || ""} onValueChange={(v) => { set("color_group", v); set("color_sub_group", ""); }}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>{getColorGroups().map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Color Sub-Group">
        <Select value={form.color_sub_group || ""} onValueChange={(v) => set("color_sub_group", v)} disabled={!form.color_group}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>{getColorSubGroups().map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="pt-2">
        <Button onClick={handleSave} disabled={!form.code || !form.name || saving} className="w-full gap-2">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {mode === "edit" ? "Save Changes" : "Create Technical Color"}
        </Button>
      </div>
    </div>
  );
}

// ─── Commercial Color Form ───────────────────────────────────────────────────
function CommercialColorForm({ entityId, mode, onSaved, onClose }) {
  const [form, setForm] = useState({ sub_type: "Solid", code: "", color_name: "", main_technical_color_id: "", linked_technical_color_ids: [] });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [techColors, setTechColors] = useState([]);
  const [hex, setHex] = useState("");

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const allTechColors = await base44.entities.TechnicalColor.list("name", 500);
      let finalTechColors = allTechColors;

      if (mode === "edit" && entityId) {
        const res = await base44.entities.CommercialColor.filter({ id: entityId });
        if (res[0]) {
          setForm({ ...res[0] });
          const linkedIds = res[0].linked_technical_color_ids || [];
          const missingIds = linkedIds.filter((id) => !allTechColors.find((c) => c.id === id));
          if (missingIds.length > 0) {
            const extras = await Promise.all(missingIds.map((id) => base44.entities.TechnicalColor.filter({ id })));
            finalTechColors = [...allTechColors, ...extras.flat()];
          }
          if (res[0].main_technical_color_id) {
            const tc = finalTechColors.find((c) => c.id === res[0].main_technical_color_id);
            if (tc) setHex(tc.hex || "");
          }
        }
      }
      setTechColors(finalTechColors);
      setLoading(false);
    };
    init();
  }, [entityId, mode]);

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const handleMainColorChange = (id) => {
    set("main_technical_color_id", id);
    const tc = techColors.find((c) => c.id === id);
    setHex(tc?.hex || "");
  };

  const handleSave = async () => {
    if (!form.code || !form.color_name) return;
    setSaving(true);
    let saved;
    if (mode === "edit" && entityId) {
      const { id, created_date, updated_date, created_by, ...data } = form;
      await base44.entities.CommercialColor.update(entityId, data);
      saved = { ...form, id: entityId };
    } else {
      saved = await base44.entities.CommercialColor.create(form);
    }
    setSaving(false);
    onSaved(saved);
    onClose();
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {hex && <div className="w-full h-24 rounded-lg border border-border" style={{ backgroundColor: hex }} />}
      <Field label="Sub-type">
        <Select value={form.sub_type || "Solid"} onValueChange={(v) => set("sub_type", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Solid">Solid</SelectItem>
            <SelectItem value="Combined">Combined</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Code" required>
        <Input value={form.code || ""} onChange={(e) => set("code", e.target.value)} placeholder="e.g. COM-001" />
      </Field>
      <Field label="Color Name" required>
        <Input value={form.color_name || ""} onChange={(e) => set("color_name", e.target.value)} placeholder="e.g. Ocean Blue" />
      </Field>
      <Field label="Main Technical Color">
        <Select value={form.main_technical_color_id || ""} onValueChange={handleMainColorChange}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {techColors.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  {c.hex && <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c.hex }} />}
                  {c.name} {c.code ? `(${c.code})` : ""}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Linked Technical Colors">
        <Select value="" onValueChange={(v) => {
          const ids = form.linked_technical_color_ids || [];
          if (!ids.includes(v)) set("linked_technical_color_ids", [...ids, v]);
        }}>
          <SelectTrigger><SelectValue placeholder="Add…" /></SelectTrigger>
          <SelectContent>
            {techColors.filter((c) => !(form.linked_technical_color_ids || []).includes(c.id)).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name} {c.code ? `(${c.code})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(form.linked_technical_color_ids || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {(form.linked_technical_color_ids || []).map((id) => {
              const tc = techColors.find((c) => c.id === id);
              return (
                <span key={id} className="inline-flex items-center gap-1 bg-muted text-xs px-2 py-0.5 rounded-full">
                  {tc?.hex && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: tc.hex }} />}
                  {tc?.name || id}
                  <button type="button" onClick={() => set("linked_technical_color_ids", (form.linked_technical_color_ids || []).filter((x) => x !== id))} className="text-muted-foreground hover:text-destructive">×</button>
                </span>
              );
            })}
          </div>
        )}
      </Field>
      <div className="pt-2">
        <Button onClick={handleSave} disabled={!form.code || !form.color_name || saving} className="w-full gap-2">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {mode === "edit" ? "Save Changes" : "Create Commercial Color"}
        </Button>
      </div>
    </div>
  );
}

// ─── Field helper ────────────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}

// ─── Entity config map ───────────────────────────────────────────────────────
const ENTITY_CONFIG = {
  Product: { label: "Product", externalPath: (id) => `/products/${id}` },
  TechnicalColor: { label: "Technical Color", externalPath: null },
  CommercialColor: { label: "Commercial Color", externalPath: null },
};

// ─── Main EntitySlidePanel ───────────────────────────────────────────────────
export default function EntitySlidePanel({ open, mode, entityType, entityId, prefill, projectId, productType, onClose, onSaved }) {
  if (!open) return null;

  const config = ENTITY_CONFIG[entityType] || { label: entityType, externalPath: null };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[420px] z-50 bg-background border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <p className="text-xs text-muted-foreground">{mode === "edit" ? "Edit" : "Create"}</p>
            <p className="font-semibold">{config.label}</p>
          </div>
          <div className="flex items-center gap-2">
            {mode === "edit" && entityId && config.externalPath && (
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Open full page"
                onClick={() => window.open(config.externalPath(entityId), "_blank")}>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {entityType === "Product" && (
            <ProductForm entityId={entityId} mode={mode} prefill={prefill} projectId={projectId} productType={productType} onSaved={onSaved} onClose={onClose} />
          )}
          {entityType === "TechnicalColor" && (
            <TechnicalColorForm entityId={entityId} mode={mode} onSaved={onSaved} onClose={onClose} />
          )}
          {entityType === "CommercialColor" && (
            <CommercialColorForm entityId={entityId} mode={mode} onSaved={onSaved} onClose={onClose} />
          )}
        </div>
      </div>
    </>
  );
}