import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const ENTITY_TYPES = [
  { value: "Product", label: "Products / Styles" },
  { value: "ProductColor", label: "Colorways" },
  { value: "TechnicalColor", label: "Technical Colors" },
  { value: "CommercialColor", label: "Commercial Colors" },
];

export default function ProductPickerPanel({ open, onClose }) {
  const [entityType, setEntityType] = useState("Product");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    let loader;
    if (entityType === "Product") loader = base44.entities.Product.list("name", 500);
    else if (entityType === "ProductColor") loader = base44.entities.ProductColor.list("-created_date", 500);
    else if (entityType === "TechnicalColor") loader = base44.entities.TechnicalColor.list("name", 500);
    else loader = base44.entities.CommercialColor.list("name", 500);
    loader.then((res) => { setItems(res); setLoading(false); });
  }, [open, entityType]);

  if (!open) return null;

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    if (!q) return true;
    if (entityType === "Product") return (item.name || "").toLowerCase().includes(q);
    if (entityType === "ProductColor") return (item.color_name || "").toLowerCase().includes(q) || (item.colorway_code || "").toLowerCase().includes(q);
    if (entityType === "TechnicalColor") return (item.name || "").toLowerCase().includes(q) || (item.code || "").toLowerCase().includes(q);
    return (item.color_name || "").toLowerCase().includes(q) || (item.code || "").toLowerCase().includes(q);
  });

  const getDragData = (item) => {
    if (entityType === "Product") return { entityType, id: item.id, name: item.name, code: "", imageUrl: item.images?.[0] || "" };
    if (entityType === "ProductColor") return { entityType, id: item.id, name: item.color_name, code: item.colorway_code || "", imageUrl: item.image_url || "" };
    if (entityType === "TechnicalColor") return { entityType, id: item.id, name: item.name, code: item.code || "", imageUrl: item.hex || "" };
    return { entityType, id: item.id, name: item.color_name, code: item.code || "", imageUrl: "" };
  };

  const getLabel = (item) => {
    if (entityType === "Product") return item.name;
    if (entityType === "ProductColor") return `${item.color_name}${item.colorway_code ? ` (${item.colorway_code})` : ""}`;
    if (entityType === "TechnicalColor") return `${item.name} (${item.code || ""})`.trim();
    return `${item.color_name}${item.code ? ` (${item.code})` : ""}`;
  };

  const getImage = (item) => {
    if (entityType === "Product") return item.images?.[0];
    if (entityType === "ProductColor") return item.image_url;
    if (entityType === "TechnicalColor") return item.hex ? `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect fill='${item.hex}' width='100' height='100'/></svg>` : "";
    return "";
  };

  return (
    <div className="fixed top-0 right-0 h-full w-[320px] z-50 bg-background border-l border-border shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <p className="font-semibold text-sm">Add Product Cards</p>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 space-y-2 border-b border-border shrink-0">
        <div className="space-y-1">
          <Label className="text-xs">Entity Type</Label>
          <Select value={entityType} onValueChange={(v) => { setEntityType(v); setSearch(""); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="px-4 py-2 bg-muted/40 border-b border-border shrink-0">
        <p className="text-[11px] text-muted-foreground">Drag items onto the canvas to add product cards</p>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No results</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/product-card", JSON.stringify(getDragData(item)));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="cursor-grab active:cursor-grabbing rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden select-none"
              >
                <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
                  {getImage(item) ? (
                    <img src={getImage(item)} alt="" className="w-full h-full object-contain" draggable={false} />
                  ) : (
                    <div className="text-2xl">🖼</div>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <p className="text-[11px] font-medium truncate leading-tight">{getLabel(item)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}