import { X } from "lucide-react";

export default function PaletteColorCard({ entry, hex, label, code, commColor, linkedHexes, onRemove }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow group/card bg-card">
      <div className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden">
        {linkedHexes?.length > 1 ? (
          <div className="w-full h-full flex">
            {linkedHexes.map((h, i) => (
              <div key={i} className="flex-1 h-full" style={{ backgroundColor: h }} />
            ))}
          </div>
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: hex }} />
        )}
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity"
          title="Remove from palette"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-0.5">
        <p className="text-xs font-medium truncate">{label}</p>
        {code && <p className="text-xs font-mono text-muted-foreground truncate">{code}</p>}
        {hex && <p className="text-xs font-mono text-muted-foreground truncate">{hex}</p>}
        {commColor && (
          <p className="text-xs font-mono text-muted-foreground truncate" title={`Commercial: ${commColor.code} – ${commColor.color_name}`}>
            {commColor.code}
          </p>
        )}
      </div>
    </div>
  );
}