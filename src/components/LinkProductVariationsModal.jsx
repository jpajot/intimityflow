import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search } from "lucide-react";

export default function LinkProductVariationsModal({
  open,
  onClose,
  onLink,
  alreadyLinkedIds = [],
}) {
  const [variations, setVariations] = useState([]);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    const [vars, prods] = await Promise.all([
      base44.entities.ProductColorAndMore.list("-created_date", 1000),
      base44.entities.Product.list("name", 500),
    ]);
    setVariations(vars);
    setProducts(prods);
    setLoading(false);
  };

  const availableVariations = variations.filter(
    (v) => !alreadyLinkedIds.includes(v.product_color_id)
  );

  const filtered = availableVariations.filter((v) => {
    const lower = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(lower) ||
      v.sequence?.includes(search)
    );
  });

  const handleToggle = (colorId) => {
    const next = new Set(selected);
    next.has(colorId) ? next.delete(colorId) : next.add(colorId);
    setSelected(next);
  };

  const handleLink = async () => {
    setLinking(true);
    await onLink(Array.from(selected));
    setLinking(false);
    setSelected(new Set());
    onClose();
  };

  const getProductName = (colorId) => {
    // colorId is product_color_id, we need to find the product through ProductColor
    const color = variations.find((v) => v.product_color_id === colorId)?.product_color_id;
    return "Product";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-96">
        <DialogHeader>
          <DialogTitle>Add Existing Variations</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search variations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-y-auto max-h-64">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {availableVariations.length === 0
                    ? "No variations available"
                    : "No matching variations"}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => handleToggle(v.product_color_id)}
                    >
                      <Checkbox
                        checked={selected.has(v.product_color_id)}
                        onCheckedChange={() =>
                          handleToggle(v.product_color_id)
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Seq. {v.sequence || "—"} · {v.size_ids?.length || 0} sizes
                        </p>
                      </div>
                      {v.pack_code && (
                        <span className="text-xs px-2 py-1 bg-muted rounded font-mono">
                          {v.pack_code}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleLink}
                disabled={selected.size === 0 || linking}
                className="gap-2"
              >
                {linking && <Loader2 className="w-4 h-4 animate-spin" />}
                Add {selected.size > 0 && `(${selected.size})`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}