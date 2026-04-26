import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Loader2, X, Upload } from "lucide-react";
import ListToolbar from "./ListToolbar";
import ViewSelector from "./ViewSelector";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DataTable from "./DataTable";



const GROUP_OPTIONS = [
  { value: "none", label: "None" },
  { value: "colorway", label: "Colorway" },
  { value: "pack_code", label: "Pack Code" },
];

function getGroupKey(v, groupBy, colorVariants) {
  if (groupBy === "colorway") {
    const cw = colorVariants.find((cv) => cv.id === v.product_color_id);
    return cw ? (cw.color_name + (cw.colorway_code ? ` (${cw.colorway_code})` : "")) : "Unknown";
  }
  if (groupBy === "pack_code") return v.pack_code || "No Pack Code";
  return "all";
}

function createVariationFilterFields(colorVariants) {
  return [
    { getValue: (v) => v.name },
    { getValue: (v) => v.pack_code },
    { getValue: (v) => {
      const cw = colorVariants.find((cv) => cv.id === v.product_color_id);
      return cw?.color_name || cw?.colorway_code || "";
    }},
  ];
}

const emptyForm = () => ({
  product_color_id: "",
  name: "",
  description: "",
  color_hex: "#000000",
  image_url: "",
  size_ids: [],
  pack_code: "",
  variant: "",
  sequence: "",
  });

