import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Download, Pencil, Trash2, LayoutGrid, List, Search } from "lucide-react";
import { PANTONE_TCX, colorToHex, tcxDisplayName } from "../lib/pantone-tcx";
import DataTable from "@/components/DataTable";
import ViewSelector from "@/components/ViewSelector";

export default function ColorLibrary({ hideTitle = false }) {
  const [technicalColors, setTechnicalColors] = useState([]);
  const [commercialColors, setCommercialColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [showTechDialog, setShowTechDialog] = useState(false);
  const [showCommDialog, setShowCommDialog] = useState(false);
  const [editingTech, setEditingTech] = useState(null);
  const [editingComm, setEditingComm] = useState(null);

  const [techForm, setTechForm] = useState({ code: "", name: "", hex: "", rgb: "", cmyk: "" });
  const [commForm, setCommForm] = useState({ sub_type: "Solid", code: "", main_technical_color_id: "", linked_technical_color_ids: [], color_name: "" });
  const [techSearch, setTechSearch] = useState("");
  const [commSearch, setCommSearch] = useState("");
  const [linkedTechSearch, setLinkedTechSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [techView, setTechView] = useState("table");
  const [commView, setCommView] = useState("table");
  const [visibleTechColumns, setVisibleTechColumns] = useState(null);
  const [visibleCommColumns, setVisibleCommColumns] = useState(null);

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
    setTechForm({ code: "", name: "", hex: "", rgb: "", cmyk: "" });
    setShowTechDialog(true);
  };
  const openEditTech = (c) => {
    setEditingTech(c);
    setTechForm({ code: c.code, name: c.name, hex: c.hex || "", rgb: c.rgb || "", cmyk: c.cmyk || "" });
    setShowTechDialog(true);
  };

  const saveTech = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...techForm };
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

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  const hexToRgb = (hex) => {
    if (!hex || hex.length !== 7) return "";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? "" : `${r},${g},${b}`;
  };

  const rgbToHex = (rgb) => {
    if (!rgb) return "";
    const parts = rgb.split(",").map(p => parseInt(p.trim()));
    if (parts.length !== 3 || parts.some(isNaN)) return "";
    return "#" + parts.map(p => Math.max(0, Math.min(255, p)).toString(16).padStart(2, "0")).join("").toUpperCase();
  };

  const techColumns = [
    {
      id: "color",
      label: "Color",
      width: 80,
      render: (c) => <div className="w-8 h-8 rounded-md border border-border" style={{ backgroundColor: colorToHex(c) }} />,
    },
    {
      id: "code",
      label: "Code",
      width: 120,
      sortKey: (c) => c.code || "",
      render: (c) => <span className="font-mono text-xs">{c.code}</span>,
    },
    {
      id: "name",
      label: "Name",
      width: 150,
      sortKey: (c) => c.name || "",
      render: (c) => <span className="font-medium">{c.name}</span>,
    },
    {
      id: "hex",
      label: "Hex",
      width: 120,
      sortKey: (c) => c.hex || "",
      render: (c) => <span className="font-mono text-xs text-muted-foreground">{colorToHex(c)}</span>,
    },
    {
      id: "rgb",
      label: "RGB",
      width: 140,
      sortKey: (c) => c.rgb || "",
      render: (c) => <span className="font-mono text-xs text-muted-foreground">{c.rgb || "—"}</span>,
    },
    {
      id: "cmyk",
      label: "CMYK",
      width: 140,
      sortKey: (c) => c.cmyk || "",
      render: (c) => <span className="font-mono text-xs text-muted-foreground">{c.cmyk || "—"}</span>,
    },
    {
      id: "actions",
      label: "",
      width: 80,
      render: (c) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTech(c)}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTech(c)}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      ),
    },
  ];

  const commColumns = [
    {
      id: "color",
      label: "Color",
      width: 80,
      render: (c) => {
        const tech = technicalColors.find((t) => t.id === c.main_technical_color_id);
        const hex = tech ? colorToHex(tech) : "#cccccc";
        return <div className="w-8 h-8 rounded-md border border-border" style={{ backgroundColor: hex }} />;
      },
    },
    {
      id: "code",
      label: "Code",
      width: 120,
      sortKey: (c) => c.code || "",
      render: (c) => <span className="font-mono text-xs">{c.code}</span>,
    },
    {
      id: "name",
      label: "Name",
      width: 150,
      sortKey: (c) => c.color_name || "",
      render: (c) => <span className="font-medium">{c.color_name}</span>,
    },
    {
      id: "type",
      label: "Type",
      width: 100,
      sortKey: (c) => c.sub_type || "",
      render: (c) => <Badge variant="secondary" className="text-[10px]">{c.sub_type}</Badge>,
    },
    {
      id: "technical_color",
      label: "Technical Color",
      width: 180,
      sortKey: (c) => {
        const tech = technicalColors.find((t) => t.id === c.main_technical_color_id);
        return tech?.code || "";
      },
      render: (c) => {
        const tech = technicalColors.find((t) => t.id === c.main_technical_color_id);
        return <span className="text-xs text-muted-foreground">{tech ? tcxDisplayName(tech) : "—"}</span>;
      },
    },
    {
      id: "actions",
      label: "",
      width: 80,
      render: (c) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditComm(c)}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteComm(c)}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {!hideTitle && (
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Color Library</h1>
          <p className="text-muted-foreground mt-1">Manage technical and commercial colors</p>
        </div>
      )}

      <Tabs defaultValue="technical">
        <TabsList>
          <TabsTrigger value="technical">Technical Colors ({technicalColors.length})</TabsTrigger>
          <TabsTrigger value="commercial">Commercial Colors ({commercialColors.length})</TabsTrigger>
        </TabsList>

        {/* TECHNICAL COLORS */}
        <TabsContent value="technical" className="mt-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={techSearch}
                onChange={(e) => setTechSearch(e.target.value)}
                placeholder="Search colors…"
                className="pl-8 h-9 text-xs"
              />
            </div>
            <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setTechView("gallery")}
                className={`px-2.5 py-1.5 transition-colors ${techView === "gallery" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                title="Gallery view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTechView("table")}
                className={`px-2.5 py-1.5 transition-colors ${techView === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                title="Table view"
              >
                <List className="w-4 h-4" />
                </button>
                </div>
                {technicalColors.length > 0 && <ViewSelector pageKey="technical_colors" allColumns={techColumns} onColumnsChange={setVisibleTechColumns} />}
                <Button onClick={openNewTech} className="gap-2 shrink-0"><Plus className="w-4 h-4" />Add Technical Color</Button>
          </div>
          {techView === "table" ? (
           <DataTable
             columns={visibleTechColumns || techColumns}
              rows={technicalColors.filter((c) =>
                !techSearch ||
                c.code?.toLowerCase().includes(techSearch.toLowerCase()) ||
                c.name?.toLowerCase().includes(techSearch.toLowerCase()) ||
                colorToHex(c).toLowerCase().includes(techSearch.toLowerCase())
              )}
              fixedColumns={["color"]}
              hideColumnToggle
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {technicalColors.filter((c) =>
                !techSearch ||
                c.code?.toLowerCase().includes(techSearch.toLowerCase()) ||
                c.name?.toLowerCase().includes(techSearch.toLowerCase()) ||
                colorToHex(c).toLowerCase().includes(techSearch.toLowerCase())
              ).map((c) => (
                <div key={c.id} className="rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow group/card bg-card">
                  <div className="aspect-square flex items-center justify-center" style={{ backgroundColor: colorToHex(c) }} />
                  <div className="p-3 space-y-1">
                    <p className="text-xs font-mono font-medium truncate">{c.code}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                    <p className="text-xs font-mono text-muted-foreground truncate">{colorToHex(c)}</p>
                  </div>
                  <div className="px-3 pb-3 flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-1" onClick={() => openEditTech(c)}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-1 text-destructive" onClick={() => deleteTech(c)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* COMMERCIAL COLORS */}
        <TabsContent value="commercial" className="mt-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={commSearch}
                onChange={(e) => setCommSearch(e.target.value)}
                placeholder="Search colors…"
                className="pl-8 h-9 text-xs"
              />
            </div>
            <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setCommView("gallery")}
                className={`px-2.5 py-1.5 transition-colors ${commView === "gallery" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                title="Gallery view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCommView("table")}
                className={`px-2.5 py-1.5 transition-colors ${commView === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                title="Table view"
              >
                <List className="w-4 h-4" />
                </button>
                </div>
                {commercialColors.length > 0 && <ViewSelector pageKey="commercial_colors" allColumns={commColumns} onColumnsChange={setVisibleCommColumns} />}
                <Button onClick={openNewComm} className="gap-2 shrink-0"><Plus className="w-4 h-4" />Add Commercial Color</Button>
          </div>
          {commView === "gallery" ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {commercialColors.filter((c) =>
                !commSearch ||
                c.code?.toLowerCase().includes(commSearch.toLowerCase()) ||
                c.color_name?.toLowerCase().includes(commSearch.toLowerCase()) ||
                c.sub_type?.toLowerCase().includes(commSearch.toLowerCase())
              ).map((c) => {
                const tech = technicalColors.find((t) => t.id === c.main_technical_color_id);
                const hex = tech ? colorToHex(tech) : "#ccc";
                return (
                  <div key={c.id} className="rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow group/card bg-card">
                    <div className="aspect-square flex items-center justify-center" style={{ backgroundColor: hex }} />
                    <div className="p-3 space-y-1">
                      <p className="text-xs font-mono font-medium truncate">{c.code}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.color_name}</p>
                      <Badge variant="secondary" className="text-[10px] w-full text-center justify-center">{c.sub_type}</Badge>
                    </div>
                    <div className="px-3 pb-3 flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6 flex-1" onClick={() => openEditComm(c)}><Pencil className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 flex-1 text-destructive" onClick={() => deleteComm(c)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
           <DataTable
             columns={visibleCommColumns || commColumns}
              rows={commercialColors.filter((c) =>
                !commSearch ||
                c.code?.toLowerCase().includes(commSearch.toLowerCase()) ||
                c.color_name?.toLowerCase().includes(commSearch.toLowerCase()) ||
                c.sub_type?.toLowerCase().includes(commSearch.toLowerCase())
              )}
              fixedColumns={["color"]}
              hideColumnToggle
            />
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
                <input type="color" value={techForm.hex || "#cccccc"} onChange={(e) => { const hex = e.target.value; const rgb = hexToRgb(hex); setTechForm((f) => ({ ...f, hex, rgb })); }} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <Input value={techForm.hex} onChange={(e) => { const hex = e.target.value; const rgb = hexToRgb(hex); setTechForm((f) => ({ ...f, hex, rgb })); }} placeholder="#000000" className="flex-1" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RGB (optional)</Label>
              <Input value={techForm.rgb} onChange={(e) => { const rgb = e.target.value; const hex = rgbToHex(rgb); setTechForm((f) => ({ ...f, rgb, ...(hex && { hex }) })); }} placeholder="e.g. 244,245,240" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CMYK (optional)</Label>
              <Input value={techForm.cmyk} onChange={(e) => setTechForm((f) => ({ ...f, cmyk: e.target.value }))} placeholder="e.g. 0,1,3,4" />
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