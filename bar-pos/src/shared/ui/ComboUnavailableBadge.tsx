/**
 * COMBO UNAVAILABLE BADGE COMPONENT
 *
 * Displays a styled badge indicating a combo product is not available.
 * Shows a Lock icon and an availability hint text.
 * Used in ProductGrid to indicate unavailable combo products.
 */

import { Lock } from 'lucide-react';

import { Badge } from '@shared/ui/badge';

export interface ComboUnavailableBadgeProps {
  /** Human-readable hint about when the combo is available (e.g., "Available Mon–Fri") */
  availabilityHint: string;
}

/**
 * Badge indicating a combo product is currently unavailable.
 * Includes a Lock icon and availability hint for the reason.
 *
 * @example
 * ```tsx
 * <ComboUnavailableBadge availabilityHint="Available Mon–Fri" />
 * ```
 */
export function ComboUnavailableBadge({ availabilityHint }: ComboUnavailableBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className="bg-muted text-muted-foreground gap-1"
      aria-label={`Combo unavailable. ${availabilityHint}`}
    >
      <Lock size={14} aria-hidden />
      <span>{availabilityHint}</span>
    </Badge>
  );
}
