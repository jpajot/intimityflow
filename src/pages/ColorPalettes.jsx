import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, Palette, FolderOpen, LayoutGrid, List } from "lucide-react";
import DataTable from "@/components/DataTable";

export default function ColorPalettes() {
  const [palettes, setPalettes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [paletteColors, setPaletteColors] = useState([]);
  const [techColors, setTechColors] = useState([]);
  const [commColors, setCommColors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", project_id: "" });
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("table");

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

  const columns = [
    {
      id: "swatches",
      label: "Colors",
      width: 100,
      render: (palette) => {
        const swatches = getSwatches(palette.id);
        return (
          <div className="flex gap-0.5">
            {swatches.length === 0 ? (
              <div className="w-8 h-8 rounded-md bg-muted border border-border" />
            ) : (
              swatches.slice(0, 6).map((hex, i) => (
                <div key={i} className="w-5 h-8 first:rounded-l-md last:rounded-r-md" style={{ backgroundColor: hex }} />
              ))
            )}
          </div>
        );
      },
    },
    {
      id: "name",
      label: "Name",
      width: 150,
      sortKey: (p) => p.name || "",
      render: (palette) => (
        <Link to={`/color-palettes/${palette.id}`} className="font-medium hover:text-primary transition-colors">{palette.name}</Link>
      ),
    },
    {
      id: "project",
      label: "Project",
      width: 150,
      sortKey: (p) => {
        const project = projects.find((pr) => pr.id === p.project_id);
        return project?.name || "";
      },
      render: (palette) => {
        const project = projects.find((p) => p.id === palette.project_id);
        return project ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <FolderOpen className="w-3 h-3" />{project.name}
          </span>
        ) : "—";
      },
    },
    {
      id: "count",
      label: "Count",
      width: 100,
      sortKey: (p) => paletteColors.filter((pc) => pc.palette_id === p.id).length,
      render: (palette) => {
        const count = paletteColors.filter((pc) => pc.palette_id === palette.id).length;
        return <span className="text-xs text-muted-foreground">{count} color{count !== 1 ? "s" : ""}</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Color Palettes</h1>
          <p className="text-muted-foreground mt-1">Organize colors into project palettes</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setView("table")}
              className={`px-2.5 py-1.5 transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("gallery")}
              className={`px-2.5 py-1.5 transition-colors ${view === "gallery" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
              title="Gallery view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <Button onClick={() => setShowDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Palette
          </Button>
        </div>
      </div>

      {palettes.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Palette className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No palettes yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create a palette and link it to a project</p>
        </div>
      ) : view === "table" ? (
        <DataTable
          columns={columns}
          rows={palettes}
          fixedColumns={["swatches"]}
          filterFields={[
            { getValue: (p) => p.name },
            { getValue: (p) => {
              const project = projects.find((pr) => pr.id === p.project_id);
              return project?.name || "";
            }},
          ]}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {palettes.map((palette) => {
            const swatches = getSwatches(palette.id);
            const project = projects.find((p) => p.id === palette.project_id);
            return (
              <Link
                key={palette.id}
                to={`/color-palettes/${palette.id}`}
                className="rounded-xl border border-border bg-card hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="h-24 flex">
                  {swatches.length === 0 ? (
                    <div className="w-full bg-muted" />
                  ) : (
                    swatches.map((hex, i) => (
                      <div
                        key={i}
                        className="flex-1"
                        style={{ backgroundColor: hex }}
                      />
                    ))
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-sm">{palette.name}</h3>
                  {project && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <FolderOpen className="w-3 h-3" />{project.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {paletteColors.filter((pc) => pc.palette_id === palette.id).length} color{paletteColors.filter((pc) => pc.palette_id === palette.id).length !== 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

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