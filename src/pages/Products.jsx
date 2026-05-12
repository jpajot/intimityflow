import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import ViewSelector from "../components/ViewSelector";
import GalleryView from "../components/GalleryView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, Loader2, LayoutGrid, List, Plus, Pin, PinOff } from "lucide-react";
import DataTable from "@/components/DataTable";
import { usePageOptions } from "@/lib/PageOptionsContext";
import { getPinnedItems, setPinnedItems } from "../components/Layout";
import RevisionBadge from "../components/revisions/RevisionBadge";


export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [colorVariants, setColorVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [view, setView] = useState(() => localStorage.getItem("products_view") || "gallery");
  const [activeColumns, setActiveColumns] = useState(null);
  const [filteredRows, setFilteredRows] = useState(null);
  const [pinnedItems, setPinnedItemsState] = useState(() => getPinnedItems());
  const { setOptions } = usePageOptions();

  const isPinned = pinnedItems.some((p) => p.path === "/list-view");
  
  const togglePin = () => {
    const current = getPinnedItems();
    let updated;
    if (current.some((p) => p.path === "/list-view")) {
      updated = current.filter((p) => p.path !== "/list-view");
    } else {
      if (current.length >= 3) return;
      updated = [...current, { path: "/list-view", label: "Products Lists" }];
    }
    setPinnedItems(updated);
    setPinnedItemsState(updated);
    window.dispatchEvent(new Event("pinned-items-changed"));
  };

  useEffect(() => {
    setOptions({
      items: [
        { label: view === "table" ? "View: Gallery" : "View: Table", icon: view === "table" ? LayoutGrid : List, onClick: () => { setView(view === "table" ? "gallery" : "table"); localStorage.setItem("products_view", view === "table" ? "gallery" : "table"); } },
        { divider: true },
        { label: isPinned ? "Unpin from sidebar" : "Pin to sidebar", icon: isPinned ? PinOff : Pin, onClick: togglePin },
      ],
    });
  }, [setOptions, view, isPinned]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [prods, colors] = await Promise.all([
      base44.entities.Product.filter({ type: "Product" }),
      base44.entities.ProductColor.list("-created_date", 1000),
    ]);
    setProducts(prods);
    setColorVariants(colors);
    setLoading(false);
  };

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === "all" || p.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  const subCategories = [...new Set(products.map((p) => p.sub_category).filter(Boolean))];
  const customerNeeds = [...new Set(products.map((p) => p.customer_need).filter(Boolean))];

  const allColumns = [
    {
      id: "image",
      label: "Image",
      width: 80,
      render: (product) => {
        const mainImage = product.images?.[0];
        return mainImage ? (
          <div className="w-10 h-10 rounded-md overflow-hidden border border-border">
            <img src={mainImage} alt={product.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-md bg-muted border border-border flex items-center justify-center text-xs font-semibold">
            {product.name?.charAt(0)?.toUpperCase()}
          </div>
        );
      },
    },
    {
      id: "name",
      label: "Name",
      width: 150,
      sortKey: (p) => p.name || "",
      render: (p) => (
        <div className="flex items-center gap-2">
          <Link to={`/products/${p.id}`} className="font-medium hover:text-primary transition-colors">
            {p.name}
          </Link>
          <RevisionBadge
            target_type="product"
            target_id={p.id}
            size="xs"
            onOpenPanel={(targetType, targetId) => navigate(`/products/${p.id}`)}
          />
        </div>
      ),
    },
    {
      id: "category",
      label: "Category",
      width: 120,
      sortKey: (p) => p.category || "",
      render: (p) => <span className="text-xs text-muted-foreground">{p.category}</span>,
    },
    {
      id: "sub_category",
      label: "Sub-Category",
      width: 120,
      sortKey: (p) => p.sub_category || "",
      render: (p) => <span className="text-xs text-muted-foreground">{p.sub_category}</span>,
    },
    {
      id: "customer_need",
      label: "Customer Need",
      width: 130,
      sortKey: (p) => p.customer_need || "",
      render: (p) => <span className="text-xs text-muted-foreground">{p.customer_need}</span>,
    },
    {
      id: "colorway_images",
      label: "Colorways",
      width: 200,
      render: (product) => {
        const cvs = colorVariants.filter((cv) => cv.product_id === product.id).slice(0, 4);
        if (!cvs.length) return "—";
        return (
          <div className="flex flex-col gap-1">
            {cvs.map((cv) => (
              <div key={cv.id} className="flex items-center gap-2">
                {cv.image_url ? (
                  <div className="w-6 h-6 rounded-sm overflow-hidden border border-border shrink-0">
                    <img src={cv.image_url} alt={cv.color_name} referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-sm border border-border shrink-0" style={{ backgroundColor: cv.color_hex || "#ccc" }} />
                )}
                <div className="flex flex-col text-xs leading-tight">
                  <span className="font-medium">{cv.color_name}</span>
                  <span className="text-muted-foreground">{cv.colorway_code}</span>
                </div>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      id: "colors",
      label: "Colors",
      width: 100,
      sortKey: (p) => colorVariants.filter((cv) => cv.product_id === p.id).length,
      render: (product) => {
        const count = colorVariants.filter((cv) => cv.product_id === product.id).length;
        return <span className="text-xs text-muted-foreground">{count}</span>;
      },
    },
  ];

  const filterableFields = [
    { id: "category", label: "Category", getValue: (p) => p.category },
    { id: "sub_category", label: "Sub-Category", getValue: (p) => p.sub_category },
    { id: "customer_need", label: "Customer Need", getValue: (p) => p.customer_need },
  ];

  const columns = activeColumns || allColumns;
  const tableRows = filteredRows !== null ? filteredRows : filtered;

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
        <h1 className="font-display text-3xl font-semibold tracking-tight">Styles</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 flex-wrap">
          {view === "table" && (
            <>
              <ViewSelector
                pageKey="styles"
                allColumns={allColumns}
                onColumnsChange={setActiveColumns}
                filterableFields={filterableFields}
                rows={filtered}
                onFilteredRowsChange={setFilteredRows}
              />
              <Link to="/products/new" asChild><Button className="gap-2"><Plus className="w-4 h-4" />New Style</Button></Link>
            </>
          )}
          {view === "gallery" && (
            <Link to="/products/new" asChild><Button className="gap-2"><Plus className="w-4 h-4" />New Style</Button></Link>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No styles yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first style to get started</p>
        </div>
      ) : view === "gallery" ? (
       <GalleryView
          pageKey="styles"
          allFields={[
            { id: "colorways", label: "Colorways", getValue: (p) => colorVariants.filter((cv) => cv.product_id === p.id).length, render: (product) => {
              const cvs = colorVariants.filter((cv) => cv.product_id === product.id).slice(0, 4);
              return cvs.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {cvs.map((cv) => (
                    <div key={cv.id} className="flex items-center gap-2">
                      {cv.image_url ? (
                        <div className="w-6 h-6 rounded overflow-hidden border border-border shrink-0">
                          <img src={cv.image_url} alt={cv.color_name} referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded border border-border shrink-0" style={{ backgroundColor: cv.color_hex || "#ccc" }} />
                      )}
                      <span className="text-xs font-medium truncate">{cv.color_name}</span>
                    </div>
                  ))}
                  {colorVariants.filter((cv) => cv.product_id === product.id).length > 4 && (
                    <span className="text-xs text-muted-foreground">+{colorVariants.filter((cv) => cv.product_id === product.id).length - 4} more</span>
                  )}
                </div>
              ) : "—";
            } },
            { id: "name", label: "Name", getValue: (p) => p.name || "—", render: (p) => p.name },
            { id: "category", label: "Category", getValue: (p) => p.category || "—", render: (p) => p.category },
          ]}
          filterableFields={filterableFields}
          rows={filtered}
          renderThumbnail={(product) => {
            const mainImage = product.images?.[0];
            return (
              <div className="relative w-full h-full">
                {mainImage ? (
                  <img src={mainImage} alt={product.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-sm font-semibold">
                    {product.name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <RevisionBadge
                    target_type="product"
                    target_id={product.id}
                    size="xs"
                    onOpenPanel={(targetType, targetId) => navigate(`/products/${product.id}`)}
                  />
                </div>
              </div>
            );
          }}
          onClickItem={(p) => navigate(`/products/${p.id}`)}
          />
      ) : (
        <DataTable
          columns={columns}
          rows={tableRows}
          fixedColumns={["image"]}
          hideColumnToggle
        />
      )}
    </div>
  );
}