import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, Palette, FolderOpen, Pencil, Trash2, X } from "lucide-react";
import { colorToHex, tcxDisplayName } from "../lib/pantone-tcx";
import ColorLibrary from "./ColorLibrary";

export default function ColorPalettes() {
  const [mainTab, setMainTab] = useState("palettes");
  const [palettes, setPalettes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [paletteColors, setPaletteColors] = useState([]);
  const [techColors, setTechColors] = useState([]);
  const [commColors, setCommColors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPaletteId, setSelectedPaletteId] = useState(null);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingPalette, setEditingPalette] = useState(null);
  const [form, setForm] = useState({ name: "", project_id: "" });
  const [saving, setSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorSearch, setColorSearch] = useState("");
  const [colorTab, setColorTab] = useState("technical");
  const [selectedColorIds, setSelectedColorIds] = useState(new Set());
  const [addingColors, setAddingColors] = useState(false);
  const [showTechDialog, setShowTechDialog] = useState(false);
  const [showCommDialog, setShowCommDialog] = useState(false);
  const [techForm, setTechForm] = useState({ code: "", name: "", hex: "", rgb_r: "", rgb_g: "", rgb_b: "" });
  const [commForm, setCommForm] = useState({ sub_type: "Solid", code: "", main_technical_color_id: "", linked_technical_color_ids: [], color_name: "" });
  const [techSearch, setTechSearch] = useState("");
  const [linkedTechSearch, setLinkedTechSearch] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [pal, proj, pc, tc, cc] = await Promise.all([
      base44.entities.ColorPalette.list("-created_date", 200),
      base44.entities.Project.list("name", 200),
      base44.entities.ColorPaletteColor.list("-created_date", 2000),
      base44.entities.TechnicalColor.list("code", 2000),
      base44.entities.CommercialColor.list("code", 2000),
    ]);
    setPalettes(pal);
    setProjects(proj);
    setPaletteColors(pc);
    setTechColors(tc);
    setCommColors(cc);
    setLoading(false);
  };

  const handleProjectChange = (projectId) => {
    const project = projects.find((p) => p.id === projectId);
    setForm((f) => ({ ...f, project_id: projectId, name: project?.name || f.name }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const created = await base44.entities.ColorPalette.create(form);
    setPalettes((prev) => [created, ...prev]);
    setShowDialog(false);
    setForm({ name: "", project_id: "" });
    setSaving(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.ColorPalette.update(editingPalette.id, form);
    setPalettes((prev) => prev.map((p) => p.id === editingPalette.id ? { ...p, ...form } : p));
    setEditingPalette(null);
    setShowDialog(false);
    setSaving(false);
  };

  const openNew = () => {
    setEditingPalette(null);
    setForm({ name: "", project_id: "" });
    setShowDialog(true);
  };

  const openEdit = (palette) => {
    setEditingPalette(palette);
    setForm({ name: palette.name, project_id: palette.project_id || "" });
    setShowDialog(true);
  };

  const handleDelete = async (palette) => {
    await base44.entities.ColorPalette.delete(palette.id);
    setPalettes((prev) => prev.filter((p) => p.id !== palette.id));
    if (selectedPaletteId === palette.id) setSelectedPaletteId(null);
  };

  const openColorPicker = () => {
    setSelectedColorIds(new Set());
    setColorSearch("");
    setColorTab("technical");
    setShowColorPicker(true);
  };

  const openNewTech = () => {
    setTechForm({ code: "", name: "", hex: "", rgb_r: "", rgb_g: "", rgb_b: "" });
    setShowTechDialog(true);
  };

  const openNewComm = () => {
    setCommForm({ sub_type: "Solid", code: "", main_technical_color_id: "", linked_technical_color_ids: [], color_name: "" });
    setTechSearch("");
    setLinkedTechSearch("");
    setShowCommDialog(true);
  };

  const handleTechSelectForComm = (techId) => {
    const tech = techColors.find((t) => t.id === techId);
    setCommForm((f) => ({
      ...f,
      main_technical_color_id: techId,
      color_name: f.color_name || tech?.name || "",
      linked_technical_color_ids: f.linked_technical_color_ids.includes(techId)
        ? f.linked_technical_color_ids
        : [...f.linked_technical_color_ids, techId],
    }));
  };

  const toggleColorSelection = (key) => {
    setSelectedColorIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const saveTech = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...techForm, rgb_r: Number(techForm.rgb_r) || 0, rgb_g: Number(techForm.rgb_g) || 0, rgb_b: Number(techForm.rgb_b) || 0 };
    const created = await base44.entities.TechnicalColor.create(data);
    setTechColors((prev) => [...prev, created]);
    const linked = await base44.entities.ColorPaletteColor.create({ palette_id: selectedPaletteId, color_type: "technical", color_id: created.id });
    setPaletteColors((prev) => [...prev, linked]);
    setShowTechDialog(false);
    setSaving(false);
  };

  const saveComm = async (e) => {
    e.preventDefault();
    setSaving(true);
    const created = await base44.entities.CommercialColor.create(commForm);
    setCommColors((prev) => [...prev, created]);
    const linked = await base44.entities.ColorPaletteColor.create({ palette_id: selectedPaletteId, color_type: "commercial", color_id: created.id });
    setPaletteColors((prev) => [...prev, linked]);
    setShowCommDialog(false);
    setSaving(false);
  };

  const handleAddSelectedColors = async () => {
    setAddingColors(true);
    const toCreate = [];
    for (const key of selectedColorIds) {
      const [type, id] = key.split(":");
      toCreate.push({ palette_id: selectedPaletteId, color_type: type, color_id: id });
    }
    const created = await Promise.all(toCreate.map((d) => base44.entities.ColorPaletteColor.create(d)));
    setPaletteColors((prev) => [...prev, ...created]);
    setAddingColors(false);
    setShowColorPicker(false);
  };

  const handleRemoveColor = async (paletteColorEntry) => {
    await base44.entities.ColorPaletteColor.delete(paletteColorEntry.id);
    setPaletteColors((prev) => prev.filter((pc) => pc.id !== paletteColorEntry.id));
  };

  const getSwatchData = (paletteId) => {
    const entries = paletteColors.filter((pc) => pc.palette_id === paletteId);
    return entries.map((e) => {
      if (e.color_type === "technical") {
        const t = techColors.find((c) => c.id === e.color_id);
        return { id: e.id, hex: t?.hex || "#ccc", name: t?.name || "", code: t?.code || "" };
      } else {
        const c = commColors.find((c) => c.id === e.color_id);
        if (!c) return { id: e.id, hex: "#ccc", name: "", code: "" };
        const t = techColors.find((t) => t.id === c.main_technical_color_id);
        return { id: e.id, hex: t?.hex || "#ccc", name: c.color_name || "", code: c.code || "" };
      }
    });
  };

  const getAvailableColors = () => {
    const linkedIds = new Set(paletteColors.filter((pc) => pc.palette_id === selectedPaletteId).map((pc) => pc.color_id));
    const q = colorSearch.toLowerCase();
    const techFiltered = techColors.filter((t) => !linkedIds.has(t.id) && (!q || t.code?.toLowerCase().includes(q) || t.name?.toLowerCase().includes(q)));
    const commFiltered = commColors.filter((c) => !linkedIds.has(c.id) && (!q || c.code?.toLowerCase().includes(q) || c.color_name?.toLowerCase().includes(q)));
    return { techFiltered, commFiltered };
  };

  const filtered = palettes.filter((p) => {
    if (!paletteSearch) return true;
    const q = paletteSearch.toLowerCase();
    return p.name?.toLowerCase().includes(q);
  });

  const selectedPalette = palettes.find((p) => p.id === selectedPaletteId);
  const selectedSwatches = selectedPaletteId ? getSwatchData(selectedPaletteId) : [];
  const selectedProject = selectedPalette ? projects.find((p) => p.id === selectedPalette.project_id) : null;

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Color Studio</h1>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="palettes">Palettes</TabsTrigger>
          <TabsTrigger value="library">Color Library</TabsTrigger>
        </TabsList>

        <TabsContent value="palettes" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Palettes Panel */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Palettes ({palettes.length})</h3>
                <Button onClick={openNew} size="sm" className="gap-1.5 h-8">
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
              <Input
                placeholder="Search palettes…"
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No palettes yet</p>
                )}
                {filtered.map((p) => {
                  const swatches = getSwatchData(p.id);
                  const project = projects.find((pr) => pr.id === p.project_id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPaletteId(p.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPaletteId === p.id
                          ? "bg-primary/10 border-primary"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="h-6 rounded-md overflow-hidden flex mb-2">
                        {swatches.length === 0 ? (
                          <div className="w-full bg-muted" />
                        ) : (
                          swatches.slice(0, 10).map((s, i) => (
                            <div key={i} className="flex-1" style={{ backgroundColor: s.hex }} />
                          ))
                        )}
                      </div>
                      <div className={`font-medium text-sm ${selectedPaletteId === p.id ? "text-primary" : ""}`}>{p.name}</div>
                      {project && (
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" />{project.name}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">{swatches.length} color{swatches.length !== 1 ? "s" : ""}</div>
                      <div className="flex gap-1 mt-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(p); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detail Panel */}
            <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 space-y-4">
              {!selectedPalette ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Palette className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Select a palette to see its colors</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{selectedPalette.name}</h3>
                      {selectedProject && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" />{selectedProject.name}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={openColorPicker}>
                      <Plus className="w-3.5 h-3.5" /> Add Color
                    </Button>
                  </div>

                  {/* Color Picker */}
                  {showColorPicker && (() => {
                    const { techFiltered, commFiltered } = getAvailableColors();
                    const items = colorTab === "technical"
                      ? techFiltered.map((t) => ({ key: `technical:${t.id}`, hex: t.hex || "#ccc", label: t.name, sub: t.code }))
                      : commFiltered.map((c) => {
                          const t = techColors.find((t) => t.id === c.main_technical_color_id);
                          return { key: `commercial:${c.id}`, hex: t?.hex || "#ccc", label: c.color_name, sub: c.code };
                        });
                    return (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <div className="flex border-b border-border">
                          <button type="button" onClick={() => setColorTab("technical")}
                            className={`flex-1 py-2 text-xs font-medium transition-colors ${ colorTab === "technical" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground" }`}>
                            Technical ({techFiltered.length})
                          </button>
                          <button type="button" onClick={() => setColorTab("commercial")}
                            className={`flex-1 py-2 text-xs font-medium transition-colors ${ colorTab === "commercial" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground" }`}>
                            Commercial ({commFiltered.length})
                          </button>
                        </div>
                        <div className="p-2 border-b border-border">
                          <Input value={colorSearch} onChange={(e) => setColorSearch(e.target.value)} placeholder="Search colors…" className="h-8 text-xs" autoFocus />
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {items.map((item) => {
                            const selected = selectedColorIds.has(item.key);
                            return (
                              <button key={item.key} type="button"
                                onClick={() => toggleColorSelection(item.key)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${ selected ? "bg-primary/10" : "hover:bg-muted" }`}>
                                <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: item.hex }} />
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-medium block truncate">{item.label}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">{item.sub}</span>
                                </div>
                                {selected && <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0"><div className="w-2 h-2 rounded-full bg-white" /></div>}
                              </button>
                            );
                          })}
                          {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No more colors to add</p>}
                        </div>
                        <div className="p-2 border-t border-border flex gap-2">
                          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => colorTab === "technical" ? openNewTech() : openNewComm()}>
                            <Plus className="w-3 h-3" /> New
                          </Button>
                          <Button size="sm" className="flex-1 text-xs gap-1.5" disabled={selectedColorIds.size === 0 || addingColors} onClick={handleAddSelectedColors}>
                            {addingColors && <Loader2 className="w-3 h-3 animate-spin" />}
                            Add {selectedColorIds.size > 0 ? `(${selectedColorIds.size})` : ""}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowColorPicker(false)}>Cancel</Button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Full color strip */}
                  {selectedSwatches.length > 0 && (
                    <div className="h-12 rounded-lg overflow-hidden flex border border-border">
                      {selectedSwatches.map((s, i) => (
                        <div key={i} className="flex-1" style={{ backgroundColor: s.hex }} title={s.name || s.code} />
                      ))}
                    </div>
                  )}

                  {/* Color cards grid */}
                  {selectedSwatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No colors in this palette yet.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                      {selectedSwatches.map((s, i) => (
                        <div key={i} className="rounded-lg border border-border overflow-hidden group/color relative">
                          <div className="aspect-square" style={{ backgroundColor: s.hex }} />
                          <button
                            type="button"
                            onClick={() => handleRemoveColor({ id: s.id })}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center hidden group-hover/color:flex"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                          <div className="p-2 space-y-0.5">
                            <p className="text-xs font-medium truncate">{s.name || "—"}</p>
                            {s.code && <p className="text-[10px] font-mono text-muted-foreground truncate">{s.code}</p>}
                            <p className="text-[10px] font-mono text-muted-foreground truncate">{s.hex}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="library" className="mt-4">
          <ColorLibrary hideTitle />
        </TabsContent>
      </Tabs>

      {/* Palette Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) { setShowDialog(false); setEditingPalette(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingPalette ? "Edit Palette" : "New Color Palette"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editingPalette ? handleUpdate : handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Project</Label>
              <Select value={form.project_id || "none"} onValueChange={(v) => handleProjectChange(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select a project…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Palette Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Spring Collection Palette" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowDialog(false); setEditingPalette(null); }}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}{editingPalette ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Technical Color Dialog */}
      <Dialog open={showTechDialog} onOpenChange={setShowTechDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Technical Color</DialogTitle></DialogHeader>
          <form onSubmit={saveTech} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Pantone Code</Label><Input value={techForm.code} onChange={(e) => setTechForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. 19-4150 TCX" required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Color Name</Label><Input value={techForm.name} onChange={(e) => setTechForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Classic Blue" required /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">HEX Value</Label>
              <div className="flex gap-2">
                <input type="color" value={techForm.hex || "#cccccc"} onChange={(e) => setTechForm((f) => ({ ...f, hex: e.target.value }))} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <Input value={techForm.hex} onChange={(e) => setTechForm((f) => ({ ...f, hex: e.target.value }))} placeholder="#000000" className="flex-1" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RGB (optional)</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" min={0} max={255} value={techForm.rgb_r} onChange={(e) => setTechForm((f) => ({ ...f, rgb_r: e.target.value }))} placeholder="R" />
                <Input type="number" min={0} max={255} value={techForm.rgb_g} onChange={(e) => setTechForm((f) => ({ ...f, rgb_g: e.target.value }))} placeholder="G" />
                <Input type="number" min={0} max={255} value={techForm.rgb_b} onChange={(e) => setTechForm((f) => ({ ...f, rgb_b: e.target.value }))} placeholder="B" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowTechDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Create & Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Commercial Color Dialog */}
      <Dialog open={showCommDialog} onOpenChange={setShowCommDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Commercial Color</DialogTitle></DialogHeader>
          <form onSubmit={saveComm} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Sub-type</Label>
                <Select value={commForm.sub_type} onValueChange={(v) => setCommForm((f) => ({ ...f, sub_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Solid">Solid</SelectItem><SelectItem value="Combined">Combined</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Commercial Code</Label><Input value={commForm.code} onChange={(e) => setCommForm((f) => ({ ...f, code: e.target.value }))} required /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Main Technical Color</Label>
              {commForm.main_technical_color_id ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
                  {(() => { const t = techColors.find(t => t.id === commForm.main_technical_color_id); return t ? (<><div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: colorToHex(t) }} /><span className="text-xs flex-1">{tcxDisplayName(t)}</span></>) : null; })()}
                  <button type="button" onClick={() => { setCommForm(f => ({ ...f, main_technical_color_id: "" })); setTechSearch(""); }} className="text-xs text-muted-foreground hover:text-foreground ml-auto">✕</button>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <Input value={techSearch} onChange={(e) => setTechSearch(e.target.value)} placeholder="Search by code or name…" className="h-8 text-xs" />
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    {techColors
                      .filter(t => !techSearch || t.code?.toLowerCase().includes(techSearch.toLowerCase()) || t.name?.toLowerCase().includes(techSearch.toLowerCase()))
                      .map((t) => (
                        <button key={t.id} type="button" onClick={() => handleTechSelectForComm(t.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted text-left transition-colors">
                          <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: colorToHex(t) }} />
                          <span className="text-xs">{tcxDisplayName(t)}</span>
                        </button>
                      ))}
                    {techColors.filter(t => !techSearch || t.code?.toLowerCase().includes(techSearch.toLowerCase()) || t.name?.toLowerCase().includes(techSearch.toLowerCase())).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No colors found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Color Name</Label>
              <Input value={commForm.color_name} onChange={(e) => setCommForm((f) => ({ ...f, color_name: e.target.value }))} placeholder="Inherits from technical color, editable" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Linked Technical Colors</Label>
              {commForm.linked_technical_color_ids.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {commForm.linked_technical_color_ids.map((id) => {
                    const t = techColors.find((c) => c.id === id);
                    if (!t) return null;
                    const isMain = id === commForm.main_technical_color_id;
                    return (
                      <div key={id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted border border-border text-xs">
                        <div className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: colorToHex(t) }} />
                        <span>{tcxDisplayName(t)}</span>
                        {isMain && <span className="text-[10px] text-primary font-medium">(main)</span>}
                        <button type="button" onClick={() => setCommForm((f) => ({ ...f, linked_technical_color_ids: f.linked_technical_color_ids.filter((i) => i !== id) }))} className="text-muted-foreground hover:text-destructive ml-0.5">×</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="p-2 border-b border-border">
                  <Input value={linkedTechSearch} onChange={(e) => setLinkedTechSearch(e.target.value)} placeholder="Search to add more technical colors…" className="h-8 text-xs" />
                </div>
                <div className="max-h-36 overflow-y-auto">
                  {techColors
                    .filter((t) => !commForm.linked_technical_color_ids.includes(t.id))
                    .filter((t) => !linkedTechSearch || t.code?.toLowerCase().includes(linkedTechSearch.toLowerCase()) || t.name?.toLowerCase().includes(linkedTechSearch.toLowerCase()))
                    .map((t) => (
                      <button key={t.id} type="button"
                        onClick={() => { setCommForm((f) => ({ ...f, linked_technical_color_ids: [...f.linked_technical_color_ids, t.id] })); setLinkedTechSearch(""); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted text-left transition-colors">
                        <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: colorToHex(t) }} />
                        <span className="text-xs">{tcxDisplayName(t)}</span>
                      </button>
                    ))}
                  {techColors.filter((t) => !commForm.linked_technical_color_ids.includes(t.id) && (!linkedTechSearch || t.code?.toLowerCase().includes(linkedTechSearch.toLowerCase()) || t.name?.toLowerCase().includes(linkedTechSearch.toLowerCase()))).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">No more colors to add</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCommDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Create & Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}