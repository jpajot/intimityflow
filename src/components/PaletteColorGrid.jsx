import { useState } from "react";
import { X, Link, ZoomIn } from "lucide-react";

const SIZE_CONFIGS = {
  S: { cols: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5", cardClass: "text-[10px]", swatchSize: "w-5 h-5", codeClass: "text-[9px]" },
  M: { cols: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", cardClass: "text-xs", swatchSize: "w-6 h-6", codeClass: "text-[10px]" },
  L: { cols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", cardClass: "text-sm", swatchSize: "w-8 h-8", codeClass: "text-xs" },
};

const STORAGE_KEY = "palette_card_size";

function loadSize() {
  try { return localStorage.getItem(STORAGE_KEY) || "M"; } catch { return "M"; }
}

function saveSize(size) {
  try { localStorage.setItem(STORAGE_KEY, size); } catch {}
}

/**
 * Renders palette colors in a commercial-led layout:
 * - Commercial colors are primary cards
 * - Their linked technical colors appear as sub-swatches inside
 * - Unlinked technical colors appear in a secondary section below
 */
export default function PaletteColorGrid({ swatches, techColors, commColors, paletteColors, paletteId, onRemove, onLinkTech }) {
  const [size, setSize] = useState(loadSize);

  const handleSize = (s) => { setSize(s); saveSize(s); };

  const cfg = SIZE_CONFIGS[size];

  // Separate commercial entries and technical entries in this palette
  const palEntries = paletteColors.filter((pc) => pc.palette_id === paletteId);
  const commEntries = palEntries.filter((e) => e.color_type === "commercial");
  const techEntries = palEntries.filter((e) => e.color_type === "technical");

  // For each commercial entry, build a rich card
  const commCards = commEntries.map((e) => {
    const comm = commColors.find((c) => c.id === e.color_id);
    if (!comm) return null;

    // All linked technical colors for this commercial color
    const linkedTechIds = [
      ...(comm.main_technical_color_id ? [comm.main_technical_color_id] : []),
      ...(comm.linked_technical_color_ids || []).filter((id) => id !== comm.main_technical_color_id),
    ];
    const linkedTechs = linkedTechIds.map((id) => techColors.find((t) => t.id === id)).filter(Boolean);

    // Main swatch hex: use main tech color hex, or first linked
    const mainHex = linkedTechs[0]?.hex || "#ccc";

    // Is this a combined color (multiple hexes)?
    const isMulti = linkedTechs.length > 1;

    return { entryId: e.id, comm, linkedTechs, mainHex, isMulti };
  }).filter(Boolean);

  // Technical entries to show standalone:
  // - has no commercial color linked globally → truly unlinked (amber, show link button)
  // - has a commercial color linked globally BUT that commercial is NOT in this palette → show it (amber, show link button)
  // - has a commercial color linked AND that commercial IS in this palette → skip (already shown via comm card)
  const commColorIdsInPalette = new Set(commEntries.map((e) => e.color_id));
  const unlinkedTechEntries = techEntries.filter((e) => {
    const linkedComm = commColors.find(
      (c) => c.main_technical_color_id === e.color_id || (c.linked_technical_color_ids || []).includes(e.color_id)
    );
    // Hide if its commercial color is already shown as a card in this palette
    if (linkedComm && commColorIdsInPalette.has(linkedComm.id)) return false;
    return true;
  });

  const unlinkedTechCards = unlinkedTechEntries.map((e) => {
    const t = techColors.find((c) => c.id === e.color_id);
    return { entryId: e.id, tech: t };
  }).filter((x) => x.tech);

  if (commCards.length === 0 && unlinkedTechCards.length === 0) {
    return <p className="text-sm text-muted-foreground">No colors in this palette yet.</p>;
  }

  return (
    <div className="space-y-5">
      {/* Size control */}
      <div className="flex items-center gap-2 justify-end">
        <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          {["S", "M", "L"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSize(s)}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                size === s ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Commercial color cards */}
      {commCards.length > 0 && (
        <div className={`grid ${cfg.cols} gap-3`}>
          {commCards.map(({ entryId, comm, linkedTechs, mainHex, isMulti }) => (
            <div key={entryId} className="rounded-lg border border-border overflow-hidden group/color relative bg-card">
              {/* Main color swatch */}
              {isMulti ? (
                <div className="aspect-square flex overflow-hidden">
                  {linkedTechs.map((t, j) => (
                    <div key={j} className="flex-1 h-full" style={{ backgroundColor: t.hex || "#ccc" }} />
                  ))}
                </div>
              ) : (
                <div className="aspect-square" style={{ backgroundColor: mainHex }} />
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={() => onRemove(entryId)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center hidden group-hover/color:flex z-10"
              >
                <X className="w-2.5 h-2.5" />
              </button>

              {/* Card info */}
              <div className="p-2 space-y-1.5">
                {/* Commercial color name & code */}
                <div>
                  <p className={`font-semibold leading-tight ${cfg.cardClass}`}>{comm.color_name || "—"}</p>
                  <p className={`font-mono text-muted-foreground ${cfg.codeClass}`}>{comm.code}</p>
                </div>

                {/* Linked technical sub-swatches */}
                {linkedTechs.length > 0 && (
                  <div className="border-t border-border pt-1.5 space-y-1">
                    {linkedTechs.map((t) => (
                      <div key={t.id} className="flex items-center gap-1.5">
                        <div
                          className={`${cfg.swatchSize} rounded-sm border border-border shrink-0`}
                          style={{ backgroundColor: t.hex || "#ccc" }}
                          title={t.hex}
                        />
                        <div className="min-w-0">
                          <p className={`font-mono leading-tight ${cfg.codeClass} text-muted-foreground`}>{t.code}</p>
                          <p className={`leading-tight ${cfg.codeClass} text-muted-foreground`}>{t.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unlinked technical colors */}
      {unlinkedTechCards.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Unlinked Technical Colors ({unlinkedTechCards.length})
          </p>
          <div className={`grid ${cfg.cols} gap-3`}>
            {unlinkedTechCards.map(({ entryId, tech }) => (
              <div key={entryId} className="rounded-lg border border-amber-300 overflow-hidden group/color relative bg-card">
                <div className="aspect-square" style={{ backgroundColor: tech.hex || "#ccc" }} />
                <button
                  type="button"
                  onClick={() => onRemove(entryId)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center hidden group-hover/color:flex z-10"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
                <div className="p-2 space-y-1">
                  <p className={`font-medium leading-tight ${cfg.cardClass}`}>{tech.name || "—"}</p>
                  <p className={`font-mono text-muted-foreground ${cfg.codeClass}`}>{tech.code}</p>
                  <p className={`font-mono text-muted-foreground ${cfg.codeClass}`}>{tech.hex}</p>
                  <button
                    type="button"
                    onClick={() => onLinkTech(tech)}
                    title="Link to commercial color"
                    className="mt-0.5 w-5 h-5 flex items-center justify-center rounded bg-amber-50 text-amber-500 border border-amber-300 hover:bg-amber-100 transition-colors"
                  >
                    <Link className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}