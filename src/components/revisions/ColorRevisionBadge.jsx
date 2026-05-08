/**
 * ColorRevisionBadge
 * Small inline revision letter badge for ProductColor detail headers.
 * Visible only when at least one ProductRevision exists for this target_id.
 * Click opens the parent Product's RevisionHistoryPanel pre-filtered to "product_color".
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function ColorRevisionBadge({ productColorId, productId, colorVariants = [], product = null, onOpenPanel }) {
  const [currentRevision, setCurrentRevision] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!productColorId) return;
    setChecked(false);
    base44.entities.ProductRevision.filter(
      { target_id: productColorId, is_current: true },
      "-created_date",
      1
    ).then(rows => {
      setCurrentRevision(rows[0] || null);
      setChecked(true);
    }).catch(() => setChecked(true));
  }, [productColorId]);

  if (!checked || !currentRevision) return null;

  return (
    <button
      type="button"
      onClick={() => onOpenPanel && onOpenPanel("product_color")}
      title={`Revision ${currentRevision.revision_code} — click to view history`}
      className="inline-flex items-center justify-center w-6 h-6 rounded border border-green-400 bg-green-50 text-green-700 text-[11px] font-mono font-bold hover:bg-green-100 transition-colors shrink-0"
    >
      {currentRevision.revision_code}
    </button>
  );
}