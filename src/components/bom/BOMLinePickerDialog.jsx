import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Lets the user pick one BOMLine from a list.
 * If only one line exists, auto-selects it without showing a picker.
 */
export default function BOMLinePickerDialog({ open, onClose, onSelect, bomLines, allProducts, title = "Select a component line" }) {
  const [selected, setSelected] = useState(null);

  const getLineName = (line) => {
    const comp = allProducts.find((p) => p.id === line.component_product_id);
    return comp ? `${comp.code || ""} ${comp.name}`.trim() : line.component_role || line.id;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {bomLines.map((line) => (
            <button
              key={line.id}
              type="button"
              onClick={() => setSelected(line.id)}
              className={`w-full text-left px-3 py-2 rounded text-xs transition-colors border ${
                selected === line.id
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-transparent hover:bg-muted text-foreground"
              }`}
            >
              {getLineName(line)}
              {line.component_role && (
                <span className="ml-2 text-muted-foreground">({line.component_role})</span>
              )}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!selected} onClick={() => selected && onSelect(bomLines.find(l => l.id === selected))}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}