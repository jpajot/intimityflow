import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";

export default function ColorwayCard({ variant, onEdit }) {

  return (
    <div
      className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/20 transition-all"
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {variant.image_url ? (
          <img src={variant.image_url} alt={variant.color_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: variant.color_hex || "#ccc" }} />
        )}
        <div className="absolute top-2 right-2 flex gap-1.5">
          {variant.linked_color_id && (
            <Badge variant="secondary" className="text-[10px] bg-background/80 backdrop-blur-sm px-1.5">
              {variant.linked_color_type === "technical" ? "TCX" : "COM"}
            </Badge>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-md bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border border-border shrink-0" style={{ backgroundColor: variant.color_hex || "#ccc" }} />
          <span className="font-medium text-sm truncate">{variant.color_name}</span>
        </div>
        {variant.colorway_code && (
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{variant.colorway_code}</p>
        )}

      </div>
    </div>
  );
}