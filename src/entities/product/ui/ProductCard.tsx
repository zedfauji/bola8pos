import type { Product, Category } from '@shared/lib/domain';
import { isHappyHourActive, resolveProductPrice } from '@shared/lib/domain-helpers';
import { cn } from '@shared/lib/utils';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { POSButton } from '@shared/ui/POSButton';
import { Badge } from '@shared/ui/badge';

export interface ProductCardProps {
  product: Product;
  category: Category;
  /** Catalog clock for happy hour and pricing (defaults to `new Date()`). */
  now?: Date;
  onSelect: (product: Product) => void;
  className?: string;
}

export function ProductCard({
  product,
  category,
  now: nowProp,
  onSelect,
  className,
}: ProductCardProps) {
  const now = nowProp ?? new Date();
  const inHappyHour = isHappyHourActive(category, now);
  const displayPrice = resolveProductPrice(product, category, now);
  const priceType =
    inHappyHour && product.happyHourPrice !== null ? 'Happy hour price' : 'Regular price';
  const unavailable = !product.isActive;

  const handleClick = () => {
    if (unavailable) return;
    if ('vibrate' in navigator) navigator.vibrate(10);
    onSelect(product);
  };

  return (
    <POSButton
      type="button"
      touchSize="large"
      variant="outline"
      disabled={unavailable}
      onClick={handleClick}
      className={cn(
        'relative h-auto min-h-[120px] w-full flex-col items-stretch justify-start gap-2 rounded-lg border bg-card p-4 text-left font-normal',
        unavailable && 'cursor-not-allowed opacity-60',
        className
      )}
      aria-label={`Select ${product.name}, ${priceType}`}
      aria-disabled={unavailable}
    >
      {inHappyHour && !unavailable && (
        <Badge variant="default" className="absolute right-2 top-2">
          HAPPY HOUR
        </Badge>
      )}
      {unavailable && (
        <Badge variant="secondary" className="absolute right-2 top-2">
          Out of stock
        </Badge>
      )}
      <div className="flex items-center gap-2">
        <div
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
          aria-hidden="true"
        />
        <span className="text-xs text-muted-foreground">{category.name}</span>
      </div>
      <h3 className="text-lg font-semibold">{product.name}</h3>
      <MoneyDisplay amount={displayPrice} size="lg" />
    </POSButton>
  );
}
