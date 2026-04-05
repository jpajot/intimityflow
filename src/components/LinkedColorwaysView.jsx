import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Search, Plus, X } from "lucide-react";
import LinkToProjectModal from "./LinkToProjectModal";
import ViewSelector from "./ViewSelector";
import DataTable from "./DataTable";
import GalleryView from "./GalleryView";

function LinkedColorwayCard({ cw, product, techColor, commColor, navigate }) {
  const styleImage = product?.images?.[0];

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all">
      {/* Style image as thumbnail */}
      <div className="aspect-square bg-muted relative">
        {styleImage ? (
          <img src={styleImage} alt={product?.name} className="w-full h-full object-contain" />
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
  projectId, allColorways = [], onLinked,
}) {
  const [showLink, setShowLink] = useState(false);

  const alreadyLinkedIds = useMemo(() => colorways.map((cw) => cw.id), [colorways]);

  const handleUnlink = async (cw) => {
    await base44.entities.ProductColor.update(cw.id, {
      project_ids: (cw.project_ids || []).filter((pid) => pid !== projectId),
    });
    if (onLinked) onLinked();
  };

  const handleLink = async (selectedIds) => {
    for (const cwId of selectedIds) {
      const cw = allColorways.find((c) => c.id === cwId);
      if (!cw) continue;
      // Link project to colorway
      const cwProjects = cw.project_ids || [];
      if (!cwProjects.includes(projectId)) {
        await base44.entities.ProductColor.update(cwId, { project_ids: [...cwProjects, projectId] });
      }
      // Also link project to parent product if not already linked
      const prod = products.find((p) => p.id === cw.product_id);
      if (prod) {
        const prodProjects = prod.project_ids || [];
        if (!prodProjects.includes(projectId)) {
          await base44.entities.Product.update(prod.id, { project_ids: [...prodProjects, projectId] });
        }
      }
    }
    if (onLinked) onLinked();
  };

  const modalItems = useMemo(() => allColorways.map((cw) => {
    const prod = products.find((p) => p.id === cw.product_id);
    return {
      id: cw.id,
      label: cw.color_name || "Unnamed",
      sublabel: [cw.colorway_code, prod?.name].filter(Boolean).join(" · "),
      imageUrl: cw.image_url || prod?.images?.[0],
      colorHex: !cw.image_url && !prod?.images?.[0] ? cw.color_hex : undefined,
    };
  }), [allColorways, products]);
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
            <img src={img} alt={prod?.name} className="w-full h-full object-contain" />
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
    { id: "_unlink", label: "", width: 50, render: (cw) => (
      <button type="button" onClick={() => handleUnlink(cw)} title="Unlink from project" className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    ) },
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
        {projectId && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowLink(true)}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        )}
        {view === "list" && (
          <ViewSelector pageKey="project_linked_colorways" allColumns={columns} onColumnsChange={onColumnsChange} entityNames={["ProductColor"]} />
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

      <LinkToProjectModal
        open={showLink}
        onClose={() => setShowLink(false)}
        title="Link Colorways to Project"
        items={modalItems}
        alreadyLinkedIds={alreadyLinkedIds}
        onSave={handleLink}
      />

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No results match your search.</p>
        </div>
      ) : view === "grid" ? (
        <GalleryView
          pageKey="project_linked_colorways"
          allFields={[
            { id: "style_name", label: "Style", getValue: (cw) => getProduct(cw)?.name || "—", render: (cw) => getProduct(cw)?.name || "—" },
            { id: "color_name", label: "Color", getValue: (cw) => cw.color_name || "—", render: (cw) => cw.color_name || "—" },
            { id: "codes", label: "Codes", getValue: (cw) => (getTechColor(cw)?.code || "") + (cw.colorway_code || ""), render: (cw) => {
              const tc = getTechColor(cw);
              return (
                <div className="flex flex-col gap-0.5">
                  {tc && <span className="text-xs font-mono text-muted-foreground">{tc.code} – {tc.name}</span>}
                  {cw.colorway_code && <span className="text-xs font-mono text-muted-foreground">{cw.colorway_code}</span>}
                </div>
              );
            } },
          ]}
          rows={filtered}
          renderThumbnail={(cw) => {
            const product = getProduct(cw);
            const styleImage = product?.images?.[0];
            return styleImage ? (
              <img src={styleImage} alt={product?.name} className="w-full h-full object-contain" />
            ) : cw.image_url ? (
              <img src={cw.image_url} alt={cw.color_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: cw.color_hex || "#ccc" }}>
                <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: cw.color_hex || "#ccc" }} />
              </div>
            );
          }}
          onClickItem={(cw) => navigate(`/products/${getProduct(cw)?.id}`)}
        />
      ) : (
        <DataTable columns={visibleColumns} rows={filtered} hideColumnToggle />
      )}
    </div>
  );
}