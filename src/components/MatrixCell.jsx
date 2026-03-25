import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const MARKET_FLAGS = {
  Spain: "🇪🇸",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Italy: "🇮🇹",
};

export default function MatrixCell({ products, colorVariants }) {
  if (!products || products.length === 0) {
    return (
      <div className="w-full h-full min-h-[100px] bg-muted/30 rounded-lg flex items-center justify-center">
        <span className="text-xs text-muted-foreground/40">—</span>
      </div>
    );
  }

  const productColors = products.flatMap((p) =>
    colorVariants
      .filter((cv) => cv.product_id === p.id)
      .map((cv) => ({ ...cv, productName: p.name }))
  );

  return (
    <TooltipProvider>
      <div className="w-full min-h-[100px] bg-card rounded-lg border border-border p-2 space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {productColors.slice(0, 8).map((pc) => (
            <Tooltip key={pc.id}>
              <TooltipTrigger asChild>
                <div className="w-10 h-10 rounded-md overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all">
                  {pc.image_url ? (
                    <img src={pc.image_url} alt={pc.color_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" style={{ backgroundColor: pc.color_hex || "#ccc" }} />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p className="font-semibold text-xs">{pc.productName}</p>
                <p className="text-xs text-muted-foreground">{pc.color_name}{pc.colorway_code ? ` · ${pc.colorway_code}` : ""}</p>
                <div className="flex gap-1 mt-1">
                  {(pc.markets || []).map((m) => (
                    <span key={m} className="text-xs">{MARKET_FLAGS[m]}</span>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {((pc.volume_spain || 0) + (pc.volume_france || 0) + (pc.volume_germany || 0) + (pc.volume_italy || 0)).toLocaleString()} units
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
          {productColors.length > 8 && (
            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
              +{productColors.length - 8}
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {products.length} product{products.length !== 1 ? "s" : ""} · {productColors.length} color{productColors.length !== 1 ? "s" : ""}
        </p>
      </div>
    </TooltipProvider>
  );
}