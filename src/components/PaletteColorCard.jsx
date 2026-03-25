import { X } from "lucide-react";

export default function PaletteColorCard({ entry, hex, label, code, onRemove }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow group/card bg-card">
      <div className="aspect-square bg-muted flex items-center justify-center relative">
        <div className="w-full h-full" style={{ backgroundColor: hex }} />
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity"
          title="Remove from palette"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-1">
        <p className="text-xs font-medium truncate">{label}</p>
        {code && <p className="text-xs font-mono text-muted-foreground truncate">{code}</p>}
      </div>
    </div>
  );
}