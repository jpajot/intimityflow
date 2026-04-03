import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { colorToHex, tcxDisplayName } from "../lib/pantone-tcx";

export default function ColorLibraryPickerModal({ open, onClose, onAdd }) {
  const [techColors, setTechColors] = useState([]);
  const [commColors, setCommColors] = useState([]);
  const [palettes, setPalettes] = useState([]);
  const [paletteColors, setPaletteColors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set()); // "tech-id" or "comm-id"
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
      setSearch("");
      setSelectedIds(new Set());
      setTab("all");
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    const [tc, cc, pals, palCols] = await Promise.all([
      base44.entities.TechnicalColor.list("code", 2000),
      base44.entities.CommercialColor.list("code", 2000),
      base44.entities.ColorPalette.list("name", 200),
      base44.entities.ColorPaletteColor.list("-created_date", 5000),
    ]);
    setTechColors(tc);
    setCommColors(cc);
    setPalettes(pals);
    setPaletteColors(palCols);
    setLoading(false);
  };

  // Build palette name lookup per color
  const getPaletteNamesForColor = (type, colorId) => {
    const links = paletteColors.filter(pc => pc.color_type === type && pc.color_id === colorId);
    return links.map(l => palettes.find(p => p.id === l.palette_id)?.name).filter(Boolean);
  };

  const matchesSearch = (text) =>
    !search || text?.toLowerCase().includes(search.toLowerCase());

  const filteredTech = techColors.filter(c => {
    if (tab === "commercial") return false;
    const palNames = getPaletteNamesForColor("technical", c.id);
    return matchesSearch(c.code) || matchesSearch(c.name) || palNames.some(n => matchesSearch(n));
  });

  const filteredComm = commColors.filter(c => {
    if (tab === "technical") return false;
    const palNames = getPaletteNamesForColor("commercial", c.id);
    return matchesSearch(c.code) || matchesSearch(c.color_name) || palNames.some(n => matchesSearch(n));
  });

  const toggle = (key) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleAdd = async () => {
    setAdding(true);
    const colorways = [];
    for (const key of selectedIds) {
      const [type, id] = key.split("--");
      if (type === "tech") {
        const tc = techColors.find(c => c.id === id);
        if (tc) colorways.push({
          color_name: tc.name,
          color_hex: colorToHex(tc),
          colorway_code: "",
          linked_tech_color_id: tc.id,
          linked_color_type: "",
          linked_color_id: "",
          markets: [],
        });
      } else {
        const cc = commColors.find(c => c.id === id);
        if (cc) {
          const tc = techColors.find(t => t.id === cc.main_technical_color_id);
          colorways.push({
            color_name: cc.color_name,
            color_hex: tc ? colorToHex(tc) : "#cccccc",
            colorway_code: cc.code || "",
            linked_tech_color_id: cc.main_technical_color_id || "",
            linked_color_type: "commercial",
            linked_color_id: cc.id,
            markets: [],
          });
        }
      }
    }
    await onAdd(colorways);
    setAdding(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add from Color Library</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 overflow-hidden">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by code, name, or palette…"
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Tab filter */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              <TabsTrigger value="technical" className="flex-1">Technical</TabsTrigger>
              <TabsTrigger value="commercial" className="flex-1">Commercial</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Color list */}
          <div className="flex-1 overflow-y-auto border border-border rounded-lg divide-y divide-border">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTech.length === 0 && filteredComm.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No colors found</p>
            ) : (
              <>
                {filteredTech.length > 0 && (tab === "all" || tab === "technical") && (
                  <>
                    <div className="px-3 py-2 bg-muted/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0">
                      Technical Colors ({filteredTech.length})
                    </div>
                    {filteredTech.map(c => {
                      const key = `tech--${c.id}`;
                      const selected = selectedIds.has(key);
                      const palNames = getPaletteNamesForColor("technical", c.id);
                      const hex = colorToHex(c);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggle(key)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted ${selected ? "bg-accent" : ""}`}
                        >
                          <div className="w-8 h-8 rounded-md border border-border shrink-0" style={{ backgroundColor: hex }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.code}</p>
                            {palNames.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {palNames.map(n => <Badge key={n} variant="outline" className="text-[10px] px-1.5 py-0">{n}</Badge>)}
                              </div>
                            )}
                          </div>
                          {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </>
                )}
                {filteredComm.length > 0 && (tab === "all" || tab === "commercial") && (
                  <>
                    <div className="px-3 py-2 bg-muted/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0">
                      Commercial Colors ({filteredComm.length})
                    </div>
                    {filteredComm.map(c => {
                      const key = `comm--${c.id}`;
                      const selected = selectedIds.has(key);
                      const palNames = getPaletteNamesForColor("commercial", c.id);
                      const tc = techColors.find(t => t.id === c.main_technical_color_id);
                      const hex = tc ? colorToHex(tc) : "#cccccc";
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggle(key)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted ${selected ? "bg-accent" : ""}`}
                        >
                          <div className="w-8 h-8 rounded-md border border-border shrink-0" style={{ backgroundColor: hex }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{c.color_name}</p>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{c.sub_type}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{c.code}{tc ? ` · ${tc.name}` : ""}</p>
                            {palNames.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {palNames.map(n => <Badge key={n} variant="outline" className="text-[10px] px-1.5 py-0">{n}</Badge>)}
                              </div>
                            )}
                          </div>
                          {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select colors to add"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleAdd} disabled={selectedIds.size === 0 || adding} className="gap-2">
              {adding && <Loader2 className="w-4 h-4 animate-spin" />}
              Add {selectedIds.size > 0 ? selectedIds.size : ""} Colorway{selectedIds.size !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}