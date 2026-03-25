import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Loader2, Download, Pencil, Trash2, LayoutGrid, List } from "lucide-react";
import { PANTONE_TCX, colorToHex, tcxDisplayName } from "../lib/pantone-tcx";

export default function ColorLibrary() {
  const [technicalColors, setTechnicalColors] = useState([]);
  const [commercialColors, setCommercialColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");

  const [showTechDialog, setShowTechDialog] = useState(false);
  const [showCommDialog, setShowCommDialog] = useState(false);
  const [editingTech, setEditingTech] = useState(null);
  const [editingComm, setEditingComm] = useState(null);

  const [techForm, setTechForm] = useState({ code: "", name: "", hex: "", rgb_r: "", rgb_g: "", rgb_b: "" });
  const [commForm, setCommForm] = useState({ sub_type: "Solid", code: "", main_technical_color_id: "", linked_technical_color_ids: [], color_name: "" });
  const [techSearch, setTechSearch] = useState("");
  const [linkedTechSearch, setLinkedTechSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [tech, comm] = await Promise.all([
      base44.entities.TechnicalColor.list("code", 2000),
      base44.entities.CommercialColor.list("code", 2000),
    ]);
    setTechnicalColors(tech);
    setCommercialColors(comm);
    setLoading(false);
  };

  const handleSeedPantone = async () => {
    setSeeding(true);
    const existing = new Set(technicalColors.map((c) => c.code));
    const toSeed = PANTONE_TCX.filter((c) => !existing.has(c.code));
    if (toSeed.length > 0) {
      const created = await base44.entities.TechnicalColor.bulkCreate(toSeed);
      setTechnicalColors((prev) => [...prev, ...created]);
    }
    setSeeding(false);
  };

  const openNewTech = () => {
    setEditingTech(null);
    setTechForm({ code: "", name: "", hex: "", rgb_r: "", rgb_g: "", rgb_b: "" });
    setShowTechDialog(true);
  };
  const openEditTech = (c) => {
    setEditingTech(c);
    setTechForm({ code: c.code, name: c.name, hex: c.hex || "", rgb_r: c.rgb_r || "", rgb_g: c.rgb_g || "", rgb_b: c.rgb_b || "" });
    setShowTechDialog(true);
  };

  const saveTech = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...techForm, rgb_r: Number(techForm.rgb_r) || 0, rgb_g: Number(techForm.rgb_g) || 0, rgb_b: Number(techForm.rgb_b) || 0 };
    if (editingTech) {
      const updated = await base44.entities.TechnicalColor.update(editingTech.id, data);
      setTechnicalColors((prev) => prev.map((c) => (c.id === editingTech.id ? { ...c, ...data } : c)));
    } else {
      const created = await base44.entities.TechnicalColor.create(data);
      setTechnicalColors((prev) => [...prev, created]);
    }
    setShowTechDialog(false);
    setSaving(false);
  };

  const deleteTech = async (c) => {
    await base44.entities.TechnicalColor.delete(c.id);
    setTechnicalColors((prev) => prev.filter((t) => t.id !== c.id));
  };

  const openNewComm = () => {
    setEditingComm(null);
    setCommForm({ sub_type: "Solid", code: "", main_technical_color_id: "", linked_technical_color_ids: [], color_name: "" });
    setTechSearch("");
    setLinkedTechSearch("");
    setShowCommDialog(true);
  };
  const openEditComm = (c) => {
    setEditingComm(c);
    setCommForm({ sub_type: c.sub_type, code: c.code, main_technical_color_id: c.main_technical_color_id || "", linked_technical_color_ids: c.linked_technical_color_ids || (c.main_technical_color_id ? [c.main_technical_color_id] : []), color_name: c.color_name });
    setTechSearch("");
    setLinkedTechSearch("");
    setShowCommDialog(true);
  };

  const handleTechSelectForComm = (techId) => {
    const tech = technicalColors.find((t) => t.id === techId);
    setCommForm((f) => ({
      ...f,
      main_technical_color_id: techId,
      color_name: f.color_name || tech?.name || "",
      linked_technical_color_ids: f.linked_technical_color_ids.includes(techId)
        ? f.linked_technical_color_ids
        : [...f.linked_technical_color_ids, techId],
    }));
  };

  const saveComm = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editingComm) {
      await base44.entities.CommercialColor.update(editingComm.id, commForm);
      setCommercialColors((prev) => prev.map((c) => (c.id === editingComm.id ? { ...c, ...commForm } : c)));
    } else {
      const created = await base44.entities.CommercialColor.create(commForm);
      setCommercialColors((prev) => [...prev, created]);
    }
    setShowCommDialog(false);
    setSaving(false);
  };

  const deleteComm = async (c) => {
    await base44.entities.CommercialColor.delete(c.id);
    setCommercialColors((prev) => prev.filter((cc) => cc.id !== c.id));
  };

  const filteredTech = technicalColors.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.code?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q) || c.hex?.toLowerCase().includes(q);
  });
  const filteredComm = commercialColors.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const tech = technicalColors.find(t => t.id === c.main_technical_color_id);
    return c.code?.toLowerCase().includes(q) || c.color_name?.toLowerCase().includes(q) || c.sub_type?.toLowerCase().includes(q) || tech?.code?.toLowerCase().includes(q) || tech?.name?.toLowerCase().includes(q);
  });

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Color Library</h1>
        <p className="text-muted-foreground mt-1">Manage technical and commercial colors</p>
      </div>

      <Tabs defaultValue="technical">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="technical">Technical Colors ({technicalColors.length})</TabsTrigger>
            <TabsTrigger value="commercial">Commercial Colors ({commercialColors.length})</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search colors…" className="pl-10" />
            </div>
            <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
              <button type="button" onClick={() => setView("grid")} className={`px-2.5 py-2 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Gallery view"><LayoutGrid className="w-4 h-4" /></button>
              <button type="button" onClick={() => setView("list")} className={`px-2.5 py-2 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="List view"><List className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* TECHNICAL COLORS */}
        <TabsContent value="technical" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Button onClick={openNewTech} className="gap-2"><Plus className="w-4 h-4" />Add Technical Color</Button>
            <Button variant="outline" onClick={handleSeedPantone} disabled={seeding} className="gap-2">
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Seed Pantone TCX
            </Button>
          </div>

          {view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredTech.map((c) => {
                const hex = colorToHex(c);
                return (
                  <div key={c.id} className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
                    <div className="h-16 w-full" style={{ backgroundColor: hex }} />
                    <div className="p-3">
                      <p className="text-xs font-semibold truncate">{c.code}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">{hex}</p>
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditTech(c)}><Pencil className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteTech(c)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Color</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Hex</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTech.map((c) => {
                    const hex = colorToHex(c);
                    return (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3"><div className="w-8 h-8 rounded-md border border-border" style={{ backgroundColor: hex }} /></td>
                        <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{hex}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTech(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTech(c)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* COMMERCIAL COLORS */
        <TabsContent value="commercial" className="mt-4 space-y-4">
          <Button onClick={openNewComm} className="gap-2"><Plus className="w-4 h-4" />Add Commercial Color</Button>

          {view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredComm.map((c) => {
                const tech = technicalColors.find((t) => t.id === c.main_technical_color_id);
                const hex = tech ? colorToHex(tech) : "#cccccc";
                return (
                  <div key={c.id} className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
                    <div className="h-16 w-full" style={{ backgroundColor: hex }} />
                    <div className="p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{c.sub_type}</Badge>
                      </div>
                      <p className="text-xs font-semibold truncate">{c.code}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.color_name}</p>
                      {tech && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{tcxDisplayName(tech)}</p>}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditComm(c)}><Pencil className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteComm(c)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Color</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Technical Color</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComm.map((c) => {
                    const tech = technicalColors.find((t) => t.id === c.main_technical_color_id);
                    const hex = tech ? colorToHex(tech) : "#cccccc";
                    return (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3"><div className="w-8 h-8 rounded-md border border-border" style={{ backgroundColor: hex }} /></td>
                        <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                        <td className="px-4 py-3 font-medium">{c.color_name}</td>
                        <td className="px-4 py-3"><Badge variant="secondary" className="text-[10px]">{c.sub_type}</Badge></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{tech ? tcxDisplayName(tech) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditComm(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteComm(c)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Technical Color Dialog */}
      <Dialog open={showTechDialog} onOpenChange={setShowTechDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingTech ? "Edit Technical Color" : "New Technical Color"}</DialogTitle></DialogHeader>
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
              <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Commercial Color Dialog */}
      <Dialog open={showCommDialog} onOpenChange={setShowCommDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingComm ? "Edit Commercial Color" : "New Commercial Color"}</DialogTitle></DialogHeader>
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
                  {(() => { const t = technicalColors.find(t => t.id === commForm.main_technical_color_id); return t ? (<><div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: colorToHex(t) }} /><span className="text-xs flex-1">{tcxDisplayName(t)}</span></>) : null; })()}
                  <button type="button" onClick={() => { setCommForm(f => ({ ...f, main_technical_color_id: "" })); setTechSearch(""); }} className="text-xs text-muted-foreground hover:text-foreground ml-auto">✕</button>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <Input value={techSearch} onChange={(e) => setTechSearch(e.target.value)} placeholder="Search by code or name…" className="h-8 text-xs" />
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    {technicalColors
                      .filter(t => !techSearch || t.code?.toLowerCase().includes(techSearch.toLowerCase()) || t.name?.toLowerCase().includes(techSearch.toLowerCase()))
                      .map((t) => (
                        <button key={t.id} type="button" onClick={() => handleTechSelectForComm(t.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted text-left transition-colors">
                          <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: colorToHex(t) }} />
                          <span className="text-xs">{tcxDisplayName(t)}</span>
                        </button>
                      ))}
                    {technicalColors.filter(t => !techSearch || t.code?.toLowerCase().includes(techSearch.toLowerCase()) || t.name?.toLowerCase().includes(techSearch.toLowerCase())).length === 0 && (
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

            {/* Linked Technical Colors multiselect */}
            <div className="space-y-1.5">
              <Label className="text-xs">Linked Technical Colors</Label>
              {commForm.linked_technical_color_ids.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {commForm.linked_technical_color_ids.map((id) => {
                    const t = technicalColors.find((c) => c.id === id);
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
                  {technicalColors
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
                  {technicalColors.filter((t) => !commForm.linked_technical_color_ids.includes(t.id) && (!linkedTechSearch || t.code?.toLowerCase().includes(linkedTechSearch.toLowerCase()) || t.name?.toLowerCase().includes(linkedTechSearch.toLowerCase()))).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">No more colors to add</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCommDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}