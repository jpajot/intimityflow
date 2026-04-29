import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Filter } from "lucide-react";
import DataTable from "@/components/DataTable";
import { usePageOptions } from "@/lib/PageOptionsContext";
import ViewDrawerContent from "@/components/ViewDrawerContent";
import QuickFiltersPanel, { applyQuickFilters } from "@/components/QuickFiltersPanel";
import { usePersistedQuickFilters } from "../hooks/usePersistedQuickFilters";

const emptyForm = { size_code: "", name: "" };

const SIZE_LIBRARY_FIELDS = [
  { id: "size_code", label: "Code" },
  { id: "name", label: "Name" },
];

const QF_FIELDS = [
  { id: "size_code", label: "Code", getValue: (s) => s.size_code },
  { id: "name", label: "Name", getValue: (s) => s.name },
];

export default function SizeLibrary({ hideTitle = false }) {
  const { setOptions } = usePageOptions();
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showQF, setShowQF] = useState(false);
  const [activeViewId, setActiveViewId] = useState("default");
  const [activeColumns, setActiveColumns] = useState(null);
  const [quickFilters, setQuickFilters] = usePersistedQuickFilters("size_library");

  const openNew = useCallback(() => { setEditing(null); setForm(emptyForm); setShowDialog(true); }, []);
  const toggleViewMenu = useCallback(() => { setShowViewMenu((v) => !v); setShowQF(false); }, []);
  const toggleQF = useCallback(() => { setShowQF((v) => !v); setShowViewMenu(false); }, []);

  useEffect(() => { loadData(); }, []);

  // Apply selected view config
  useEffect(() => {
    if (!activeViewId || activeViewId === "default") {
      setActiveColumns(null);
      return;
    }
    base44.entities.ListViewConfig.filter({ id: activeViewId }).then((results) => {
      const view = results[0];
      setActiveColumns(view?.column_ids?.length ? view.column_ids : null);
    });
  }, [activeViewId]);

  // Sync page options
  useEffect(() => {
    setOptions({
      items: [
        { label: "Add Size", icon: Plus, onClick: openNew, className: "text-primary hover:bg-primary/10" },
        { divider: true },
        {
          label: "Quick Filters",
          icon: Filter,
          onClick: toggleQF,
          custom: true,
          badge: quickFilters.length > 0 ? quickFilters.length : null,
        },
        { divider: true },
        { label: "Manage Views", icon: Pencil, onClick: toggleViewMenu, custom: true },
      ],
      customContent: showQF
        ? <QuickFiltersPanel fields={QF_FIELDS} activeFilters={quickFilters} onApply={setQuickFilters} />
        : showViewMenu
        ? <ViewDrawerContent
            pageKey="size_library"
            activeViewId={activeViewId}
            onSelectView={setActiveViewId}
            currentViewType={null}
            allFields={SIZE_LIBRARY_FIELDS}
          />
        : null,
    });
  }, [showViewMenu, showQF, activeViewId, quickFilters, openNew, toggleViewMenu, toggleQF]);

  const loadData = async () => {
    const s = await base44.entities.Size.list("size_code", 500);
    setSizes(s);
    setLoading(false);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ size_code: s.size_code, name: s.name });
    setShowDialog(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      await base44.entities.Size.update(editing.id, form);
      setSizes((prev) => prev.map((s) => s.id === editing.id ? { ...s, ...form } : s));
    } else {
      const created = await base44.entities.Size.create(form);
      setSizes((prev) => [...prev, created]);
    }
    setSaving(false);
    setShowDialog(false);
  };

  const handleDelete = async (s) => {
    await base44.entities.Size.delete(s.id);
    setSizes((prev) => prev.filter((x) => x.id !== s.id));
  };

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const columns = [
    {
      id: "size_code",
      label: "Code",
      width: 100,
      sortKey: (s) => s.size_code || "",
      render: (s) => <span className="font-mono text-xs font-semibold">{s.size_code}</span>,
    },
    {
      id: "name",
      label: "Name",
      width: 200,
      sortKey: (s) => s.name || "",
      render: (s) => <span className="font-medium">{s.name}</span>,
    },
    {
      id: "actions",
      label: "",
      width: 80,
      render: (s) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s)}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      ),
    },
  ];

  const visibleColumns = activeColumns
    ? columns.filter((c) => c.id === "actions" || activeColumns.includes(c.id))
    : columns;

  const filteredSizes = applyQuickFilters(sizes, quickFilters);

  return (
    <div className="space-y-6">
      {!hideTitle && (
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Size Library</h1>
          <p className="text-muted-foreground mt-1">{sizes.length} sizes</p>
        </div>
      )}

      <DataTable
        columns={visibleColumns}
        rows={filteredSizes}
        fixedColumns={["size_code"]}
        hideColumnToggle
        filterFields={[
          { getValue: (s) => s.size_code },
          { getValue: (s) => s.name },
        ]}
      />

      <Dialog open={showDialog} onOpenChange={(o) => !o && setShowDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit Size" : "New Size"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Size Code</Label>
                <Input value={form.size_code} onChange={(e) => setForm((f) => ({ ...f, size_code: e.target.value }))} placeholder="e.g. XS, 36" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Extra Small" required />
              </div>
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