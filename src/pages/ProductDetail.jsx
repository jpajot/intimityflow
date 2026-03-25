import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Loader2, Trash2 } from "lucide-react";
import ColorVariantForm from "../components/ColorVariantForm";
import ColorVariantCard from "../components/ColorVariantCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const CATEGORIES = ["Briefs", "Boxers", "Trunks", "Thongs", "Bras", "Lingerie Sets", "Shapewear", "Loungewear"];
const SUB_CATEGORIES = ["Basic", "Sport", "Seamless", "Lace", "Cotton", "Microfiber", "Thermal", "Premium"];
const CUSTOMER_NEEDS = ["Everyday Comfort", "Active Performance", "Fashion Forward", "Special Occasion", "Maternity", "Plus Size", "Eco-Friendly", "Budget Value"];
const SEASONS = ["SS25", "FW25", "SS26", "FW26"];
const STATUSES = ["Draft", "Active", "Discontinued"];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [product, setProduct] = useState({
    name: "", sku: "", category: "", sub_category: "", customer_need: "",
    description: "", base_price: 0, season: "", status: "Draft",
  });
  const [colorVariants, setColorVariants] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showNewColor, setShowNewColor] = useState(false);
  const [editingColor, setEditingColor] = useState(null);

  useEffect(() => {
    if (!isNew) loadProduct();
  }, [id]);

  const loadProduct = async () => {
    setLoading(true);
    const [prod, colors] = await Promise.all([
      base44.entities.Product.filter({ id }),
      base44.entities.ProductColor.filter({ product_id: id }),
    ]);
    if (prod.length > 0) setProduct(prod[0]);
    setColorVariants(colors);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (isNew) {
      const created = await base44.entities.Product.create(product);
      navigate(`/products/${created.id}`, { replace: true });
    } else {
      const { id: _, created_date, updated_date, created_by, ...data } = product;
      await base44.entities.Product.update(product.id, data);
    }
    setSaving(false);
  };

  const handleAddColor = async (data) => {
    const created = await base44.entities.ProductColor.create({ ...data, product_id: product.id });
    setColorVariants((prev) => [...prev, created]);
    setShowNewColor(false);
  };

  const handleUpdateColor = async (data) => {
    const { id: cid, created_date, updated_date, created_by, product_id, ...rest } = editingColor;
    await base44.entities.ProductColor.update(cid, { ...rest, ...data });
    setColorVariants((prev) => prev.map((cv) => (cv.id === cid ? { ...cv, ...data } : cv)));
    setEditingColor(null);
  };

  const handleDeleteColor = async () => {
    await base44.entities.ProductColor.delete(editingColor.id);
    setColorVariants((prev) => prev.filter((cv) => cv.id !== editingColor.id));
    setEditingColor(null);
  };

  const handleDeleteProduct = async () => {
    for (const cv of colorVariants) {
      await base44.entities.ProductColor.delete(cv.id);
    }
    await base44.entities.Product.delete(product.id);
    navigate("/");
  };

  const updateField = (field, value) => setProduct((p) => ({ ...p, [field]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {isNew ? "New Style" : product.name}
          </h1>
        </div>
        {!isNew && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Style</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this style and all its color variants.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Style Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input value={product.name} onChange={(e) => updateField("name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">SKU</Label>
              <Input value={product.sku} onChange={(e) => updateField("sku", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Category</Label>
              <Select value={product.category} onValueChange={(v) => updateField("category", v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Sub-Category</Label>
              <Select value={product.sub_category} onValueChange={(v) => updateField("sub_category", v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {SUB_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Customer Need</Label>
              <Select value={product.customer_need} onValueChange={(v) => updateField("customer_need", v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CUSTOMER_NEEDS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Season</Label>
              <Select value={product.season} onValueChange={(v) => updateField("season", v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {SEASONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Base Price (€)</Label>
              <Input type="number" min={0} step={0.01} value={product.base_price} onChange={(e) => updateField("base_price", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Select value={product.status} onValueChange={(v) => updateField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Description</Label>
            <Textarea value={product.description} onChange={(e) => updateField("description", e.target.value)} rows={3} />
          </div>
        </div>

        <Button type="submit" disabled={saving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isNew ? "Create Style" : "Save Changes"}
        </Button>
      </form>

      {!isNew && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Color Variants ({colorVariants.length})</h3>
            <Button variant="outline" size="sm" onClick={() => { setShowNewColor(true); setEditingColor(null); }} className="gap-2">
              <Plus className="w-4 h-4" /> Add Color
            </Button>
          </div>

          {showNewColor && (
            <ColorVariantForm onSave={handleAddColor} onCancel={() => setShowNewColor(false)} />
          )}

          {editingColor && (
            <ColorVariantForm
              variant={editingColor}
              onSave={handleUpdateColor}
              onCancel={() => setEditingColor(null)}
              onDelete={handleDeleteColor}
            />
          )}

          {colorVariants.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {colorVariants.map((cv) => (
                <ColorVariantCard
                  key={cv.id}
                  variant={cv}
                  onClick={() => { setEditingColor(cv); setShowNewColor(false); }}
                />
              ))}
            </div>
          ) : (
            !showNewColor && (
              <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted-foreground">No color variants yet. Add one to get started.</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}