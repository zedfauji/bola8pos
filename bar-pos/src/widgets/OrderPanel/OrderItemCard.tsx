/**
 * ORDER ITEM CARD
 *
 * Displays a single order item in the OrderPanel.
 * Read-only view (no quantity adjustment or removal).
 */

import type { OrderItem } from '@entities/tab/model/types';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { Badge } from '@shared/ui/badge';

export interface OrderItemCardProps {
  item: OrderItem;
}

/**
 * OrderItemCard - Read-only display of an order item
 *
 * Shows:
 * - Product name
 * - Quantity
 * - Modifiers (if any)
 * - Line total
 *
 * Note: This is read-only. For editable cart items, see CartItem component.
 */
export function OrderItemCard({ item }: OrderItemCardProps) {
  const lineTotal = (item.unitPrice + item.modifierPriceDelta) * item.quantity;

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-card border">
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{item.quantity}×</span>
            <h4 className="font-medium text-sm">{item.product?.name ?? 'Unknown Product'}</h4>
          </div>
          <MoneyDisplay amount={lineTotal} className="font-semibold" />
        </div>

        {item.modifiers.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.modifiers.map(mod => (
              <Badge key={mod.id} variant="secondary" className="text-xs">
                {mod.name}
                {mod.priceDelta > 0 && ` +$${(mod.priceDelta / 100).toFixed(2)}`}
              </Badge>
            ))}
          </div>
        )}

        {item.notes && <p className="text-xs text-muted-foreground mt-2 italic">{item.notes}</p>}
      </div>
    </div>
  );
}
