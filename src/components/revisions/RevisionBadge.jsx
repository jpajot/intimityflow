/**
 * RevisionBadge
 * Generalized inline revision letter badge for any revision-tracked entity.
 * Renders the current revision letter for Product or ProductColor.
 * Subscribes to real-time ProductRevision changes.
 * 
 * Props:
 *   - target_type: "product" | "product_color" | string
 *   - target_id: string (the entity id)
 *   - onOpenPanel?: function(target_type, target_id) — called on click
 *   - parentProductId?: string — optional, context for cross-entity navigation
 *   - size?: "xs" | "sm" | "md" (default "sm")
 * 
 * Behavior:
 *   - Fetches current revision on mount + subscribes to real-time updates
 *   - Renders nothing if no revision exists
 *   - Green-tinted appearance for current revisions
 *   - Clickable to open revision panel
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function RevisionBadge({
  target_type,
  target_id,
  onOpenPanel,
  parentProductId,
  size = "sm",
  is_stale = false,
  current_revision_code = null,
  snapshotted_revision_code = null,
}) {
  const [currentRevision, setCurrentRevision] = useState(null);
  const [checked, setChecked] = useState(false);

  const sizeClasses = {
    xs: "w-5 h-5 text-[10px]",
    sm: "w-6 h-6 text-[11px]",
    md: "w-8 h-8 text-xs",
  };

  const fetchRevision = () => {
    if (!target_id) return;
    base44.entities.ProductRevision.filter(
      { target_id, is_current: true },
      "-created_date",
      1
    )
      .then((rows) => {
        setCurrentRevision(rows[0] || null);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  };

  useEffect(() => {
    if (!target_id) {
      setChecked(true);
      return;
    }
    // If external revision codes are provided (staleness indicator mode), skip fetch
    if (snapshotted_revision_code !== null) {
      setChecked(true);
      return;
    }
    setChecked(false);
    fetchRevision();

    // Subscribe to real-time ProductRevision changes filtered by target_id
    const unsubscribe = base44.entities.ProductRevision.subscribe((event) => {
      if (event.data?.target_id === target_id) {
        fetchRevision();
      }
    });
    return unsubscribe;
  }, [target_id, snapshotted_revision_code]);

  if (!checked) return null;

  // Staleness indicator mode: use provided revision codes
  if (snapshotted_revision_code !== null) {
    const letterToDisplay = snapshotted_revision_code;
    const isFresh = letterToDisplay === current_revision_code;
    
    return (
      <button
        type="button"
        onClick={() => onOpenPanel && onOpenPanel(target_type, target_id)}
        title={isFresh ? `Revision ${letterToDisplay}` : `Snapshotted at ${letterToDisplay}; current is ${current_revision_code || "—"}`}
        className={`inline-flex items-center justify-center rounded border-2 font-mono font-bold hover:opacity-80 transition-opacity shrink-0 gap-0.5 ${sizeClasses[size]} ${
          isFresh
            ? "border-green-400 bg-green-50 text-green-700"
            : "border-orange-400 bg-orange-50 text-orange-700"
        }`}
      >
        {letterToDisplay}
        {!isFresh && <span className="text-orange-500 text-lg leading-none">●</span>}
      </button>
    );
  }

  // Normal mode: display current revision
  if (!currentRevision) return null;

  return (
    <button
      type="button"
      onClick={() => onOpenPanel && onOpenPanel(target_type, target_id)}
      title={`Revision ${currentRevision.revision_code} — click to view history`}
      className={`inline-flex items-center justify-center rounded border-2 border-green-400 bg-green-50 text-green-700 font-mono font-bold hover:bg-green-100 transition-colors shrink-0 ${sizeClasses[size]}`}
    >
      {currentRevision.revision_code}
    </button>
  );
}