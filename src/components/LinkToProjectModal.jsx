import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2 } from "lucide-react";

/**
 * Generic modal to search & multi-select items to link to a project.
 * Props:
 *   open, onClose, title
 *   items: [{ id, label, sublabel?, imageUrl? }]
 *   alreadyLinkedIds: Set or array of IDs already linked
 *   onSave(selectedIds): async callback — caller handles entity update
 */
export default function LinkToProjectModal({ open, onClose, title, items = [], alreadyLinkedIds = [], onSave }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const linkedSet = useMemo(() => new Set(alreadyLinkedIds), [alreadyLinkedIds]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((it) =>
      it.label?.toLowerCase().includes(q) || it.sublabel?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const toggle = (id) => {
    if (linkedSet.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    await onSave([...selected]);
    setSaving(false);
    setSelected(new Set());
    setSearch("");
    onClose();
  };

  const handleClose = () => {
    setSelected(new Set());
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 h-8 text-xs"
              autoFocus
            />
          </div>
          <div className="border border-border rounded-lg divide-y divide-border max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No items found.</p>
            ) : (
              filtered.map((item) => {
                const isLinked = linkedSet.has(item.id);
                const isSelected = selected.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${isLinked ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50"}`}
                  >
                    <Checkbox checked={isLinked || isSelected} disabled={isLinked} onCheckedChange={() => toggle(item.id)} />
                    {item.imageUrl && (
                      <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0 bg-muted">
                        <img src={item.imageUrl} alt={item.label} className="w-full h-full object-contain" />
                      </div>
                    )}
                    {item.colorHex && !item.imageUrl && (
                      <div className="w-5 h-5 rounded border border-border shrink-0" style={{ backgroundColor: item.colorHex }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.label}</p>
                      {item.sublabel && <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>}
                    </div>
                    {isLinked && <span className="text-[10px] text-muted-foreground shrink-0">Already linked</span>}
                  </div>
                );
              })
            )}
          </div>
          {selected.size > 0 && (
            <p className="text-xs text-muted-foreground">{selected.size} item{selected.size > 1 ? "s" : ""} selected</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || selected.size === 0} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Link {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}