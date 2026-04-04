import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Search, Loader2 } from "lucide-react";
import ViewSelector from "../components/ViewSelector";
import DataTable from "../components/DataTable";
import ProductCard from "../components/ProductCard";

// ─── Styles Tab ───────────────────────────────────────────────────────────────
function StylesTab({ products, colorVariants }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");
  const [activeColumns, setActiveColumns] = useState(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.sub_category?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const columns = [
    {
      id: "image", label: "Image", width: 70,
      render: (p) => p.images?.[0] ? (
        <div className="w-10 h-10 rounded-md overflow-hidden border border-border bg-muted">
          <img src={p.images[0]} alt={p.name} className="w-full h-full object-contain" />
        </div>
      ) : <div className="w-10 h-10 rounded-md border border-border bg-muted" />,
    },
    { id: "name", label: "Name", width: 180, sortKey: (p) => p.name || "", render: (p) => <span className="font-medium">{p.name}</span> },
    { id: "type", label: "Type", width: 100, sortKey: (p) => p.type || "", render: (p) => <span className="text-xs text-muted-foreground">{p.type}</span> },
    { id: "category", label: "Category", width: 140, sortKey: (p) => p.category || "", render: (p) => <span className="text-xs">{p.category || "—"}</span> },
    { id: "sub_category", label: "Sub-Category", width: 160, sortKey: (p) => p.sub_category || "", render: (p) => <span className="text-xs">{p.sub_category || "—"}</span> },
    { id: "customer_need", label: "Customer Need", width: 160, sortKey: (p) => p.customer_need || "", render: (p) => <span className="text-xs">{p.customer_need || "—"}</span> },
    {
      id: "colors", label: "Colorways", width: 120,
      render: (p) => {
        const cvs = colorVariants.filter((cv) => cv.product_id === p.id);
        return (
          <div className="flex gap-1 flex-wrap">
            {cvs.slice(0, 6).map((cv) => (
              <div key={cv.id} className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: cv.color_hex || "#ccc" }} title={cv.color_name} />
            ))}
            {cvs.length > 6 && <span className="text-xs text-muted-foreground">+{cvs.length - 6}</span>}
          </div>
        );
      },
    },
    {
      id: "actions", label: "", width: 50,
      render: (p) => (
        <button type="button" onClick={() => navigate(`/products/${p.id}`)} className="text-xs text-primary hover:underline">View</button>
      ),
    },
  ];

  const filterableFields = [
    { id: "category", label: "Category", getValue: (p) => p.category },
    { id: "sub_category", label: "Sub-Category", getValue: (p) => p.sub_category },
    { id: "customer_need", label: "Customer Need", getValue: (p) => p.customer_need },
    { id: "type", label: "Type", getValue: (p) => p.type },
  ];

  const visibleColumns = activeColumns || columns;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search styles…" className="pl-8 h-8 text-xs" />
        </div>
        {view === "list" && (
          <ViewSelector pageKey="styles_list" allColumns={columns} onColumnsChange={setActiveColumns} filterableFields={filterableFields} rows={products} />
        )}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button type="button" onClick={() => setView("grid")} className={`px-2.5 py-1.5 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Gallery"><LayoutGrid className="w-4 h-4" /></button>
          <button type="button" onClick={() => setView("list")} className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Table"><List className="w-4 h-4" /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">{products.length === 0 ? "No styles yet." : "No results match your search."}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} colorVariants={colorVariants.filter((cv) => cv.product_id === p.id)} />
          ))}
        </div>
      ) : (
        <DataTable columns={visibleColumns} rows={filtered} hideColumnToggle />
      )}
    </div>
  );
}

// ─── Colorways Tab ────────────────────────────────────────────────────────────
function ColorwaysTab({ colorways, products, techColors }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("list");
  const [activeColumns, setActiveColumns] = useState(null);

  const getProduct = (cw) => products.find((p) => p.id === cw.product_id);
  const getTechColor = (cw) => techColors.find((t) => t.id === cw.linked_tech_color_id);

  const filtered = useMemo(() => {
    if (!search.trim()) return colorways;
    const q = search.toLowerCase();
    return colorways.filter((cw) => {
      const prod = getProduct(cw);
      const tc = getTechColor(cw);
      return (
        cw.color_name?.toLowerCase().includes(q) ||
        cw.colorway_code?.toLowerCase().includes(q) ||
        prod?.name?.toLowerCase().includes(q) ||
        tc?.code?.toLowerCase().includes(q)
      );
    });
  }, [colorways, search]);

  // Columns include both colorway and parent style fields
  const columns = [
    {
      id: "style_image", label: "Style Image", width: 70,
      render: (cw) => {
        const prod = getProduct(cw);
        const img = prod?.images?.[0];
        return img ? (
          <div className="w-10 h-10 rounded-md overflow-hidden border border-border bg-muted">
            <img src={img} alt={prod.name} className="w-full h-full object-contain" />
          </div>
        ) : <div className="w-10 h-10 rounded-md border border-border bg-muted" />;
      },
    },
    {
      id: "style_name", label: "Style Name", width: 160, sortKey: (cw) => getProduct(cw)?.name || "",
      render: (cw) => {
        const prod = getProduct(cw);
        return prod ? (
          <button type="button" onClick={() => navigate(`/products/${prod.id}`)} className="text-xs font-semibold text-primary hover:underline text-left">{prod.name}</button>
        ) : "—";
      },
    },
    { id: "style_category", label: "Style: Category", width: 140, sortKey: (cw) => getProduct(cw)?.category || "", render: (cw) => <span className="text-xs text-muted-foreground">{getProduct(cw)?.category || "—"}</span> },
    { id: "style_sub_category", label: "Style: Sub-Category", width: 160, sortKey: (cw) => getProduct(cw)?.sub_category || "", render: (cw) => <span className="text-xs text-muted-foreground">{getProduct(cw)?.sub_category || "—"}</span> },
    { id: "style_customer_need", label: "Style: Customer Need", width: 170, sortKey: (cw) => getProduct(cw)?.customer_need || "", render: (cw) => <span className="text-xs text-muted-foreground">{getProduct(cw)?.customer_need || "—"}</span> },
    {
      id: "cw_image", label: "Colorway Image", width: 70,
      render: (cw) => cw.image_url ? (
        <div className="w-8 h-8 rounded-md overflow-hidden border border-border">
          <img src={cw.image_url} alt={cw.color_name} className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-md border border-border" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
      ),
    },
    { id: "color_name", label: "Color Name", width: 150, sortKey: (cw) => cw.color_name || "", render: (cw) => <span className="font-medium">{cw.color_name}</span> },
    { id: "colorway_code", label: "Colorway Code", width: 130, sortKey: (cw) => cw.colorway_code || "", render: (cw) => <span className="font-mono text-xs text-muted-foreground">{cw.colorway_code || "—"}</span> },
    {
      id: "color_hex", label: "Hex", width: 110,
      render: (cw) => cw.color_hex ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: cw.color_hex }} />
          <span className="font-mono text-xs text-muted-foreground">{cw.color_hex}</span>
        </div>
      ) : "—",
    },
    {
      id: "tech_color", label: "Technical Color", width: 160, sortKey: (cw) => getTechColor(cw)?.code || "",
      render: (cw) => {
        const tc = getTechColor(cw);
        if (!tc) return "—";
        return (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm border border-border shrink-0" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
            <span className="text-xs font-mono text-muted-foreground">{tc.code}</span>
          </div>
        );
      },
    },
  ];

  const filterableFields = [
    { id: "style_category", label: "Style: Category", getValue: (cw) => getProduct(cw)?.category },
    { id: "style_sub_category", label: "Style: Sub-Category", getValue: (cw) => getProduct(cw)?.sub_category },
  ];

  const visibleColumns = activeColumns || columns;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search colorways…" className="pl-8 h-8 text-xs" />
        </div>
        {view === "list" && (
          <ViewSelector pageKey="colorways_list" allColumns={columns} onColumnsChange={setActiveColumns} filterableFields={filterableFields} rows={colorways} />
        )}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button type="button" onClick={() => setView("grid")} className={`px-2.5 py-1.5 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Gallery"><LayoutGrid className="w-4 h-4" /></button>
          <button type="button" onClick={() => setView("list")} className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Table"><List className="w-4 h-4" /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">{colorways.length === 0 ? "No colorways yet." : "No results match your search."}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((cw) => {
            const prod = getProduct(cw);
            const img = prod?.images?.[0];
            return (
              <div key={cw.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
                <div className="aspect-square bg-muted relative">
                  {img ? (
                    <img src={img} alt={prod?.name} className="w-full h-full object-contain" />
                  ) : cw.image_url ? (
                    <img src={cw.image_url} alt={cw.color_name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 w-8 h-8 rounded-md border-2 border-white shadow" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
                </div>
                <div className="p-3 space-y-1">
                  {prod && (
                    <button type="button" onClick={() => navigate(`/products/${prod.id}`)} className="text-xs font-semibold text-primary hover:underline truncate block w-full text-left">{prod.name}</button>
                  )}
                  <p className="text-sm font-medium truncate">{cw.color_name}</p>
                  {cw.colorway_code && <p className="text-xs font-mono text-muted-foreground">{cw.colorway_code}</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable columns={visibleColumns} rows={filtered} hideColumnToggle />
      )}
    </div>
  );
}

// ─── More Variations Tab ──────────────────────────────────────────────────────
function MoreVariationsTab({ variations, colorways, products }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("list");
  const [activeColumns, setActiveColumns] = useState(null);

  const getColorway = (v) => colorways.find((cw) => cw.id === v.product_color_id);
  const getProduct = (v) => {
    const cw = getColorway(v);
    return cw ? products.find((p) => p.id === cw.product_id) : null;
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return variations;
    const q = search.toLowerCase();
    return variations.filter((v) => {
      const cw = getColorway(v);
      const prod = getProduct(v);
      return (
        v.name?.toLowerCase().includes(q) ||
        v.sequence?.toLowerCase().includes(q) ||
        cw?.color_name?.toLowerCase().includes(q) ||
        prod?.name?.toLowerCase().includes(q)
      );
    });
  }, [variations, search]);

  // Columns: variation fields + colorway parent fields + style grandparent fields
  const columns = [
    {
      id: "style_image", label: "Style Image", width: 70,
      render: (v) => {
        const prod = getProduct(v);
        const img = prod?.images?.[0];
        return img ? (
          <div className="w-10 h-10 rounded-md overflow-hidden border border-border bg-muted">
            <img src={img} alt={prod.name} className="w-full h-full object-contain" />
          </div>
        ) : <div className="w-10 h-10 rounded-md border border-border bg-muted" />;
      },
    },
    {
      id: "style_name", label: "Style Name", width: 150, sortKey: (v) => getProduct(v)?.name || "",
      render: (v) => {
        const prod = getProduct(v);
        return prod ? (
          <button type="button" onClick={() => navigate(`/products/${prod.id}`)} className="text-xs font-semibold text-primary hover:underline text-left">{prod.name}</button>
        ) : "—";
      },
    },
    { id: "style_category", label: "Style: Category", width: 140, sortKey: (v) => getProduct(v)?.category || "", render: (v) => <span className="text-xs text-muted-foreground">{getProduct(v)?.category || "—"}</span> },
    { id: "style_sub_category", label: "Style: Sub-Category", width: 160, sortKey: (v) => getProduct(v)?.sub_category || "", render: (v) => <span className="text-xs text-muted-foreground">{getProduct(v)?.sub_category || "—"}</span> },
    {
      id: "cw_image", label: "Colorway", width: 70,
      render: (v) => {
        const cw = getColorway(v);
        return cw?.image_url ? (
          <div className="w-8 h-8 rounded-md overflow-hidden border border-border">
            <img src={cw.image_url} alt={cw.color_name} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-md border border-border" style={{ backgroundColor: cw?.color_hex || "#ccc" }} />
        );
      },
    },
    { id: "cw_color_name", label: "Colorway Name", width: 150, sortKey: (v) => getColorway(v)?.color_name || "", render: (v) => <span className="text-xs">{getColorway(v)?.color_name || "—"}</span> },
    { id: "cw_code", label: "Colorway Code", width: 130, sortKey: (v) => getColorway(v)?.colorway_code || "", render: (v) => <span className="font-mono text-xs text-muted-foreground">{getColorway(v)?.colorway_code || "—"}</span> },
    {
      id: "var_image", label: "Variation Image", width: 70,
      render: (v) => v.image_url ? (
        <div className="w-8 h-8 rounded-md overflow-hidden border border-border">
          <img src={v.image_url} alt={v.name} className="w-full h-full object-contain" />
        </div>
      ) : <div className="w-8 h-8 rounded-md border border-border bg-muted" />,
    },
    { id: "sequence", label: "Sequence", width: 90, sortKey: (v) => v.sequence || "", render: (v) => <span className="font-mono text-xs">{v.sequence || "—"}</span> },
    { id: "name", label: "Variation Name", width: 150, sortKey: (v) => v.name || "", render: (v) => <span className="font-medium">{v.name || "—"}</span> },
    { id: "description", label: "Description", width: 200, render: (v) => <span className="text-xs text-muted-foreground truncate max-w-[180px] block">{v.description || "—"}</span> },
    { id: "pack_code", label: "Pack Code", width: 110, sortKey: (v) => v.pack_code || "", render: (v) => <span className="text-xs">{v.pack_code || "—"}</span> },
    { id: "variant", label: "Variant", width: 110, sortKey: (v) => v.variant || "", render: (v) => <span className="text-xs">{v.variant || "—"}</span> },
  ];

  const filterableFields = [
    { id: "style_category", label: "Style: Category", getValue: (v) => getProduct(v)?.category },
    { id: "style_sub_category", label: "Style: Sub-Category", getValue: (v) => getProduct(v)?.sub_category },
    { id: "pack_code", label: "Pack Code", getValue: (v) => v.pack_code },
    { id: "variant", label: "Variant", getValue: (v) => v.variant },
  ];

  const visibleColumns = activeColumns || columns;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search variations…" className="pl-8 h-8 text-xs" />
        </div>
        {view === "list" && (
          <ViewSelector pageKey="more_variations_list" allColumns={columns} onColumnsChange={setActiveColumns} filterableFields={filterableFields} rows={variations} />
        )}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button type="button" onClick={() => setView("grid")} className={`px-2.5 py-1.5 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Gallery"><LayoutGrid className="w-4 h-4" /></button>
          <button type="button" onClick={() => setView("list")} className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Table"><List className="w-4 h-4" /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">{variations.length === 0 ? "No variations yet." : "No results match your search."}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((v) => {
            const prod = getProduct(v);
            const cw = getColorway(v);
            const img = v.image_url || prod?.images?.[0];
            return (
              <div key={v.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
                <div className="aspect-square bg-muted relative">
                  {img ? (
                    <img src={img} alt={v.name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: cw?.color_hex || "#ccc" }} />
                    </div>
                  )}
                  {cw?.color_hex && (
                    <div className="absolute bottom-2 right-2 w-8 h-8 rounded-md border-2 border-white shadow" style={{ backgroundColor: cw.color_hex }} />
                  )}
                </div>
                <div className="p-3 space-y-1">
                  {prod && (
                    <button type="button" onClick={() => navigate(`/products/${prod.id}`)} className="text-xs font-semibold text-primary hover:underline truncate block w-full text-left">{prod.name}</button>
                  )}
                  {cw && <p className="text-xs text-muted-foreground truncate">{cw.color_name}</p>}
                  <p className="text-sm font-medium truncate">{v.name || `#${v.sequence}`}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable columns={visibleColumns} rows={filtered} hideColumnToggle />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ListView() {
  const [products, setProducts] = useState([]);
  const [colorways, setColorways] = useState([]);
  const [variations, setVariations] = useState([]);
  const [techColors, setTechColors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Product.list("-created_date", 500),
      base44.entities.ProductColor.list("-created_date", 2000),
      base44.entities.ProductColorAndMore.list("-created_date", 5000),
      base44.entities.TechnicalColor.list("code", 2000),
    ]).then(([prods, cws, vars, tcs]) => {
      setProducts(prods);
      setColorways(cws);
      setVariations(vars);
      setTechColors(tcs);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Styles Lists</h1>
        <p className="text-muted-foreground mt-1">Browse and filter styles, colorways, and variations</p>
      </div>

      <Tabs defaultValue="styles">
        <TabsList>
          <TabsTrigger value="styles">Styles ({products.length})</TabsTrigger>
          <TabsTrigger value="colorways">Colorways ({colorways.length})</TabsTrigger>
          <TabsTrigger value="variations">More Variations ({variations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="styles" className="mt-4">
          <StylesTab products={products} colorVariants={colorways} />
        </TabsContent>

        <TabsContent value="colorways" className="mt-4">
          <ColorwaysTab colorways={colorways} products={products} techColors={techColors} />
        </TabsContent>

        <TabsContent value="variations" className="mt-4">
          <MoreVariationsTab variations={variations} colorways={colorways} products={products} />
        </TabsContent>
      </Tabs>
    </div>
  );
}