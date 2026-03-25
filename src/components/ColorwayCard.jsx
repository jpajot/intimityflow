import { Badge } from "@/components/ui/badge";

const MARKET_FLAGS = {
  Spain: "🇪🇸",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Italy: "🇮🇹",
};

export default function ColorwayCard({ variant, onClick }) {
  const totalVolume =
    (variant.volume_spain || 0) +
    (variant.volume_france || 0) +
    (variant.volume_germany || 0) +
    (variant.volume_italy || 0);

  return (
    <div
      onClick={onClick}
      className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/20 transition-all cursor-pointer"
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {variant.image_url ? (
          <img src={variant.image_url} alt={variant.color_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: variant.color_hex || "#ccc" }} />
        )}
        {variant.linked_color_id && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="text-[10px] bg-background/80 backdrop-blur-sm px-1.5">
              {variant.linked_color_type === "technical" ? "TCX" : "COM"}
            </Badge>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border border-border shrink-0" style={{ backgroundColor: variant.color_hex || "#ccc" }} />
          <span className="font-medium text-sm truncate">{variant.color_name}</span>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {(variant.markets || []).map((m) => (
            <span key={m} className="text-xs" title={m}>{MARKET_FLAGS[m]}</span>
          ))}
          {totalVolume > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">{totalVolume.toLocaleString()} u.</span>
          )}
        </div>
      </div>
    </div>
  );
}