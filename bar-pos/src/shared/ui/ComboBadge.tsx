/**
 * COMBO BADGE COMPONENT
 *
 * Displays a styled "Combo" badge for products that are combo products.
 * Used in ProductGrid to indicate combo products in the catalog.
 */

import { Badge } from '@shared/ui/badge';

/**
 * Badge indicating a product is a combo (bundle of items).
 *
 * @example
 * ```tsx
 * <ComboBadge />
 * ```
 */
export function ComboBadge() {
  return (
    <Badge
      variant="secondary"
      className="bg-pos-accent/20 text-pos-accent border-pos-accent/30 text-sm px-1.5 py-0.5"
    >
      Combo
    </Badge>
  );
}
