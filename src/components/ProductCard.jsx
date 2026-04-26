import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp } from "lucide-react";

export default function ProductCard({ product, colorVariants = [] }) {
  const totalVolume = colorVariants.reduce((sum, cv) => {
    return sum + (cv.volume_spain || 0) + (cv.volume_france || 0) + (cv.volume_germany || 0) + (cv.volume_italy || 0);
  }, 0);

  const allMarkets = [...new Set(colorVariants.flatMap(cv => cv.markets || []))];
  const firstImage = (product.images && product.images[0]) || colorVariants.find(cv => cv.image_url)?.image_url;

  return (
    <Link
      to={`/products/${product.id}`}
      className="group block bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-300"
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {firstImage ? (
          <img
            src={firstImage}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            <span className="text-5xl font-display">{product.name?.charAt(0)}</span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge variant="secondary" className="text-xs bg-background/80 backdrop-blur-sm">
            {product.category}
          </Badge>
        </div>
        {colorVariants.length > 0 && (
          <div className="absolute bottom-3 left-3 flex gap-1">
            {colorVariants.slice(0, 5).map((cv) => (
              <div
                key={cv.id}
                className="w-5 h-5 rounded-sm border-2 border-white shadow-sm"
                style={{ backgroundColor: cv.color_hex || '#ccc' }}
                title={cv.color_name}
              />
            ))}
            {colorVariants.length > 5 && (
              <div className="w-5 h-5 rounded-sm border-2 border-white shadow-sm bg-foreground/80 text-background text-[8px] flex items-center justify-center font-medium">
                +{colorVariants.length - 5}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-sm truncate">{product.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{product.sub_category} · {product.customer_need}</p>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{allMarkets.length} market{allMarkets.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="w-3 h-3" />
            <span>{totalVolume.toLocaleString()} units</span>
          </div>
        </div>
      </div>
    </Link>
  );
}