export default function MoreVariationsSection({ productId, colorVariants, projects = [] }) {
  const [variations, setVariations] = useState([]);
  const [styleSizes, setStyleSizes] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [packCodes, setPackCodes] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeColumns, setActiveColumns] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addColorwayIds, setAddColorwayIds] = useState([]);
  const [addPackCodes, setAddPackCodes] = useState([]);
  const [addVariants, setAddVariants] = useState([]);
  const [addName, setAddName] = useState("");
  const [addSizeIds, setAddSizeIds] = useState([]);

  useEffect(() => {
    loadAll();
  }, [productId]);

  const loadAll = async () => {
    setLoading(true);
    const [allVars, ss, sz, lovTypes, variantLovTypes] = await Promise.all([
      base44.entities.ProductColorAndMore.list("-created_date", 500),
      base44.entities.StyleSize.filter({ product_id: productId }),
      base44.entities.Size.list("size_code", 500),
      base44.entities.TypeOfLOV.filter({ code: "Pack" }),
      base44.entities.TypeOfLOV.filter({ code: "Variant" }),
    ]);
    if (lovTypes.length > 0) {
      const lovValues = await base44.entities.ListOfValues.filter({ type_of_lov_id: lovTypes[0].id });
      setPackCodes(lovValues.map((v) => v.name));
    }
    if (variantLovTypes.length > 0) {
      const variantValues = await base44.entities.ListOfValues.filter({ type_of_lov_id: variantLovTypes[0].id });
      setVariants(variantValues.map((v) => v.name));
    }
    const colorIds = colorVariants.map((cv) => cv.id);
    setVariations(allVars.filter((v) => colorIds.includes(v.product_color_id)));
    setStyleSizes(ss);
    setSizes(sz);
    setLoading(false);
  };

  // Active style sizes (active !== false)
  const activeSizes = styleSizes.filter((ss) => ss.active !== false);

  const openAdd = () => {
    setAddColorwayIds([]);
    setAddPackCodes([]);
    setAddVariants([]);
    setAddName("");
    setAddSizeIds(activeSizes.map((ss) => ss.size_id));
    setShowAddDialog(true);
  };

  const toggleAddColorway = (id) => setAddColorwayIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAddPackCode = (pc) => setAddPackCodes((prev) => prev.includes(pc) ? prev.filter((x) => x !== pc) : [...prev, pc]);
  const toggleAddVariant = (v) => setAddVariants((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  const toggleAddSize = (sizeId) => setAddSizeIds((prev) => prev.includes(sizeId) ? prev.filter((x) => x !== sizeId) : [...prev, sizeId]);

  const handleBulkCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const combinations = [];
    const effectiveVariants = addVariants.length > 0 ? addVariants : [""];
    for (const cwId of addColorwayIds) {
      for (const pc of addPackCodes) {
        for (const vt of effectiveVariants) {
          combinations.push({ cwId, pc, vt });
        }
      }
    }
    const cw = colorVariants.find((cv) => cv.id === addColorwayIds[0]);
    let seq = parseInt((variations.reduce((max, v) => Math.max(max, parseInt(v.sequence || "0", 10)), 0)).toString(), 10);
    const created = [];
    for (const { cwId, pc, vt } of combinations) {
      seq += 1;
      const item = await base44.entities.ProductColorAndMore.create({
        product_color_id: cwId,
        name: addName,
        pack_code: pc,
        variant: vt || undefined,
        size_ids: addSizeIds,
        sequence: String(seq).padStart(4, "0"),
      });
      created.push(item);
    }
    setVariations((prev) => [...created, ...prev]);
    setSaving(false);
    setShowAddDialog(false);
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
      variant: v.variant || "",
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

  const filteredVariations = useMemo(() => {
    if (!search.trim()) return variations;
    const q = search.toLowerCase();
    return variations.filter((v) => {
      const cw = colorVariants.find((cv) => cv.id === v.product_color_id);
      return (
        v.name?.toLowerCase().includes(q) ||
        v.pack_code?.toLowerCase().includes(q) ||
        v.variant?.toLowerCase().includes(q) ||
        cw?.color_name?.toLowerCase().includes(q) ||
        cw?.colorway_code?.toLowerCase().includes(q)
      );
    });
  }, [variations, search, colorVariants]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const columns = [
    {
      id: "sequence",
      label: "Seq.",
      width: 80,
      sortKey: (v) => v.sequence || "",
      render: (v) => <span className="font-mono text-xs text-muted-foreground">{v.sequence || "—"}</span>,
    },
    {
      id: "colorway",
      label: "Colorway",
      width: 150,
      sortKey: (v) => {
        const cw = colorVariants.find((cv) => cv.id === v.product_color_id);
        return cw?.color_name || "";
      },
      render: (v) => {
        const cw = colorVariants.find((cv) => cv.id === v.product_color_id);
        return (
          <div className="flex items-center gap-2">
            {cw?.color_hex && <div className="w-4 h-4 rounded-sm border border-border shrink-0" style={{ backgroundColor: cw.color_hex }} />}
            <span className="text-xs">{cw?.color_name || "—"}</span>
          </div>
        );
      },
    },
    {
      id: "name",
      label: "Name",
      width: 120,
      sortKey: (v) => v.name || "",
      render: (v) => <span className="font-medium">{v.name}</span>,
    },
    {
      id: "pack_code",
      label: "Pack Code",
      width: 100,
      sortKey: (v) => v.pack_code || "",
      render: (v) => <span className="text-xs text-muted-foreground">{v.pack_code || "—"}</span>,
    },
    {
      id: "variant",
      label: "Variant",
      width: 90,
      sortKey: (v) => v.variant || "",
      render: (v) => <span className="text-xs text-muted-foreground">{v.variant || "—"}</span>,
    },
    {
      id: "creation_project",
      label: "Creation Project",
      width: 160,
      sortKey: (v) => projects.find((p) => p.id === v.creation_project_id)?.name || "",
      render: (v) => { const p = projects.find((pr) => pr.id === v.creation_project_id); return <span className="text-xs text-muted-foreground">{p?.name || "—"}</span>; },
    },
    {
      id: "linked_projects",
      label: "Linked Projects",
      width: 200,
      render: (v) => { const names = (v.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean); return <span className="text-xs text-muted-foreground">{names.length > 0 ? names.join(", ") : "—"}</span>; },
    },
    {
      id: "sizes",
      label: "Sizes",
      width: 150,
      sortKey: (v) => (v.size_ids || []).length,
      render: (v) => {
        const vSizes = (v.size_ids || []).map((sid) => {
          const sz = sizes.find((s) => s.id === sid);
          return sz?.size_code;
        }).filter(Boolean);
        return <span className="text-xs text-muted-foreground">{vSizes.join(", ") || "—"}</span>;
      },
    },
    {
      id: "actions",
      label: "",
      width: 50,
      render: (v) => (
        <button type="button" onClick={() => openEdit(v)} className="p-1.5 rounded-md hover:bg-muted transition-colors ml-auto block">
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search variations…"
        view={null}
        moreItems={[{ label: "Add Variations", icon: Plus, onClick: openAdd }]}
      >
        <ViewSelector pageKey="more_variations_product" allColumns={columns} onColumnsChange={setActiveColumns} entityNames={["ProductColorAndMore"]} />
      </ListToolbar>

      {variations.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No variations yet. Add one to get started.</p>
        </div>
      ) : (
        <DataTable
          columns={activeColumns || columns}
          rows={filteredVariations}
          fixedColumns={["sequence", "colorway"]}
          groupOptions={GROUP_OPTIONS}
          getGroupKey={(v, groupBy) => getGroupKey(v, groupBy, colorVariants)}
          hideColumnToggle
        />
      )}

      {/* Bulk Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(o) => !o && setShowAddDialog(false)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Variations</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBulkCreate} className="space-y-4">
            {/* Colorways */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Colorways</Label>
              <div className="border border-border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                {colorVariants.map((cv) => (
                  <div key={cv.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={addColorwayIds.includes(cv.id)}
                      onCheckedChange={() => toggleAddColorway(cv.id)}
                      id={`add-cw-${cv.id}`}
                    />
                    <label htmlFor={`add-cw-${cv.id}`} className="flex items-center gap-2 text-sm cursor-pointer">
                      {cv.color_hex && <div className="w-3 h-3 rounded-sm border border-border shrink-0" style={{ backgroundColor: cv.color_hex }} />}
                      {cv.color_name}{cv.colorway_code ? ` (${cv.colorway_code})` : ""}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Pack Codes */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Pack Codes</Label>
              <div className="flex flex-wrap gap-2">
                {packCodes.map((pc) => (
                  <label key={pc} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                    addPackCodes.includes(pc) ? "border-primary bg-accent" : "border-border hover:bg-muted"
                  }`}>
                    <Checkbox
                      checked={addPackCodes.includes(pc)}
                      onCheckedChange={() => toggleAddPackCode(pc)}
                    />
                    {pc}
                  </label>
                ))}
              </div>
            </div>

            {/* Variants */}
            {variants.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Variants (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {variants.map((vt) => (
                    <label key={vt} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                      addVariants.includes(vt) ? "border-primary bg-accent" : "border-border hover:bg-muted"
                    }`}>
                      <Checkbox
                        checked={addVariants.includes(vt)}
                        onCheckedChange={() => toggleAddVariant(vt)}
                      />
                      {vt}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Sizes */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Sizes</Label>
              {activeSizes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No active sizes on this style.</p>
              ) : (
                <div className="border border-border rounded-lg p-3 space-y-2">
                  {activeSizes.map((ss) => {
                    const sz = sizes.find((s) => s.id === ss.size_id);
                    return (
                      <div key={ss.size_id} className="flex items-center gap-2">
                        <Checkbox
                          checked={addSizeIds.includes(ss.size_id)}
                          onCheckedChange={() => toggleAddSize(ss.size_id)}
                          id={`add-sz-${ss.size_id}`}
                        />
                        <label htmlFor={`add-sz-${ss.size_id}`} className="text-sm cursor-pointer">
                          {sz?.size_code || "?"} {sz?.name ? `— ${sz.name}` : ""}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {addColorwayIds.length > 0 && addPackCodes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {addColorwayIds.length} colorway{addColorwayIds.length > 1 ? "s" : ""} × {addPackCodes.length} pack code{addPackCodes.length > 1 ? "s" : ""}{addVariants.length > 0 ? ` × ${addVariants.length} variant${addVariants.length > 1 ? "s" : ""}` : ""} = <strong>{addColorwayIds.length * addPackCodes.length * (addVariants.length || 1)} variations</strong>
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" disabled={saving || addColorwayIds.length === 0 || addPackCodes.length === 0} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Variations
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
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
                  {packCodes.map((pc) => <SelectItem key={pc} value={pc}>{pc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Variant */}
            <div className="space-y-2">
              <Label className="text-xs">Variant</Label>
              <Select value={form.variant || "none"} onValueChange={(v) => setForm((f) => ({ ...f, variant: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select variant…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {variants.map((vt) => <SelectItem key={vt} value={vt}>{vt}</SelectItem>)}
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

function generateSequence(variations) {
  const nums = variations
    .map((v) => parseInt(v.sequence || "0", 10))
    .filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return String(max + 1).padStart(4, "0");
}