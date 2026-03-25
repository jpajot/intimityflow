import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Search, ChevronDown, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const emptyForm = { code: "", name: "", active: true, sample_size_id: "", base_size_id: "" };

export default function SizeGridLibrary() {
  const [grids, setGrids] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [gridSizes, setGridSizes] = useState([]); // SizeGridSize records
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sizeSearch, setSizeSearch] = useState("");
  const [showSizePicker, setShowSizePicker] = useState(null); // grid id

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [g, s, gs] = await Promise.all([
      base44.entities.SizeGrid.list("code", 500),
      base44.entities.Size.list("size_code", 500),
      base44.entities.SizeGridSize.list("-created_date", 2000),
    ]);
    setGrids(g);
    setSizes(s);
    setGridSizes(gs);
    setLoading(false);
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowDialog(true); };
  const openEdit = (g) => {
    setEditing(g);
    setForm({ code: g.code, name: g.name, active: g.active !== false, sample_size_id: g.sample_size_id || "", base_size_id: g.base_size_id || "" });
    setShowDialog(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...form, active: form.active };
    if (editing) {
      await base44.entities.SizeGrid.update(editing.id, data);
      setGrids((prev) => prev.map((g) => g.id === editing.id ? { ...g, ...data } : g));
    } else {
      const created = await base44.entities.SizeGrid.create(data);
      setGrids((prev) => [...prev, created]);
    }
    setSaving(false);
    setShowDialog(false);
  };

  const handleDeleteGrid = async (g) => {
    // remove linked sizes first
    const linked = gridSizes.filter((gs) => gs.size_grid_id === g.id);
    await Promise.all(linked.map((gs) => base44.entities.SizeGridSize.delete(gs.id)));
    await base44.entities.SizeGrid.delete(g.id);
    setGrids((prev) => prev.filter((x) => x.id !== g.id));
    setGridSizes((prev) => prev.filter((gs) => gs.size_grid_id !== g.id));
  };

  const getLinkedSizes = (gridId) => gridSizes.filter((gs) => gs.size_grid_id === gridId);

  const handleAddSize = async (gridId, sizeId) => {
    // no duplicates
    if (gridSizes.some((gs) => gs.size_grid_id === gridId && gs.size_id === sizeId)) return;
    const created = await base44.entities.SizeGridSize.create({ size_grid_id: gridId, size_id: sizeId, active: true });
    setGridSizes((prev) => [...prev, created]);
    setSizeSearch("");
    setShowSizePicker(null);
  };

  const handleRemoveSize = async (gs) => {
    await base44.entities.SizeGridSize.delete(gs.id);
    setGridSizes((prev) => prev.filter((x) => x.id !== gs.id));
  };

  const handleToggleSizeActive = async (gs) => {
    const updated = { ...gs, active: !gs.active };
    await base44.entities.SizeGridSize.update(gs.id, { active: updated.active });
    setGridSizes((prev) => prev.map((x) => x.id === gs.id ? updated : x));
  };

  const handleToggleGridActive = async (g) => {
    const updated = { active: !g.active };
    await base44.entities.SizeGrid.update(g.id, updated);
    setGrids((prev) => prev.map((x) => x.id === g.id ? { ...x, ...updated } : x));
  };

  const getSizeName = (sizeId) => {
    const s = sizes.find((x) => x.id === sizeId);
    return s ? `${s.size_code} – ${s.name}` : "—";
  };

  const filtered = grids.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return g.code?.toLowerCase().includes(q) || g.name?.toLowerCase().includes(q);
  });

  // sizes available to pick for a given grid (not already linked)
  const availableSizes = (gridId) => {
    const linked = new Set(gridSizes.filter((gs) => gs.size_grid_id === gridId).map((gs) => gs.size_id));
    return sizes.filter((s) => !linked.has(s.id) && (!sizeSearch || s.size_code?.toLowerCase().includes(sizeSearch.toLowerCase()) || s.name?.toLowerCase().includes(sizeSearch.toLowerCase())));
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Size Grid Library</h1>
          <p className="text-muted-foreground mt-1">{grids.length} size grids</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />New Size Grid</Button>
      </div>

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter grids…" className="pl-10" />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No size grids found.</p>
          </div>
        )}
        {filtered.map((g) => {
          const isExpanded = expandedId === g.id;
          const linked = getLinkedSizes(g.id);
          const sampleSize = sizes.find((s) => s.id === g.sample_size_id);
          const baseSize = sizes.find((s) => s.id === g.base_size_id);

          return (
            <div key={g.id} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-3 px-5 py-4">
                <button onClick={() => setExpandedId(isExpanded ? null : g.id)} className="text-muted-foreground">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="flex items-center gap-2 mr-2">
                  <Checkbox checked={g.active !== false} onCheckedChange={() => handleToggleGridActive(g)} id={`active-${g.id}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{g.code}</span>
                    <span className="font-semibold">{g.name}</span>
                    {g.active === false && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {sampleSize && <span>Sample: <span className="font-medium">{sampleSize.size_code}</span></span>}
                    {baseSize && <span>Base: <span className="font-medium">{baseSize.size_code}</span></span>}
                    <span>{linked.length} size{linked.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteGrid(g)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {/* Expanded: linked sizes */}
              {isExpanded && (
                <div className="border-t border-border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Active</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Code</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {linked.map((gs) => {
                          const size = sizes.find((s) => s.id === gs.size_id);
                          return (
                            <tr key={gs.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="px-5 py-3">
                                <Checkbox checked={gs.active !== false} onCheckedChange={() => handleToggleSizeActive(gs)} />
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">{size?.size_code || "—"}</td>
                              <td className="px-4 py-3">{size?.name || "—"}</td>
                              <td className="px-4 py-3 text-right">
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveSize(gs)}><X className="w-3 h-3" /></Button>
                              </td>
                            </tr>
                          );
                        })}
                        {linked.length === 0 && (
                          <tr><td colSpan={4} className="text-center py-4 text-xs text-muted-foreground">No sizes linked yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Add size picker */}
                  <div className="px-5 py-3 border-t border-border">
                    {showSizePicker === g.id ? (
                      <div className="border border-border rounded-lg overflow-hidden w-72">
                        <div className="p-2 border-b border-border">
                          <Input value={sizeSearch} onChange={(e) => setSizeSearch(e.target.value)} placeholder="Search sizes…" className="h-8 text-xs" autoFocus />
                        </div>
                        <div className="max-h-44 overflow-y-auto">
                          {availableSizes(g.id).map((s) => (
                            <button key={s.id} type="button" onClick={() => handleAddSize(g.id, s.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left text-sm transition-colors">
                              <span className="font-mono text-xs text-muted-foreground w-10 shrink-0">{s.size_code}</span>
                              <span>{s.name}</span>
                            </button>
                          ))}
                          {availableSizes(g.id).length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No more sizes available.</p>}
                        </div>
                        <div className="p-2 border-t border-border">
                          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setShowSizePicker(null); setSizeSearch(""); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => { setShowSizePicker(g.id); setSizeSearch(""); }}>
                        <Plus className="w-3.5 h-3.5" /> Add Size
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grid Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => !o && setShowDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Size Grid" : "New Size Grid"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Code</Label>
                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required placeholder="e.g. EU-WOMEN" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. European Women" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Sample Size</Label>
                <Select value={form.sample_size_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, sample_size_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {sizes.map((s) => <SelectItem key={s.id} value={s.id}>{s.size_code} – {s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Base Size</Label>
                <Select value={form.base_size_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, base_size_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {sizes.map((s) => <SelectItem key={s.id} value={s.id}>{s.size_code} – {s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="active-form" checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: !!v }))} />
              <Label htmlFor="active-form" className="text-sm cursor-pointer">Active</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}