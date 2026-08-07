import { X, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CartItem as CartItemType } from '@shared/lib/domain';
import { formatMoney } from '@shared/lib/format';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { POSButton } from '@shared/ui/POSButton';
import { QuantityControl } from '@shared/ui/QuantityControl';
import { Badge } from '@shared/ui/badge';
import { Input } from '@shared/ui/input';

export interface CartItemProps {
  item: CartItemType;
  onQuantitySet: (quantity: number) => void;
  onRemove: () => void;
  onNotesChange: (notes: string) => void;
}

export function CartItem({ item, onQuantitySet, onRemove, onNotesChange }: CartItemProps) {
  const { t } = useTranslation('entities');
  return (
    <div className="flex gap-3 rounded-lg border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h4 className="truncate text-sm font-medium">{item.product.name}</h4>
          <POSButton
            type="button"
            variant="ghost"
            touchSize="default"
            size="icon"
            className="shrink-0"
            onClick={onRemove}
            aria-label={t('cartItem.remove', { name: item.product.name })}
          >
            <X className="h-4 w-4" />
          </POSButton>
        </div>

        {item.selectedModifiers.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {item.selectedModifiers.map(mod => (
              <Badge key={mod.id} variant="secondary" className="text-xs">
                {mod.name}
                {mod.priceDelta > 0 ? ` ${formatMoney(mod.priceDelta, { showSign: true })}` : ''}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <QuantityControl value={item.quantity} min={1} max={99} onChange={onQuantitySet} />
          <div className="flex shrink-0 items-center gap-1">
            {item.unitPrice !== item.product.basePrice && (
              <Zap className="h-3.5 w-3.5 text-amber-400" aria-label={t('cartItem.happyHourPrice')} />
            )}
            <MoneyDisplay amount={item.lineTotal} size="lg" />
          </div>
        </div>

        <Input
          data-testid={`cart-item-notes-${item.product.id}`}
          type="text"
          placeholder={t('cartItem.notesPlaceholder')}
          value={item.notes}
          maxLength={200}
          className="mt-2 h-7 text-xs"
          onChange={e => {
            onNotesChange(e.target.value);
          }}
          aria-label={t('cartItem.notesFor', { name: item.product.name })}
        />
      </div>
    </div>
  );
}
