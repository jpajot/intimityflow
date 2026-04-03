import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DataTable from "./DataTable";
import ColorwayCard from "./ColorwayCard";

export default function ColorwaySection({ colorVariants, onEdit, onAddNew, onAddFromLibrary }) {
  const [view, setView] = useState("grid");
  const [techColors, setTechColors] = useState([]);

  useEffect(() => {
    base44.entities.TechnicalColor.list("code", 2000).then(setTechColors);
  }, []);

  const getTechColor = (id) => techColors.find((t) => t.id === id);

  const columns = [
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
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Colorways ({colorVariants.length})</h3>
        <div className="flex items-center gap-2">
          {colorVariants.length > 0 && (
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`px-2.5 py-1.5 transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                title="Gallery view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={onAddFromLibrary} className="gap-1.5 h-8 text-xs">
            From Library
          </Button>
          <Button variant="outline" size="sm" onClick={onAddNew} className="gap-1.5 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
      </div>

      {colorVariants.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No color variants yet. Add one to get started.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {colorVariants.map((cv) => (
            <ColorwayCard key={cv.id} variant={cv} techColor={getTechColor(cv.linked_tech_color_id)} onEdit={() => onEdit(cv)} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={colorVariants}
          fixedColumns={["color"]}
          filterFields={[
            { getValue: (cv) => cv.color_name },
            { getValue: (cv) => cv.colorway_code },
            { getValue: (cv) => cv.color_hex },
            { getValue: (cv) => cv.linked_color_type },
            { getValue: (cv) => getTechColor(cv.linked_tech_color_id)?.code },
            { getValue: (cv) => getTechColor(cv.linked_tech_color_id)?.name },
          ]}
        />
      )}
    </div>
  );
}