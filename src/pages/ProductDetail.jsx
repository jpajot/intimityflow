import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Loader2, Trash2, Upload, X, Palette, Ruler, Layers, ChevronDown } from "lucide-react";
import ItemSubNav from "../components/ItemSubNav";

import MoreVariationsSection from "../components/MoreVariationsSection";
import StyleSizesSection from "../components/StyleSizesSection";
import ColorwaySection from "../components/ColorwaySection";
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
import PresenceIndicator from "../components/PresenceIndicator";

// Categories, sub-categories, and customer needs are now fetched from database


export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const queryParams = new URLSearchParams(window.location.search);
  const typeFromQuery = queryParams.get("type") || "Product";

  const [detailsOpen, setDetailsOpen] = useState(() => {
    const saved = localStorage.getItem("product_detail_details_open");
    return saved === null ? true : saved === "true";
  });

  const toggleDetails = (v) => {
    const next = typeof v === "boolean" ? v : !detailsOpen;
    setDetailsOpen(next);
    localStorage.setItem("product_detail_details_open", String(next));
  };
  const [product, setProduct] = useState({
    type: typeFromQuery, name: "", category: "", sub_category: "", customer_need: "",
    description: "", images: [], size_grid_id: "",
  });
  const [sizeGrids, setSizeGrids] = useState([]);
  const [projects, setProjects] = useState([]);
  const [hasStyleSizes, setHasStyleSizes] = useState(false);
  const [lovTypes, setLovTypes] = useState({});
  const [lovTypesArray, setLovTypesArray] = useState([]);
  const [lovValues, setLovValues] = useState([]);
  const [productTypeOptions, setProductTypeOptions] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [colorVariants, setColorVariants] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [originalSizeGridId, setOriginalSizeGridId] = useState("");
  const autoSaveTimer = useRef(null);
  const [editingColor, setEditingColor] = useState(null);
  const [showNewColorModal, setShowNewColorModal] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [activeTab, setActiveTab] = useState("colorways");

  useEffect(() => {
    loadLovData();
    base44.entities.SizeGrid.list("name", 200).then(setSizeGrids);
    base44.entities.Project.list("name", 500).then(setProjects);
    if (!isNew) {
      loadProduct();
      checkStyleSizes();
    }
  }, [id]);

  const checkStyleSizes = async () => {
    const ss = await base44.entities.StyleSize.filter({ product_id: id });
    setHasStyleSizes(ss.length > 0);
  };

  const loadLovData = async () => {
    const [types, values] = await Promise.all([
      base44.entities.TypeOfLOV.list("code", 500),
      base44.entities.ListOfValues.list("name", 5000),
    ]);
    const typeMap = {};
    types.forEach((t) => (typeMap[t.code] = t.id));
    setLovTypes(typeMap);
    setLovTypesArray(types);
    setLovValues(values);

    // Load product type options from EntityTypes LOV filtered by Product entity
    const entityTypesLov = types.find((t) => t.code === "EntityTypes");
    const entitiesLov = types.find((t) => t.code === "Entities");
    if (entityTypesLov && entitiesLov) {
      const productEntityValue = values.find((v) => v.type_of_lov_id === entitiesLov.id && v.name === "Product");
      if (productEntityValue) {
        const typeOpts = values.filter((v) => v.type_of_lov_id === entityTypesLov.id && v.depends_on_value_id === productEntityValue.id);
        setProductTypeOptions(typeOpts.map((v) => v.name));
      }
    }
  };

  const getCategories = () => {
    const categoryTypeId = lovTypes["Category"];
    if (!categoryTypeId) return [];
    const all = lovValues.filter((v) => v.type_of_lov_id === categoryTypeId);
    const anyHasDep = all.some((v) => !!v.depends_on_value_id);
    if (!anyHasDep) return all;
    // Find which parent value IDs are referenced by categories, then match by current type name
    const categoryDepIds = new Set(all.map((v) => v.depends_on_value_id).filter(Boolean));
    const matchingTypeVal = lovValues.find((v) => categoryDepIds.has(v.id) && v.name === product.type);
    if (!matchingTypeVal) return all.filter((v) => !v.depends_on_value_id);
    return all.filter((v) => v.depends_on_value_id === matchingTypeVal.id);
  };

  const getSubCategories = () => {
    const subCategoryTypeId = lovTypes["Sub-Category"];
    if (!subCategoryTypeId || !product.category) return [];
    const categoryValue = lovValues.find((v) => v.type_of_lov_id === lovTypes["Category"] && v.name === product.category);
    if (!categoryValue) return [];
    return lovValues.filter((v) => v.type_of_lov_id === subCategoryTypeId && v.depends_on_value_id === categoryValue.id);
  };

  const getCustomerNeeds = () => {
    const customerNeedTypeId = lovTypes["Customer Need"];
    if (!customerNeedTypeId) return [];
    const allCustomerNeeds = lovValues.filter((v) => v.type_of_lov_id === customerNeedTypeId);
    const hasDependencies = allCustomerNeeds.some((v) => v.depends_on_value_id);
    if (!hasDependencies) return allCustomerNeeds.map((v) => v.name);
    if (!product.sub_category) return allCustomerNeeds.map((v) => v.name);
    const subCategoryValue = lovValues.find((v) => v.type_of_lov_id === lovTypes["Sub-Category"] && v.name === product.sub_category);
    if (!subCategoryValue) return allCustomerNeeds.map((v) => v.name);
    return allCustomerNeeds
      .filter((v) => v.depends_on_value_id === subCategoryValue.id)
      .map((v) => v.name);
  };

  const getSubTypes = () => {
    const subTypesDef = lovTypesArray.find((t) => t.code === "Sub-Types");
    if (!subTypesDef) return [];
    const allSubTypes = lovValues.filter((v) => v.type_of_lov_id === subTypesDef.id);
    if (!allSubTypes.some((v) => v.depends_on_value_id)) return allSubTypes.map((v) => v.name);
    if (!product.type) return allSubTypes.map((v) => v.name);
    // Find the parent TypeOfLOV
    const parentTypeDef = lovTypesArray.find((t) => t.id === subTypesDef.depends_on_id);
    if (!parentTypeDef) return allSubTypes.map((v) => v.name);
    const parentValue = lovValues.find((v) => v.type_of_lov_id === parentTypeDef.id && v.name === product.type);
    if (!parentValue) return allSubTypes.map((v) => v.name);
    return allSubTypes.filter((v) => v.depends_on_value_id === parentValue.id).map((v) => v.name);
  };

  const loadProduct = async () => {
    setLoading(true);
    const [prod, colors] = await Promise.all([
      base44.entities.Product.filter({ id }),
      base44.entities.ProductColor.filter({ product_id: id }),
    ]);
    if (prod.length > 0) {
      setProduct(prod[0]);
      setOriginalSizeGridId(prod[0].size_grid_id || "");
    }
    setColorVariants(colors);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let productId = product.id;
      if (isNew) {
        // Auto-generate code if not already set
        let code = product.code || "";
        if (!code) {
          try {
            const res = await base44.functions.invoke("generateCode", {
              entity_name: "Product",
              entity_type: product.type || typeFromQuery,
            });
            code = res.data?.code || "";
          } catch (_) { /* no generator configured, skip */ }
        }
        const created = await base44.entities.Product.create({ ...product, type: product.type || typeFromQuery, code });
        productId = created.id;
      } else {
        const { id: _, created_date, updated_date, created_by, ...data } = product;
        await base44.entities.Product.update(product.id, data);
      }
      
      // If a size grid was selected, populate or update StyleSize with grid's active status
      if (product.size_grid_id) {
        const gridSizeIdChanged = originalSizeGridId !== product.size_grid_id;
        
        if (!hasStyleSizes || gridSizeIdChanged) {
          // Delete old sizes if grid changed
          if (gridSizeIdChanged && hasStyleSizes) {
            const oldSizes = await base44.entities.StyleSize.filter({ product_id: productId });
            await Promise.all(oldSizes.map((ss) => base44.entities.StyleSize.delete(ss.id)));
          }
          
          // Add new sizes from grid
          const gridSizes = await base44.entities.SizeGridSize.filter({ size_grid_id: product.size_grid_id });
          if (gridSizes.length > 0) {
            await Promise.all(
              gridSizes.map((gs) => base44.entities.StyleSize.create({ product_id: productId, size_id: gs.size_id, active: gs.active !== false }))
            );
          }
          
          if (gridSizeIdChanged) {
            setOriginalSizeGridId(product.size_grid_id);
            setHasStyleSizes(true);
          }
        }
      }
      
      if (isNew) {
        navigate(`/products/${productId}`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const createDefaultVariation = async (productColorId, colorName) => {
    const [allVars, styleSizes] = await Promise.all([
      base44.entities.ProductColorAndMore.list("-created_date", 500),
      base44.entities.StyleSize.filter({ product_id: product.id }),
    ]);
    const colorIds = colorVariants.map((cv) => cv.id);
    const existing = allVars.filter((v) => [...colorIds, productColorId].includes(v.product_color_id));
    const nums = existing.map((v) => parseInt(v.sequence || "0", 10)).filter((n) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    const sequence = String(max + 1).padStart(4, "0");
    const activeSizeIds = styleSizes.filter((ss) => ss.active !== false).map((ss) => ss.size_id);
    await base44.entities.ProductColorAndMore.create({
      product_color_id: productColorId,
      name: colorName || "Default",
      sequence,
      size_ids: activeSizeIds,
    });
  };

  const handleAddColor = async (data) => {
    const created = await base44.entities.ProductColor.create({ ...data, product_id: product.id });
    setColorVariants((prev) => [...prev, created]);
    if (created.linked_tech_color_id) {
      await createDefaultVariation(created.id, created.color_name);
    }
  };

  const handleAddFromLibrary = async (colorways) => {
    const created = await Promise.all(
      colorways.map(data => base44.entities.ProductColor.create({ ...data, product_id: product.id }))
    );
    setColorVariants(prev => [...prev, ...created]);
    for (const cv of created) {
      if (cv.linked_tech_color_id) {
        await createDefaultVariation(cv.id, cv.color_name);
      }
    }
  };

  const handleUpdateColor = async (data) => {
    const { id: cid } = editingColor;
    await base44.entities.ProductColor.update(cid, data);
    setColorVariants((prev) => prev.map((cv) => (cv.id === cid ? { ...cv, ...data } : cv)));
  };

  const handleSizeGridChange = (value) => {
    const newGridId = value === "none" ? "" : value;
    updateField("size_grid_id", newGridId);
  };

  const handleDeleteColor = async () => {
    // Check if this colorway is referenced in any More Variation
    const allVars = await base44.entities.ProductColorAndMore.list("-created_date", 500);
    const isReferenced = allVars.some((v) => v.product_color_id === editingColor.id);
    if (isReferenced) {
      alert("This colorway cannot be deleted because it has linked variations. Delete those variations first.");
      return;
    }
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

  const updateField = (field, value) => {
    setProduct((p) => {
      const updated = { ...p, [field]: value };
      if (!isNew) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => autoSave(updated), 800);
      }
      return updated;
    });
  };

  const autoSave = async (data) => {
    const { id: _, created_date, updated_date, created_by, ...fields } = data;
    await base44.entities.Product.update(data.id, fields);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(product.type === "Material" ? "/materials" : "/")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {isNew ? `New ${product.type}` : product.name}
          </h1>
        </div>
        {!isNew && (
          <PresenceIndicator entityType="Product" entityId={product.id} />
        )}
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

      {/* Collapsible Form */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => toggleDetails()}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors"
        >
          <span className="text-sm font-semibold">{isNew ? `New ${product.type}` : "Details"}</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${detailsOpen ? "" : "-rotate-90"}`} />
        </button>
        {detailsOpen && (
          <div className="p-5 pt-0">
            <div className="flex gap-6 items-start">

              {/* 1/4 — Images */}
              <div className="w-1/4 shrink-0">
                <div className="bg-card rounded-xl border border-border p-4 space-y-3 sticky top-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Images</p>
                    <label className={`flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors ${uploadingImage ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploadingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {uploadingImage ? "…" : "Add"}
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
                    <div className="grid grid-cols-2 gap-2">
                      {(product.images || []).map((url, idx) => (
                        <div key={url} className="relative group/img aspect-square rounded-lg overflow-hidden border border-border">
                          <img src={url} alt={`Style image ${idx + 1}`} className="w-full h-full object-cover" />
                          {idx === 0 && (
                            <div className="absolute top-1 left-1 px-1 py-0.5 bg-primary text-primary-foreground text-[9px] font-semibold rounded">Main</div>
                          )}
                          <button type="button" onClick={() => updateField("images", (product.images || []).filter((_, i) => i !== idx))} className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground items-center justify-center hidden group-hover/img:flex">
                            <X className="w-2.5 h-2.5" />
                          </button>
                          {idx > 0 && (
                            <button type="button" onClick={() => { const imgs = [...(product.images || [])]; imgs.splice(idx, 1); imgs.unshift(url); updateField("images", imgs); }} className="absolute bottom-1 left-1 px-1 py-0.5 bg-background/80 text-foreground text-[9px] rounded hidden group-hover/img:block">Set main</button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-square flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground text-center px-2">No images yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 3/4 — Fields */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">

                  {/* Code */}
                  <div className="space-y-2">
                    <Label className="text-xs">Code</Label>
                    <Input value={product.code || ""} onChange={(e) => updateField("code", e.target.value)} placeholder="Auto-generated on creation" />
                  </div>

                  {/* Type */}
                  <div className="space-y-2">
                    <Label className="text-xs">Type</Label>
                    {productTypeOptions.length > 0 ? (
                      <Select value={product.type} onValueChange={(v) => updateField("type", v)}>
                        <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                        <SelectContent>
                          {productTypeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground">{product.type}</p>
                    )}
                  </div>

                  {/* Name */}
                  <div className="space-y-2">
                    <Label className="text-xs">Name</Label>
                    <Input value={product.name} onChange={(e) => updateField("name", e.target.value)} required />
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <Label className="text-xs">Category</Label>
                    <Select value={product.category} onValueChange={(v) => { updateField("category", v); updateField("sub_category", ""); updateField("customer_need", ""); }}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {getCategories().map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sub-Category */}
                  <div className="space-y-2">
                    <Label className="text-xs">Sub-Category</Label>
                    <Select value={product.sub_category} onValueChange={(v) => { updateField("sub_category", v); updateField("customer_need", ""); }} disabled={!product.category}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {getSubCategories().map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sub-type */}
                  {getSubTypes().length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs">Sub-type</Label>
                      <Select value={product.sub_type || "none"} onValueChange={(v) => updateField("sub_type", v === "none" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {getSubTypes().map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Customer Need */}
                  {product.type === "Product" && (
                    <div className="space-y-2">
                      <Label className="text-xs">Customer Need</Label>
                      <Select value={product.customer_need} onValueChange={(v) => updateField("customer_need", v)}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {getCustomerNeeds().map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Size Grid */}
                  <div className="space-y-2">
                    <Label className="text-xs">Size Grid</Label>
                    <Select value={product.size_grid_id || "none"} onValueChange={handleSizeGridChange}>
                      <SelectTrigger><SelectValue placeholder="Select size grid..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {sizeGrids.map((sg) => <SelectItem key={sg.id} value={sg.id}>{sg.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Creation Project */}
                  <div className="space-y-2">
                    <Label className="text-xs">Creation Project</Label>
                    <Select value={product.creation_project_id || "none"} onValueChange={(v) => updateField("creation_project_id", v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                </div>

                {/* Linked Projects */}
                <div className="space-y-2">
                  <Label className="text-xs">Linked Projects</Label>
                  <div className="flex flex-wrap gap-2 p-2 rounded-md border border-input min-h-[36px]">
                    {(product.project_ids || []).map((pid) => {
                      const proj = projects.find((p) => p.id === pid);
                      return proj ? (
                        <span key={pid} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full border border-primary/20">
                          {proj.name}
                          <button type="button" onClick={() => updateField("project_ids", (product.project_ids || []).filter((x) => x !== pid))} className="ml-1 hover:text-destructive">×</button>
                        </span>
                      ) : null;
                    })}
                    <Select value="none" onValueChange={(v) => { if (v !== "none" && !(product.project_ids || []).includes(v)) updateField("project_ids", [...(product.project_ids || []), v]); }}>
                      <SelectTrigger className="h-6 text-xs border-dashed w-auto min-w-[120px] border-0 shadow-none p-0 pl-1"><SelectValue placeholder="+ Add project" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">+ Add project</SelectItem>
                        {projects.filter((p) => !(product.project_ids || []).includes(p.id)).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description — full width */}
                <div className="space-y-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea value={product.description} onChange={(e) => updateField("description", e.target.value)} rows={4} />
                </div>

                {isNew && (
                  <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {!isNew && (
        <ItemSubNav
          items={[
            { id: "colorways", label: "Colorways", count: colorVariants.length, icon: Palette },
            { id: "sizes", label: "Sizes", icon: Ruler },
            { id: "more", label: "More Variations", icon: Layers },
          ]}
          activeId={activeTab}
          onChange={setActiveTab}
        >
          {activeTab === "colorways" && (
            <ColorwaySection
              colorVariants={colorVariants}
              onEdit={(cv) => setEditingColor(cv)}
              onAddNew={() => { setEditingColor(null); setShowNewColorModal(true); }}
              onAddFromLibrary={() => setShowLibraryPicker(true)}
            />
          )}
          {activeTab === "sizes" && (
            <StyleSizesSection product={product} onSizesChange={(hasSizes) => { setHasStyleSizes(hasSizes); if (!hasSizes) setOriginalSizeGridId(""); }} />
          )}
          {activeTab === "more" && (
            <MoreVariationsSection productId={product.id} colorVariants={colorVariants} />
          )}
        </ItemSubNav>
      )}

      <ColorwayEditModal
        open={showNewColorModal}
        onClose={() => setShowNewColorModal(false)}
        onSave={handleAddColor}
        existingColorways={colorVariants}
      />

      <ColorwayEditModal
        open={!!editingColor}
        variant={editingColor}
        onClose={() => setEditingColor(null)}
        onSave={handleUpdateColor}
        onDelete={handleDeleteColor}
        existingColorways={colorVariants.filter((cv) => cv.id !== editingColor?.id)}
      />

      <ColorLibraryPickerModal
        open={showLibraryPicker}
        onClose={() => setShowLibraryPicker(false)}
        onAdd={handleAddFromLibrary}
      />
    </div>
  );
}