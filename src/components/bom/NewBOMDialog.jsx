import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";

function sortRoutingsByRevVersion(rs) {
  return [...rs].sort((a, b) => {
    const revCmp = (b.revision_code || "").localeCompare(a.revision_code || "");
    if (revCmp !== 0) return revCmp;
    return (b.version || 0) - (a.version || 0);
  });
}

function routingLabel(r, typeChip) {
  return `${r.name} · [${typeChip}] · Rev ${r.revision_code || "—"} v${r.version || "—"} · [${(r.status || "").toUpperCase()}]`;
}

export default function NewBOMDialog({ open, onClose, products, preselectedProduct, onCreated }) {
  const [bomType, setBomType] = useState("development");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(preselectedProduct || null);
  const [saving, setSaving] = useState(false);

  // Dev routing picker state
  const [devRoutings, setDevRoutings] = useState([]);
  const [devRoutingsLoading, setDevRoutingsLoading] = useState(false);
  const [selectedDevRoutingId, setSelectedDevRoutingId] = useState(null);

  const productId = selectedProduct?.id;

  // Load dev routings when product changes or bomType is development
  useEffect(() => {
    if (!open || bomType !== "development" || !productId) {
      setDevRoutings([]); setSelectedDevRoutingId(null); return;
    }
    setDevRoutingsLoading(true);
    base44.entities.SupplierRouting.filter({ product_id: productId, routing_type: "development" }).then((rs) => {
      const sorted = sortRoutingsByRevVersion(rs);
      setDevRoutings(sorted);
      setSelectedDevRoutingId(sorted[0]?.id || null);
      setDevRoutingsLoading(false);
    });
  }, [open, bomType, productId]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return products.filter((p) => !q || p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)).slice(0, 50);
  }, [products, productSearch]);

  const canSave = !!selectedProduct && (bomType !== "development" || (devRoutings.length > 0 && !!selectedDevRoutingId));

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const created = await base44.entities.BOM.create({
      bom_type: bomType,
      product_id: selectedProduct.id,
      revision_code: "A",
      version: 1,
      status: "draft",
      selected_routing_id: bomType === "development" ? (selectedDevRoutingId || null) : null,
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
    setBomType("development"); setProductSearch(""); setSelectedProduct(preselectedProduct || null);
    setDevRoutings([]); setSelectedDevRoutingId(null);
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

          {/* Dev routing picker — shown when bomType = development and product is selected */}
          {bomType === "development" && selectedProduct && (
            <div className="space-y-1.5">
              <Label className="text-xs">Linked Routing (Development) <span className="text-destructive">*</span></Label>
              {devRoutingsLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
              ) : devRoutings.length === 0 ? (
                <Select disabled>
                  <SelectTrigger className="h-8 text-xs text-muted-foreground"><SelectValue placeholder="No development routings — create one on Product → Suppliers first" /></SelectTrigger>
                  <SelectContent />
                </Select>
              ) : (
                <Select value={selectedDevRoutingId || ""} onValueChange={setSelectedDevRoutingId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {devRoutings.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{routingLabel(r, "DEV")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {preselectedProduct ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Product</Label>
              <p className="text-sm font-medium text-foreground px-1">
                {preselectedProduct.code ? `${preselectedProduct.code} ` : ""}{preselectedProduct.name}
              </p>
            </div>
          ) : (
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || saving} size="sm" className="gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create BOM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}