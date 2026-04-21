import { Badge } from "@/components/ui/badge";
import { X, LayoutGrid, List } from "lucide-react";
import DataTable from "./DataTable";
import PaletteColorCard from "./PaletteColorCard";

export default function PaletteColorSection({ paletteColors, getColorHex, getColorLabel, getColorCode, getColorSubType, getLinkedCommColor, onRemove, view, onViewChange }) {
  if (paletteColors.length === 0) {
    return (
      <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">No colors yet. Add technical or commercial colors to this palette.</p>
      </div>
    );
  }

  const columns = [
    {
      id: "color",
      label: "Color",
      width: 80,
      render: (entry) => {
        const hex = getColorHex(entry);
        return <div className="w-10 h-10 rounded-md border border-border" style={{ backgroundColor: hex }} />;
      },
    },
    {
      id: "label",
      label: "Name / Code",
      width: 150,
      sortKey: (entry) => getColorLabel(entry) || "",
      render: (entry) => {
        const label = getColorLabel(entry);
        const code = getColorCode ? getColorCode(entry) : null;
        return (
          <div>
            <p className="font-medium text-sm">{label}</p>
            {code && <p className="text-xs text-muted-foreground font-mono">{code}</p>}
          </div>
        );
      },
    },
    {
      id: "type",
      label: "Type",
      width: 120,
      sortKey: (entry) => entry.color_type || "",
      render: (entry) => <Badge variant="secondary" className="text-[10px]">{entry.color_type}</Badge>,
    },
    {
      id: "subtype",
      label: "Sub-type",
      width: 120,
      sortKey: (entry) => getColorSubType ? getColorSubType(entry) : "",
      render: (entry) => {
        const subType = getColorSubType ? getColorSubType(entry) : null;
        return <span className="text-xs text-muted-foreground">{subType || "—"}</span>;
      },
    },
    {
      id: "hex",
      label: "Hex",
      width: 120,
      sortKey: (entry) => getColorHex(entry) || "",
      render: (entry) => {
        const hex = getColorHex(entry);
        return (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: hex }} />
            <span className="font-mono text-xs text-muted-foreground">{hex}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      label: "",
      width: 60,
      render: (entry) => (
        <button
          onClick={() => onRemove(entry.id)}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-destructive ml-auto block"
          title="Remove from palette"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Colors ({paletteColors.length})</h3>
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => onViewChange("gallery")}
            className={`px-2.5 py-1.5 transition-colors ${view === "gallery" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            title="Gallery view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewChange("table")}
            className={`px-2.5 py-1.5 transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            title="Table view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === "gallery" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {paletteColors.map((entry) => (
            <PaletteColorCard
              key={entry.id}
              entry={entry}
              hex={getColorHex(entry)}
              label={getColorLabel(entry)}
              code={getColorCode(entry)}
              commColor={getLinkedCommColor ? getLinkedCommColor(entry) : null}
              onRemove={() => onRemove(entry.id)}
            />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={paletteColors}
          fixedColumns={["color"]}
          filterFields={[
            { getValue: (entry) => getColorLabel(entry) },
            { getValue: (entry) => getColorCode ? getColorCode(entry) : "" },
            { getValue: (entry) => entry.color_type },
            { getValue: (entry) => getColorSubType ? getColorSubType(entry) : "" },
            { getValue: (entry) => getColorHex(entry) },
          ]}
        />
      )}
    </div>
  );
}