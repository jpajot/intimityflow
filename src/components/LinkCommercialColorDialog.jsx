import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { colorToHex, tcxDisplayName } from "../lib/pantone-tcx";

/**
 * Dialog shown when clicking "Link to Commercial Color" on an unlinked technical color card.
 *
 * Props:
 *   techColor       – the TechnicalColor object to link
 *   commColors      – full list of CommercialColor objects
 *   setCommColors   – state setter to update parent's commColors list
 *   onClose         – called when dialog should close
 */
export default function LinkCommercialColorDialog({ techColor, commColors, setCommColors, onClose, paletteId, setPaletteColors }) {
  const [mode, setMode] = useState("choose"); // "choose" | "link" | "create"
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Create new commercial color form
  const [commForm, setCommForm] = useState({
    sub_type: "Solid",
    code: "",
    color_name: "",
    main_technical_color_id: techColor?.id || "",
    linked_technical_color_ids: techColor ? [techColor.id] : [],
  });

  // Pre-fill code on mount
  useEffect(() => {
    base44.functions.invoke("generateCode", { entity_name: "CommercialColor", entity_type: "" })
      .then((res) => setCommForm((f) => ({ ...f, code: res.data.code })))
      .catch(() => {});
  }, []);

  // ── Link to existing ──────────────────────────────────────────────────────────

  const handleLinkToExisting = async (commColor) => {
    setSaving(true);
    const newLinkedIds = [...(commColor.linked_technical_color_ids || [])];
    if (!newLinkedIds.includes(techColor.id)) {
      newLinkedIds.push(techColor.id);
    }
    const updated = await base44.entities.CommercialColor.update(commColor.id, {
      linked_technical_color_ids: newLinkedIds,
    });
    setCommColors((prev) => prev.map((c) => c.id === commColor.id ? { ...c, ...updated } : c));
    // If this commercial color isn't already in the palette, add it
    if (paletteId && setPaletteColors) {
      const linked = await base44.entities.ColorPaletteColor.create({ palette_id: paletteId, color_type: "commercial", color_id: commColor.id });
      setPaletteColors((prev) => [...prev, linked]);
    }
    setSaving(false);
    onClose();
  };

  // ── Create new commercial color ───────────────────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const created = await base44.entities.CommercialColor.create(commForm);
    setCommColors((prev) => [...prev, created]);
    // Add the new commercial color to the palette
    if (paletteId && setPaletteColors) {
      const linked = await base44.entities.ColorPaletteColor.create({ palette_id: paletteId, color_type: "commercial", color_id: created.id });
      setPaletteColors((prev) => [...prev, linked]);
    }
    setSaving(false);
    onClose();
  };

  const filteredComm = commColors.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.code?.toLowerCase().includes(q) || c.color_name?.toLowerCase().includes(q);
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Commercial Color" : "Link to Commercial Color"}
          </DialogTitle>
        </DialogHeader>

        {/* Source tech color preview */}
        <div className="flex items-center gap-2.5 px-3 py-2 bg-muted rounded-lg border border-border">
          <div className="w-6 h-6 rounded-sm shrink-0 border border-border" style={{ backgroundColor: techColor?.hex || "#ccc" }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{techColor?.name}</p>
            <p className="text-[10px] font-mono text-muted-foreground">{techColor?.code}</p>
          </div>
        </div>

        {mode === "choose" && (
          <div className="space-y-3 pt-1">
            <Button className="w-full justify-start gap-2 h-auto py-3 text-sm whitespace-normal text-left" variant="outline" onClick={() => setMode("link")}>
              🔗 Link to an existing commercial color
            </Button>
            <Button className="w-full justify-start gap-2 h-auto py-3 text-sm whitespace-normal text-left" variant="outline" onClick={() => setMode("create")}>
              ✨ Create a new commercial color from this technical color
            </Button>
          </div>
        )}

        {mode === "link" && (
          <div className="space-y-3">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search commercial colors…" className="h-8 text-xs" autoFocus />
            <div className="border border-border rounded-lg max-h-64 overflow-y-auto divide-y divide-border">
              {filteredComm.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">No commercial colors found</p>
              )}
              {filteredComm.map((c) => {
                const alreadyLinked = (c.linked_technical_color_ids || []).includes(techColor?.id);
                return (
                  <button key={c.id} type="button" disabled={alreadyLinked || saving}
                    onClick={() => handleLinkToExisting(c)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${alreadyLinked ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"}`}>
                    <div className="w-5 h-5 rounded-sm border border-border shrink-0" style={{ backgroundColor: c.hex || "#ccc" }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium block truncate">{c.color_name || "—"}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{c.code}</span>
                    </div>
                    {alreadyLinked && <span className="text-[10px] text-muted-foreground shrink-0">already linked</span>}
                    {saving && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                  </button>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("choose")}>Back</Button>
            </DialogFooter>
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Sub-type</Label>
                <select value={commForm.sub_type} onChange={(e) => setCommForm((f) => ({ ...f, sub_type: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="Solid">Solid</option>
                  <option value="Combined">Combined</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Commercial Code</Label>
                <Input value={commForm.code} onChange={(e) => setCommForm((f) => ({ ...f, code: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Color Name</Label>
              <Input value={commForm.color_name} onChange={(e) => setCommForm((f) => ({ ...f, color_name: e.target.value }))}
                placeholder={techColor?.name || "Color name"} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMode("choose")}>Back</Button>
              <Button type="submit" disabled={saving || !commForm.code.trim() || !commForm.color_name.trim()} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Create
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}