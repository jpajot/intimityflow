import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, X, Ruler, Grid3X3 } from "lucide-react";
import SizeLibrary from "./SizeLibrary";
import DataTable from "@/components/DataTable";
import { useRegisterSubNav } from "../hooks/useRegisterSubNav";

const emptyForm = { code: "", name: "", active: true, sample_size_id: "", base_size_id: "" };

export default function SizeGridLibrary() {
  const [activeSection, setActiveSection] = useState("grids");
  const [grids, setGrids] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [gridSizes, setGridSizes] = useState([]); // SizeGridSize records
  const [loading, setLoading] = useState(true);
  const [gridSearch, setGridSearch] = useState("");
  const [selectedGrid, setSelectedGrid] = useState(null);
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
    if (!gridSearch) return true;
    const q = gridSearch.toLowerCase();
    return g.code?.toLowerCase().includes(q) || g.name?.toLowerCase().includes(q);
  });

  const selectedGridObj = grids.find((g) => g.id === selectedGrid);
  const linkedSizes = selectedGrid ? getLinkedSizes(selectedGrid) : [];

  // sizes available to pick for a given grid (not already linked)
  const availableSizes = (gridId) => {
    const linked = new Set(gridSizes.filter((gs) => gs.size_grid_id === gridId).map((gs) => gs.size_id));
    return sizes.filter((s) => !linked.has(s.id) && (!sizeSearch || s.size_code?.toLowerCase().includes(sizeSearch.toLowerCase()) || s.name?.toLowerCase().includes(sizeSearch.toLowerCase())));
  };

  useRegisterSubNav([
    { id: "grids", label: "Size Grids", count: grids.length, icon: Grid3X3 },
    { id: "library", label: "Size Library", icon: Ruler },
  ], activeSection, setActiveSection, "Size Studio");

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="px-2 py-2 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{activeSection === "library" ? "Size Library" : "Size Grids"}</h1>
      </div>

      {activeSection === "grids" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grids Panel */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Grids ({grids.length})</h3>
            <Button onClick={openNew} size="sm" className="gap-1.5 h-8">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
          <Input
            placeholder="Search grids…"
            value={gridSearch}
            onChange={(e) => setGridSearch(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filtered.map((g) => (
              <div
                key={g.id}
                onClick={() => setSelectedGrid(g.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedGrid === g.id
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="font-medium text-sm">{g.name || g.code}</div>
                <div className="text-xs text-muted-foreground mt-1">{g.code}</div>
                <div className="flex gap-1 mt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(g);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGrid(g);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 space-y-4">
          <h3 className="font-semibold">
            Sizes {selectedGridObj ? `— ${selectedGridObj.name || selectedGridObj.code}` : ""}
          </h3>
          {!selectedGrid ? (
            <p className="text-sm text-muted-foreground">Select a grid to manage its sizes</p>
          ) : (
            <div className="space-y-4">
              <DataTable
                columns={[
                  {
                    id: "code",
                    label: "Code",
                    width: 120,
                    sortKey: (gs) => {
                      const size = sizes.find((s) => s.id === gs.size_id);
                      return size?.size_code || "";
                    },
                    render: (gs) => {
                      const size = sizes.find((s) => s.id === gs.size_id);
                      return <span className="font-mono text-xs">{size?.size_code || "—"}</span>;
                    },
                  },
                  {
                    id: "name",
                    label: "Name",
                    width: 200,
                    sortKey: (gs) => {
                      const size = sizes.find((s) => s.id === gs.size_id);
                      return size?.name || "";
                    },
                    render: (gs) => {
                      const size = sizes.find((s) => s.id === gs.size_id);
                      return <span>{size?.name || "—"}</span>;
                    },
                  },
                  {
                    id: "active",
                    label: "Active",
                    width: 100,
                    sortKey: (gs) => (gs.active !== false ? "1" : "0"),
                    render: (gs) => (
                      <Checkbox checked={gs.active !== false} onCheckedChange={() => handleToggleSizeActive(gs)} />
                    ),
                  },
                  {
                    id: "actions",
                    label: "",
                    width: 50,
                    render: (gs) => (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveSize(gs)}>
                        <X className="w-3 h-3" />
                      </Button>
                    ),
                  },
                ]}
                rows={linkedSizes}
                filterFields={[
                  { getValue: (gs) => {
                    const size = sizes.find((s) => s.id === gs.size_id);
                    return size?.size_code || "";
                  }},
                  { getValue: (gs) => {
                    const size = sizes.find((s) => s.id === gs.size_id);
                    return size?.name || "";
                  }},
                ]}
              />
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => { setShowSizePicker(selectedGrid); setSizeSearch(""); }}>
                <Plus className="w-3.5 h-3.5" /> Add Size
              </Button>
              {showSizePicker === selectedGrid && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <Input value={sizeSearch} onChange={(e) => setSizeSearch(e.target.value)} placeholder="Search sizes…" className="h-8 text-xs" autoFocus />
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    {availableSizes(selectedGrid).map((s) => (
                      <button key={s.id} type="button" onClick={() => handleAddSize(selectedGrid, s.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left text-sm transition-colors">
                        <span className="font-mono text-xs text-muted-foreground w-10 shrink-0">{s.size_code}</span>
                        <span>{s.name}</span>
                      </button>
                    ))}
                    {availableSizes(selectedGrid).length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No more sizes available.</p>}
                  </div>
                  <div className="p-2 border-t border-border">
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setShowSizePicker(null); setSizeSearch(""); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {activeSection === "library" && <SizeLibrary hideTitle />}

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