import { Badge } from "@/components/ui/badge";
import { X, LayoutGrid, List } from "lucide-react";
import DataTable from "./DataTable";
import PaletteColorCard from "./PaletteColorCard";

export default function PaletteColorSection({ paletteColors, getColorHex, getColorLabel, getColorCode, getColorSubType, getLinkedCommColor, getLinkedHexes, onRemove, view, onViewChange, paletteSize = "md" }) {
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
      <h3 className="font-semibold">Colors ({paletteColors.length})</h3>

      {view === "gallery" ? (
        <div className={`grid gap-3 ${
          paletteSize === "sm" ? "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8" :
          paletteSize === "md" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" :
          "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3"
        }`}>
          {paletteColors.map((entry) => (
            <PaletteColorCard
              key={entry.id}
              entry={entry}
              hex={getColorHex(entry)}
              label={getColorLabel(entry)}
              code={getColorCode(entry)}
              commColor={getLinkedCommColor ? getLinkedCommColor(entry) : null}
              linkedHexes={getLinkedHexes ? getLinkedHexes(entry) : null}
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