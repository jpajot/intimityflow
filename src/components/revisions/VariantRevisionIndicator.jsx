/**
 * VariantRevisionIndicator
 * 
 * Displays a revision staleness indicator for a BOMLineVariant.
 * Shows snapshotted revision letter with orange dot if stale.
 * Integrates with RevisionHistoryPanel on click.
 */
import { useState } from "react";
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

  if (!snapshotRevisionCode) return null;

  const isFresh = snapshotRevisionCode === currentRevisionCode;

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
        onOpenPanel={() => setShowPanel(true)}
      />
      {showPanel && (
        <RevisionHistoryPanel
          open={true}
          onClose={() => setShowPanel(false)}
          targetType={targetType}
          targetId={targetId}
          parentProductId={parentProductId}
        />
      )}
    </>
  );
}