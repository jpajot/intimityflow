import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, AlertTriangle } from "lucide-react";

export default function BOMLineAddDialog({ open, onClose, onSave, allProducts, lovValues }) {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [role, setRole] = useState("");
  const [baseQty, setBaseQty] = useState("");
  const [uomOverride, setUomOverride] = useState("");
  const [variesByColor, setVariesByColor] = useState(false);
  const [variesBySize, setVariesBySize] = useState(false);
  const [variesByCam, setVariesByCam] = useState(false);
  const [saving, setSaving] = useState(false);

  const roleOptions = useMemo(() => lovValues.filter((v) => v.category === "bom_line_role"), [lovValues]);
  const uomOptions = useMemo(() => lovValues.filter((v) => v.category === "uom"), [lovValues]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return allProducts
      .filter((p) => !q || p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q))
      .slice(0, 50);
  }, [allProducts, search]);

  const inheritedUom = selectedProduct?.default_uom;
  const effectiveUom = uomOverride || inheritedUom;

  const handleSave = async () => {
    if (!selectedProduct || !role) return;
    setSaving(true);
    const uomIsOverridden = !!uomOverride && uomOverride !== inheritedUom;
    await onSave({
      component_product_id: selectedProduct.id,
      component_role: role,
      base_quantity: parseFloat(baseQty) || null,
      uom: uomIsOverridden ? uomOverride : null,
      uom_is_overridden: uomIsOverridden,
      varies_by_color: variesByColor,
      varies_by_size: variesBySize,
      varies_by_color_and_more: variesByCam,
      varies_by_supplier: false,
    });
    setSaving(false);
    reset();
  };

  const reset = () => {
    setSearch(""); setSelectedProduct(null); setRole(""); setBaseQty(""); setUomOverride("");
    setVariesByColor(false); setVariesBySize(false); setVariesByCam(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Component Line</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Role */}
          <div className="space-y-1.5">
            <Label className="text-xs">Component Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select role…" /></SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Product picker */}
          <div className="space-y-1.5">
            <Label className="text-xs">Component Product</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="border border-border rounded-lg max-h-40 overflow-y-auto divide-y divide-border">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProduct(p)}
                  className={`w-full px-3 py-2 text-xs text-left hover:bg-muted transition-colors flex items-center justify-between gap-2
                    ${selectedProduct?.id === p.id ? "bg-primary/10 text-primary" : ""}`}
                >
                  <span>
                    <span className="font-mono mr-2 text-muted-foreground">{p.code || "—"}</span>
                    {p.name}
                  </span>
                  {!p.default_uom && (
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" title="No default UOM set" />
                  )}
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="px-3 py-3 text-xs text-muted-foreground">No products found</p>
              )}
            </div>
            {selectedProduct && (
              <p className="text-[10px] text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedProduct.name}</span>
                {selectedProduct.default_uom && <> · UOM: <span className="font-medium">{selectedProduct.default_uom}</span></>}
              </p>
            )}
          </div>

          {/* Base qty + UOM */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Base Quantity</Label>
              <Input
                type="number"
                value={baseQty}
                onChange={(e) => setBaseQty(e.target.value)}
                placeholder="e.g. 1.2"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                UOM
                {inheritedUom && !uomOverride && (
                  <span className="ml-1 text-muted-foreground font-normal">(inherited: {inheritedUom})</span>
                )}
              </Label>
              <Select value={uomOverride || (inheritedUom ? `__inherit__${inheritedUom}` : "none")} onValueChange={(v) => setUomOverride(v.startsWith("__inherit__") ? "" : v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select UOM…" /></SelectTrigger>
                <SelectContent>
                  {inheritedUom && (
                    <SelectItem value={`__inherit__${inheritedUom}`}>{inheritedUom} (from Product)</SelectItem>
                  )}
                  {uomOptions.map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Variation flags */}
          <div className="space-y-2">
            <Label className="text-xs">Varies by axis</Label>
            <div className="flex flex-wrap gap-4">
              {[
                { label: "Color", value: variesByColor, set: setVariesByColor },
                { label: "Size", value: variesBySize, set: setVariesBySize },
                { label: "Color & More", value: variesByCam, set: setVariesByCam },
              ].map(({ label, value, set }) => (
                <label key={label} className="flex items-center gap-1.5 cursor-pointer select-none text-xs">
                  <Checkbox checked={value} onCheckedChange={set} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} size="sm">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!selectedProduct || !role || saving}
            size="sm"
            className="gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Add Line
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}