import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List } from "lucide-react";

export default function ColorwaySection({ colorVariants, onEdit, onAddNew, onAddFromLibrary }) {
  const [view, setView] = useState("grid");

  const columns = [

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