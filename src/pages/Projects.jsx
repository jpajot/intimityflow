import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, FolderOpen, Pencil, Search, LayoutGrid, List } from "lucide-react";
import DataTable from "@/components/DataTable";
import ViewSelector from "../components/ViewSelector";

const SEASONS = ["SS25", "FW25", "SS26", "FW26", "Evergreen"];
const STATUSES = ["Planning", "Active", "Archived"];

const STATUS_COLORS = {
  Planning: "bg-amber-100 text-amber-700",
  Active: "bg-green-100 text-green-700",
  Archived: "bg-slate-100 text-slate-500",
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [projectTypes, setProjectTypes] = useState([]);
  const [subTypeLovId, setSubTypeLovId] = useState(null);
  const [subTypesMap, setSubTypesMap] = useState({}); // parentTypeLovId -> { parentValueName -> [subTypeNames] }
  const [allSubTypes, setAllSubTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", type: "", season: "", description: "", status: "Planning" });
  const [editingProject, setEditingProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState(() => localStorage.getItem("projects_view") || "gallery");
  const [activeColumns, setActiveColumns] = useState(null);
  const [filteredRows, setFilteredRows] = useState(null);

  useEffect(() => {
    loadData();
    loadProjectTypes();
  }, []);

  const loadProjectTypes = async () => {
    const [lovTypesAll, lovValsAll] = await Promise.all([
      base44.entities.TypeOfLOV.list("code", 500),
      base44.entities.ListOfValues.list("name", 5000),
    ]);
    // Project types from EntityTypes LOV
    const entityTypesLov = lovTypesAll.find((t) => t.code === "EntityTypes");
    const entitiesLov = lovTypesAll.find((t) => t.code === "Entities");
    if (entityTypesLov && entitiesLov) {
      const entityValues = lovValsAll.filter((v) => v.type_of_lov_id === entitiesLov.id);
      const projectEntityValue = entityValues.find((v) => v.name === "Project");
      if (projectEntityValue) {
        const types = lovValsAll.filter((v) => v.type_of_lov_id === entityTypesLov.id && v.depends_on_value_id === projectEntityValue.id);
        setProjectTypes(types.map((t) => t.name));
      }
    }
    // Sub-Types LOV
    const subTypesDef = lovTypesAll.find((t) => t.code === "Sub-Types");
    if (subTypesDef) {
      setSubTypeLovId(subTypesDef.id);
      const subs = lovValsAll.filter((v) => v.type_of_lov_id === subTypesDef.id);
      setAllSubTypes(subs);
      if (subTypesDef.depends_on_id) {
        const parentTypeDef = lovTypesAll.find((t) => t.id === subTypesDef.depends_on_id);
        if (parentTypeDef) {
          const map = {};
          const parentVals = lovValsAll.filter((v) => v.type_of_lov_id === parentTypeDef.id);
          parentVals.forEach((pv) => {
            map[pv.name] = subs.filter((s) => s.depends_on_value_id === pv.id).map((s) => s.name);
          });
          setSubTypesMap(map);
        }
      }
    }
  };

  const getSubTypesForType = (type) => {
    if (!type || Object.keys(subTypesMap).length === 0) return allSubTypes.map((s) => s.name);
    return subTypesMap[type] || [];
  };

  const loadData = async () => {
    const projs = await base44.entities.Project.list("-created_date", 200);
    setProjects(projs);
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const created = await base44.entities.Project.create(form);
    setProjects((p) => [created, ...p]);
    setShowNew(false);
    setForm({ name: "", type: "", season: "", sub_type: "", description: "", status: "Planning" });
    setSaving(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { id, created_date, updated_date, created_by, ...data } = editingProject;
    await base44.entities.Project.update(id, data);
    setProjects((prev) => prev.map((p) => p.id === id ? editingProject : p));
    setEditingProject(null);
    setSaving(false);
  };



  const filtered = projects.filter((p) =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const types = [...new Set(projects.map((p) => p.type).filter(Boolean))];
  const seasons = [...new Set(projects.map((p) => p.season).filter(Boolean))];

  const allColumns = [
    {
      id: "name",
      label: "Name",
      width: 200,
      sortKey: (p) => p.name || "",
      render: (p) => <Link to={`/projects/${p.id}`} className="font-medium hover:text-primary transition-colors">{p.name}</Link>,
    },
    {
      id: "type",
      label: "Type",
      width: 150,
      sortKey: (p) => p.type || "",
      render: (p) => <span className="text-xs text-muted-foreground">{p.type}</span>,
    },
    {
      id: "season",
      label: "Season",
      width: 100,
      sortKey: (p) => p.season || "",
      render: (p) => <span className="text-xs text-muted-foreground">{p.season}</span>,
    },
    {
      id: "status",
      label: "Status",
      width: 110,
      sortKey: (p) => p.status || "",
      render: (p) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || STATUS_COLORS.Planning}`}>{p.status}</span>
      ),
    },
    {
      id: "description",
      label: "Description",
      width: 250,
      render: (p) => <span className="text-xs text-muted-foreground line-clamp-1">{p.description}</span>,
    },
    {
      id: "actions",
      label: "",
      width: 50,
      render: (p) => (
        <button onClick={(e) => { e.preventDefault(); setEditingProject({ ...p }); }} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      ),
    },
  ];

  const filterableFields = [
    { id: "type", label: "Type", getValue: (p) => p.type },
    { id: "season", label: "Season", getValue: (p) => p.season },
    { id: "status", label: "Status", getValue: (p) => p.status },
  ];

  const columns = activeColumns || allColumns;
  const tableRows = filteredRows !== null ? filteredRows : filtered;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Projects</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="pl-10" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {view === "table" && (
            <ViewSelector
              pageKey="projects"
              allColumns={allColumns}
              onColumnsChange={setActiveColumns}
              filterableFields={filterableFields}
              rows={filtered}
              onFilteredRowsChange={setFilteredRows}
            />
          )}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button type="button" onClick={() => { setView("gallery"); localStorage.setItem("projects_view", "gallery"); }} className={`px-2.5 py-1.5 transition-colors ${view === "gallery" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Gallery view">
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { setView("table"); localStorage.setItem("projects_view", "table"); }} className={`px-2.5 py-1.5 transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Table view">
              <List className="w-4 h-4" />
            </button>
          </div>
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No projects yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first project to get started</p>
        </div>
      ) : view === "gallery" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <div key={project.id} className="group relative bg-card rounded-xl border border-border p-5 hover:shadow-lg hover:border-primary/20 transition-all">
              <Link to={`/projects/${project.id}`} className="absolute inset-0 rounded-xl" />
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold group-hover:text-primary transition-colors">{project.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{project.type}{project.season ? ` · ${project.season}` : ""}</p>
                </div>
                <button onClick={(e) => { e.preventDefault(); setEditingProject({ ...project }); }} className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
              )}
              <div className="flex items-center justify-between mt-auto">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status] || STATUS_COLORS.Planning}`}>{project.status}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={tableRows}
          hideColumnToggle
        />
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Project Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v, sub_type: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{projectTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Season</Label>
                <Select value={form.season} onValueChange={(v) => setForm((f) => ({ ...f, season: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{SEASONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {getSubTypesForType(form.type).length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Sub-type</Label>
                <Select value={form.sub_type || "none"} onValueChange={(v) => setForm((f) => ({ ...f, sub_type: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {getSubTypesForType(form.type).map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Create Project</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {editingProject && (
        <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Project Name</Label>
                <Input value={editingProject.name} onChange={(e) => setEditingProject((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Type</Label>
                  <Select value={editingProject.type} onValueChange={(v) => setEditingProject((p) => ({ ...p, type: v, sub_type: "" }))}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{projectTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Season</Label>
                  <Select value={editingProject.season} onValueChange={(v) => setEditingProject((p) => ({ ...p, season: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{SEASONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {getSubTypesForType(editingProject.type).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Sub-type</Label>
                  <Select value={editingProject.sub_type || "none"} onValueChange={(v) => setEditingProject((p) => ({ ...p, sub_type: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {getSubTypesForType(editingProject.type).map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <Select value={editingProject.status} onValueChange={(v) => setEditingProject((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Description</Label>
                <Textarea value={editingProject.description || ""} onChange={(e) => setEditingProject((p) => ({ ...p, description: e.target.value }))} rows={2} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingProject(null)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}