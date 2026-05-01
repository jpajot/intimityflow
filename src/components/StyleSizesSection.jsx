import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";

export default function StyleSizesSection({ product, onSizesChange }) {
  const [styleSizes, setStyleSizes] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const prevGridId = useRef(null);

  useEffect(() => {
    if (!product?.id) return;
    loadData();
  }, [product?.id]);

  // When size_grid_id changes on the product, sync StyleSize records
  useEffect(() => {
    if (!product?.id || loading) return;
    if (prevGridId.current === product.size_grid_id) return;
    prevGridId.current = product.size_grid_id;
    syncGridSizes();
  }, [product?.size_grid_id, loading]);

  const loadData = async () => {
    setLoading(true);
    const [ss, sz] = await Promise.all([
      base44.entities.StyleSize.filter({ product_id: product.id }),
      base44.entities.Size.list("size_code", 500),
    ]);
    setSizes(sz);
    prevGridId.current = product.size_grid_id;

    // If a grid is assigned but no StyleSizes exist yet, auto-populate from the grid
    if (product.size_grid_id && ss.length === 0) {
      const gridSizes = await base44.entities.SizeGridSize.filter({ size_grid_id: product.size_grid_id });
      const created = await Promise.all(
        gridSizes.map((gs) => base44.entities.StyleSize.create({ product_id: product.id, size_id: gs.size_id, active: gs.active !== false }))
      );
      setStyleSizes(created);
      if (onSizesChange) onSizesChange(created.length > 0);
    } else {
      setStyleSizes(ss);
    }

    setLoading(false);
  };

  const syncGridSizes = async () => {
    if (!product.size_grid_id) return;

    // Get active sizes from the grid
    const gridSizes = await base44.entities.SizeGridSize.filter({ size_grid_id: product.size_grid_id });
    const allGridSizeIds = new Set(gridSizes.map((gs) => gs.size_id));

    // Get current style sizes
    const current = await base44.entities.StyleSize.filter({ product_id: product.id });

    const currentSizeIds = new Set(current.map((ss) => ss.size_id));

    // Add missing ones (all grid sizes, preserving their active status)
    const toAdd = gridSizes.filter((gs) => !currentSizeIds.has(gs.size_id));
    const created = await Promise.all(
      toAdd.map((gs) => base44.entities.StyleSize.create({ product_id: product.id, size_id: gs.size_id, active: gs.active !== false }))
    );

    // Remove ones no longer in the grid
    const toRemove = current.filter((ss) => !allGridSizeIds.has(ss.size_id));
    await Promise.all(toRemove.map((ss) => base44.entities.StyleSize.delete(ss.id)));

    setStyleSizes([...current.filter((ss) => allGridSizeIds.has(ss.size_id)), ...created]);
  };

  const handleToggle = async (ss) => {
    const updated = { active: !ss.active };
    await base44.entities.StyleSize.update(ss.id, updated);
    setStyleSizes((prev) => prev.map((x) => x.id === ss.id ? { ...x, ...updated } : x));
  };

  const handleDelete = async (ss) => {
    // Check if this size is referenced in any More Variation for THIS product
    const colorVariants = await base44.entities.ProductColor.filter({ product_id: product.id });
    const colorIds = colorVariants.map((cv) => cv.id);
    const allVars = await base44.entities.ProductColorAndMore.filter({ product_color_id: { $in: colorIds } });
    const isReferenced = allVars.some((v) => (v.size_ids || []).includes(ss.size_id));
    if (isReferenced) {
      alert("This size cannot be deleted because it is used in one or more variations. Remove it from all variations first.");
      return;
    }
    try {
      await base44.entities.StyleSize.delete(ss.id);
    } catch (error) {
      // If the entity doesn't exist, just update local state
      if (!error.message.includes("not found")) throw error;
    }
    const updated = styleSizes.filter((x) => x.id !== ss.id);
    setStyleSizes(updated);
    if (onSizesChange) onSizesChange(updated.length > 0);
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  if (!product.size_grid_id) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">No size grid selected. Set a Size Grid in Style Details above to link sizes.</p>
      </div>
    );
  }

  if (styleSizes.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">No active sizes in the selected grid.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Sizes ({styleSizes.length})</h3>
        <p className="text-xs text-muted-foreground">Synced from size grid — toggle to deactivate for this style</p>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Active</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Code</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Name</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {styleSizes.map((ss) => {
              const size = sizes.find((s) => s.id === ss.size_id);
              return (
                <tr key={ss.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <Checkbox checked={ss.active !== false} onCheckedChange={() => handleToggle(ss)} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{size?.size_code || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{size?.name || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(ss)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}