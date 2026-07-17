import { Clock } from 'lucide-react';
import type { Tab } from '@entities/tab/model/types';
import { cn } from '@shared/lib/utils';
import { MoneyDisplay, POSButton } from '@shared/ui';
import { Badge } from '@shared/ui/badge';

export interface TabPaymentCardProps {
  tab: Tab;
  selected: boolean;
  onClick: () => void;
}

function calculateSubtotal(tab: Tab): number {
  const itemsTotal = tab.items.reduce(
    (sum, item) => sum + (item.unitPrice + item.modifierPriceDelta) * item.quantity,
    0
  );
  const poolTotal = tab.poolCharges.reduce((sum, c) => sum + c.totalCharge, 0);
  return Math.round((itemsTotal + poolTotal) * 100) / 100;
}

export function TabPaymentCard({ tab, selected, onClick }: TabPaymentCardProps) {
  const subtotal = calculateSubtotal(tab);
  const itemCount = tab.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <POSButton
      type="button"
      variant="ghost"
      touchSize="large"
      aria-label={`tab ${tab.customerName}`}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'w-full flex-col items-stretch justify-start rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent',
        selected && 'border-primary ring-1 ring-primary bg-accent'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{tab.customerName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </p>
        </div>
        <MoneyDisplay amount={subtotal} size="sm" className="shrink-0 font-semibold" />
      </div>

      {/* Badges row */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tab.tableNumber != null && !tab.hasActivePoolSession && (
          <Badge variant="secondary" className="text-xs">
            Table {tab.tableNumber}
          </Badge>
        )}
        {tab.activePoolTableNumber != null && (
          <Badge variant="secondary" className="text-xs">
            Pool #{tab.activePoolTableNumber}
          </Badge>
        )}
        {tab.hasActivePoolSession && (
          <Badge variant="outline" className="border-amber-500 text-xs text-amber-500">
            <Clock className="mr-1 size-3" aria-hidden="true" />
            Timer Running
          </Badge>
        )}
      </div>
    </POSButton>
  );
}
