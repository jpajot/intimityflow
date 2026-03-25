import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, Palette, FolderOpen, Search, LayoutGrid, List } from "lucide-react";

export default function ColorPalettes() {
  const [palettes, setPalettes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [paletteColors, setPaletteColors] = useState([]);
  const [techColors, setTechColors] = useState([]);
  const [commColors, setCommColors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");

  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", project_id: "" });
  const [saving, setSaving] = useState(false);

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

  const getSwatches = (paletteId) => {
    const entries = paletteColors.filter((pc) => pc.palette_id === paletteId);
    return entries.map((e) => {
      if (e.color_type === "technical") {
        const t = techColors.find((c) => c.id === e.color_id);
        return t ? (t.hex || "#ccc") : "#ccc";
      } else {
        const c = commColors.find((c) => c.id === e.color_id);
        if (!c) return "#ccc";
        const t = techColors.find((t) => t.id === c.main_technical_color_id);
        return t ? (t.hex || "#ccc") : "#ccc";
      }
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Color Palettes</h1>
          <p className="text-muted-foreground mt-1">Organize colors into project palettes</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Palette
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter palettes…" className="pl-10" />
        </div>
        <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
          <button type="button" onClick={() => setView("grid")} className={`px-2.5 py-2 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Gallery view"><LayoutGrid className="w-4 h-4" /></button>
          <button type="button" onClick={() => setView("list")} className={`px-2.5 py-2 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="List view"><List className="w-4 h-4" /></button>
        </div>
      </div>

      {(() => {
        const filtered = palettes.filter((p) => {
          if (!search) return true;
          const q = search.toLowerCase();
          const project = projects.find((pr) => pr.id === p.project_id);
          return p.name?.toLowerCase().includes(q) || project?.name?.toLowerCase().includes(q);
        });
        if (palettes.length === 0) return (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Palette className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">No palettes yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create a palette and link it to a project</p>
          </div>
        );
        if (filtered.length === 0) return (
          <div className="text-center py-10 text-sm text-muted-foreground">No palettes match your filter.</div>
        );
        if (view === "list") return (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Colors</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Project</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Count</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((palette) => {
                  const project = projects.find((p) => p.id === palette.project_id);
                  const swatches = getSwatches(palette.id);
                  const count = paletteColors.filter((pc) => pc.palette_id === palette.id).length;
                  return (
                    <tr key={palette.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex gap-0.5">
                          {swatches.length === 0 ? (
                            <div className="w-8 h-8 rounded-md bg-muted border border-border" />
                          ) : (
                            swatches.slice(0, 6).map((hex, i) => (
                              <div key={i} className="w-5 h-8 first:rounded-l-md last:rounded-r-md" style={{ backgroundColor: hex }} />
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/color-palettes/${palette.id}`} className="hover:text-primary transition-colors">{palette.name}</Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{project ? (<span className="flex items-center gap-1"><FolderOpen className="w-3 h-3" />{project.name}</span>) : "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{count} color{count !== 1 ? "s" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((palette) => {
            const project = projects.find((p) => p.id === palette.project_id);
            const swatches = getSwatches(palette.id);
            const count = paletteColors.filter((pc) => pc.palette_id === palette.id).length;
            return (
              <Link key={palette.id} to={`/color-palettes/${palette.id}`}
                className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all">
                {/* Swatch preview */}
                <div className="h-20 flex">
                  {swatches.length === 0 ? (
                    <div className="flex-1 bg-muted flex items-center justify-center">
                      <Palette className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  ) : (
                    swatches.slice(0, 8).map((hex, i) => (
                      <div key={i} className="flex-1" style={{ backgroundColor: hex }} />
                    ))
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm">{palette.name}</h3>
                  {project && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <FolderOpen className="w-3 h-3" />
                      <span>{project.name}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{count} color{count !== 1 ? "s" : ""}</p>
                </div>
              </Link>
            );
          })}
        </div>
        );
      })()}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Color Palette</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Project</Label>
              <Select value={form.project_id} onValueChange={handleProjectChange}>
                <SelectTrigger><SelectValue placeholder="Select a project…" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Palette Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Spring Collection Palette" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}