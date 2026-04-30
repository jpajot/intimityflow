import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function NewBOMDialog({ open, onClose, projectId, products, onCreated }) {
  const [bomType, setBomType] = useState("development");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [saving, setSaving] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return products.filter((p) => !q || p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)).slice(0, 50);
  }, [products, productSearch]);

  const handleSave = async () => {
    if (!selectedProduct) return;
    setSaving(true);
    const created = await base44.entities.BOM.create({
      bom_type: bomType,
      product_id: selectedProduct.id,
      project_id: projectId,
      revision_code: "A",
      version: 1,
      status: "draft",
    });
    await base44.entities.BOMChangeLog.create({
      bom_id: created.id,
      change_type: "status_transition",
      payload: { from: null, to: "draft" },
      triggered_by: (await base44.auth.me())?.email || "",
      triggered_at: new Date().toISOString(),
    });
    setSaving(false);
    reset();
    onCreated(created);
  };

  const reset = () => {
    setBomType("development"); setProductSearch(""); setSelectedProduct(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New BOM</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">BOM Type</Label>
            <Select value={bomType} onValueChange={setBomType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Product</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products…"
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProduct(p)}
                  className={`w-full px-3 py-2 text-xs text-left hover:bg-muted transition-colors
                    ${selectedProduct?.id === p.id ? "bg-primary/10 text-primary" : ""}`}
                >
                  <span className="font-mono mr-2 text-muted-foreground">{p.code || "—"}</span>
                  {p.name}
                  <span className="ml-2 text-muted-foreground opacity-60">{p.type}</span>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="px-3 py-3 text-xs text-muted-foreground">No products found</p>
              )}
            </div>
            {selectedProduct && (
              <p className="text-[10px] text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedProduct.name}</span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={handleSave} disabled={!selectedProduct || saving} size="sm" className="gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create BOM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}