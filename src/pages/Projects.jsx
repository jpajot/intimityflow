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
import { Plus, Loader2, FolderOpen, ChevronRight, Pencil } from "lucide-react";

const PROJECT_TYPES = ["Seasonal Collection", "Artist Collaboration", "Capsule", "Limited Edition", "Core Range", "Other"];
const SEASONS = ["SS25", "FW25", "SS26", "FW26", "Evergreen"];
const STATUSES = ["Planning", "Active", "Archived"];

const STATUS_COLORS = {
  Planning: "bg-amber-100 text-amber-700",
  Active: "bg-green-100 text-green-700",
  Archived: "bg-slate-100 text-slate-500",
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", type: "", season: "", description: "", status: "Planning" });
  const [editingProject, setEditingProject] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [projs, asns] = await Promise.all([
      base44.entities.Project.list("-created_date", 200),
      base44.entities.ProjectAssignment.list("-created_date", 2000),
    ]);
    setProjects(projs);
    setAssignments(asns);
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const created = await base44.entities.Project.create(form);
    setProjects((p) => [created, ...p]);
    setShowNew(false);
    setForm({ name: "", type: "", season: "", description: "", status: "Planning" });
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

  const getCount = (projectId) =>
    assignments.filter((a) => a.project_id === projectId).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Projects</h1>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No projects yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first project to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="group relative bg-card rounded-xl border border-border p-5 hover:shadow-lg hover:border-primary/20 transition-all">
              <Link to={`/projects/${project.id}`} className="absolute inset-0 rounded-xl" />
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold group-hover:text-primary transition-colors">{project.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{project.type}{project.season ? ` · ${project.season}` : ""}</p>
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); setEditingProject({ ...project }); }}
                  className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
              )}
              <div className="flex items-center justify-between mt-auto">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status] || STATUS_COLORS.Planning}`}>
                  {project.status}
                </span>
                <span className="text-xs text-muted-foreground">{getCount(project.id)} color{getCount(project.id) !== 1 ? "s" : ""}</span>
              </div>
            </div>
          ))}
        </div>
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
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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

      {/* Edit Project Dialog */}
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
                  <Select value={editingProject.type} onValueChange={(v) => setEditingProject((p) => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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