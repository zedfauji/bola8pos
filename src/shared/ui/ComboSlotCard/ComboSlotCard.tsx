/**
 * COMBO SLOT CARD COMPONENT
 *
 * Renders a single combo slot with its available options.
 * Used inside ComboBuilderSheet to let users pick options for each slot.
 *
 * Supports two slot types:
 *   - 'product': renders scrollable option list with checkboxes + optional QuantityControl
 *   - 'pool_time': renders non-interactive info card (hour of pool time included)
 *
 * Shows a red border when the slot is required but no option is selected.
 */

import type { ComboSlot, ComboSlotOption, SlotSelection } from '@shared/lib/domain';

import { cn } from '@shared/lib/utils';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { QuantityControl } from '@shared/ui/QuantityControl';
import { Checkbox } from '@shared/ui/checkbox';

export interface ComboSlotCardProps {
  /** The slot definition (label, slotType, minQty, maxQty, isRequired, etc.) */
  slot: ComboSlot;
  /** Available options for this slot */
  options: ComboSlotOption[];
  /** Child products keyed by product id for display name + base price */
  productMap: Record<string, { name: string; basePrice: number }>;
  /** Current selection for this slot */
  value: SlotSelection;
  /** Called when the selection changes */
  onChange: (v: SlotSelection) => void;
  /** Disable all interactions */
  disabled?: boolean;
}

/**
 * Card component for a single combo slot.
 * Manages selection state and validation visual feedback.
 *
 * @example
 * ```tsx
 * <ComboSlotCard
 *   slot={slot}
 *   options={options}
 *   productMap={productMap}
 *   value={selection}
 *   onChange={setSelection}
 * />
 * ```
 */
export function ComboSlotCard({
  slot,
  options,
  productMap,
  value,
  onChange,
  disabled = false,
}: ComboSlotCardProps) {
  const isUnfilled = slot.isRequired && value.childProductId === null;
  const isFixedQty = slot.minQty === slot.maxQty;

  const handleOptionToggle = (option: ComboSlotOption, checked: boolean) => {
    if (disabled) return;
    if (checked) {
      onChange({
        slotId: slot.id,
        childProductId: option.childProductId,
        qty: slot.minQty,
      });
    } else {
      onChange({
        slotId: slot.id,
        childProductId: null,
        qty: 0,
      });
    }
  };

  const handleQtyChange = (newQty: number) => {
    if (disabled) return;
    onChange({ ...value, qty: newQty });
  };

  return (
    <div
      className={cn(
        'bg-card rounded-lg border p-4 space-y-3',
        isUnfilled ? 'border-destructive' : 'border'
      )}
    >
      {/* Header */}
      <div>
        <p className="text-base font-medium">{slot.label}</p>
        <p className="text-sm text-muted-foreground">
          Select {slot.minQty}–{slot.maxQty}
        </p>
      </div>

      {/* Pool time slot — non-interactive info card */}
      {slot.slotType === 'pool_time' && (
        <div className="rounded-md bg-muted px-3 py-2">
          <p className="text-sm text-muted-foreground">1 hour pool time included</p>
        </div>
      )}

      {/* Product slot — scrollable option list */}
      {slot.slotType === 'product' && (
        <div
          className="max-h-48 overflow-y-auto divide-y rounded-md border"
          role="listbox"
          aria-label={`Options for ${slot.label}`}
        >
          {options.map(option => {
            if (!option.childProductId) return null;
            const product = productMap[option.childProductId];
            if (!product) return null;

            const isSelected = value.childProductId === option.childProductId;
            const optionId = `slot-${slot.id}-opt-${option.id}`;

            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={disabled}
                onClick={() => {
                  handleOptionToggle(option, !isSelected);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer',
                  isSelected && 'bg-accent/50',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <Checkbox
                  id={optionId}
                  checked={isSelected}
                  onCheckedChange={(checked: boolean | 'indeterminate') => {
                    handleOptionToggle(option, checked === true);
                  }}
                  disabled={disabled}
                  aria-label={`Select ${product.name}`}
                  tabIndex={-1}
                />
                <label
                  htmlFor={optionId}
                  className="flex-1 text-sm cursor-pointer pointer-events-none"
                >
                  {product.name}
                </label>
                <div className="text-sm text-right ml-auto">
                  {product.basePrice > 0 && <MoneyDisplay amount={product.basePrice} size="sm" />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Quantity control — shown when option selected and range differs */}
      {slot.slotType === 'product' && value.childProductId !== null && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Quantity</span>
          {isFixedQty ? (
            <span className="rounded-full border bg-muted px-3 py-0.5 text-sm font-medium">
              {slot.minQty}
            </span>
          ) : (
            <QuantityControl
              value={value.qty}
              min={slot.minQty}
              max={slot.maxQty}
              onChange={handleQtyChange}
              disabled={disabled}
            />
          )}
        </div>
      )}
    </div>
  );
}
