import { useTranslation } from 'react-i18next';
import { cn } from '@shared/lib/utils';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';

interface CartSummaryProps {
  subtotal: number;
  tax: number;
  total: number;
  className?: string;
}

export function CartSummary({ subtotal, tax, total, className }: CartSummaryProps) {
  const { t } = useTranslation('wPanels');
  return (
    <div
      className={cn('flex flex-col space-y-2 border-t pt-4', className)}
      role="region"
      aria-label={t('cartSummary.orderSummaryAriaLabel')}
    >
      <div className="flex justify-between text-sm text-muted-foreground">
        <span id="subtotal-label">{t('cartSummary.subtotal')}</span>
        <MoneyDisplay amount={subtotal} aria-labelledby="subtotal-label" />
      </div>
      <div className="flex justify-between text-sm text-muted-foreground">
        <span id="tax-label">{t('cartSummary.tax')}</span>
        <MoneyDisplay amount={tax} aria-labelledby="tax-label" />
      </div>
      <div className="flex justify-between font-bold text-lg">
        <span id="total-label">{t('cartSummary.total')}</span>
        <MoneyDisplay amount={total} aria-labelledby="total-label" />
      </div>
    </div>
  );
}
