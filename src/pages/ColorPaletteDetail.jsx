import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Loader2, Trash2, X } from "lucide-react";
import { colorToHex, tcxDisplayName } from "../lib/pantone-tcx";

export default function ColorPaletteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [palette, setPalette] = useState(null);
  const [paletteColors, setPaletteColors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [techColors, setTechColors] = useState([]);
  const [commColors, setCommColors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addTab, setAddTab] = useState("technical"); // "technical" | "commercial"
  const [colorSearch, setColorSearch] = useState("");

  // New technical color form
  const [showNewTech, setShowNewTech] = useState(false);
  const [techForm, setTechForm] = useState({ code: "", name: "", hex: "#cccccc" });
  // New commercial color form
  const [showNewComm, setShowNewComm] = useState(false);
  const [commForm, setCommForm] = useState({ sub_type: "Solid", code: "", main_technical_color_id: "", color_name: "" });
  const [commTechSearch, setCommTechSearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [groupByType, setGroupByType] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    const [pal, pc, proj, tc, cc] = await Promise.all([
      base44.entities.ColorPalette.filter({ id }),
      base44.entities.ColorPaletteColor.filter({ palette_id: id }),
      base44.entities.Project.list("name", 200),
      base44.entities.TechnicalColor.list("code", 2000),
      base44.entities.CommercialColor.list("code", 2000),
    ]);
    setPalette(pal[0] || null);
    setPaletteColors(pc);
    setProjects(proj);
    setTechColors(tc);
    setCommColors(cc);
    setLoading(false);
  };

  const linkedColorIds = new Set(paletteColors.map((pc) => `${pc.color_type}:${pc.color_id}`));

  const handleAddExisting = async (colorType, colorId) => {
    const key = `${colorType}:${colorId}`;
    if (linkedColorIds.has(key)) return;
    const created = await base44.entities.ColorPaletteColor.create({ palette_id: id, color_type: colorType, color_id: colorId });
    setPaletteColors((prev) => [...prev, created]);
  };

  const handleRemove = async (entryId) => {
    await base44.entities.ColorPaletteColor.delete(entryId);
    setPaletteColors((prev) => prev.filter((pc) => pc.id !== entryId));
  };

  const handleSavePaletteName = async (e) => {
    e.preventDefault();
    await base44.entities.ColorPalette.update(id, { name: palette.name, project_id: palette.project_id });
  };

  const handleCreateTech = async (e) => {
    e.preventDefault();
    setSaving(true);
    const created = await base44.entities.TechnicalColor.create(techForm);
    setTechColors((prev) => [...prev, created]);
    await handleAddExisting("technical", created.id);
    setShowNewTech(false);
    setTechForm({ code: "", name: "", hex: "#cccccc" });
    setSaving(false);
  };

  const handleCreateComm = async (e) => {
    e.preventDefault();
    setSaving(true);
    const created = await base44.entities.CommercialColor.create(commForm);
    setCommColors((prev) => [...prev, created]);
    await handleAddExisting("commercial", created.id);
    setShowNewComm(false);
    setCommForm({ sub_type: "Solid", code: "", main_technical_color_id: "", color_name: "" });
    setSaving(false);
  };

  const handleCommTechSelect = (techId) => {
    const t = techColors.find((c) => c.id === techId);
    setCommForm((f) => ({ ...f, main_technical_color_id: techId, color_name: f.color_name || t?.name || "" }));
    setCommTechSearch("");
  };

  const getColorHex = (entry) => {
    if (entry.color_type === "technical") {
      const t = techColors.find((c) => c.id === entry.color_id);
      return t ? colorToHex(t) : "#ccc";
    }
    const c = commColors.find((c) => c.id === entry.color_id);
    if (!c) return "#ccc";
    const t = techColors.find((t) => t.id === c.main_technical_color_id);
    return t ? colorToHex(t) : "#ccc";
  };

  const getColorLabel = (entry) => {
    if (entry.color_type === "technical") {
      const t = techColors.find((c) => c.id === entry.color_id);
      return t ? tcxDisplayName(t) : "Unknown";
    }
    const c = commColors.find((c) => c.id === entry.color_id);
    return c ? `${c.code} - ${c.color_name}` : "Unknown";
  };

  const filteredTech = techColors.filter((t) => {
    const key = `technical:${t.id}`;
    if (linkedColorIds.has(key)) return false;
    return !colorSearch || t.code?.toLowerCase().includes(colorSearch.toLowerCase()) || t.name?.toLowerCase().includes(colorSearch.toLowerCase());
  });
  const filteredComm = commColors.filter((c) => {
    const key = `commercial:${c.id}`;
    if (linkedColorIds.has(key)) return false;
    return !colorSearch || c.code?.toLowerCase().includes(colorSearch.toLowerCase()) || c.color_name?.toLowerCase().includes(colorSearch.toLowerCase());
  });

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!palette) return <div className="text-center py-20 text-muted-foreground">Palette not found</div>;

  const project = projects.find((p) => p.id === palette.project_id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/color-palettes")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{palette.name}</h1>
          {project && <p className="text-sm text-muted-foreground mt-0.5">{project.name}</p>}
        </div>
        <Button onClick={() => { setShowAddDialog(true); setColorSearch(""); }} className="gap-2">
          <Plus className="w-4 h-4" /> Add Color
        </Button>
      </div>

      {/* Palette settings */}
      <form onSubmit={handleSavePaletteName} className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row gap-3 items-end">
        <div className="space-y-1.5 flex-1">
          <Label className="text-xs">Palette Name</Label>
          <Input value={palette.name} onChange={(e) => setPalette((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5 flex-1">
          <Label className="text-xs">Project</Label>
          <Select value={palette.project_id || ""} onValueChange={(v) => {
            const proj = projects.find((p) => p.id === v);
            setPalette((p) => ({ ...p, project_id: v, name: proj?.name || p.name }));
          }}>
            <SelectTrigger><SelectValue placeholder="No project linked" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="outline" size="sm">Save</Button>
      </form>

      {/* Color strip preview */}
      {paletteColors.length > 0 && (
        <div className="h-10 rounded-xl overflow-hidden flex border border-border">
          {paletteColors.map((entry) => (
            <div key={entry.id} className="flex-1" style={{ backgroundColor: getColorHex(entry) }} title={getColorLabel(entry)} />
          ))}
        </div>
      )}

      {/* Color swatches */}
      {paletteColors.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => setGroupByType((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              groupByType ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Group by Type
          </button>
        </div>
      )}
      {paletteColors.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No colors yet. Add technical or commercial colors to this palette.</p>
        </div>
      ) : groupByType ? (
        ["technical", "commercial"].map((type) => {
          const entries = paletteColors.filter((e) => e.color_type === type);
          if (entries.length === 0) return null;
          return (
            <div key={type} className="space-y-3">
              <h3 className="text-sm font-semibold capitalize text-muted-foreground">{type === "technical" ? "Technical Colors" : "Commercial Colors"}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {entries.map((entry) => {
                  const hex = getColorHex(entry);
                  const label = getColorLabel(entry);
                  return (
                    <div key={entry.id} className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
                      <div className="h-16 w-full" style={{ backgroundColor: hex }} />
                      <div className="p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{label}</p>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-1">{entry.color_type}</Badge>
                        </div>
                        <button onClick={() => handleRemove(entry.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {paletteColors.map((entry) => {
            const hex = getColorHex(entry);
            const label = getColorLabel(entry);
            return (
              <div key={entry.id} className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
                <div className="h-16 w-full" style={{ backgroundColor: hex }} />
                <div className="p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{label}</p>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-1">{entry.color_type}</Badge>
                  </div>
                  <button onClick={() => handleRemove(entry.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Color Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); setShowNewTech(false); setShowNewComm(false); }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>Add Color to Palette</DialogTitle></DialogHeader>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {["technical", "commercial"].map((tab) => (
              <button key={tab} type="button" onClick={() => { setAddTab(tab); setColorSearch(""); setShowNewTech(false); setShowNewComm(false); }}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${addTab === tab ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {tab === "technical" ? "Technical Colors" : "Commercial Colors"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {/* Search */}
            {!showNewTech && !showNewComm && (
              <Input value={colorSearch} onChange={(e) => setColorSearch(e.target.value)} placeholder="Search colors…" className="h-8 text-xs" />
            )}

            {addTab === "technical" && !showNewTech && (
              <>
                <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setShowNewTech(true)}>
                  <Plus className="w-3.5 h-3.5" /> Create New Technical Color
                </Button>
                <div className="space-y-0.5">
                  {filteredTech.map((t) => (
                    <button key={t.id} type="button" onClick={() => { handleAddExisting("technical", t.id); setShowAddDialog(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted rounded-lg text-left transition-colors">
                      <div className="w-7 h-7 rounded-md border border-border shrink-0" style={{ backgroundColor: colorToHex(t) }} />
                      <span className="text-xs">{tcxDisplayName(t)}</span>
                    </button>
                  ))}
                  {filteredTech.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No colors found</p>}
                </div>
              </>
            )}

            {addTab === "technical" && showNewTech && (
              <form onSubmit={handleCreateTech} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Pantone Code</Label><Input value={techForm.code} onChange={(e) => setTechForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. 19-4150 TCX" required /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Color Name</Label><Input value={techForm.name} onChange={(e) => setTechForm((f) => ({ ...f, name: e.target.value }))} required /></div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">HEX</Label>
                  <div className="flex gap-2">
                    <input type="color" value={techForm.hex} onChange={(e) => setTechForm((f) => ({ ...f, hex: e.target.value }))} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                    <Input value={techForm.hex} onChange={(e) => setTechForm((f) => ({ ...f, hex: e.target.value }))} className="flex-1" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewTech(false)}>Back</Button>
                  <Button type="submit" size="sm" disabled={saving} className="gap-1.5">{saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Create & Add</Button>
                </div>
              </form>
            )}

            {addTab === "commercial" && !showNewComm && (
              <>
                <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setShowNewComm(true)}>
                  <Plus className="w-3.5 h-3.5" /> Create New Commercial Color
                </Button>
                <div className="space-y-0.5">
                  {filteredComm.map((c) => {
                    const t = techColors.find((t) => t.id === c.main_technical_color_id);
                    const hex = t ? colorToHex(t) : "#ccc";
                    return (
                      <button key={c.id} type="button" onClick={() => { handleAddExisting("commercial", c.id); setShowAddDialog(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted rounded-lg text-left transition-colors">
                        <div className="w-7 h-7 rounded-md border border-border shrink-0" style={{ backgroundColor: hex }} />
                        <span className="text-xs flex-1">{c.code} - {c.color_name}</span>
                        <Badge variant="outline" className="text-[10px]">{c.sub_type}</Badge>
                      </button>
                    );
                  })}
                  {filteredComm.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No colors found</p>}
                </div>
              </>
            )}

            {addTab === "commercial" && showNewComm && (
              <form onSubmit={handleCreateComm} className="space-y-3">
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
                      <button type="button" onClick={() => { setCommForm(f => ({ ...f, main_technical_color_id: "" })); setCommTechSearch(""); }} className="text-xs text-muted-foreground hover:text-foreground ml-auto">✕</button>
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="p-1.5 border-b border-border">
                        <Input value={commTechSearch} onChange={(e) => setCommTechSearch(e.target.value)} placeholder="Search by code or name…" className="h-7 text-xs" />
                      </div>
                      <div className="max-h-32 overflow-y-auto">
                        {techColors.filter(t => !commTechSearch || t.code?.toLowerCase().includes(commTechSearch.toLowerCase()) || t.name?.toLowerCase().includes(commTechSearch.toLowerCase())).map((t) => (
                          <button key={t.id} type="button" onClick={() => handleCommTechSelect(t.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left transition-colors">
                            <div className="w-4 h-4 rounded-sm border border-border shrink-0" style={{ backgroundColor: colorToHex(t) }} />
                            <span className="text-xs">{tcxDisplayName(t)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Color Name</Label><Input value={commForm.color_name} onChange={(e) => setCommForm((f) => ({ ...f, color_name: e.target.value }))} placeholder="Inherits from technical color" required /></div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewComm(false)}>Back</Button>
                  <Button type="submit" size="sm" disabled={saving} className="gap-1.5">{saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Create & Add</Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}