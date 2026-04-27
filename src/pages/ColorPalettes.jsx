import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, Palette, FolderOpen, Pencil, Trash2, X, Link, Download, SwatchBook, LayoutGrid, List, Settings2, GripVertical, ShieldCheck, Pin } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { colorToHex, tcxDisplayName } from "../lib/pantone-tcx";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { useRegisterSubNav } from "../hooks/useRegisterSubNav";
import LinkCommercialColorDialog from "../components/LinkCommercialColorDialog";
import PaletteColorGrid from "../components/PaletteColorGrid";


export default function ColorPalettes() {
  const { setOptions } = usePageOptions();
  const [activeSection, setActiveSection] = useState("palettes");
  const [palettes, setPalettes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [paletteColors, setPaletteColors] = useState([]);
  const [techColors, setTechColors] = useState([]);
  const [commColors, setCommColors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPaletteId, setSelectedPaletteId] = useState(null);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingPalette, setEditingPalette] = useState(null);
  const [form, setForm] = useState({ name: "", project_id: "" });
  const [saving, setSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorSearch, setColorSearch] = useState("");
  const [colorTab, setColorTab] = useState("technical");
  const [selectedColorIds, setSelectedColorIds] = useState(new Set());
  const [addingColors, setAddingColors] = useState(false);
  const [paletteCardSize, setPaletteCardSize] = useState(() => {try {return localStorage.getItem("palette_card_size") || "M";} catch {return "M";}});
  const [showTechDialog, setShowTechDialog] = useState(false);
  const [showCommDialog, setShowCommDialog] = useState(false);
  const [linkingTechColor, setLinkingTechColor] = useState(null);
  const [techForm, setTechForm] = useState({ code: "", name: "", hex: "", rgb_r: "", rgb_g: "", rgb_b: "" });
  const [commForm, setCommForm] = useState({ sub_type: "Solid", code: "", main_technical_color_id: "", linked_technical_color_ids: [], color_name: "" });
  const [techSearch, setTechSearch] = useState("");
  const [linkedTechSearch, setLinkedTechSearch] = useState("");
  const [techView, setTechView] = useState("table");
  const [commView, setCommView] = useState("table");
  const [commSearch, setCommSearch] = useState("");
  const [visibleTechColumns, setVisibleTechColumns] = useState(null);
  const [visibleCommColumns, setVisibleCommColumns] = useState(null);
  const [showViewsMenu, setShowViewsMenu] = useState(false);
  const [techViews, setTechViews] = useState([]);
  const [commViews, setCommViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState("default");
  const [showViewEditor, setShowViewEditor] = useState(false);
  const [editingView, setEditingView] = useState(null);
  const [editorMode, setEditorMode] = useState("list"); // list, new, edit
  const [editorTab, setEditorTab] = useState("columns");
  const [viewFormName, setViewFormName] = useState("");
  const [viewFormColumns, setViewFormColumns] = useState([]);
  const [viewFormFilters, setViewFormFilters] = useState({ operator: "and", filters: [] });
  const [viewFormRoles, setViewFormRoles] = useState([]);
  const [roleInput, setRoleInput] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const [viewFormFixedColumnIds, setViewFormFixedColumnIds] = useState([]);
  const DEFAULT_FILTERS = { operator: "and", filters: [] };

  useRegisterSubNav([
    { id: "palettes", label: "Palettes", count: palettes.length, icon: Palette },
    { id: "technical", label: "Technical Colors", count: techColors.length, icon: SwatchBook },
    { id: "commercial", label: "Commercial Colors", count: commColors.length, icon: SwatchBook },
  ], activeSection, setActiveSection, "Color Studio");

  useEffect(() => {
    if (activeSection === "palettes" && selectedPaletteId) {
      const swatches = getSwatchData(selectedPaletteId);
      setOptions({
        items: [
          { label: "Add Color", icon: Plus, onClick: () => openColorPicker(), className: "text-primary hover:bg-primary/10" },
          { divider: true },
          { label: "S", onClick: () => { setPaletteCardSize("S"); try { localStorage.setItem("palette_card_size", "S"); } catch {} }, className: `px-2 py-1 text-xs font-medium rounded border ${paletteCardSize === "S" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}` },
          { label: "M", onClick: () => { setPaletteCardSize("M"); try { localStorage.setItem("palette_card_size", "M"); } catch {} }, className: `px-2 py-1 text-xs font-medium rounded border ${paletteCardSize === "M" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}` },
          { label: "L", onClick: () => { setPaletteCardSize("L"); try { localStorage.setItem("palette_card_size", "L"); } catch {} }, className: `px-2 py-1 text-xs font-medium rounded border ${paletteCardSize === "L" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}` },
          ...(swatches.length > 0 ? [{ divider: true }, { label: "Export .ase", icon: Download, onClick: () => exportASE() }] : [])
        ]
      });
    } else if (activeSection === "technical") {
      setOptions({
        items: [
          { label: "Add Technical Color", icon: Plus, onClick: () => openNewTech(), className: "text-primary hover:bg-primary/10" },
          { label: "Manage Views", icon: Pencil, onClick: () => setShowViewsMenu(true) }
        ],
        customContent: (
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Select View</p>
            <div className="space-y-2">
              <button onClick={() => { setActiveViewId("default"); setShowViewsMenu(false); }} className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeViewId === "default" ? "bg-primary text-primary-foreground" : "hover:bg-muted border border-border"}`}>Default View</button>
              {techViews.map((v) => (
                <div key={v.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted">
                  <button onClick={() => { setActiveViewId(v.id); setShowViewsMenu(false); }} className="flex-1 text-left text-sm">{v.name}</button>
                  <button onClick={() => { setEditingView(v); setViewFormName(v.name); setViewFormColumns(v.column_ids || []); setViewFormFilters(v.filters_config || DEFAULT_FILTERS); setViewFormRoles(v.allowed_roles || []); setViewFormFixedColumnIds(v.fixed_column_ids || []); setEditorTab("columns"); setEditorMode("edit"); setShowViewEditor(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { setSaving(true); if (activeSection === "technical") { setTechViews(techViews.filter(vv => vv.id !== v.id)); } else { setCommViews(commViews.filter(vv => vv.id !== v.id)); } if (activeViewId === v.id) setActiveViewId("default"); setSaving(false); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <Button onClick={() => { setEditingView(null); setViewFormName(""); setViewFormColumns(["color", "code", "name", "hex"]); setViewFormFilters(DEFAULT_FILTERS); setViewFormRoles([]); setViewFormFixedColumnIds([]); setRoleInput(""); setEditorTab("columns"); setEditorMode("new"); setShowViewEditor(true); }} variant="outline" className="w-full gap-2 text-xs"><Plus className="w-3.5 h-3.5" /> New View</Button>
          </div>
        )
      });
    } else if (activeSection === "commercial") {
      setOptions({
        items: [
          { label: "Add Commercial Color", icon: Plus, onClick: () => openNewComm(), className: "text-primary hover:bg-primary/10" },
          { label: "Manage Views", icon: Pencil, onClick: () => setShowViewsMenu(true) }
        ],
        customContent: (
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Select View</p>
            <div className="space-y-2">
              <button onClick={() => { setActiveViewId("default"); setShowViewsMenu(false); }} className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeViewId === "default" ? "bg-primary text-primary-foreground" : "hover:bg-muted border border-border"}`}>Default View</button>
              {commViews.map((v) => (
                <div key={v.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted">
                  <button onClick={() => { setActiveViewId(v.id); setShowViewsMenu(false); }} className="flex-1 text-left text-sm">{v.name}</button>
                  <button onClick={() => { setEditingView(v); setViewFormName(v.name); setViewFormColumns(v.column_ids || []); setViewFormFilters(v.filters_config || DEFAULT_FILTERS); setViewFormRoles(v.allowed_roles || []); setViewFormFixedColumnIds(v.fixed_column_ids || []); setEditorTab("columns"); setEditorMode("edit"); setShowViewEditor(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { setSaving(true); if (activeSection === "technical") { setTechViews(techViews.filter(vv => vv.id !== v.id)); } else { setCommViews(commViews.filter(vv => vv.id !== v.id)); } if (activeViewId === v.id) setActiveViewId("default"); setSaving(false); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <Button onClick={() => { setEditingView(null); setViewFormName(""); setViewFormColumns(["color", "code", "name", "type"]); setViewFormFilters(DEFAULT_FILTERS); setViewFormRoles([]); setViewFormFixedColumnIds([]); setRoleInput(""); setEditorTab("columns"); setEditorMode("new"); setShowViewEditor(true); }} variant="outline" className="w-full gap-2 text-xs"><Plus className="w-3.5 h-3.5" /> New View</Button>
          </div>
        )
      });
    } else {
      setOptions({ items: [] });
    }
  }, [activeSection, selectedPaletteId, paletteCardSize, setOptions, showViewsMenu, techColors]);

  useEffect(() => {loadData();}, []);

  useEffect(() => {
    const loadViews = async () => {
      const pageKey = activeSection === "technical" ? "technical_colors" : "commercial_colors";
      const views = await base44.entities.ListViewConfig.filter({ page_key: pageKey });
      if (activeSection === "technical") setTechViews(views);
      else setCommViews(views);
    };
    loadViews();
  }, [activeSection]);

  const loadData = async () => {
    const [pal, proj, pc, tc, cc] = await Promise.all([
    base44.entities.ColorPalette.list("-created_date", 200),
    base44.entities.Project.list("name", 200),
    base44.entities.ColorPaletteColor.list("-created_date", 2000),
    base44.entities.TechnicalColor.list("code", 2000),
    base44.entities.CommercialColor.list("code", 2000)]
    );
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

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.ColorPalette.update(editingPalette.id, form);
    setPalettes((prev) => prev.map((p) => p.id === editingPalette.id ? { ...p, ...form } : p));
    setEditingPalette(null);
    setShowDialog(false);
    setSaving(false);
  };

  const openNew = () => {
    setEditingPalette(null);
    setForm({ name: "", project_id: "" });
    setShowDialog(true);
  };

  const openEdit = (palette) => {
    setEditingPalette(palette);
    setForm({ name: palette.name, project_id: palette.project_id || "" });
    setShowDialog(true);
  };

  const handleDelete = async (palette) => {
    await base44.entities.ColorPalette.delete(palette.id);
    setPalettes((prev) => prev.filter((p) => p.id !== palette.id));
    if (selectedPaletteId === palette.id) setSelectedPaletteId(null);
  };

  const openColorPicker = async () => {
    setSelectedColorIds(new Set());
    setColorSearch("");
    setColorTab("technical");
    setShowColorPicker(true);
    // Refresh colors in case new ones were added in Color Library
    const [tc, cc] = await Promise.all([
    base44.entities.TechnicalColor.list("code", 2000),
    base44.entities.CommercialColor.list("code", 2000)]
    );
    setTechColors(tc);
    setCommColors(cc);
  };

  const openNewTech = () => {
    setTechForm({ code: "", name: "", hex: "", rgb_r: "", rgb_g: "", rgb_b: "" });
    setShowTechDialog(true);
  };

  const openNewComm = async () => {
    setCommForm({ sub_type: "Solid", code: "", main_technical_color_id: "", linked_technical_color_ids: [], color_name: "" });
    setTechSearch("");
    setLinkedTechSearch("");
    setShowCommDialog(true);
    try {
      const res = await base44.functions.invoke("generateCode", { entity_name: "CommercialColor", entity_type: "" });
      setCommForm((f) => ({ ...f, code: res.data.code }));
    } catch {}
  };

  const handleTechSelectForComm = (techId) => {
    const tech = techColors.find((t) => t.id === techId);
    setCommForm((f) => ({
      ...f,
      main_technical_color_id: techId,
      color_name: f.color_name || tech?.name || "",
      linked_technical_color_ids: f.linked_technical_color_ids.includes(techId) ?
      f.linked_technical_color_ids :
      [...f.linked_technical_color_ids, techId]
    }));
  };

  const toggleColorSelection = (key) => {
    setSelectedColorIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);else next.add(key);
      return next;
    });
  };

  const saveTech = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...techForm, rgb_r: Number(techForm.rgb_r) || 0, rgb_g: Number(techForm.rgb_g) || 0, rgb_b: Number(techForm.rgb_b) || 0 };
    const created = await base44.entities.TechnicalColor.create(data);
    setTechColors((prev) => [...prev, created]);
    const linked = await base44.entities.ColorPaletteColor.create({ palette_id: selectedPaletteId, color_type: "technical", color_id: created.id });
    setPaletteColors((prev) => [...prev, linked]);
    setShowTechDialog(false);
    setSaving(false);
  };

  const saveComm = async (e) => {
    e.preventDefault();
    setSaving(true);
    const created = await base44.entities.CommercialColor.create(commForm);
    setCommColors((prev) => [...prev, created]);
    const linked = await base44.entities.ColorPaletteColor.create({ palette_id: selectedPaletteId, color_type: "commercial", color_id: created.id });
    setPaletteColors((prev) => [...prev, linked]);
    setShowCommDialog(false);
    setSaving(false);
  };

  const handleAddSelectedColors = async () => {
    setAddingColors(true);

    const alreadyInPalette = new Set(
      paletteColors.filter((pc) => pc.palette_id === selectedPaletteId).map((pc) => pc.color_id)
    );

    const toAdd = [...selectedColorIds].map((key) => {
      const [color_type, color_id] = key.split(":");
      return { palette_id: selectedPaletteId, color_type, color_id };
    });

    const companions = [];
    for (const { color_type, color_id } of toAdd) {
      if (color_type === "commercial") {
        const comm = commColors.find((c) => c.id === color_id);
        if (comm?.main_technical_color_id && !alreadyInPalette.has(comm.main_technical_color_id) &&
        !toAdd.some((e) => e.color_type === "technical" && e.color_id === comm.main_technical_color_id) &&
        !companions.some((e) => e.color_type === "technical" && e.color_id === comm.main_technical_color_id)) {
          companions.push({ palette_id: selectedPaletteId, color_type: "technical", color_id: comm.main_technical_color_id });
        }
      } else if (color_type === "technical") {
        const comm = commColors.find((c) =>
        c.main_technical_color_id === color_id || (c.linked_technical_color_ids || []).includes(color_id)
        );
        if (comm && !alreadyInPalette.has(comm.id) &&
        !toAdd.some((e) => e.color_type === "commercial" && e.color_id === comm.id) &&
        !companions.some((e) => e.color_type === "commercial" && e.color_id === comm.id)) {
          companions.push({ palette_id: selectedPaletteId, color_type: "commercial", color_id: comm.id });
        }
      }
    }

    const allEntries = [...toAdd, ...companions];
    const created = await Promise.all(allEntries.map((d) => base44.entities.ColorPaletteColor.create(d)));
    setPaletteColors((prev) => [...prev, ...created]);
    setAddingColors(false);
    setShowColorPicker(false);
  };

  const handleReorderColors = async (orderedEntryIds) => {
    // Update local state immediately
    setPaletteColors((prev) => prev.map((pc) => {
      const idx = orderedEntryIds.indexOf(pc.id);
      if (idx === -1) return pc;
      return { ...pc, sort_order: idx };
    }));
    // Persist to backend
    await Promise.all(orderedEntryIds.map((id, idx) =>
    base44.entities.ColorPaletteColor.update(id, { sort_order: idx })
    ));
  };

  const handleRemoveColor = async (paletteColorEntry) => {
    const entryId = paletteColorEntry.id || paletteColorEntry;
    const linkedTechEntryIds = paletteColorEntry.linkedTechEntryIds || [];
    const allIds = [entryId, ...linkedTechEntryIds];
    await Promise.all(allIds.map((id) => base44.entities.ColorPaletteColor.delete(id)));
    setPaletteColors((prev) => prev.filter((pc) => !allIds.includes(pc.id)));
  };

  const exportASE = () => {
    if (!selectedPaletteId) return;
    const swatches = getSwatchData(selectedPaletteId);
    if (!swatches.length) return;

    const hexToRgbFloat = (hex) => {
      const h = (hex || "#cccccc").replace("#", "");
      return [parseInt(h.substring(0, 2), 16) / 255, parseInt(h.substring(2, 4), 16) / 255, parseInt(h.substring(4, 6), 16) / 255];
    };

    const colorBlocks = swatches.map((s) => {
      const colorName = s.name || s.code || "Color";
      const [r, g, b] = hexToRgbFloat(s.hex);
      const nameCharCount = colorName.length + 1;
      const nameBytesLen = nameCharCount * 2;
      const blockDataSize = 2 + nameBytesLen + 4 + 12 + 2;
      const block = new ArrayBuffer(2 + 4 + blockDataSize);
      const v = new DataView(block);
      let o = 0;
      v.setUint16(o, 0x0001);o += 2;
      v.setUint32(o, blockDataSize);o += 4;
      v.setUint16(o, nameCharCount);o += 2;
      for (let i = 0; i < colorName.length; i++) {v.setUint16(o, colorName.charCodeAt(i));o += 2;}
      v.setUint16(o, 0);o += 2;
      v.setUint8(o, 0x52);v.setUint8(o + 1, 0x47);v.setUint8(o + 2, 0x42);v.setUint8(o + 3, 0x20);o += 4;
      v.setFloat32(o, r);o += 4;
      v.setFloat32(o, g);o += 4;
      v.setFloat32(o, b);o += 4;
      v.setUint16(o, 0);o += 2;
      return block;
    });

    const header = new ArrayBuffer(12);
    const hv = new DataView(header);
    hv.setUint8(0, 0x41);hv.setUint8(1, 0x53);hv.setUint8(2, 0x45);hv.setUint8(3, 0x46);
    hv.setUint16(4, 1);hv.setUint16(6, 0);
    hv.setUint32(8, colorBlocks.length);

    const totalSize = header.byteLength + colorBlocks.reduce((s, b) => s + b.byteLength, 0);
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    combined.set(new Uint8Array(header), offset);offset += header.byteLength;
    for (const block of colorBlocks) {combined.set(new Uint8Array(block), offset);offset += block.byteLength;}

    const blob = new Blob([combined], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedPalette?.name?.replace(/\s+/g, "_") || "palette"}.ase`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSwatchData = (paletteId) => {
    const entries = paletteColors.
    filter((pc) => pc.palette_id === paletteId).
    sort((a, b) => (a.sort_order ?? 999999) - (b.sort_order ?? 999999));

    const commEntries = entries.filter((e) => e.color_type === "commercial");
    const commColorIdsInPalette = new Set(commEntries.map((e) => e.color_id));

    const result = [];

    // Commercial colors first
    for (const e of commEntries) {
      const c = commColors.find((c) => c.id === e.color_id);
      if (!c) continue;
      const t = techColors.find((t) => t.id === c.main_technical_color_id);
      const linkedHexes = c.linked_technical_color_ids?.length > 1 ?
      c.linked_technical_color_ids.map((id) => {const lt = techColors.find((t) => t.id === id);return lt?.hex || "#ccc";}) :
      null;
      result.push({ id: e.id, hex: t?.hex || "#ccc", name: c.color_name || "", code: c.code || "", commCode: null, linkedHexes, isUnlinked: false });
    }

    // Only truly unlinked technical colors (no commercial in this palette references them)
    for (const e of entries.filter((e) => e.color_type === "technical")) {
      const linkedComm = commColors.find((c) =>
      (c.main_technical_color_id === e.color_id || (c.linked_technical_color_ids || []).includes(e.color_id)) &&
      commColorIdsInPalette.has(c.id)
      );
      if (linkedComm) continue; // already represented by its commercial entry
      const t = techColors.find((c) => c.id === e.color_id);
      result.push({ id: e.id, hex: t?.hex || "#ccc", name: t?.name || "", code: t?.code || "", commCode: null, isUnlinked: true, techColorObj: t });
    }

    return result;
  };

  const getAvailableColors = () => {
    const linkedIds = new Set(paletteColors.filter((pc) => pc.palette_id === selectedPaletteId).map((pc) => pc.color_id));
    const q = colorSearch.toLowerCase();
    const techFiltered = techColors.filter((t) => {
      if (linkedIds.has(t.id)) return false;
      if (!q) return true;
      const linkedComm = commColors.find((c) => c.main_technical_color_id === t.id || (c.linked_technical_color_ids || []).includes(t.id));
      return t.code?.toLowerCase().includes(q) || t.name?.toLowerCase().includes(q) || linkedComm?.code?.toLowerCase().includes(q);
    });
    const commFiltered = commColors.filter((c) => {
      if (linkedIds.has(c.id)) return false;
      if (!q) return true;
      if (c.code?.toLowerCase().includes(q) || c.color_name?.toLowerCase().includes(q)) return true;
      // also search by linked tech color codes
      const linkedTechCodes = (c.linked_technical_color_ids || []).map((id) => techColors.find((t) => t.id === id)?.code).filter(Boolean);
      return linkedTechCodes.some((tc) => tc.toLowerCase().includes(q));
    });
    return { techFiltered, commFiltered };
  };

  const filtered = palettes.filter((p) => {
    if (!paletteSearch) return true;
    const q = paletteSearch.toLowerCase();
    return p.name?.toLowerCase().includes(q);
  });

  const selectedPalette = palettes.find((p) => p.id === selectedPaletteId);
  const selectedSwatches = selectedPaletteId ? getSwatchData(selectedPaletteId) : [];
  const selectedProject = selectedPalette ? projects.find((p) => p.id === selectedPalette.project_id) : null;

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>);


  const pageTitle = activeSection === "technical" ? "Technical Color" : activeSection === "commercial" ? "Commercial Colors" : "Color Studio";

  return (
    <div className="px-2 py-2 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{pageTitle}</h1>
      </div>

      {activeSection === "palettes" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Palettes Panel */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Palettes ({palettes.length})</h3>
                <Button onClick={openNew} size="sm" className="gap-1.5 h-8">
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
              <Input
                placeholder="Search palettes…"
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                className="h-8 text-xs" />
              
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filtered.length === 0 &&
                <p className="text-sm text-muted-foreground text-center py-6">No palettes yet</p>
                }
                {filtered.map((p) => {
                  const swatches = getSwatchData(p.id);
                  const project = projects.find((pr) => pr.id === p.project_id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPaletteId(p.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPaletteId === p.id ?
                      "bg-primary/10 border-primary" :
                      "border-border hover:bg-muted"}`
                      }>
                      
                      <div className="h-6 rounded-md overflow-hidden flex mb-2">
                        {swatches.length === 0 ?
                        <div className="w-full bg-muted" /> :

                        swatches.slice(0, 10).map((s, i) =>
                        s.linkedHexes?.length > 1 ?
                        <div key={i} className="flex-1 flex overflow-hidden">
                                {s.linkedHexes.map((h, j) => <div key={j} className="flex-1 h-full" style={{ backgroundColor: h }} />)}
                              </div> :

                        <div key={i} className="flex-1" style={{ backgroundColor: s.hex }} />

                        )
                        }
                      </div>
                      <div className={`font-medium text-sm ${selectedPaletteId === p.id ? "text-primary" : ""}`}>{p.name}</div>
                      {project &&
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" />{project.name}
                        </div>
                      }
                      <div className="text-xs text-muted-foreground mt-1">{swatches.length} color{swatches.length !== 1 ? "s" : ""}</div>
                      <div className="flex gap-1 mt-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {e.stopPropagation();openEdit(p);}}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => {e.stopPropagation();handleDelete(p);}}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>);

                })}
              </div>
            </div>

            {/* Detail Panel */}
            <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 space-y-4">
              {!selectedPalette ?
              <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Palette className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Select a palette to see its colors</p>
                </div> :

              <>
                  <div>
                    <h3 className="font-semibold">{selectedPalette.name}</h3>
                    {selectedProject &&
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <FolderOpen className="w-3 h-3" />{selectedProject.name}
                      </p>
                  }
                  </div>

                  {/* Color Picker */}
                  {showColorPicker && (() => {
                  const { techFiltered, commFiltered } = getAvailableColors();
                  const items = colorTab === "technical" ?
                  techFiltered.map((t) => {
                    const linkedComm = commColors.find((c) => c.main_technical_color_id === t.id || (c.linked_technical_color_ids || []).includes(t.id));
                    return { key: `technical:${t.id}`, hex: t.hex || "#ccc", label: t.name, sub: t.code, commCode: linkedComm?.code };
                  }) :
                  commFiltered.map((c) => {
                    const mainTech = techColors.find((t) => t.id === c.main_technical_color_id);
                    const linkedHexes = c.linked_technical_color_ids?.length > 1 ?
                    (c.linked_technical_color_ids || []).map((id) => techColors.find((t) => t.id === id)?.hex).filter(Boolean) :
                    null;
                    const techCode = mainTech?.code;
                    return { key: `commercial:${c.id}`, hex: mainTech?.hex || "#ccc", linkedHexes, label: c.color_name, sub: c.code, techCode };
                  });
                  return (
                    <div className="border border-border rounded-lg overflow-hidden">
                        <div className="flex border-b border-border">
                          <button type="button" onClick={() => setColorTab("technical")}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${colorTab === "technical" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
                            Technical ({techFiltered.length})
                          </button>
                          <button type="button" onClick={() => setColorTab("commercial")}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${colorTab === "commercial" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
                            Commercial ({commFiltered.length})
                          </button>
                        </div>
                        <div className="p-2 border-b border-border">
                          <Input value={colorSearch} onChange={(e) => setColorSearch(e.target.value)} placeholder="Search colors…" className="h-8 text-xs" autoFocus />
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {items.map((item) => {
                          const selected = selectedColorIds.has(item.key);
                          return (
                            <button key={item.key} type="button"
                            onClick={() => toggleColorSelection(item.key)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${selected ? "bg-primary/10" : "hover:bg-muted"}`}>
                                {item.linkedHexes?.length > 1 ?
                              <div className="w-5 h-5 rounded-sm border border-border shrink-0 overflow-hidden flex">
                                    {item.linkedHexes.map((h, i) => <div key={i} className="flex-1 h-full" style={{ backgroundColor: h }} />)}
                                  </div> :

                              <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: item.hex }} />
                              }
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-medium block truncate">{item.label}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    {item.sub}
                                    {item.commCode ? <span className="ml-1.5 text-primary/70">· {item.commCode}</span> : null}
                                    {item.techCode ? <span className="ml-1.5 text-muted-foreground/70">· {item.techCode}</span> : null}
                                  </span>
                                </div>
                                {selected && <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0"><div className="w-2 h-2 rounded-full bg-white" /></div>}
                              </button>);

                        })}
                          {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No more colors to add</p>}
                        </div>
                        <div className="p-2 border-t border-border flex gap-2">
                          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => colorTab === "technical" ? openNewTech() : openNewComm()}>
                            <Plus className="w-3 h-3" /> New
                          </Button>
                          <Button size="sm" className="flex-1 text-xs gap-1.5" disabled={selectedColorIds.size === 0 || addingColors} onClick={handleAddSelectedColors}>
                            {addingColors && <Loader2 className="w-3 h-3 animate-spin" />}
                            Add {selectedColorIds.size > 0 ? `(${selectedColorIds.size})` : ""}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowColorPicker(false)}>Cancel</Button>
                        </div>
                      </div>);

                })()}

                  {/* Full color strip */}
                  {selectedSwatches.length > 0 &&
                <div className="h-12 rounded-lg overflow-hidden flex border border-border">
                      {selectedSwatches.map((s, i) =>
                  s.linkedHexes?.length > 1 ?
                  <div key={i} className="flex-1 flex overflow-hidden" title={s.name || s.code}>
                            {s.linkedHexes.map((h, j) => <div key={j} className="flex-1 h-full" style={{ backgroundColor: h }} />)}
                          </div> :

                  <div key={i} className="flex-1" style={{ backgroundColor: s.hex }} title={s.name || s.code} />

                  )}
                    </div>
                }

                  {/* Color cards grid — commercial-led layout via shared component */}
                  <PaletteColorGrid
                   paletteColors={paletteColors}
                   paletteId={selectedPaletteId}
                   techColors={techColors}
                   commColors={commColors}
                   swatches={selectedSwatches}
                   onRemove={(entryId, linkedTechEntryIds) => handleRemoveColor({ id: entryId, linkedTechEntryIds })}
                   onLinkTech={(tech) => setLinkingTechColor(tech)}
                   onReorder={handleReorderColors}
                   size={paletteCardSize} />
                
                </>
              }
            </div>
          </div>
      )}

      {activeSection === "technical" && (
        <div className="space-y-4">
          <Input value={techSearch} onChange={(e) => setTechSearch(e.target.value)} placeholder="Search technical colors…" className="max-w-sm h-8 text-xs" />
          {techView === "table" ? (
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium">Color</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Code</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Hex</th>
                    <th className="px-4 py-2 text-right text-xs font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {techColors.filter(c => !techSearch || c.code?.toLowerCase().includes(techSearch.toLowerCase()) || c.name?.toLowerCase().includes(techSearch.toLowerCase())).map(c => (
                    <tr key={c.id} className="border-b border-border hover:bg-muted/50">
                      <td className="px-4 py-2"><div className="w-6 h-6 rounded-sm border border-border" style={{backgroundColor: colorToHex(c)}} /></td>
                      <td className="px-4 py-2 text-xs font-mono">{c.code}</td>
                      <td className="px-4 py-2 text-xs">{c.name}</td>
                      <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{colorToHex(c)}</td>
                      <td className="px-4 py-2 text-right"><Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => base44.entities.TechnicalColor.delete(c.id).then(() => setTechColors(prev => prev.filter(t => t.id !== c.id)))}><Trash2 className="w-3 h-3" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {techColors.filter(c => !techSearch || c.code?.toLowerCase().includes(techSearch.toLowerCase()) || c.name?.toLowerCase().includes(techSearch.toLowerCase())).map(c => (
                <div key={c.id} className="rounded-lg border border-border overflow-hidden bg-card hover:shadow-md transition-shadow">
                  <div className="aspect-square" style={{backgroundColor: colorToHex(c)}} />
                  <div className="p-2 space-y-1">
                    <p className="text-xs font-mono font-medium truncate">{c.code}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive mx-auto" onClick={() => base44.entities.TechnicalColor.delete(c.id).then(() => setTechColors(prev => prev.filter(t => t.id !== c.id)))}><Trash2 className="w-2.5 h-2.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === "commercial" && (
        <div className="space-y-4">
          <Input value={commSearch} onChange={(e) => setCommSearch(e.target.value)} placeholder="Search commercial colors…" className="max-w-sm h-8 text-xs" />
          {commView === "table" ? (
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium">Color</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Code</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Type</th>
                    <th className="px-4 py-2 text-right text-xs font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {commColors.filter(c => !commSearch || c.code?.toLowerCase().includes(commSearch.toLowerCase()) || c.color_name?.toLowerCase().includes(commSearch.toLowerCase())).map(c => {
                    const tech = techColors.find(t => t.id === c.main_technical_color_id);
                    return (
                      <tr key={c.id} className="border-b border-border hover:bg-muted/50">
                        <td className="px-4 py-2"><div className="w-6 h-6 rounded-sm border border-border" style={{backgroundColor: tech ? colorToHex(tech) : "#ccc"}} /></td>
                        <td className="px-4 py-2 text-xs font-mono">{c.code}</td>
                        <td className="px-4 py-2 text-xs">{c.color_name}</td>
                        <td className="px-4 py-2 text-xs">{c.sub_type}</td>
                        <td className="px-4 py-2 text-right"><Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => base44.entities.CommercialColor.delete(c.id).then(() => setCommColors(prev => prev.filter(cc => cc.id !== c.id)))}><Trash2 className="w-3 h-3" /></Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {commColors.filter(c => !commSearch || c.code?.toLowerCase().includes(commSearch.toLowerCase()) || c.color_name?.toLowerCase().includes(commSearch.toLowerCase())).map(c => {
                const tech = techColors.find(t => t.id === c.main_technical_color_id);
                return (
                  <div key={c.id} className="rounded-lg border border-border overflow-hidden bg-card hover:shadow-md transition-shadow">
                    <div className="aspect-square" style={{backgroundColor: tech ? colorToHex(tech) : "#ccc"}} />
                    <div className="p-2 space-y-1">
                      <p className="text-xs font-mono font-medium truncate">{c.code}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.color_name}</p>
                      <p className="text-[10px] text-muted-foreground text-center">{c.sub_type}</p>
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive mx-auto" onClick={() => base44.entities.CommercialColor.delete(c.id).then(() => setCommColors(prev => prev.filter(cc => cc.id !== c.id)))}><Trash2 className="w-2.5 h-2.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Link Commercial Color dialog */}
      {linkingTechColor &&
      <LinkCommercialColorDialog
        techColor={linkingTechColor}
        commColors={commColors}
        setCommColors={setCommColors}
        onClose={() => setLinkingTechColor(null)} />

      }

      {/* Palette Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => {if (!o) {setShowDialog(false);setEditingPalette(null);}}}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingPalette ? "Edit Palette" : "New Color Palette"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editingPalette ? handleUpdate : handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Project</Label>
              <Select value={form.project_id || "none"} onValueChange={(v) => handleProjectChange(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select a project…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Palette Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Spring Collection Palette" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {setShowDialog(false);setEditingPalette(null);}}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}{editingPalette ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Technical Color Dialog */}
      <Dialog open={showTechDialog} onOpenChange={setShowTechDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Technical Color</DialogTitle></DialogHeader>
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
              <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Create & Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Editor Dialog - Full Featured */}
      <Dialog open={showViewEditor} onOpenChange={(o) => { if (!o) { setShowViewEditor(false); setEditorMode("list"); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editorMode === "list" ? "Views" : editorMode === "new" ? "New View" : `Edit: ${editingView?.name}`}</DialogTitle>
          </DialogHeader>

          {editorMode === "list" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                <span className="flex-1 text-sm font-medium">Default</span>
              </div>
              {(activeSection === "technical" ? techViews : commViews).map((v) => (
                <div key={v.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border">
                  <span className="flex-1 text-sm font-medium">{v.name}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingView(v); setViewFormName(v.name); setViewFormColumns(v.column_ids || []); setViewFormFilters(v.filters_config || DEFAULT_FILTERS); setViewFormRoles(v.allowed_roles || []); setEditorTab("columns"); setEditorMode("edit"); }}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { setSaving(true); if (activeSection === "technical") { setTechViews(techViews.filter(vv => vv.id !== v.id)); } else { setCommViews(commViews.filter(vv => vv.id !== v.id)); } if (activeViewId === v.id) setActiveViewId("default"); setSaving(false); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
              {(activeSection === "technical" ? techViews : commViews).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No custom views yet</p>}
              <Button onClick={() => { setEditingView(null); setViewFormName(""); setViewFormColumns(activeSection === "technical" ? ["color", "code", "name", "hex"] : ["color", "code", "name", "type"]); setViewFormFilters(DEFAULT_FILTERS); setViewFormRoles([]); setRoleInput(""); setEditorTab("columns"); setEditorMode("new"); }} className="gap-2 w-full" variant="outline"><Plus className="w-4 h-4" /> New View</Button>
            </div>
          )}

          {(editorMode === "new" || editorMode === "edit") && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">View Name</Label>
                <Input value={viewFormName} onChange={(e) => setViewFormName(e.target.value)} placeholder="e.g. Sales View" autoFocus />
              </div>

              <Tabs value={editorTab} onValueChange={setEditorTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="columns" className="flex-1 text-xs">Columns</TabsTrigger>
                  <TabsTrigger value="filters" className="flex-1 text-xs">Filters</TabsTrigger>
                  <TabsTrigger value="roles" className="flex-1 text-xs">Roles</TabsTrigger>
                </TabsList>

                {/* COLUMNS */}
                <TabsContent value="columns" className="mt-3">
                  <div className="mb-2">
                    <Input value={columnSearch} onChange={(e) => setColumnSearch(e.target.value)} placeholder="Search columns…" className="h-7 text-xs" />
                  </div>
                  {(() => {
                    const allFields = activeSection === "technical" 
                      ? ["color", "code", "name", "hex", "rgb", "cmyk", "color_group", "color_sub_group", "commercial"] 
                      : ["color", "code", "name", "type", "technical_color"];
                    const q = columnSearch.toLowerCase();
                    const checked = viewFormColumns.map(id => ({ id, label: id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));
                    const unchecked = allFields.filter(f => !viewFormColumns.includes(f)).map(id => ({ id, label: id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));
                    const filteredChecked = q ? checked.filter(c => c.label.toLowerCase().includes(q)) : checked;
                    const filteredUnchecked = q ? unchecked.filter(c => c.label.toLowerCase().includes(q)) : unchecked;
                    const handleDragEnd = (result) => {
                      if (!result.destination) return;
                      const newIds = [...viewFormColumns];
                      const [removed] = newIds.splice(result.source.index, 1);
                      newIds.splice(result.destination.index, 0, removed);
                      setViewFormColumns(newIds);
                    };
                    const pinnedCols = filteredChecked.filter(c => viewFormFixedColumnIds.includes(c.id));
                    const unpinnedCols = filteredChecked.filter(c => !viewFormFixedColumnIds.includes(c.id));
                    return (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <DragDropContext onDragEnd={handleDragEnd}>
                          <Droppable droppableId="columns-checked">
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.droppableProps} className="max-h-44 overflow-y-auto divide-y divide-border">
                                {pinnedCols.map((col, index) => (
                                  <Draggable key={col.id} draggableId={col.id} index={index}>
                                    {(drag, snapshot) => (
                                      <div ref={drag.innerRef} {...drag.draggableProps} style={drag.draggableProps.style} className={`flex items-center gap-2.5 px-3 py-2 bg-primary/5 ${snapshot.isDragging ? "shadow-lg border border-border" : ""}`}>
                                        <div {...drag.dragHandleProps} className="text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"><GripVertical className="w-3.5 h-3.5" /></div>
                                        <Checkbox checked={true} onCheckedChange={() => setViewFormColumns(viewFormColumns.filter(c => c !== col.id))} id={`col-${col.id}`} />
                                        <label htmlFor={`col-${col.id}`} className="flex-1 text-sm cursor-pointer">{col.label}</label>
                                        <button type="button" title="Unpin column" onClick={() => setViewFormFixedColumnIds((prev) => prev.filter((id) => id !== col.id))} className="p-0.5 rounded hover:bg-muted transition-colors text-primary"><Pin className="w-3 h-3" /></button>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {unpinnedCols.map((col, index) => (
                                  <Draggable key={col.id} draggableId={col.id} index={pinnedCols.length + index}>
                                    {(drag, snapshot) => (
                                      <div ref={drag.innerRef} {...drag.draggableProps} style={drag.draggableProps.style} className={`flex items-center gap-2.5 px-3 py-2 bg-card ${snapshot.isDragging ? "shadow-lg border border-border" : ""}`}>
                                        <div {...drag.dragHandleProps} className="text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"><GripVertical className="w-3.5 h-3.5" /></div>
                                        <Checkbox checked={true} onCheckedChange={() => setViewFormColumns(viewFormColumns.filter(c => c !== col.id))} id={`col-${col.id}`} />
                                        <label htmlFor={`col-${col.id}`} className="flex-1 text-sm cursor-pointer">{col.label}</label>
                                        <button type="button" title="Pin column" onClick={() => setViewFormFixedColumnIds((prev) => [...prev, col.id])} className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground"><Pin className="w-3 h-3" /></button>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
                        {filteredUnchecked.length > 0 && (
                          <div className="border-t border-border max-h-24 overflow-y-auto divide-y divide-border">
                            {filteredUnchecked.map((col) => (
                              <div key={col.id} className="flex items-center gap-2.5 px-3 py-2 opacity-50">
                                <div className="w-3.5 h-3.5 shrink-0" />
                                <Checkbox checked={false} onCheckedChange={() => setViewFormColumns([...viewFormColumns, col.id])} id={`col-${col.id}`} />
                                <label htmlFor={`col-${col.id}`} className="flex-1 text-sm cursor-pointer">{col.label}</label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </TabsContent>

                {/* FILTERS */}
                <TabsContent value="filters" className="mt-3 space-y-3">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {viewFormFilters.filters.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No filters yet. Add one below.</p>}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setViewFormFilters((f) => ({ ...f, filters: [...f.filters, { field: "", operator: "and", values: [] }] }))} className="gap-1.5 text-xs w-full"><Plus className="w-3.5 h-3.5" /> Add Filter</Button>
                </TabsContent>

                {/* ROLES */}
                <TabsContent value="roles" className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">Restrict this view to specific user roles. Leave empty to allow all roles.</p>
                  <div className="flex gap-2">
                    <Input value={roleInput} onChange={(e) => setRoleInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (roleInput.trim() && !viewFormRoles.includes(roleInput.trim())) { setViewFormRoles([...viewFormRoles, roleInput.trim()]); setRoleInput(""); } } }} placeholder="e.g. admin, manager…" className="h-8 text-xs flex-1" />
                    <Button type="button" variant="outline" size="sm" onClick={() => { if (roleInput.trim() && !viewFormRoles.includes(roleInput.trim())) { setViewFormRoles([...viewFormRoles, roleInput.trim()]); setRoleInput(""); } }} className="h-8 text-xs gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                  </div>
                  {viewFormRoles.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg p-3"><ShieldCheck className="w-4 h-4" /> Visible to all roles</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {viewFormRoles.map((r) => (
                        <div key={r} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full border border-primary/20"><ShieldCheck className="w-3 h-3" />{r}<button type="button" onClick={() => setViewFormRoles(viewFormRoles.filter(rr => rr !== r))} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button></div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditorMode("list")}>Back</Button>
                <Button onClick={async () => { if (!viewFormName.trim()) return; setSaving(true); const newView = { id: editingView?.id || `view_${Date.now()}`, name: viewFormName, page_key: activeSection === "technical" ? "technical_colors" : "commercial_colors", column_ids: viewFormColumns, fixed_column_ids: viewFormFixedColumnIds, filters_config: viewFormFilters, allowed_roles: viewFormRoles }; try { if (editingView) { await base44.entities.ListViewConfig.update(editingView.id, newView); } else { await base44.entities.ListViewConfig.create(newView); } } catch (err) { console.error("Error saving view:", err); } if (activeSection === "technical") { if (editingView) { setTechViews(techViews.map(v => v.id === newView.id ? newView : v)); } else { setTechViews([...techViews, newView]); } } else { if (editingView) { setCommViews(commViews.map(v => v.id === newView.id ? newView : v)); } else { setCommViews([...commViews, newView]); } } setActiveViewId(newView.id); setShowViewEditor(false); setSaving(false); }} disabled={saving || !viewFormName.trim()} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}{editorMode === "new" ? "Create & Apply" : "Save"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Commercial Color Dialog */}
      <Dialog open={showCommDialog} onOpenChange={setShowCommDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Commercial Color</DialogTitle></DialogHeader>
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
              {commForm.main_technical_color_id ?
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
                  {(() => {const t = techColors.find((t) => t.id === commForm.main_technical_color_id);return t ? <><div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: colorToHex(t) }} /><span className="text-xs flex-1">{tcxDisplayName(t)}</span></> : null;})()}
                  <button type="button" onClick={() => {setCommForm((f) => ({ ...f, main_technical_color_id: "" }));setTechSearch("");}} className="text-xs text-muted-foreground hover:text-foreground ml-auto">✕</button>
                </div> :

              <div className="border border-border rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <Input value={techSearch} onChange={(e) => setTechSearch(e.target.value)} placeholder="Search by code or name…" className="h-8 text-xs" />
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    {techColors.
                  filter((t) => !techSearch || t.code?.toLowerCase().includes(techSearch.toLowerCase()) || t.name?.toLowerCase().includes(techSearch.toLowerCase())).
                  map((t) =>
                  <button key={t.id} type="button" onClick={() => handleTechSelectForComm(t.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted text-left transition-colors">
                          <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: colorToHex(t) }} />
                          <span className="text-xs">{tcxDisplayName(t)}</span>
                        </button>
                  )}
                    {techColors.filter((t) => !techSearch || t.code?.toLowerCase().includes(techSearch.toLowerCase()) || t.name?.toLowerCase().includes(techSearch.toLowerCase())).length === 0 &&
                  <p className="text-xs text-muted-foreground text-center py-4">No colors found</p>
                  }
                  </div>
                </div>
              }
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Color Name</Label>
              <Input value={commForm.color_name} onChange={(e) => setCommForm((f) => ({ ...f, color_name: e.target.value }))} placeholder="Inherits from technical color, editable" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Linked Technical Colors</Label>
              {commForm.linked_technical_color_ids.length > 0 &&
              <div className="flex flex-wrap gap-1.5 mb-2">
                  {commForm.linked_technical_color_ids.map((id) => {
                  const t = techColors.find((c) => c.id === id);
                  if (!t) return null;
                  const isMain = id === commForm.main_technical_color_id;
                  return (
                    <div key={id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted border border-border text-xs">
                        <div className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: colorToHex(t) }} />
                        <span>{tcxDisplayName(t)}</span>
                        {isMain && <span className="text-[10px] text-primary font-medium">(main)</span>}
                        <button type="button" onClick={() => setCommForm((f) => ({ ...f, linked_technical_color_ids: f.linked_technical_color_ids.filter((i) => i !== id) }))} className="text-muted-foreground hover:text-destructive ml-0.5">×</button>
                      </div>);

                })}
                </div>
              }
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="p-2 border-b border-border">
                  <Input value={linkedTechSearch} onChange={(e) => setLinkedTechSearch(e.target.value)} placeholder="Search to add more technical colors…" className="h-8 text-xs" />
                </div>
                <div className="max-h-36 overflow-y-auto">
                  {techColors.
                  filter((t) => !commForm.linked_technical_color_ids.includes(t.id)).
                  filter((t) => !linkedTechSearch || t.code?.toLowerCase().includes(linkedTechSearch.toLowerCase()) || t.name?.toLowerCase().includes(linkedTechSearch.toLowerCase())).
                  map((t) =>
                  <button key={t.id} type="button"
                  onClick={() => {setCommForm((f) => ({ ...f, linked_technical_color_ids: [...f.linked_technical_color_ids, t.id] }));setLinkedTechSearch("");}}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted text-left transition-colors">
                        <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: colorToHex(t) }} />
                        <span className="text-xs">{tcxDisplayName(t)}</span>
                      </button>
                  )}
                  {techColors.filter((t) => !commForm.linked_technical_color_ids.includes(t.id) && (!linkedTechSearch || t.code?.toLowerCase().includes(linkedTechSearch.toLowerCase()) || t.name?.toLowerCase().includes(linkedTechSearch.toLowerCase()))).length === 0 &&
                  <p className="text-xs text-muted-foreground text-center py-3">No more colors to add</p>
                  }
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCommDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Create & Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>);

}