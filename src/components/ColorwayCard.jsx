import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import ImageLightbox from "./ImageLightbox";

export default function ColorwayCard({ variant, techColor, productImage = "", onEdit }) {
  const [lightbox, setLightbox] = useState(false);
  // Rule: show colorway image if available, else fall back to product main image
  const useProductImage = !variant.image_url && !!productImage;
  const displayImage = variant.image_url || productImage;

  return (
    <>
      <div className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/20 transition-all">
        <div className="aspect-square bg-muted relative overflow-hidden">
          {displayImage ? (
            <img
              src={displayImage}
              alt={variant.color_name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 cursor-zoom-in"
              onClick={() => setLightbox(true)}
            />
          ) : (
            <div className="w-full h-full" style={{ backgroundColor: variant.color_hex || "#ccc" }} />
          )}
          {/* Hex swatch overlay when using product fallback image */}
          {useProductImage && variant.color_hex && (
            <div
              className="absolute bottom-2 left-2 w-6 h-6 rounded-md border-2 border-white shadow-md"
              style={{ backgroundColor: variant.color_hex }}
              title={variant.color_hex}
            />
          )}
          <div className="absolute top-2 right-2 flex gap-1.5">
            {!variant.linked_color_id && (
              <div title="No commercial color linked" className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-600 shadow-sm" />
            )}
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
          {techColor && (
            <p className="text-xs text-muted-foreground font-mono">{techColor.code}</p>
          )}
        </div>
      </div>

      {lightbox && (
        <ImageLightbox src={displayImage} alt={variant.color_name} onClose={() => setLightbox(false)} />
      )}
    </>
  );
}