import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LayoutGrid, List, Plus, X } from "lucide-react";
import LinkToProjectModal from "./LinkToProjectModal";
import DataTable from "./DataTable";
import GalleryView from "./GalleryView";
import ViewSelector from "./ViewSelector";
import ImageLightbox from "./ImageLightbox";

export default function LinkedStylesView({ styles, navigate, projects = [], sizeGrids = [], projectId, allStyles = [], allColorways = [], allVariations = [], onLinked }) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");
  const [activeColumns, setActiveColumns] = useState(null);
  const [pinnedCols, setPinnedCols] = useState([]);
  const [showLink, setShowLink] = useState(false);
  const [tableLightbox, setTableLightbox] = useState(null);

  const alreadyLinkedIds = useMemo(() => styles.map((s) => s.id), [styles]);

  const handleUnlink = async (style) => {
    // Remove project from style
    await base44.entities.Product.update(style.id, {
      project_ids: (style.project_ids || []).filter((pid) => pid !== projectId),
    });
    // Cascade: unlink colorways of this style that are linked to this project
    const styleCws = allColorways.filter((cw) => cw.product_id === style.id && (cw.project_ids || []).includes(projectId));
    for (const cw of styleCws) {
      await base44.entities.ProductColor.update(cw.id, {
        project_ids: (cw.project_ids || []).filter((pid) => pid !== projectId),
      });
    }
    // Cascade: unlink variations of those colorways that are linked to this project
    const cwIds = new Set(styleCws.map((cw) => cw.id));
    const styleVars = allVariations.filter((v) => cwIds.has(v.product_color_id) && (v.project_ids || []).includes(projectId));
    for (const v of styleVars) {
      await base44.entities.ProductColorAndMore.update(v.id, {
        project_ids: (v.project_ids || []).filter((pid) => pid !== projectId),
      });
    }
    if (onLinked) onLinked();
  };

  const handleLink = async (selectedIds) => {
    for (const sid of selectedIds) {
      const style = allStyles.find((s) => s.id === sid);
      if (!style) continue;
      const current = style.project_ids || [];
      if (!current.includes(projectId)) {
        await base44.entities.Product.update(sid, { project_ids: [...current, projectId] });
      }
    }
    if (onLinked) onLinked();
  };

  const modalItems = useMemo(() => allStyles.map((s) => ({
    id: s.id,
    label: s.name,
    sublabel: [s.category, s.sub_category].filter(Boolean).join(" · "),
    imageUrl: s.images?.[0],
  })), [allStyles]);

  const filtered = useMemo(() => {
    if (!search.trim()) return styles;
    const q = search.toLowerCase();
    return styles.filter((s) =>
      s.name?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q) ||
      s.sub_category?.toLowerCase().includes(q) ||
      s.customer_need?.toLowerCase().includes(q)
    );
  }, [styles, search]);

  const columns = [
    {
      id: "image", label: "Image", width: 70,
      render: (p) => p.images?.[0] ? (
        <div className="w-10 h-10 overflow-hidden cursor-zoom-in" onClick={() => setTableLightbox(p.images[0])}>
          <img src={p.images[0]} alt={p.name} className="w-full h-full object-contain" />
        </div>
      ) : null,
    },
    { id: "code", label: "Code", width: 120, sortKey: (p) => p.code || "", render: (p) => <span className="font-mono text-xs text-muted-foreground">{p.code || "—"}</span> },
    { id: "name", label: "Name", width: 180, sortKey: (p) => p.name || "", render: (p) => <button type="button" onClick={() => navigate(`/products/${p.id}`)} className="font-medium text-primary hover:underline text-left">{p.name}</button> },
    { id: "type", label: "Type", width: 100, sortKey: (p) => p.type || "", render: (p) => <span className="text-xs text-muted-foreground">{p.type}</span> },
    { id: "sub_type", label: "Sub-type", width: 130, sortKey: (p) => p.sub_type || "", render: (p) => <span className="text-xs">{p.sub_type || "—"}</span> },
    { id: "category", label: "Category", width: 140, sortKey: (p) => p.category || "", render: (p) => <span className="text-xs">{p.category || "—"}</span> },
    { id: "sub_category", label: "Sub-Category", width: 160, sortKey: (p) => p.sub_category || "", render: (p) => <span className="text-xs">{p.sub_category || "—"}</span> },
    { id: "customer_need", label: "Customer Need", width: 160, sortKey: (p) => p.customer_need || "", render: (p) => <span className="text-xs">{p.customer_need || "—"}</span> },
    { id: "size_grid", label: "Size Grid", width: 130, sortKey: (p) => sizeGrids.find((sg) => sg.id === p.size_grid_id)?.name || "", render: (p) => { const sg = sizeGrids.find((sg) => sg.id === p.size_grid_id); return <span className="text-xs">{sg?.name || "—"}</span>; } },
    { id: "creation_project", label: "Creation Project", width: 160, sortKey: (p) => projects.find((pr) => pr.id === p.creation_project_id)?.name || "", render: (p) => { const pr = projects.find((proj) => proj.id === p.creation_project_id); return <span className="text-xs text-muted-foreground">{pr?.name || "—"}</span>; } },
    { id: "linked_projects", label: "Linked Projects", width: 200, render: (p) => { const names = (p.project_ids || []).map((pid) => projects.find((pr) => pr.id === pid)?.name).filter(Boolean); return <span className="text-xs text-muted-foreground">{names.length > 0 ? names.join(", ") : "—"}</span>; } },
    { id: "created_by", label: "Created By", width: 180, sortKey: (p) => p.created_by || "", render: (p) => <span className="text-xs text-muted-foreground">{p.created_by || "—"}</span> },
    { id: "_unlink", label: "", width: 50, render: (p) => (
      <button type="button" onClick={() => handleUnlink(p)} title="Unlink from project" className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    ) },
  ];

  const filterableFields = [
    { id: "category", label: "Category", getValue: (p) => p.category },
    { id: "sub_category", label: "Sub-Category", getValue: (p) => p.sub_category },
    { id: "customer_need", label: "Customer Need", getValue: (p) => p.customer_need },
    { id: "creation_project", label: "Creation Project", getValue: (p) => projects.find((pr) => pr.id === p.creation_project_id)?.name },
  ];

  const allFields = [
    { id: "code", label: "Code", getValue: (p) => p.code || "—", render: (p) => p.code || "—" },
    { id: "name", label: "Name", getValue: (p) => p.name || "—", render: (p) => p.name || "—" },
    { id: "sub_type", label: "Sub-type", getValue: (p) => p.sub_type || "—", render: (p) => p.sub_type || "—" },
    { id: "category", label: "Category", getValue: (p) => p.category || "—", render: (p) => p.category || "—" },
    { id: "sub_category", label: "Sub-Category", getValue: (p) => p.sub_category || "—", render: (p) => p.sub_category || "—" },
    { id: "customer_need", label: "Customer Need", getValue: (p) => p.customer_need || "—", render: (p) => p.customer_need || "—" },
    { id: "size_grid", label: "Size Grid", getValue: (p) => sizeGrids.find((sg) => sg.id === p.size_grid_id)?.name || "—", render: (p) => sizeGrids.find((sg) => sg.id === p.size_grid_id)?.name || "—" },
    { id: "creation_project", label: "Creation Project", getValue: (p) => projects.find((pr) => pr.id === p.creation_project_id)?.name || "—", render: (p) => projects.find((pr) => pr.id === p.creation_project_id)?.name || "—" },
    { id: "linked_projects", label: "Linked Projects", getValue: (p) => (p.project_ids || []).map((pid) => projects.find((pr) => pr.id === pid)?.name).filter(Boolean).join(", ") || "—", render: (p) => (p.project_ids || []).map((pid) => projects.find((pr) => pr.id === pid)?.name).filter(Boolean).join(", ") || "—" },
  ];

  const visibleColumns = activeColumns || columns;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search styles…" className="pl-8 h-8 text-xs" />
        </div>
        {projectId && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowLink(true)}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        )}
        {view === "list" && (
          <ViewSelector pageKey="project_linked_styles" allColumns={columns} onColumnsChange={setActiveColumns} filterableFields={filterableFields} rows={styles} fixedColumnIds={pinnedCols} onFixedColumnIdsChange={setPinnedCols} />
        )}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button type="button" onClick={() => setView("grid")} className={`px-2.5 py-1.5 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Gallery"><LayoutGrid className="w-4 h-4" /></button>
          <button type="button" onClick={() => setView("list")} className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Table"><List className="w-4 h-4" /></button>
        </div>
      </div>

      <LinkToProjectModal
        open={showLink}
        onClose={() => setShowLink(false)}
        title="Link Styles to Project"
        items={modalItems}
        alreadyLinkedIds={alreadyLinkedIds}
        onSave={handleLink}
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            {styles.length === 0 ? "No linked styles yet." : "No results match your search."}
          </p>
        </div>
      ) : view === "grid" ? (
        <GalleryView
          pageKey="project_linked_styles"
          navigate={navigate}
          allFields={allFields}
          filterableFields={filterableFields}
          rows={filtered}
          renderThumbnail={(p) => {
            const img = p.images?.[0];
            return img ? (
              <img src={img} alt={p.name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground/40">
                {p.name?.charAt(0)?.toUpperCase()}
              </div>
            );
          }}
          onClickItem={(p) => navigate(`/products/${p.id}`)}
        />
      ) : (
        <DataTable columns={visibleColumns} rows={filtered} hideColumnToggle fixedColumns={pinnedCols} onPinColumn={(id) => setPinnedCols((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])} />
      )}

      {tableLightbox && <ImageLightbox src={tableLightbox} onClose={() => setTableLightbox(null)} />}
    </div>
  );
}