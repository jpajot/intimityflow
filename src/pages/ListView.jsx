import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Search, Loader2, Shirt, Palette, Layers, Plus } from "lucide-react";
import ItemSubNav from "../components/ItemSubNav";
import ViewSelector from "../components/ViewSelector";
import DataTable from "../components/DataTable";
import GalleryView from "../components/GalleryView";
import ProductCard from "../components/ProductCard";

// ─── Styles Tab ───────────────────────────────────────────────────────────────
function StylesTab({ products, colorVariants, techColors, sizeGrids, projects }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");
  const [activeColumns, setActiveColumns] = useState(null);
  const [pinnedCols, setPinnedCols] = useState([]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => {
      if (
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.sub_category?.toLowerCase().includes(q)
      ) return true;
      // Also search by colorway name/code or tech color code
      const pColorways = colorVariants.filter((cv) => cv.product_id === p.id);
      return pColorways.some((cv) => {
        const tc = techColors.find((t) => t.id === cv.linked_tech_color_id);
        return (
          cv.color_name?.toLowerCase().includes(q) ||
          cv.colorway_code?.toLowerCase().includes(q) ||
          tc?.code?.toLowerCase().includes(q) ||
          tc?.name?.toLowerCase().includes(q)
        );
      });
    });
  }, [products, search, colorVariants, techColors]);

  const columns = [
    {
      id: "image", label: "Image", width: 70,
      render: (p) => p.images?.[0] ? (
        <div className="w-10 h-10 rounded-md overflow-hidden border border-border bg-muted">
          <img src={p.images[0]} alt={p.name} className="w-full h-full object-contain" />
        </div>
      ) : <div className="w-10 h-10 rounded-md border border-border bg-muted" />,
    },
    { id: "name", label: "Name", width: 180, sortKey: (p) => p.name || "", render: (p) => <button type="button" onClick={() => navigate(`/products/${p.id}`)} className="font-medium text-primary hover:underline text-left">{p.name}</button> },
    { id: "type", label: "Type", width: 100, sortKey: (p) => p.type || "", render: (p) => <span className="text-xs text-muted-foreground">{p.type}</span> },
    { id: "category", label: "Category", width: 140, sortKey: (p) => p.category || "", render: (p) => <span className="text-xs">{p.category || "—"}</span> },
    { id: "sub_category", label: "Sub-Category", width: 160, sortKey: (p) => p.sub_category || "", render: (p) => <span className="text-xs">{p.sub_category || "—"}</span> },
    { id: "customer_need", label: "Customer Need", width: 160, sortKey: (p) => p.customer_need || "", render: (p) => <span className="text-xs">{p.customer_need || "—"}</span> },
    { id: "size_grid_id", label: "Size Grid", width: 130, sortKey: (p) => sizeGrids.find((sg) => sg.id === p.size_grid_id)?.name || "", render: (p) => { const sg = sizeGrids.find((sg) => sg.id === p.size_grid_id); return <span className="text-xs">{sg?.name || "—"}</span>; } },
    { id: "created_by", label: "Created By", width: 180, sortKey: (p) => p.created_by || "", render: (p) => <span className="text-xs text-muted-foreground">{p.created_by || "—"}</span> },
    { id: "creation_project", label: "Creation Project", width: 160, sortKey: (p) => sizeGrids.find ? (projects.find((pr) => pr.id === p.creation_project_id)?.name || "") : "", render: (p) => { const pr = projects.find((proj) => proj.id === p.creation_project_id); return <span className="text-xs text-muted-foreground">{pr?.name || "—"}</span>; } },
    { id: "linked_projects", label: "Linked Projects", width: 200, render: (p) => { const names = (p.project_ids || []).map((pid) => projects.find((pr) => pr.id === pid)?.name).filter(Boolean); return <span className="text-xs text-muted-foreground">{names.length > 0 ? names.join(", ") : "—"}</span>; } },
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

  ];

  const filterableFields = [
    { id: "category", label: "Category", getValue: (p) => p.category },
    { id: "sub_category", label: "Sub-Category", getValue: (p) => p.sub_category },
    { id: "customer_need", label: "Customer Need", getValue: (p) => p.customer_need },
    { id: "type", label: "Type", getValue: (p) => p.type },
    { id: "creation_project", label: "Creation Project", getValue: (p) => projects.find((pr) => pr.id === p.creation_project_id)?.name },
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
          <ViewSelector pageKey="styles_list" allColumns={columns} onColumnsChange={setActiveColumns} filterableFields={filterableFields} rows={products} entityNames={["Product"]} fixedColumnIds={pinnedCols} onFixedColumnIdsChange={setPinnedCols} />
        )}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button type="button" onClick={() => setView("grid")} className={`px-2.5 py-1.5 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Gallery"><LayoutGrid className="w-4 h-4" /></button>
          <button type="button" onClick={() => setView("list")} className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Table"><List className="w-4 h-4" /></button>
        </div>
        <Button size="sm" className="gap-1.5 h-8" onClick={() => navigate("/products/new")}><Plus className="w-3.5 h-3.5" /> New Style</Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">{products.length === 0 ? "No styles yet." : "No results match your search."}</p>
        </div>
      ) : view === "grid" ? (
        <GalleryView
          pageKey="styles_list"
          navigate={navigate}
          allFields={[
            { id: "colorways", label: "Colorways", getValue: (p) => colorVariants.filter((cv) => cv.product_id === p.id).length, render: (product) => {
              const cvs = colorVariants.filter((cv) => cv.product_id === product.id).slice(0, 4);
              return cvs.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {cvs.map((cv) => (
                    <div key={cv.id} className="flex items-center gap-2">
                      {cv.image_url ? (
                        <div className="w-6 h-6 rounded overflow-hidden border border-border shrink-0">
                          <img src={cv.image_url} alt={cv.color_name} className="w-full h-full object-contain" />
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
            { id: "sub_category", label: "Sub-Category", getValue: (p) => p.sub_category || "—", render: (p) => p.sub_category || "—" },
            { id: "customer_need", label: "Customer Need", getValue: (p) => p.customer_need || "—", render: (p) => p.customer_need || "—" },
            { id: "creation_project", label: "Creation Project", getValue: (p) => projects.find((pr) => pr.id === p.creation_project_id)?.name || "—", render: (p) => projects.find((pr) => pr.id === p.creation_project_id)?.name || "—" },
            { id: "linked_projects", label: "Linked Projects", getValue: (p) => (p.project_ids || []).map((pid) => projects.find((pr) => pr.id === pid)?.name).filter(Boolean).join(", ") || "—", render: (p) => (p.project_ids || []).map((pid) => projects.find((pr) => pr.id === pid)?.name).filter(Boolean).join(", ") || "—" },
          ]}
          filterableFields={filterableFields}
          rows={filtered}
          renderThumbnail={(product) => {
            const mainImage = product.images?.[0];
            return mainImage ? (
              <img src={mainImage} alt={product.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center text-sm font-semibold">
                {product.name?.charAt(0)?.toUpperCase()}
              </div>
            );
          }}
          onClickItem={(p) => navigate(`/products/${p.id}`)}
        />
      ) : (
        <DataTable columns={visibleColumns} rows={filtered} hideColumnToggle fixedColumns={pinnedCols} onPinColumn={(id) => setPinnedCols((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])} />
      )}
    </div>
  );
}

// ─── Colorways Tab ────────────────────────────────────────────────────────────
function ColorwaysTab({ colorways, products, techColors, sizeGrids, projects }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("list");
  const [activeColumns, setActiveColumns] = useState(null);
  const [pinnedCols, setPinnedCols] = useState([]);

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
    { id: "style_size_grid", label: "Style: Size Grid", width: 130, sortKey: (cw) => sizeGrids.find((sg) => sg.id === getProduct(cw)?.size_grid_id)?.name || "", render: (cw) => { const sg = sizeGrids.find((sg) => sg.id === getProduct(cw)?.size_grid_id); return <span className="text-xs">{sg?.name || "—"}</span>; } },
    { id: "style_created_by", label: "Style: Created By", width: 180, sortKey: (cw) => getProduct(cw)?.created_by || "", render: (cw) => <span className="text-xs text-muted-foreground">{getProduct(cw)?.created_by || "—"}</span> },
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
    { id: "creation_project", label: "Creation Project", width: 160, sortKey: (cw) => projects.find((p) => p.id === cw.creation_project_id)?.name || "", render: (cw) => { const p = projects.find((proj) => proj.id === cw.creation_project_id); return <span className="text-xs text-muted-foreground">{p?.name || "—"}</span>; } },
    { id: "linked_projects", label: "Linked Projects", width: 200, render: (cw) => { const names = (cw.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean); return <span className="text-xs text-muted-foreground">{names.length > 0 ? names.join(", ") : "—"}</span>; } },
    { id: "cw_created_by", label: "Colorway: Created By", width: 180, sortKey: (cw) => cw.created_by || "", render: (cw) => <span className="text-xs text-muted-foreground">{cw.created_by || "—"}</span> },
  ];

  const filterableFields = [
    { id: "style_category", label: "Style: Category", getValue: (cw) => getProduct(cw)?.category },
    { id: "style_sub_category", label: "Style: Sub-Category", getValue: (cw) => getProduct(cw)?.sub_category },
    { id: "creation_project", label: "Creation Project", getValue: (cw) => projects.find((p) => p.id === cw.creation_project_id)?.name },
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
          <ViewSelector pageKey="colorways_list" allColumns={columns} onColumnsChange={setActiveColumns} filterableFields={filterableFields} rows={colorways} entityNames={["ProductColor", "Product"]} fixedColumnIds={pinnedCols} onFixedColumnIdsChange={setPinnedCols} />
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
        <GalleryView
          pageKey="colorways_list"
          navigate={navigate}
          allFields={[
            { id: "cw_color_name", label: "CW: Color Name", getValue: (cw) => cw.color_name || "—", render: (cw) => cw.color_name || "—" },
            { id: "cw_colorway_code", label: "CW: Colorway Code", getValue: (cw) => cw.colorway_code || "—", render: (cw) => cw.colorway_code || "—" },
            { id: "cw_color_hex", label: "CW: Color Hex", getValue: (cw) => cw.color_hex || "—", render: (cw) => cw.color_hex || "—" },
            { id: "cw_image_url", label: "CW: Image URL", getValue: (cw) => cw.image_url || "—", render: (cw) => cw.image_url || "—" },
            { id: "cw_linked_tech_color_id", label: "CW: Linked Tech Color ID", getValue: (cw) => cw.linked_tech_color_id || "—", render: (cw) => cw.linked_tech_color_id || "—" },
            { id: "cw_linked_color_type", label: "CW: Linked Color Type", getValue: (cw) => cw.linked_color_type || "—", render: (cw) => cw.linked_color_type || "—" },
            { id: "cw_linked_color_id", label: "CW: Linked Color ID", getValue: (cw) => cw.linked_color_id || "—", render: (cw) => cw.linked_color_id || "—" },
            { id: "cw_creation_project", label: "CW: Creation Project", getValue: (cw) => projects.find((p) => p.id === cw.creation_project_id)?.name || "—", render: (cw) => projects.find((p) => p.id === cw.creation_project_id)?.name || "—" },
            { id: "cw_linked_projects", label: "CW: Linked Projects", getValue: (cw) => (cw.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—", render: (cw) => (cw.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—" },
            { id: "prod_name", label: "Product: Name", getValue: (cw) => getProduct(cw)?.name || "—", render: (cw) => getProduct(cw)?.name || "—" },
            { id: "prod_type", label: "Product: Type", getValue: (cw) => getProduct(cw)?.type || "—", render: (cw) => getProduct(cw)?.type || "—" },
            { id: "prod_category", label: "Product: Category", getValue: (cw) => getProduct(cw)?.category || "—", render: (cw) => getProduct(cw)?.category || "—" },
            { id: "prod_sub_category", label: "Product: Sub-Category", getValue: (cw) => getProduct(cw)?.sub_category || "—", render: (cw) => getProduct(cw)?.sub_category || "—" },
            { id: "prod_customer_need", label: "Product: Customer Need", getValue: (cw) => getProduct(cw)?.customer_need || "—", render: (cw) => getProduct(cw)?.customer_need || "—" },
            { id: "prod_description", label: "Product: Description", getValue: (cw) => getProduct(cw)?.description || "—", render: (cw) => getProduct(cw)?.description || "—" },
            { id: "prod_creation_project", label: "Product: Creation Project", getValue: (cw) => projects.find((p) => p.id === getProduct(cw)?.creation_project_id)?.name || "—", render: (cw) => projects.find((p) => p.id === getProduct(cw)?.creation_project_id)?.name || "—" },
            { id: "prod_linked_projects", label: "Product: Linked Projects", getValue: (cw) => (getProduct(cw)?.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—", render: (cw) => (getProduct(cw)?.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—" },
          ]}
          filterableFields={filterableFields}
          rows={filtered}
          renderThumbnail={(cw) => {
            const prod = getProduct(cw);
            const img = prod?.images?.[0];
            return img ? (
              <img src={img} alt={prod?.name} className="w-full h-full object-contain" />
            ) : cw.image_url ? (
              <img src={cw.image_url} alt={cw.color_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
            );
          }}
          onClickItem={(cw) => navigate(`/products/${getProduct(cw)?.id}`)}
        />
      ) : (
        <DataTable columns={visibleColumns} rows={filtered} hideColumnToggle fixedColumns={pinnedCols} onPinColumn={(id) => setPinnedCols((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])} />
      )}
    </div>
  );
}

// ─── More Variations Tab ──────────────────────────────────────────────────────
function MoreVariationsTab({ variations, colorways, products, sizeGrids, projects }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("list");
  const [activeColumns, setActiveColumns] = useState(null);
  const [pinnedCols, setPinnedCols] = useState([]);

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
    { id: "style_customer_need", label: "Style: Customer Need", width: 170, sortKey: (v) => getProduct(v)?.customer_need || "", render: (v) => <span className="text-xs text-muted-foreground">{getProduct(v)?.customer_need || "—"}</span> },
    { id: "style_size_grid", label: "Style: Size Grid", width: 130, sortKey: (v) => sizeGrids.find((sg) => sg.id === getProduct(v)?.size_grid_id)?.name || "", render: (v) => { const sg = sizeGrids.find((sg) => sg.id === getProduct(v)?.size_grid_id); return <span className="text-xs">{sg?.name || "—"}</span>; } },
    { id: "style_created_by", label: "Style: Created By", width: 180, sortKey: (v) => getProduct(v)?.created_by || "", render: (v) => <span className="text-xs text-muted-foreground">{getProduct(v)?.created_by || "—"}</span> },
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
    { id: "cw_creation_project", label: "CW: Creation Project", width: 160, sortKey: (v) => projects.find((p) => p.id === getColorway(v)?.creation_project_id)?.name || "", render: (v) => { const p = projects.find((proj) => proj.id === getColorway(v)?.creation_project_id); return <span className="text-xs text-muted-foreground">{p?.name || "—"}</span>; } },
    { id: "cw_linked_projects", label: "CW: Linked Projects", width: 200, render: (v) => { const names = (getColorway(v)?.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean); return <span className="text-xs text-muted-foreground">{names.length > 0 ? names.join(", ") : "—"}</span>; } },
    { id: "var_created_by", label: "Variation: Created By", width: 180, sortKey: (v) => v.created_by || "", render: (v) => <span className="text-xs text-muted-foreground">{v.created_by || "—"}</span> },
    { id: "style_creation_project", label: "Style: Creation Project", width: 160, sortKey: (v) => projects.find((p) => p.id === getProduct(v)?.creation_project_id)?.name || "", render: (v) => { const p = projects.find((pr) => pr.id === getProduct(v)?.creation_project_id); return <span className="text-xs text-muted-foreground">{p?.name || "—"}</span>; } },
    { id: "style_linked_projects", label: "Style: Linked Projects", width: 200, render: (v) => { const names = (getProduct(v)?.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean); return <span className="text-xs text-muted-foreground">{names.length > 0 ? names.join(", ") : "—"}</span>; } },
  ];

  const filterableFields = [
    { id: "style_category", label: "Style: Category", getValue: (v) => getProduct(v)?.category },
    { id: "style_sub_category", label: "Style: Sub-Category", getValue: (v) => getProduct(v)?.sub_category },
    { id: "pack_code", label: "Pack Code", getValue: (v) => v.pack_code },
    { id: "variant", label: "Variant", getValue: (v) => v.variant },
    { id: "style_creation_project", label: "Style: Creation Project", getValue: (v) => projects.find((p) => p.id === getProduct(v)?.creation_project_id)?.name },
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
          <ViewSelector pageKey="more_variations_list" allColumns={columns} onColumnsChange={setActiveColumns} filterableFields={filterableFields} rows={variations} entityNames={["ProductColorAndMore", "ProductColor", "Product"]} fixedColumnIds={pinnedCols} onFixedColumnIdsChange={setPinnedCols} />
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
        <GalleryView
          pageKey="variations_list"
          navigate={navigate}
          allFields={[
            { id: "sequence", label: "Var: Sequence", getValue: (v) => v.sequence || "—", render: (v) => v.sequence || "—" },
            { id: "name", label: "Var: Name", getValue: (v) => v.name || "—", render: (v) => v.name || "—" },
            { id: "description", label: "Var: Description", getValue: (v) => v.description || "—", render: (v) => v.description || "—" },
            { id: "pack_code", label: "Var: Pack Code", getValue: (v) => v.pack_code || "—", render: (v) => v.pack_code || "—" },
            { id: "variant", label: "Var: Variant", getValue: (v) => v.variant || "—", render: (v) => v.variant || "—" },
            { id: "var_color_hex", label: "Var: Color Hex", getValue: (v) => v.color_hex || "—", render: (v) => v.color_hex || "—" },
            { id: "cw_color_name", label: "CW: Color Name", getValue: (v) => getColorway(v)?.color_name || "—", render: (v) => getColorway(v)?.color_name || "—" },
            { id: "cw_colorway_code", label: "CW: Colorway Code", getValue: (v) => getColorway(v)?.colorway_code || "—", render: (v) => getColorway(v)?.colorway_code || "—" },
            { id: "cw_color_hex", label: "CW: Color Hex", getValue: (v) => getColorway(v)?.color_hex || "—", render: (v) => getColorway(v)?.color_hex || "—" },
            { id: "cw_image_url", label: "CW: Image URL", getValue: (v) => getColorway(v)?.image_url || "—", render: (v) => getColorway(v)?.image_url || "—" },
            { id: "prod_name", label: "Product: Name", getValue: (v) => getProduct(v)?.name || "—", render: (v) => getProduct(v)?.name || "—" },
            { id: "prod_type", label: "Product: Type", getValue: (v) => getProduct(v)?.type || "—", render: (v) => getProduct(v)?.type || "—" },
            { id: "prod_category", label: "Product: Category", getValue: (v) => getProduct(v)?.category || "—", render: (v) => getProduct(v)?.category || "—" },
            { id: "prod_sub_category", label: "Product: Sub-Category", getValue: (v) => getProduct(v)?.sub_category || "—", render: (v) => getProduct(v)?.sub_category || "—" },
            { id: "prod_customer_need", label: "Product: Customer Need", getValue: (v) => getProduct(v)?.customer_need || "—", render: (v) => getProduct(v)?.customer_need || "—" },
            { id: "prod_description", label: "Product: Description", getValue: (v) => getProduct(v)?.description || "—", render: (v) => getProduct(v)?.description || "—" },
            { id: "prod_creation_project", label: "Product: Creation Project", getValue: (v) => projects.find((p) => p.id === getProduct(v)?.creation_project_id)?.name || "—", render: (v) => projects.find((p) => p.id === getProduct(v)?.creation_project_id)?.name || "—" },
            { id: "prod_linked_projects", label: "Product: Linked Projects", getValue: (v) => (getProduct(v)?.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—", render: (v) => (getProduct(v)?.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—" },
            { id: "cw_creation_project_gallery", label: "CW: Creation Project", getValue: (v) => projects.find((p) => p.id === getColorway(v)?.creation_project_id)?.name || "—", render: (v) => projects.find((p) => p.id === getColorway(v)?.creation_project_id)?.name || "—" },
            { id: "cw_linked_projects_gallery", label: "CW: Linked Projects", getValue: (v) => (getColorway(v)?.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—", render: (v) => (getColorway(v)?.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—" },
          ]}
          filterableFields={filterableFields}
          rows={filtered}
          renderThumbnail={(v) => {
            const prod = getProduct(v);
            const cw = getColorway(v);
            const img = v.image_url || prod?.images?.[0];
            return img ? (
              <img src={img} alt={v.name} className="w-full h-full object-contain" />
              ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: cw?.color_hex || "#ccc" }} />
              );
              }}
              onClickItem={(v) => navigate(`/products/${getProduct(v)?.id}`)}
              />
      ) : (
        <DataTable columns={visibleColumns} rows={filtered} hideColumnToggle fixedColumns={pinnedCols} onPinColumn={(id) => setPinnedCols((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])} />
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
  const [sizeGrids, setSizeGrids] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("styles");

  useEffect(() => {
    Promise.all([
      base44.entities.Product.list("-created_date", 500),
      base44.entities.ProductColor.list("-created_date", 2000),
      base44.entities.ProductColorAndMore.list("-created_date", 5000),
      base44.entities.TechnicalColor.list("code", 2000),
      base44.entities.SizeGrid.list("name", 200),
      base44.entities.Project.list("name", 500),
    ]).then(([prods, cws, vars, tcs, sgs, projs]) => {
      setSizeGrids(sgs);
      setProjects(projs);
      const styleProds = prods.filter((p) => p.type === "Product");
      const styleIds = new Set(styleProds.map((p) => p.id));
      const styleCws = cws.filter((cw) => styleIds.has(cw.product_id));
      const cwIds = new Set(styleCws.map((cw) => cw.id));
      setProducts(styleProds);
      setColorways(styleCws);
      setVariations(vars.filter((v) => cwIds.has(v.product_color_id)));
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

      <ItemSubNav
            items={[
              { id: "styles", label: "Styles", count: products.length, icon: Shirt },
              { id: "colorways", label: "Colorways", count: colorways.length, icon: Palette },
              { id: "variations", label: "More Variations", count: variations.length, icon: Layers },
            ]}
            activeId={activeSection}
            onChange={setActiveSection}
          >
            {activeSection === "styles" && (
              <StylesTab products={products} colorVariants={colorways} techColors={techColors} sizeGrids={sizeGrids} projects={projects} />
            )}
            {activeSection === "colorways" && (
              <ColorwaysTab colorways={colorways} products={products} techColors={techColors} sizeGrids={sizeGrids} projects={projects} />
            )}
            {activeSection === "variations" && (
              <MoreVariationsTab variations={variations} colorways={colorways} products={products} sizeGrids={sizeGrids} projects={projects} />
            )}
          </ItemSubNav>
    </div>
  );
}