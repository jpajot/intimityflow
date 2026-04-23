import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import ViewSelector from "./ViewSelector";
import { base44 } from "@/api/base44Client";
import DataTable from "./DataTable";
import ColorwayCard from "./ColorwayCard";

const STORAGE_KEY = "colorway_section_view";

export default function ColorwaySection({ colorVariants, onEdit, onAddNew, onAddFromLibrary }) {
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

  useEffect(() => {
    base44.entities.TechnicalColor.list("code", 2000).then(setTechColors);
    base44.entities.Project.list("name", 500).then(setProjects);
    base44.entities.CommercialColor.list("code", 2000).then(setCommColors);
  }, []);

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
      render: (cv) =>
        cv.image_url ? (
          <div className="w-8 h-8 rounded-md overflow-hidden border border-border">
            <img src={cv.image_url} alt={cv.color_name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-md border border-border" style={{ backgroundColor: cv.color_hex || "#ccc" }} />
        ),
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
            <div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: cv.color_hex }} />
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
            <div className="w-4 h-4 rounded-sm border border-border shrink-0" style={{ backgroundColor: cv.color_hex || "#ccc" }} />
            <span className="text-xs font-mono text-muted-foreground">{tc.code}</span>
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

  const visibleColumns = activeColumns || columns;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search colorways…" className="pl-8 h-8 text-xs" />
        </div>
        {colorVariants.length > 0 && (
          <>
            {view === "list" && (
              <ViewSelector pageKey="colorways" allColumns={columns} onColumnsChange={setActiveColumns} entityNames={["ProductColor"]} />
            )}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button type="button" onClick={() => handleSetView("grid")} className={`px-2.5 py-1.5 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Gallery view"><LayoutGrid className="w-4 h-4" /></button>
              <button type="button" onClick={() => handleSetView("list")} className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title="Table view"><List className="w-4 h-4" /></button>
            </div>
          </>
        )}
        <Button variant="outline" size="sm" onClick={onAddFromLibrary} className="gap-1.5 h-8 text-xs">From Library</Button>
        <Button variant="outline" size="sm" onClick={onAddNew} className="gap-1.5 h-8 text-xs"><Plus className="w-3.5 h-3.5" /> Add</Button>
      </div>

      {filteredVariants.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">{colorVariants.length === 0 ? "No color variants yet. Add one to get started." : "No results match your search."}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredVariants.map((cv) => (
            <ColorwayCard key={cv.id} variant={cv} techColor={getTechColor(cv.linked_tech_color_id)} onEdit={() => onEdit(cv)} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={visibleColumns}
          rows={filteredVariants}
          hideColumnToggle
        />
      )}
    </div>
  );
}