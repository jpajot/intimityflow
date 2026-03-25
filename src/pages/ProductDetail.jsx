import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Loader2, Trash2, Upload, X, Search } from "lucide-react";
import ColorwayCard from "../components/ColorwayCard";
import ColorwayEditModal from "../components/ColorwayEditModal";
import ColorLibraryPickerModal from "../components/ColorLibraryPickerModal";
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
    name: "", category: "", sub_category: "", customer_need: "",
    description: "", images: [],
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [colorVariants, setColorVariants] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [showNewColorModal, setShowNewColorModal] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

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
      const { id: _, created_date, updated_date, created_by, sku, season, base_price, status, ...data } = product;
      await base44.entities.Product.update(product.id, data);
    }
    setSaving(false);
  };

  const handleAddColor = async (data) => {
    const created = await base44.entities.ProductColor.create({ ...data, product_id: product.id });
    setColorVariants((prev) => [...prev, created]);
  };

  const handleAddFromLibrary = async (colorways) => {
    const created = await Promise.all(
      colorways.map(data => base44.entities.ProductColor.create({ ...data, product_id: product.id }))
    );
    setColorVariants(prev => [...prev, ...created]);
  };

  const handleUpdateColor = async (data) => {
    const { id: cid } = editingColor;
    await base44.entities.ProductColor.update(cid, data);
    setColorVariants((prev) => prev.map((cv) => (cv.id === cid ? { ...cv, ...data } : cv)));
  };

  const handleDeleteColor = async () => {
    await base44.entities.ProductColor.delete(editingColor.id);
    setColorVariants((prev) => prev.filter((cv) => cv.id !== editingColor.id));
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
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Description</Label>
            <Textarea value={product.description} onChange={(e) => updateField("description", e.target.value)} rows={3} />
          </div>
        </div>

        {/* Style Images */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Style Images</h3>
              <p className="text-xs text-muted-foreground mt-0.5">First image will be used as the main cover image</p>
            </div>
            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors ${uploadingImage ? "opacity-50 pointer-events-none" : ""}`}>
              {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingImage ? "Uploading..." : "Add Image"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;
                setUploadingImage(true);
                const urls = await Promise.all(files.map(async (file) => {
                  const { file_url } = await base44.integrations.Core.UploadFile({ file });
                  return file_url;
                }));
                updateField("images", [...(product.images || []), ...urls]);
                setUploadingImage(false);
                e.target.value = "";
              }} />
            </label>
          </div>
          {(product.images || []).length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {(product.images || []).map((url, idx) => (
                <div key={url} className="relative group/img aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={url} alt={`Style image ${idx + 1}`} className="w-full h-full object-cover" />
                  {idx === 0 && (
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold rounded">
                      Main
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => updateField("images", (product.images || []).filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center hidden group-hover/img:flex"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const imgs = [...(product.images || [])];
                        imgs.splice(idx, 1);
                        imgs.unshift(url);
                        updateField("images", imgs);
                      }}
                      className="absolute bottom-1 left-1 px-1 py-0.5 bg-background/80 text-foreground text-[10px] rounded hidden group-hover/img:block"
                    >
                      Set main
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-28 flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
              <p className="text-sm text-muted-foreground">No images yet — click "Add Image" to upload</p>
            </div>
          )}
        </div>

        <Button type="submit" disabled={saving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isNew ? "Create Style" : "Save Changes"}
        </Button>
      </form>

      {!isNew && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Colorways ({colorVariants.length})</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowLibraryPicker(true)} className="gap-2">
                <Search className="w-4 h-4" /> From Color Library
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setEditingColor(null); setShowNewColorModal(true); }} className="gap-2">
                <Plus className="w-4 h-4" /> Add Colorway
              </Button>
            </div>
          </div>

          {colorVariants.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {colorVariants.map((cv) => (
                <ColorwayCard
                  key={cv.id}
                  variant={cv}
                  onEdit={() => setEditingColor(cv)}
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

      <ColorwayEditModal
        open={showNewColorModal}
        onClose={() => setShowNewColorModal(false)}
        onSave={handleAddColor}
      />

      <ColorwayEditModal
        variant={editingColor}
        open={!!editingColor}
        onClose={() => setEditingColor(null)}
        onSave={handleUpdateColor}
        onDelete={handleDeleteColor}
      />

      <ColorLibraryPickerModal
        open={showLibraryPicker}
        onClose={() => setShowLibraryPicker(false)}
        onAdd={handleAddFromLibrary}
      />
    </div>
  );
}