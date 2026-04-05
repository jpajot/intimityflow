import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LayoutGrid, List, Plus } from "lucide-react";
import LinkToProjectModal from "./LinkToProjectModal";
import DataTable from "./DataTable";
import GalleryView from "./GalleryView";
import ViewSelector from "./ViewSelector";

export default function LinkedMoreVariationsView({ variations, colorways, products, projects, navigate, projectId, allVariations = [], onLinked }) {
  const [search, setSearch] = useState("");
  const [showLink, setShowLink] = useState(false);

  const alreadyLinkedIds = useMemo(() => variations.map((v) => v.id), [variations]);

  const handleLink = async (selectedIds) => {
    for (const vid of selectedIds) {
      const v = allVariations.find((x) => x.id === vid);
      if (!v) continue;
      const current = v.project_ids || [];
      if (!current.includes(projectId)) {
        await base44.entities.ProductColorAndMore.update(vid, { project_ids: [...current, projectId] });
      }
    }
    if (onLinked) onLinked();
  };

  const modalItems = useMemo(() => allVariations.map((v) => {
    const cw = colorways.find((c) => c.id === v.product_color_id);
    const prod = cw ? products.find((p) => p.id === cw.product_id) : null;
    return {
      id: v.id,
      label: v.name || `Seq. ${v.sequence}`,
      sublabel: [v.sequence, v.pack_code, cw?.color_name, prod?.name].filter(Boolean).join(" · "),
      imageUrl: v.image_url || prod?.images?.[0],
      colorHex: !v.image_url && !prod?.images?.[0] ? cw?.color_hex : undefined,
    };
  }), [allVariations, colorways, products]);
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
        v.pack_code?.toLowerCase().includes(q) ||
        v.variant?.toLowerCase().includes(q) ||
        cw?.color_name?.toLowerCase().includes(q) ||
        cw?.colorway_code?.toLowerCase().includes(q) ||
        prod?.name?.toLowerCase().includes(q)
      );
    });
  }, [variations, search]);

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
    { id: "cw_color_name", label: "Colorway Name", width: 140, sortKey: (v) => getColorway(v)?.color_name || "", render: (v) => <span className="text-xs">{getColorway(v)?.color_name || "—"}</span> },
    { id: "cw_code", label: "Colorway Code", width: 120, sortKey: (v) => getColorway(v)?.colorway_code || "", render: (v) => <span className="font-mono text-xs text-muted-foreground">{getColorway(v)?.colorway_code || "—"}</span> },
    { id: "sequence", label: "Seq.", width: 80, sortKey: (v) => v.sequence || "", render: (v) => <span className="font-mono text-xs text-muted-foreground">{v.sequence || "—"}</span> },
    { id: "name", label: "Variation Name", width: 150, sortKey: (v) => v.name || "", render: (v) => <span className="font-medium">{v.name || "—"}</span> },
    { id: "pack_code", label: "Pack Code", width: 110, sortKey: (v) => v.pack_code || "", render: (v) => <span className="text-xs">{v.pack_code || "—"}</span> },
    { id: "variant", label: "Variant", width: 110, sortKey: (v) => v.variant || "", render: (v) => <span className="text-xs">{v.variant || "—"}</span> },
    { id: "creation_project", label: "Creation Project", width: 160, sortKey: (v) => projects.find((p) => p.id === v.creation_project_id)?.name || "", render: (v) => { const p = projects.find((pr) => pr.id === v.creation_project_id); return <span className="text-xs text-muted-foreground">{p?.name || "—"}</span>; } },
    { id: "linked_projects", label: "Linked Projects", width: 200, render: (v) => { const names = (v.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean); return <span className="text-xs text-muted-foreground">{names.length > 0 ? names.join(", ") : "—"}</span>; } },
  ];

  const filterableFields = [
    { id: "pack_code", label: "Pack Code", getValue: (v) => v.pack_code },
    { id: "variant", label: "Variant", getValue: (v) => v.variant },
    { id: "style_category", label: "Style: Category", getValue: (v) => getProduct(v)?.category },
    { id: "creation_project", label: "Creation Project", getValue: (v) => projects.find((p) => p.id === v.creation_project_id)?.name },
  ];

  const allFields = [
    { id: "sequence", label: "Seq.", getValue: (v) => v.sequence || "—", render: (v) => v.sequence || "—" },
    { id: "name", label: "Name", getValue: (v) => v.name || "—", render: (v) => v.name || "—" },
    { id: "pack_code", label: "Pack Code", getValue: (v) => v.pack_code || "—", render: (v) => v.pack_code || "—" },
    { id: "variant", label: "Variant", getValue: (v) => v.variant || "—", render: (v) => v.variant || "—" },
    { id: "cw_color_name", label: "Colorway", getValue: (v) => getColorway(v)?.color_name || "—", render: (v) => getColorway(v)?.color_name || "—" },
    { id: "style_name", label: "Style", getValue: (v) => getProduct(v)?.name || "—", render: (v) => getProduct(v)?.name || "—" },
    { id: "creation_project", label: "Creation Project", getValue: (v) => projects.find((p) => p.id === v.creation_project_id)?.name || "—", render: (v) => projects.find((p) => p.id === v.creation_project_id)?.name || "—" },
    { id: "linked_projects", label: "Linked Projects", getValue: (v) => (v.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—", render: (v) => (v.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—" },
  ];

  const visibleColumns = activeColumns || columns;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search variations…" className="pl-8 h-8 text-xs" />
        </div>
        {projectId && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowLink(true)}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        )}
        {view === "list" && (
          <ViewSelector pageKey="project_linked_variations" allColumns={columns} onColumnsChange={setActiveColumns} filterableFields={filterableFields} rows={variations} entityNames={["ProductColorAndMore"]} fixedColumnIds={pinnedCols} onFixedColumnIdsChange={setPinnedCols} />
        )}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button type="button" onClick={() => setView("grid")} className={`px-2.5 py-1.5 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Gallery"><LayoutGrid className="w-4 h-4" /></button>
          <button type="button" onClick={() => setView("list")} className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Table"><List className="w-4 h-4" /></button>
        </div>
      </div>

      <LinkToProjectModal
        open={showLink}
        onClose={() => setShowLink(false)}
        title="Link Variations to Project"
        items={modalItems}
        alreadyLinkedIds={alreadyLinkedIds}
        onSave={handleLink}
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">{variations.length === 0 ? "No linked variations yet." : "No results match your search."}</p>
        </div>
      ) : view === "grid" ? (
        <GalleryView
          pageKey="project_linked_variations"
          navigate={navigate}
          allFields={allFields}
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