/**
 * SUB TAB COLUMN COMPONENT
 *
 * Represents one sub-check column in the Item and By Person split modes.
 * Displays a label, running total, list of assigned items, and a drop zone
 * hint when empty.
 *
 * Selected state (isSelected=true) renders with border-primary ring-2 ring-primary/30
 * to signal that tapping an item will assign it here.
 */

import { X } from 'lucide-react';

import type { OrderItem } from '@shared/lib/domain';
import { cn } from '@shared/lib/utils';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';

export interface SubTabColumnProps {
  /** Column heading — "Alice", "Sub-tab 1", etc. */
  label: string;
  /** Slot for custom label rendering (PersonCard passes an editable Input) */
  labelSlot?: React.ReactNode;
  /** Items currently assigned to this column */
  items: OrderItem[];
  /** Running sum in CENTS (integer) */
  total: number;
  /** True when this column is the active drop target */
  isSelected: boolean;
  /** Called when user taps/keys the column to make it the active drop target */
  onSelect: () => void;
  /** Called when the X button next to an item is pressed */
  onRemoveItem: (itemId: string) => void;
}

/**
 * One column in the split-bill sheet.
 *
 * @example
 * ```tsx
 * <SubTabColumn
 *   label="Alice"
 *   items={aliceItems}
 *   total={aliceTotal}
 *   isSelected={activeColumn === 'alice'}
 *   onSelect={() => setActiveColumn('alice')}
 *   onRemoveItem={handleRemove}
 * />
 * ```
 */
export function SubTabColumn({
  label,
  labelSlot,
  items,
  total,
  isSelected,
  onSelect,
  onRemoveItem,
}: SubTabColumnProps) {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={cn(
        'flex flex-col min-w-[140px] bg-card rounded-lg border cursor-pointer transition-colors',
        isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'
      )}
      onClick={e => {
        // Don't trigger column selection when clicking inside the item list area
        const target = e.target as HTMLElement;
        if (target.closest('[data-item-list]')) return;
        onSelect();
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* ColumnHeader */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        {labelSlot ?? <span className="text-sm font-semibold truncate max-w-[100px]">{label}</span>}
        <MoneyDisplay amount={total / 100} size="sm" />
      </div>

      {/* ItemList — data-item-list prevents outer onClick from calling onSelect */}
      <ul
        data-item-list
        className="flex-1 overflow-y-auto divide-y min-h-[120px] list-none p-0 m-0"
      >
        {items.map(item => (
          <li
            key={item.id}
            className="flex items-center justify-between px-3 py-2 gap-2 hover:bg-accent/30"
          >
            <span className="text-sm truncate flex-1">{item.product?.name ?? item.productId}</span>
            <span className="text-sm text-muted-foreground font-mono">×{item.quantity}</span>
            <MoneyDisplay amount={item.unitPrice} size="sm" />
            <button
              type="button"
              aria-label={`Remove ${item.product?.name ?? item.productId} from ${label}`}
              className="text-muted-foreground hover:text-destructive transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={e => {
                e.stopPropagation();
                onRemoveItem(item.id);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {/* DropZone — visible only when column has no items */}
      {items.length === 0 && (
        <div className="px-3 py-2 text-sm text-muted-foreground text-center border-t">
          Tap an item to assign here
        </div>
      )}
    </div>
  );
}
