import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { LayoutGrid, List, Search } from "lucide-react";
import ViewSelector from "./ViewSelector";
import DataTable from "./DataTable";

function LinkedColorwayCard({ cw, product, techColor, commColor, navigate }) {
  const styleImage = product?.images?.[0];

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
      {/* Style image as thumbnail */}
      <div className="aspect-square bg-muted relative">
        {styleImage ? (
          <img src={styleImage} alt={product?.name} className="w-full h-full object-cover" />
        ) : cw.image_url ? (
          <img src={cw.image_url} alt={cw.color_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
          </div>
        )}
        {/* Colorway swatch overlay */}
        <div className="absolute bottom-2 right-2 w-8 h-8 rounded-md border-2 border-white shadow" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
      </div>
      <div className="p-3 space-y-1.5">
        {/* Style name */}
        {product ? (
          <button
            type="button"
            onClick={() => navigate(`/products/${product.id}`)}
            className="text-xs font-semibold text-primary hover:underline truncate block w-full text-left"
          >
            {product.name}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">—</p>
        )}
        {/* Colorway name */}
        <p className="text-sm font-medium truncate">{cw.color_name}</p>
        {/* Codes */}
        {cw.colorway_code && (
          <p className="text-xs font-mono text-muted-foreground truncate">{cw.colorway_code}</p>
        )}
        {techColor && (
          <p className="text-xs text-muted-foreground truncate">{techColor.code} – {techColor.name}</p>
        )}
      </div>
    </div>
  );
}

export default function LinkedColorwaysView({
  colorways, products, techColors, commColors, navigate,
  search, onSearchChange, view, onViewChange, activeColumns, onColumnsChange,
}) {
  const getProduct = (cw) => products.find((p) => p.id === cw.product_id);
  const getTechColor = (cw) => techColors.find((t) => t.id === cw.linked_tech_color_id);
  const getCommColor = (cw) => commColors.find((c) => c.id === cw.linked_color_id);

  const filtered = useMemo(() => {
    if (!search.trim()) return colorways;
    const q = search.toLowerCase();
    return colorways.filter((cw) => {
      const prod = products.find((p) => p.id === cw.product_id);
      const tc = techColors.find((t) => t.id === cw.linked_tech_color_id);
      return (
        cw.color_name?.toLowerCase().includes(q) ||
        cw.colorway_code?.toLowerCase().includes(q) ||
        prod?.name?.toLowerCase().includes(q) ||
        tc?.code?.toLowerCase().includes(q) ||
        tc?.name?.toLowerCase().includes(q)
      );
    });
  }, [colorways, search, products, techColors]);

  const columns = [
    {
      id: "style_image",
      label: "Style",
      width: 70,
      render: (cw) => {
        const prod = getProduct(cw);
        const img = prod?.images?.[0];
        return img ? (
          <div className="w-10 h-10 rounded-md overflow-hidden border border-border">
            <img src={img} alt={prod?.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-md border border-border bg-muted" />
        );
      },
    },
    {
      id: "style_name",
      label: "Style Name",
      width: 160,
      sortKey: (cw) => getProduct(cw)?.name || "",
      render: (cw) => {
        const prod = getProduct(cw);
        return prod ? (
          <button
            type="button"
            onClick={() => navigate(`/products/${prod.id}`)}
            className="text-xs font-semibold text-primary hover:underline text-left"
          >
            {prod.name}
          </button>
        ) : "—";
      },
    },
    {
      id: "cw_image",
      label: "Colorway",
      width: 70,
      render: (cw) =>
        cw.image_url ? (
          <div className="w-8 h-8 rounded-md overflow-hidden border border-border">
            <img src={cw.image_url} alt={cw.color_name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-md border border-border" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
        ),
    },
    {
      id: "color_name",
      label: "Color Name",
      width: 150,
      sortKey: (cw) => cw.color_name || "",
      render: (cw) => <span className="font-medium">{cw.color_name}</span>,
    },
    {
      id: "comm_code",
      label: "Commercial Code",
      width: 140,
      sortKey: (cw) => getCommColor(cw)?.code || cw.colorway_code || "",
      render: (cw) => {
        const cc = getCommColor(cw);
        return <span className="font-mono text-xs text-muted-foreground">{cc?.code || cw.colorway_code || "—"}</span>;
      },
    },
    {
      id: "tech_code",
      label: "Technical Code",
      width: 160,
      sortKey: (cw) => getTechColor(cw)?.code || "",
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

  const visibleColumns = activeColumns || columns;

  if (colorways.length === 0) {
    return (
      <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">No colorways linked to this project yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search colorways…" className="pl-8 h-8 text-xs" />
        </div>
        {view === "list" && (
          <ViewSelector pageKey="project_linked_colorways" allColumns={columns} onColumnsChange={onColumnsChange} />
        )}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => onViewChange("grid")}
            className={`px-2.5 py-1.5 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            title="Gallery view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewChange("list")}
            className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            title="Table view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No results match your search.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((cw) => (
            <LinkedColorwayCard
              key={cw.id}
              cw={cw}
              product={getProduct(cw)}
              techColor={getTechColor(cw)}
              commColor={getCommColor(cw)}
              navigate={navigate}
            />
          ))}
        </div>
      ) : (
        <DataTable columns={visibleColumns} rows={filtered} hideColumnToggle />
      )}
    </div>
  );
}