import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2 } from "lucide-react";

const MARKET_FLAGS = { Spain: "🇪🇸", France: "🇫🇷", Germany: "🇩🇪", Italy: "🇮🇹" };

export default function LinkProductColorModal({ open, onClose, onLink, alreadyLinkedIds = [] }) {
  const [products, setProducts] = useState([]);
  const [colorVariants, setColorVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
      setSelected([]);
      setSearch("");
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    const [prods, colors] = await Promise.all([
      base44.entities.Product.list("-created_date", 200),
      base44.entities.ProductColor.list("-created_date", 1000),
    ]);
    setProducts(prods);
    setColorVariants(colors);
    setLoading(false);
  };

  const filteredColors = colorVariants.filter((cv) => {
    if (alreadyLinkedIds.includes(cv.id)) return false;
    const product = products.find((p) => p.id === cv.product_id);
    if (!product) return false;
    if (!search) return true;
    return (
      product.name?.toLowerCase().includes(search.toLowerCase()) ||
      cv.color_name?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const toggle = (cvId, productId) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.product_color_id === cvId);
      if (exists) return prev.filter((s) => s.product_color_id !== cvId);
      return [...prev, { product_color_id: cvId, product_id: productId }];
    });
  };

  const isSelected = (cvId) => selected.some((s) => s.product_color_id === cvId);

  const handleLink = async () => {
    setLinking(true);
    await onLink(selected);
    setLinking(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Existing Product-Colors</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product or color name…"
            className="pl-10"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredColors.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {alreadyLinkedIds.length > 0 && colorVariants.length === alreadyLinkedIds.length
                ? "All product-colors are already linked"
                : "No matching product-colors found"}
            </div>
          ) : (
            filteredColors.map((cv) => {
              const product = products.find((p) => p.id === cv.product_id);
              const sel = isSelected(cv.id);
              return (
                <div
                  key={cv.id}
                  onClick={() => toggle(cv.id, cv.product_id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${sel ? "bg-accent" : "hover:bg-muted"}`}
                >
                  <Checkbox checked={sel} onCheckedChange={() => toggle(cv.id, cv.product_id)} onClick={(e) => e.stopPropagation()} />
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-border shrink-0">
                    {cv.image_url ? (
                      <img src={cv.image_url} alt={cv.color_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full" style={{ backgroundColor: cv.color_hex || "#ccc" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product?.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: cv.color_hex || "#ccc" }} />
                      <span>{cv.color_name}</span>
                      <span className="flex gap-0.5">{(cv.markets || []).map((m) => <span key={m}>{MARKET_FLAGS[m]}</span>)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">{selected.length} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleLink} disabled={selected.length === 0 || linking} className="gap-2">
              {linking && <Loader2 className="w-4 h-4 animate-spin" />}
              Link Selected
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}