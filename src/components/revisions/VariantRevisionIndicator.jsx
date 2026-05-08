/**
 * VariantRevisionIndicator
 * 
 * Displays a revision staleness indicator for a BOMLineVariant.
 * Shows snapshotted revision letter with orange dot if stale.
 * Integrates with RevisionHistoryPanel on click.
 * 
 * Fetches parent Product before opening panel to provide full context.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import RevisionBadge from "./RevisionBadge";
import RevisionHistoryPanel from "./RevisionHistoryPanel";

export default function VariantRevisionIndicator({
  variant,
  targetType, // "product_color" | "product_attribute" | "product_color_size"
  targetId,
  snapshotRevisionCode,
  currentRevisionCode,
  parentProductId,
}) {
  const [showPanel, setShowPanel] = useState(false);
  const [parentProduct, setParentProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(false);

  if (!snapshotRevisionCode) return null;

  const isFresh = snapshotRevisionCode === currentRevisionCode;

  const handleOpenPanel = async () => {
    if (!parentProductId) return;
    if (parentProduct) {
      setShowPanel(true);
      return;
    }
    
    // Fetch parent Product if not already loaded
    setLoadingProduct(true);
    try {
      const prods = await base44.entities.Product.filter({ id: parentProductId });
      if (prods[0]) {
        setParentProduct(prods[0]);
        setShowPanel(true);
      }
    } catch (err) {
      console.error("[VariantRevisionIndicator] Failed to fetch parent product:", err);
    } finally {
      setLoadingProduct(false);
    }
  };

  return (
    <>
      <RevisionBadge
        target_type={targetType}
        target_id={targetId}
        size="xs"
        is_stale={!isFresh}
        snapshotted_revision_code={snapshotRevisionCode}
        current_revision_code={currentRevisionCode}
        parentProductId={parentProductId}
        onOpenPanel={handleOpenPanel}
      />
      {showPanel && parentProduct && (
        <RevisionHistoryPanel
          open={true}
          onClose={() => setShowPanel(false)}
          product={parentProduct}
          colorVariants={[]}
          initialTargetType={targetType}
          initialTargetId={targetId}
        />
      )}
    </>
  );
}