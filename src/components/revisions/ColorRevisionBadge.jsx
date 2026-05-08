/**
 * ColorRevisionBadge
 * Wrapper around RevisionBadge for ProductColor contexts.
 * Maintained for backward compatibility; delegates to RevisionBadge.
 */
import RevisionBadge from "./RevisionBadge";

export default function ColorRevisionBadge({
  productColorId,
  productId,
  colorVariants = [],
  product = null,
  onOpenPanel,
}) {
  return (
    <RevisionBadge
      target_type="product_color"
      target_id={productColorId}
      parentProductId={productId}
      onOpenPanel={onOpenPanel}
      size="sm"
    />
  );
}