import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const ENTITY_OPTIONS = [
  {
    group: "Product",
    items: [
      { entityType: "Product", productType: "Product", label: "Style / Product" },
      { entityType: "Product", productType: "Material", label: "Material" },
    ],
  },
  {
    group: "Color",
    items: [
      { entityType: "TechnicalColor", label: "Technical Color" },
      { entityType: "CommercialColor", label: "Commercial Color" },
    ],
  },
];

export default function CreateItemPanel({ open, onSelect, onClose }) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[300px] z-50 bg-background border-l border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <p className="text-xs text-muted-foreground">Create</p>
            <p className="font-semibold">Create item from this</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <p className="text-xs text-muted-foreground">Select the type of item to create:</p>
          {ENTITY_OPTIONS.map((group) => (
            <div key={group.group}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.group}</p>
              <div className="space-y-1.5">
                {group.items.map((opt) => (
                  <Button
                    key={`${opt.entityType}-${opt.productType || ""}`}
                    variant="outline"
                    className="w-full justify-start text-sm h-9"
                    onClick={() => onSelect(opt)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}