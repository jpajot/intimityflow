import { useState, useEffect, useMemo } from "react";

import { Plus, Library, LayoutGrid, List } from "lucide-react";
import ListToolbar from "./ListToolbar";
import ViewSelector from "./ViewSelector";
import { base44 } from "@/api/base44Client";
import DataTable from "./DataTable";
import ColorwayCard from "./ColorwayCard";
import ImageLightbox from "./ImageLightbox";
import { usePageOptions } from "@/lib/PageOptionsContext";

const STORAGE_KEY = "colorway_section_view";

export default function ColorwaySection({ colorVariants, productImage = "", onEdit, onAddNew, onAddFromLibrary }) {
  const { setOptions } = usePageOptions();
  const [view, setView] = useState(() => localStorage.getItem(STORAGE_KEY) || "grid");

  const handleSetView = (v) => {
    setView(v);
    localStorage.setItem(STORAGE_KEY, v);
  };
  const [techColors, setTechColors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [activeColumns, setActiveColumns] = useState(null);

  const [commColors, setCommColors] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  useEffect(() => {
    base44.entities.TechnicalColor.list("code", 2000).then(setTechColors);
    base44.entities.Project.list("name", 500).then(setProjects);
    base44.entities.CommercialColor.list("code", 2000).then(setCommColors);
  }, []);

  useEffect(() => {
    setOptions({
      items: [
        { label: "Add Colorway", icon: Plus, onClick: onAddNew, className: "text-primary hover:bg-primary/10" },
        { label: "Add from Library", icon: Library, onClick: onAddFromLibrary },
        { divider: true },
        { label: view === "grid" ? "View: List" : "View: Grid", icon: view === "grid" ? List : LayoutGrid, onClick: () => handleSetView(view === "grid" ? "list" : "grid") },
      ],
    });
  }, [onAddNew, onAddFromLibrary, view]);

  const getTechColor = (id) => techColors.find((t) => t.id === id);

  const filteredVariants = useMemo(() => {
    if (!search.trim()) return colorVariants;
    const q = search.toLowerCase();
    return colorVariants.filter((cv) => {
      const tc = getTechColor(cv.linked_tech_color_id);
      return (
        cv.color_name?.toLowerCase().includes(q) ||
        cv.colorway_code?.toLowerCase().includes(q) ||
        cv.color_hex?.toLowerCase().includes(q) ||
        tc?.code?.toLowerCase().includes(q) ||
        tc?.name?.toLowerCase().includes(q)
      );
    });
  }, [colorVariants, search, techColors]);

  const columns = useMemo(() => [
    {
      id: "image",
      label: "Image",
      width: 80,
      render: (cv) => {
        if (cv.image_url) {
          return (
            <div className="w-8 h-8 rounded-md overflow-hidden cursor-zoom-in" onClick={(e) => { e.stopPropagation(); setLightboxSrc(cv.image_url); setLightboxAlt(cv.color_name); }}>
              <img src={cv.image_url} alt={cv.color_name} className="w-full h-full object-cover" />
            </div>
          );
        }
        const cc = commColors.find((c) => c.id === cv.linked_color_id);
        const linkedHexes = cc?.sub_type === "Combined"
          ? (cc.linked_technical_color_ids || []).map((id) => techColors.find((t) => t.id === id)?.hex).filter(Boolean)
          : null;
        if (linkedHexes?.length > 1) {
          return (
            <div className="w-8 h-8 rounded-md overflow-hidden flex">
              {linkedHexes.map((h, i) => <div key={i} className="flex-1 h-full" style={{ backgroundColor: h }} />)}
            </div>
          );
        }
        return <div className="w-8 h-8 rounded-md" style={{ backgroundColor: cv.color_hex || "#ccc" }} />;
      },
    },
    {
      id: "name",
      label: "Name",
      width: 150,
      sortKey: (cv) => cv.color_name || "",
      render: (cv) => <span className="font-medium">{cv.color_name}</span>,
    },
    {
      id: "code",
      label: "Code",
      width: 120,
      sortKey: (cv) => cv.colorway_code || "",
      render: (cv) => <span className="font-mono text-xs text-muted-foreground">{cv.colorway_code || "—"}</span>,
    },
    {
      id: "hex",
      label: "Hex",
      width: 120,
      sortKey: (cv) => cv.color_hex || "",
      render: (cv) =>
        cv.color_hex ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: cv.color_hex }} />
            <span className="font-mono text-xs text-muted-foreground">{cv.color_hex}</span>
          </div>
        ) : "—",
    },
    {
      id: "comm_color",
      label: "Commercial Color",
      width: 200,
      sortKey: (cv) => {
        const cc = commColors.find((c) => c.id === cv.linked_color_id);
        return cc ? `${cc.code} ${cc.color_name}` : "";
      },
      render: (cv) => {
        const cc = commColors.find((c) => c.id === cv.linked_color_id);
        return cc
          ? <span className="text-xs text-muted-foreground">{cc.code} – {cc.color_name}</span>
          : <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">⚠ Not linked</span>;
      },
    },
    {
      id: "tech_color",
      label: "Technical Color",
      width: 160,
      sortKey: (cv) => getTechColor(cv.linked_tech_color_id)?.code || "",
      render: (cv) => {
        const tc = getTechColor(cv.linked_tech_color_id);
        if (!tc) return "—";
        return (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: tc.hex || cv.color_hex || "#ccc" }} />
            <span className="text-xs text-muted-foreground">{tc.code} – {tc.name}</span>
          </div>
        );
      },
    },
    {
      id: "creation_project",
      label: "Creation Project",
      width: 150,
      sortKey: (cv) => projects.find((p) => p.id === cv.creation_project_id)?.name || "",
      render: (cv) => {
        const proj = projects.find((p) => p.id === cv.creation_project_id);
        return proj ? <span className="text-xs text-muted-foreground">{proj.name}</span> : "—";
      },
    },
    {
      id: "linked_projects",
      label: "Linked Projects",
      width: 200,
      render: (cv) => {
        const linked = (cv.project_ids || []).map((pid) => projects.find((p) => p.id === pid)?.name).filter(Boolean);
        return linked.length > 0 ? <span className="text-xs text-muted-foreground">{linked.join(", ")}</span> : "—";
      },
    },
    {
      id: "actions",
      label: "",
      width: 50,
      render: (cv) => (
        <button
          type="button"
          onClick={() => onEdit(cv)}
          className="p-1.5 rounded-md hover:bg-muted transition-colors ml-auto block text-muted-foreground hover:text-foreground"
          title="Edit colorway"
        >
          ✏️
        </button>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [techColors, commColors, projects, onEdit]);

  // Reset activeColumns whenever columns rebuild (data loaded) so renders always use fresh closures
  useEffect(() => { setActiveColumns(null); }, [columns]);

  const visibleColumns = activeColumns || columns;

  return (
    <div className="space-y-4">
      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search colorways…"
        moreItems={[]}
      >
        {colorVariants.length > 0 && view === "list" && (
          <ViewSelector pageKey="colorways" allColumns={columns} onColumnsChange={setActiveColumns} entityNames={["ProductColor"]} />
        )}
      </ListToolbar>

      {filteredVariants.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">{colorVariants.length === 0 ? "No color variants yet. Add one to get started." : "No results match your search."}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredVariants.map((cv) => (
            <ColorwayCard key={cv.id} variant={cv} techColor={getTechColor(cv.linked_tech_color_id)} productImage={productImage} onEdit={() => onEdit(cv)} commColor={commColors.find((c) => c.id === cv.linked_color_id)} allTechColors={techColors} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={visibleColumns}
          rows={filteredVariants}
          hideColumnToggle
        />
      )}

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} alt={lightboxAlt} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
}