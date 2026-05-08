import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Loader2, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { colorToHex } from "../lib/pantone-tcx";
import RevisionContextModal from "./RevisionContextModal";

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
    creation_project_id: variant?.creation_project_id || "",
    project_ids: variant?.project_ids || [],
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [techColors, setTechColors] = useState([]);
  const [commColors, setCommColors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [revisionPending, setRevisionPending] = useState(null); // { beforeSnapshot, afterSnapshot, formData }
  const [revisionSaving, setRevisionSaving] = useState(false);
  const [currentRevision, setCurrentRevision] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.TechnicalColor.list("code", 2000),
      base44.entities.CommercialColor.list("code", 2000),
      base44.entities.Project.list("name", 500),
    ]).then(([tc, cc, projs]) => { setTechColors(tc); setCommColors(cc); setProjects(projs); });
  }, []);

  useEffect(() => {
    if (!variant?.id) return;
    base44.entities.ProductRevision.filter(
      { target_id: variant.id, is_current: true },
      "-created_date",
      1
    ).then((rows) => setCurrentRevision(rows[0] || null)).catch(() => {});
  }, [variant?.id]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, image_url: file_url }));
    setUploading(false);
  };

  const handleSelectTech = (tech) => {
    const linkedComm = commColors.find((c) => c.main_technical_color_id === tech.id);
    setForm((f) => ({
      ...f,
      linked_tech_color_id: tech.id,
      color_hex: colorToHex(tech) || f.color_hex,
      color_name: tech.name || f.color_name,
      // Auto-inherit commercial color if one is linked to this technical color and none is set yet
      linked_color_type: !f.linked_color_id && linkedComm ? "commercial" : f.linked_color_type,
      linked_color_id: !f.linked_color_id && linkedComm ? linkedComm.id : f.linked_color_id,
      colorway_code: !f.linked_color_id && linkedComm ? (linkedComm.code || f.colorway_code) : f.colorway_code,
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

    // If editing an existing colorway, check for tracked-field changes
    if (variant) {
      let tracked = null;
      try {
        const res = await base44.functions.invoke("detectTrackedFieldChanges", {
          target_type: "product_color",
          before_record: variant,
          after_record: { ...variant, ...form },
        });
        tracked = res.data;
      } catch (err) {
        console.error("[Revision] detectTrackedFieldChanges failed:", err);
      }

      if (tracked?.has_tracked_changes) {
        // Pause and prompt for revision context
        setRevisionPending({
          beforeSnapshot: tracked.before_snapshot,
          afterSnapshot: tracked.after_snapshot,
          formData: form,
        });
        return;
      }
    }

    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const handleRevisionConfirm = async (revisionContext) => {
    if (!revisionPending) return;
    setRevisionSaving(true);
    try {
      // Persist the entity update
      await onSave(revisionPending.formData);
      // Create the revision (post-save, non-blocking)
      try {
        const me = await base44.auth.me();
        await base44.functions.invoke("createProductRevision", {
          product_id: variant.product_id,
          target_type: "product_color",
          target_id: variant.id,
          revision_context: revisionContext,
          before_snapshot: revisionPending.beforeSnapshot,
          after_snapshot: revisionPending.afterSnapshot,
          triggered_by: me?.email || "",
        });
      } catch (err) {
        console.error("[Revision] createProductRevision failed after entity save:", err);
      }
    } finally {
      setRevisionSaving(false);
      setRevisionPending(null);
    }
  };

  const getTechHex = (t) => colorToHex(t) || "#ccc";
  const getTechLabel = (t) => `${t.code} – ${t.name}`;
  const getCommHex = (c) => {
    const t = techColors.find((t) => t.id === c.main_technical_color_id);
    return t ? colorToHex(t) : "#ccc";
  };
  const getCommLabel = (c) => {
    const tc = techColors.find((t) => t.id === c.main_technical_color_id);
    return tc ? `${c.code} – ${c.color_name} (${tc.code})` : `${c.code} – ${c.color_name}`;
  };

  return (
    <>
    <RevisionContextModal
      open={!!revisionPending}
      onClose={() => setRevisionPending(null)}
      onConfirm={handleRevisionConfirm}
      saving={revisionSaving}
      title="Tracked Change Detected"
      subtitle={variant ? `This edit modifies tracked fields on "${variant.color_name}". Add context before saving.` : undefined}
    />
    <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm">{variant ? "Edit Colorway" : "New Colorway"}</h4>
          {variant && currentRevision && (
            <span
              title={`Current revision: ${currentRevision.revision_code} — ${currentRevision.revision_context || ""}`}
              className="inline-flex items-center justify-center w-6 h-6 rounded border border-green-400 bg-green-50 text-green-700 text-[11px] font-mono font-bold shrink-0"
            >
              {currentRevision.revision_code}
            </span>
          )}
        </div>
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

      {/* Creation Project */}
      <div className="space-y-1.5">
        <Label className="text-xs">Creation Project</Label>
        <Select value={form.creation_project_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, creation_project_id: v === "none" ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Linked Projects (multi-select) */}
      <div className="space-y-1.5">
        <Label className="text-xs">Linked Projects</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {(form.project_ids || []).map((pid) => {
            const proj = projects.find((p) => p.id === pid);
            return proj ? (
              <span key={pid} className="flex items-center gap-1 px-2 py-1 bg-accent text-accent-foreground rounded-full text-xs">
                {proj.name}
                <button type="button" onClick={() => setForm((f) => ({ ...f, project_ids: f.project_ids.filter((x) => x !== pid) }))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ) : null;
          })}
        </div>
        <Select value="" onValueChange={(v) => { if (v && !(form.project_ids || []).includes(v)) setForm((f) => ({ ...f, project_ids: [...(f.project_ids || []), v] })); }}>
          <SelectTrigger><SelectValue placeholder="Add project…" /></SelectTrigger>
          <SelectContent>
            {projects.filter((p) => !(form.project_ids || []).includes(p.id)).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

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
        <Button type="submit" disabled={saving || revisionSaving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {variant ? "Update" : "Add"} Colorway
        </Button>
        {variant && onDelete && (
          <Button type="button" variant="destructive" onClick={onDelete}>Delete</Button>
        )}
      </div>
    </form>
    </>
  );
}