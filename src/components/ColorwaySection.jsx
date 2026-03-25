import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List } from "lucide-react";
import DataTable from "./DataTable";
import ColorwayCard from "./ColorwayCard";

export default function ColorwaySection({ colorVariants, onEdit, onAddNew, onAddFromLibrary }) {
  const [view, setView] = useState("grid");

  const columns = [
    {
      id: "color",
      label: "Color",
      width: 80,
      render: (cv) => (
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
      render: (cv) => (
        cv.color_hex ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: cv.color_hex }} />
            <span className="font-mono text-xs text-muted-foreground">{cv.color_hex}</span>
          </div>
        ) : "—"
      ),
    },
    {
      id: "image",
      label: "Image",
      width: 100,
      render: (cv) => (
        cv.image_url ? (
          <div className="w-8 h-8 rounded-md overflow-hidden border border-border">
            <img src={cv.image_url} alt={cv.color_name} className="w-full h-full object-cover" />
          </div>
        ) : "—"
      ),
    },
    {
      id: "library",
      label: "Library",
      width: 100,
      sortKey: (cv) => cv.linked_color_type || "",
      render: (cv) => (
        cv.linked_color_id ? (
          <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">
            {cv.linked_color_type === "technical" ? "TCX" : "COM"}
          </span>
        ) : "—"
      ),
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
      </div>

      {colorVariants.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No color variants yet. Add one to get started.</p>
        </div>
      ) : view === "grid" ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onAddFromLibrary} className="gap-1.5 h-8 text-xs">
              From Library
            </Button>
            <Button variant="outline" size="sm" onClick={onAddNew} className="gap-1.5 h-8 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {colorVariants.map((cv) => (
              <ColorwayCard key={cv.id} variant={cv} onEdit={() => onEdit(cv)} />
            ))}
          </div>
        </>
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
          ]}
        />
      )}
    </div>
  );
}