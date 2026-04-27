/**
 * MONEY DISPLAY COMPONENT
 *
 * Displays formatted money amounts with proper styling.
 * Uses domain-helpers.formatMoney() for consistent formatting.
 */

import { formatMoney } from '@shared/lib/domain-helpers';
import { cn } from '@shared/lib/utils';

export type MoneyDisplayProps = {
  /** Amount in dollars (e.g., 12.50) */
  amount: number;
  /** Force negative styling even if amount is positive */
  negative?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
};

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-3xl font-bold',
};

/**
 * Displays a formatted money amount.
 *
 * @example
 * ```tsx
 * <MoneyDisplay amount={12.50} />
 * <MoneyDisplay amount={-5.00} />
 * <MoneyDisplay amount={100.00} size="xl" />
 * ```
 */
export function MoneyDisplay({
  amount,
  negative = false,
  size = 'md',
  className,
}: MoneyDisplayProps) {
  const isNegative = amount < 0 || negative;
  const formatted = formatMoney(Math.abs(amount));

  return (
    <span
      className={cn(
        'font-mono tabular-nums',
        sizeClasses[size],
        isNegative && 'text-red-600 dark:text-red-400',
        className
      )}
      aria-label={`${isNegative ? 'Negative ' : ''}${formatted} dollars`}
    >
      {isNegative && '−'}${formatted}
    </span>
  );
}
