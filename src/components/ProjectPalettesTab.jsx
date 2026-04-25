import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, Palette, FolderOpen, Pencil, Trash2, Download } from "lucide-react";
import { colorToHex, tcxDisplayName } from "../lib/pantone-tcx";
import LinkCommercialColorDialog from "./LinkCommercialColorDialog";
import PaletteColorGrid, { SizeControl } from "./PaletteColorGrid";

export default function ProjectPalettesTab({
  projectId, projectName,
  palettes, setPalettes,
  paletteColors, setPaletteColors,
  techColors, setTechColors,
  commColors, setCommColors,
}) {
  const [selectedPaletteId, setSelectedPaletteId] = useState(null);
  const [paletteSearch, setPaletteSearch] = useState("");

  // Create / Edit palette dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editingPalette, setEditingPalette] = useState(null);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  // Add colors picker (inline panel)
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorTab, setColorTab] = useState("technical");
  const [colorSearch, setColorSearch] = useState("");
  const [selectedColorIds, setSelectedColorIds] = useState(new Set());
  const [addingColors, setAddingColors] = useState(false);

  // New tech color dialog
  const [showTechDialog, setShowTechDialog] = useState(false);
  const [techForm, setTechForm] = useState({ code: "", name: "", hex: "#cccccc" });

  // New commercial color dialog
  const [showCommDialog, setShowCommDialog] = useState(false);
  const [commForm, setCommForm] = useState({ sub_type: "Solid", code: "", main_technical_color_id: "", linked_technical_color_ids: [], color_name: "" });
  const [techSearch, setTechSearch] = useState("");
  const [linkedTechSearch, setLinkedTechSearch] = useState("");

  const [paletteCardSize, setPaletteCardSize] = useState(() => { try { return localStorage.getItem("palette_card_size") || "M"; } catch { return "M"; } });

  // Link commercial color dialog
  const [linkingTechColor, setLinkingTechColor] = useState(null); // TechnicalColor object

  // ── Palette CRUD ─────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditingPalette(null);
    setFormName("");
    setShowDialog(true);
  };

  const openEdit = (palette) => {
    setEditingPalette(palette);
    setFormName(palette.name);
    setShowDialog(true);
  };

  const handleSavePalette = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editingPalette) {
      await base44.entities.ColorPalette.update(editingPalette.id, { name: formName, project_id: projectId });
      setPalettes((prev) => prev.map((p) => p.id === editingPalette.id ? { ...p, name: formName } : p));
    } else {
      const created = await base44.entities.ColorPalette.create({ name: formName, project_id: projectId });
      setPalettes((prev) => [created, ...prev]);
      setSelectedPaletteId(created.id);
    }
    setShowDialog(false);
    setEditingPalette(null);
    setSaving(false);
  };

  const handleDelete = async (palette) => {
    await base44.entities.ColorPalette.delete(palette.id);
    setPalettes((prev) => prev.filter((p) => p.id !== palette.id));
    if (selectedPaletteId === palette.id) setSelectedPaletteId(null);
  };

  // ── Color helpers ─────────────────────────────────────────────────────────────

  const getSwatchData = (paletteId) => {
    const entries = paletteColors
      .filter((pc) => pc.palette_id === paletteId)
      .sort((a, b) => (a.sort_order ?? 999999) - (b.sort_order ?? 999999));

    const commEntries = entries.filter((e) => e.color_type === "commercial");
    const commColorIdsInPalette = new Set(commEntries.map((e) => e.color_id));

    const result = [];

    // Commercial colors
    for (const e of commEntries) {
      const c = commColors.find((c) => c.id === e.color_id);
      if (!c) continue;
      const t = techColors.find((t) => t.id === c.main_technical_color_id);
      const linkedHexes = c.linked_technical_color_ids?.length > 1
        ? c.linked_technical_color_ids.map((lid) => { const lt = techColors.find((t) => t.id === lid); return lt?.hex || "#ccc"; })
        : null;
      result.push({ id: e.id, hex: t?.hex || "#ccc", name: c.color_name || "", code: c.code || "", commCode: null, linkedHexes, isUnlinked: false });
    }

    // Only truly unlinked technical colors
    for (const e of entries.filter((e) => e.color_type === "technical")) {
      const linkedComm = commColors.find((c) =>
        (c.main_technical_color_id === e.color_id || (c.linked_technical_color_ids || []).includes(e.color_id)) &&
        commColorIdsInPalette.has(c.id)
      );
      if (linkedComm) continue;
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
    const commFiltered = commColors.filter((c) => !linkedIds.has(c.id) && (!q || c.code?.toLowerCase().includes(q) || c.color_name?.toLowerCase().includes(q)));
    return { techFiltered, commFiltered };
  };

  const toggleColorSelection = (key) => {
    setSelectedColorIds((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const openColorPicker = async () => {
    setSelectedColorIds(new Set());
    setColorSearch("");
    setColorTab("technical");
    setShowColorPicker(true);
    const [tc, cc] = await Promise.all([
      base44.entities.TechnicalColor.list("code", 2000),
      base44.entities.CommercialColor.list("code", 2000),
    ]);
    setTechColors(tc);
    setCommColors(cc);
  };

  const handleAddSelectedColors = async () => {
    setAddingColors(true);

    // Build the set of already-in-palette color IDs
    const alreadyInPalette = new Set(
      paletteColors.filter((pc) => pc.palette_id === selectedPaletteId).map((pc) => pc.color_id)
    );

    // Start with explicitly selected entries
    const toAdd = [...selectedColorIds].map((key) => {
      const [t, i] = key.split(":");
      return { palette_id: selectedPaletteId, color_type: t, color_id: i };
    });

    // Collect auto-companion entries
    const companions = [];
    for (const { color_type, color_id } of toAdd) {
      if (color_type === "commercial") {
        // Rule 1: add the main technical color if not already present
        const comm = commColors.find((c) => c.id === color_id);
        if (comm?.main_technical_color_id && !alreadyInPalette.has(comm.main_technical_color_id) &&
            !toAdd.some((e) => e.color_type === "technical" && e.color_id === comm.main_technical_color_id) &&
            !companions.some((e) => e.color_type === "technical" && e.color_id === comm.main_technical_color_id)) {
          companions.push({ palette_id: selectedPaletteId, color_type: "technical", color_id: comm.main_technical_color_id });
        }
      } else if (color_type === "technical") {
        // Rule 2: add the linked commercial color if not already present
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
    const newEntries = await Promise.all(allEntries.map((d) => base44.entities.ColorPaletteColor.create(d)));
    setPaletteColors((prev) => [...prev, ...newEntries]);
    setAddingColors(false);
    setShowColorPicker(false);
  };

  const handleReorderColors = async (orderedEntryIds) => {
    setPaletteColors((prev) => prev.map((pc) => {
      const idx = orderedEntryIds.indexOf(pc.id);
      if (idx === -1) return pc;
      return { ...pc, sort_order: idx };
    }));
    await Promise.all(orderedEntryIds.map((id, idx) =>
      base44.entities.ColorPaletteColor.update(id, { sort_order: idx })
    ));
  };

  const handleRemoveColor = async (entryId, linkedTechEntryIds = []) => {
    const allIds = [entryId, ...linkedTechEntryIds];
    await Promise.all(allIds.map((id) => base44.entities.ColorPaletteColor.delete(id)));
    setPaletteColors((prev) => prev.filter((pc) => !allIds.includes(pc.id)));
  };

  // ── New Technical Color ───────────────────────────────────────────────────────

  const saveTech = async (e) => {
    e.preventDefault();
    setSaving(true);
    const created = await base44.entities.TechnicalColor.create(techForm);
    setTechColors((prev) => [...prev, created]);
    const linked = await base44.entities.ColorPaletteColor.create({ palette_id: selectedPaletteId, color_type: "technical", color_id: created.id });
    setPaletteColors((prev) => [...prev, linked]);
    setShowTechDialog(false);
    setSaving(false);
  };

  // ── New Commercial Color ──────────────────────────────────────────────────────

  const openNewComm = async () => {
    setCommForm({ sub_type: "Solid", code: "", main_technical_color_id: "", linked_technical_color_ids: [], color_name: "" });
    setTechSearch(""); setLinkedTechSearch("");
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
      linked_technical_color_ids: f.linked_technical_color_ids.includes(techId) ? f.linked_technical_color_ids : [...f.linked_technical_color_ids, techId],
    }));
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

  // ── ASE Export ───────────────────────────────────────────────────────────────

  const exportASE = () => {
    const swatches = getSwatchData(selectedPaletteId);
    if (!swatches.length) return;

    const hexToRgbFloat = (hex) => {
      const h = hex.replace("#", "");
      const r = parseInt(h.substring(0, 2), 16) / 255;
      const g = parseInt(h.substring(2, 4), 16) / 255;
      const b = parseInt(h.substring(4, 6), 16) / 255;
      return [r, g, b];
    };

    // Build all color blocks first so we know total count
    const colorBlocks = swatches.map((s) => {
      const colorName = s.name || s.code || "Color";
      const [r, g, b] = hexToRgbFloat(s.hex || "#cccccc");

      // Name field: uint16 char count (including null) + UTF-16BE chars + null terminator
      const nameCharCount = colorName.length + 1; // includes null terminator
      const nameBytesLen = nameCharCount * 2;      // each char is 2 bytes

      // Block data = 2 (name char count) + nameBytesLen + 4 (model) + 12 (3×float32) + 2 (color type)
      const blockDataSize = 2 + nameBytesLen + 4 + 12 + 2;

      // Total buffer = 2 (block type) + 4 (block size) + blockDataSize
      const block = new ArrayBuffer(2 + 4 + blockDataSize);
      const v = new DataView(block);
      let o = 0;

      v.setUint16(o, 0x0001); o += 2;         // block type: color entry
      v.setUint32(o, blockDataSize); o += 4;   // block data length

      // Name: uint16 char count then UTF-16BE chars including null
      v.setUint16(o, nameCharCount); o += 2;
      for (let i = 0; i < colorName.length; i++) {
        v.setUint16(o, colorName.charCodeAt(i)); o += 2;
      }
      v.setUint16(o, 0); o += 2; // null terminator

      // Color model: "RGB "
      v.setUint8(o, 0x52); v.setUint8(o+1, 0x47); v.setUint8(o+2, 0x42); v.setUint8(o+3, 0x20); o += 4;

      // R G B as float32 big-endian
      v.setFloat32(o, r); o += 4;
      v.setFloat32(o, g); o += 4;
      v.setFloat32(o, b); o += 4;

      // Color type: 0 = global
      v.setUint16(o, 0); o += 2;

      return block;
    });

    // ASE header: signature "ASEF" + version 1.0 + color count
    const header = new ArrayBuffer(12);
    const hv = new DataView(header);
    // "ASEF"
    hv.setUint8(0, 0x41); hv.setUint8(1, 0x53); hv.setUint8(2, 0x45); hv.setUint8(3, 0x46);
    hv.setUint16(4, 1); // version major
    hv.setUint16(6, 0); // version minor
    hv.setUint32(8, colorBlocks.length); // num blocks

    const totalSize = header.byteLength + colorBlocks.reduce((s, b) => s + b.byteLength, 0);
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    combined.set(new Uint8Array(header), offset); offset += header.byteLength;
    for (const block of colorBlocks) {
      combined.set(new Uint8Array(block), offset); offset += block.byteLength;
    }

    const blob = new Blob([combined], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedPalette.name.replace(/\s+/g, "_")}.ase`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const filtered = palettes.filter((p) => !paletteSearch || p.name?.toLowerCase().includes(paletteSearch.toLowerCase()));
  const selectedPalette = palettes.find((p) => p.id === selectedPaletteId);
  const selectedSwatches = selectedPaletteId ? getSwatchData(selectedPaletteId) : [];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: Palette list */}
      <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Palettes ({palettes.length})</h3>
          <Button onClick={openNew} size="sm" className="gap-1.5 h-7 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
        <Input
          placeholder="Search palettes…"
          value={paletteSearch}
          onChange={(e) => setPaletteSearch(e.target.value)}
          className="h-8 text-xs"
        />
        <div className="space-y-2 max-h-[520px] overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No palettes yet</p>
          )}
          {filtered.map((p) => {
            const swatches = getSwatchData(p.id);
            return (
              <div
                key={p.id}
                onClick={() => { setSelectedPaletteId(p.id); setShowColorPicker(false); }}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedPaletteId === p.id ? "bg-primary/10 border-primary" : "border-border hover:bg-muted bg-card"
                }`}
              >
                <div className="h-6 rounded-md overflow-hidden flex mb-2">
                  {swatches.length === 0 ? (
                    <div className="w-full bg-muted" />
                  ) : (
                    swatches.slice(0, 10).map((s, i) => (
                      s.linkedHexes?.length > 1 ? (
                        <div key={i} className="flex-1 flex overflow-hidden">
                          {s.linkedHexes.map((h, j) => <div key={j} className="flex-1 h-full" style={{ backgroundColor: h }} />)}
                        </div>
                      ) : (
                        <div key={i} className="flex-1" style={{ backgroundColor: s.hex }} />
                      )
                    ))
                  )}
                </div>
                <div className={`font-medium text-sm ${selectedPaletteId === p.id ? "text-primary" : ""}`}>{p.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" />{projectName}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{swatches.length} color{swatches.length !== 1 ? "s" : ""}</div>
                <div className="flex gap-1 mt-2">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(p); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Color detail */}
      <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 space-y-4">
        {!selectedPalette ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Palette className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Select a palette to see its colors</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{selectedPalette.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" />{projectName}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <SizeControl size={paletteCardSize} onChange={(s) => { setPaletteCardSize(s); try { localStorage.setItem("palette_card_size", s); } catch {} }} />
                {selectedSwatches.length > 0 && (
                  <Button size="sm" variant="outline" className="gap-1 h-8 text-xs px-2" onClick={exportASE} title="Export as Adobe Swatch Exchange (.ase)">
                    <Download className="w-3.5 h-3.5" /> .ase
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={openColorPicker}>
                  <Plus className="w-3.5 h-3.5" /> Add Color
                </Button>
              </div>
            </div>

            {/* Inline color picker */}
            {showColorPicker && (() => {
              const { techFiltered, commFiltered } = getAvailableColors();
              const items = colorTab === "technical"
                ? techFiltered.map((t) => {
                    const linkedComm = commColors.find((c) => c.main_technical_color_id === t.id || (c.linked_technical_color_ids || []).includes(t.id));
                    return { key: `technical:${t.id}`, hex: t.hex || "#ccc", label: t.name, sub: t.code, commCode: linkedComm?.code };
                  })
                : commFiltered.map((c) => {
                    const t = techColors.find((t) => t.id === c.main_technical_color_id);
                    return { key: `commercial:${c.id}`, hex: t?.hex || "#ccc", label: c.color_name, sub: c.code };
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
                        <button key={item.key} type="button" onClick={() => toggleColorSelection(item.key)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${selected ? "bg-primary/10" : "hover:bg-muted"}`}>
                          <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: item.hex }} />
                          <div className="flex-1 min-w-0">
                           <span className="text-xs font-medium block truncate">{item.label}</span>
                           <span className="text-[10px] text-muted-foreground font-mono">{item.sub}{item.commCode ? <span className="ml-1.5 text-primary/70">· {item.commCode}</span> : null}</span>
                          </div>
                          {selected && <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0"><div className="w-2 h-2 rounded-full bg-white" /></div>}
                        </button>
                      );
                    })}
                    {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No more colors to add</p>}
                  </div>
                  <div className="p-2 border-t border-border flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => colorTab === "technical" ? (setShowTechDialog(true), setTechForm({ code: "", name: "", hex: "#cccccc" })) : openNewComm()}>
                      <Plus className="w-3 h-3" /> New
                    </Button>
                    <Button size="sm" className="flex-1 text-xs gap-1.5" disabled={selectedColorIds.size === 0 || addingColors} onClick={handleAddSelectedColors}>
                      {addingColors && <Loader2 className="w-3 h-3 animate-spin" />}
                      Add {selectedColorIds.size > 0 ? `(${selectedColorIds.size})` : ""}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowColorPicker(false)}>Cancel</Button>
                  </div>
                </div>
              );
            })()}

            {/* Color strip */}
            {selectedSwatches.length > 0 && (
              <div className="h-12 rounded-lg overflow-hidden flex border border-border">
                {selectedSwatches.map((s, i) => (
                  s.linkedHexes?.length > 1 ? (
                    <div key={i} className="flex-1 flex overflow-hidden" title={s.name || s.code}>
                      {s.linkedHexes.map((h, j) => <div key={j} className="flex-1 h-full" style={{ backgroundColor: h }} />)}
                    </div>
                  ) : (
                    <div key={i} className="flex-1" style={{ backgroundColor: s.hex }} title={s.name || s.code} />
                  )
                ))}
              </div>
            )}

            {/* Color cards grid — commercial-led layout */}
            <PaletteColorGrid
              paletteColors={paletteColors}
              paletteId={selectedPaletteId}
              techColors={techColors}
              commColors={commColors}
              swatches={selectedSwatches}
              onRemove={handleRemoveColor}
              onLinkTech={(tech) => setLinkingTechColor(tech)}
              onReorder={handleReorderColors}
              size={paletteCardSize}
              onSizeChange={(s) => { setPaletteCardSize(s); try { localStorage.setItem("palette_card_size", s); } catch {} }}
            />
          </>
        )}
      </div>

      {/* Create/Edit palette dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) { setShowDialog(false); setEditingPalette(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingPalette ? "Edit Palette" : "New Color Palette"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSavePalette} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Palette Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Core Colors" autoFocus required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowDialog(false); setEditingPalette(null); }}>Cancel</Button>
              <Button type="submit" disabled={saving || !formName.trim()} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}{editingPalette ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Technical Color dialog */}
      <Dialog open={showTechDialog} onOpenChange={setShowTechDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Technical Color</DialogTitle></DialogHeader>
          <form onSubmit={saveTech} className="space-y-4">
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowTechDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Create & Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Link Commercial Color dialog */}
      {linkingTechColor && (
        <LinkCommercialColorDialog
          techColor={linkingTechColor}
          commColors={commColors}
          setCommColors={setCommColors}
          onClose={() => setLinkingTechColor(null)}
        />
      )}

      {/* New Commercial Color dialog */}
      <Dialog open={showCommDialog} onOpenChange={setShowCommDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Commercial Color</DialogTitle></DialogHeader>
          <form onSubmit={saveComm} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Sub-type</Label>
                <select value={commForm.sub_type} onChange={(e) => setCommForm((f) => ({ ...f, sub_type: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="Solid">Solid</option>
                  <option value="Combined">Combined</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Commercial Code</Label><Input value={commForm.code} onChange={(e) => setCommForm((f) => ({ ...f, code: e.target.value }))} required /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Main Technical Color</Label>
              {commForm.main_technical_color_id ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
                  {(() => { const t = techColors.find((t) => t.id === commForm.main_technical_color_id); return t ? (<><div className="w-4 h-4 rounded-sm" style={{ backgroundColor: colorToHex(t) }} /><span className="text-xs flex-1">{tcxDisplayName(t)}</span></>) : null; })()}
                  <button type="button" onClick={() => setCommForm((f) => ({ ...f, main_technical_color_id: "" }))} className="text-xs text-muted-foreground hover:text-foreground ml-auto">✕</button>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <Input value={techSearch} onChange={(e) => setTechSearch(e.target.value)} placeholder="Search…" className="h-8 text-xs" />
                  </div>
                  <div className="max-h-36 overflow-y-auto">
                    {techColors.filter((t) => !techSearch || t.code?.toLowerCase().includes(techSearch.toLowerCase()) || t.name?.toLowerCase().includes(techSearch.toLowerCase())).map((t) => (
                      <button key={t.id} type="button" onClick={() => handleTechSelectForComm(t.id)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left">
                        <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: colorToHex(t) }} />
                        <span className="text-xs">{tcxDisplayName(t)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Color Name</Label><Input value={commForm.color_name} onChange={(e) => setCommForm((f) => ({ ...f, color_name: e.target.value }))} required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCommDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Create & Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}