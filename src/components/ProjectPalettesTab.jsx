import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Loader2, X } from "lucide-react";
import { colorToHex, tcxDisplayName } from "../lib/pantone-tcx";

export default function ProjectPalettesTab({ projectId, palettes, paletteColors, techColors, commColors, getPaletteHexes, onPaletteCreated }) {
  const navigate = useNavigate();

  // Step 1: create palette dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState("");
  const [creating, setCreating] = useState(false);

  // Step 2: add colors dialog
  const [createdPalette, setCreatedPalette] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addTab, setAddTab] = useState("technical");
  const [colorSearch, setColorSearch] = useState("");
  const [selectedColorKeys, setSelectedColorKeys] = useState(new Set());
  const [adding, setAdding] = useState(false);

  const handleCreatePalette = async (e) => {
    e.preventDefault();
    if (!newPaletteName.trim()) return;
    setCreating(true);
    const palette = await base44.entities.ColorPalette.create({
      name: newPaletteName.trim(),
      project_id: projectId,
    });
    setCreating(false);
    setShowCreateDialog(false);
    setNewPaletteName("");
    setCreatedPalette(palette);
    setSelectedColorKeys(new Set());
    setColorSearch("");
    setAddTab("technical");
    setShowAddDialog(true);
    if (onPaletteCreated) onPaletteCreated(palette);
  };

  const toggleColor = (colorType, colorId) => {
    const key = `${colorType}:${colorId}`;
    setSelectedColorKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleAddColors = async () => {
    if (!createdPalette || selectedColorKeys.size === 0) {
      setShowAddDialog(false);
      return;
    }
    setAdding(true);
    for (const key of selectedColorKeys) {
      const [colorType, colorId] = key.split(":");
      await base44.entities.ColorPaletteColor.create({
        palette_id: createdPalette.id,
        color_type: colorType,
        color_id: colorId,
      });
    }
    setAdding(false);
    setShowAddDialog(false);
    setCreatedPalette(null);
    if (onPaletteCreated) onPaletteCreated(null); // trigger reload
  };

  const filteredTech = techColors.filter((t) =>
    !colorSearch ||
    t.code?.toLowerCase().includes(colorSearch.toLowerCase()) ||
    t.name?.toLowerCase().includes(colorSearch.toLowerCase())
  );

  const filteredComm = commColors.filter((c) =>
    !colorSearch ||
    c.code?.toLowerCase().includes(colorSearch.toLowerCase()) ||
    c.color_name?.toLowerCase().includes(colorSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header with New Palette button */}
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5 h-8" onClick={() => { setNewPaletteName(""); setShowCreateDialog(true); }}>
          <Plus className="w-3.5 h-3.5" /> New Palette
        </Button>
      </div>

      {palettes.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No color palettes yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {palettes.map((palette) => {
            const hexes = getPaletteHexes(palette.id);
            const count = paletteColors.filter((pc) => pc.palette_id === palette.id).length;
            return (
              <button
                key={palette.id}
                onClick={() => navigate(`/color-palettes/${palette.id}`)}
                className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/20 transition-all text-left"
              >
                <div className="h-12 flex">
                  {hexes.length === 0 ? (
                    <div className="flex-1 bg-muted" />
                  ) : (
                    hexes.slice(0, 10).map((hex, i) => <div key={i} className="flex-1" style={{ backgroundColor: hex }} />)
                  )}
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <span className="font-medium text-sm">{palette.name}</span>
                  <span className="text-xs text-muted-foreground">{count} color{count !== 1 ? "s" : ""}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Step 1: Create palette dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(o) => { if (!o) setShowCreateDialog(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Color Palette</DialogTitle></DialogHeader>
          <form onSubmit={handleCreatePalette} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Palette Name</Label>
              <Input
                value={newPaletteName}
                onChange={(e) => setNewPaletteName(e.target.value)}
                placeholder="e.g. SS26 Core Colors"
                autoFocus
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 gap-1.5" disabled={creating || !newPaletteName.trim()}>
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create & Add Colors
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Step 2: Add colors dialog */}
      <Dialog open={showAddDialog} onOpenChange={(o) => { if (!o) { setShowAddDialog(false); setCreatedPalette(null); if (onPaletteCreated) onPaletteCreated(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Colors — {createdPalette?.name}</DialogTitle>
          </DialogHeader>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg shrink-0">
            {["technical", "commercial"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setAddTab(tab); setColorSearch(""); }}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${addTab === tab ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab === "technical" ? `Technical (${techColors.length})` : `Commercial (${commColors.length})`}
              </button>
            ))}
          </div>

          <Input
            value={colorSearch}
            onChange={(e) => setColorSearch(e.target.value)}
            placeholder="Search colors…"
            className="h-8 text-xs shrink-0"
          />

          {/* Selected count badge */}
          {selectedColorKeys.size > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{selectedColorKeys.size} selected</span>
              <button type="button" onClick={() => setSelectedColorKeys(new Set())} className="text-xs text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3 inline" /> Clear
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
            {addTab === "technical" && filteredTech.map((t) => {
              const key = `technical:${t.id}`;
              const selected = selectedColorKeys.has(key);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleColor("technical", t.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${selected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}`}
                >
                  <div className="w-7 h-7 rounded-md border border-border shrink-0" style={{ backgroundColor: colorToHex(t) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.code}</p>
                  </div>
                  {selected && <span className="text-primary text-xs">✓</span>}
                </button>
              );
            })}

            {addTab === "commercial" && filteredComm.map((c) => {
              const key = `commercial:${c.id}`;
              const selected = selectedColorKeys.has(key);
              const t = techColors.find((t) => t.id === c.main_technical_color_id);
              const hex = t ? colorToHex(t) : "#ccc";
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleColor("commercial", c.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${selected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}`}
                >
                  <div className="w-7 h-7 rounded-md border border-border shrink-0" style={{ backgroundColor: hex }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.color_name}</p>
                    <p className="text-[11px] text-muted-foreground">{c.code}</p>
                  </div>
                  {selected && <span className="text-primary text-xs">✓</span>}
                  <Badge variant="outline" className="text-[10px] shrink-0">{c.sub_type}</Badge>
                </button>
              );
            })}

            {addTab === "technical" && filteredTech.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No colors found</p>
            )}
            {addTab === "commercial" && filteredComm.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No colors found</p>
            )}
          </div>

          <div className="flex gap-2 shrink-0 pt-2 border-t border-border">
            <Button variant="outline" className="flex-1" onClick={() => { setShowAddDialog(false); setCreatedPalette(null); if (onPaletteCreated) onPaletteCreated(null); }}>
              Skip
            </Button>
            <Button className="flex-1 gap-1.5" onClick={handleAddColors} disabled={adding}>
              {adding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {selectedColorKeys.size > 0 ? `Add ${selectedColorKeys.size} Color${selectedColorKeys.size > 1 ? "s" : ""}` : "Done"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}