import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, Loader2, LayoutGrid, List, Plus } from "lucide-react";
import DataTable from "@/components/DataTable";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [colorVariants, setColorVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [view, setView] = useState("gallery");

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

  const columns = [
    {
      id: "image",
      label: "Image",
      width: 80,
      render: (product) => {
        const mainImage = product.images?.[0];
        return mainImage ? (
          <div className="w-10 h-10 rounded-md overflow-hidden border border-border">
            <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
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
      render: (p) => <Link to={`/products/${p.id}`} className="font-medium hover:text-primary transition-colors">{p.name}</Link>,
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
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setView("gallery")}
              className={`px-2.5 py-1.5 transition-colors ${view === "gallery" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
              title="Gallery view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`px-2.5 py-1.5 transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <Link to="/products/new" asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Style
            </Button>
          </Link>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              colorVariants={colorVariants.filter((cv) => cv.product_id === product.id)}
            />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          fixedColumns={["image"]}
          filterFields={[
            { getValue: (p) => p.name },
            { getValue: (p) => p.category },
            { getValue: (p) => p.sub_category },
          ]}
        />
      )}
    </div>
  );
}