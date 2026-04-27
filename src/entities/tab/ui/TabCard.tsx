import type { Tab } from '@shared/lib/domain';
import { getTabDurationTier } from '@shared/lib/domain-helpers';
import { cn } from '@shared/lib/utils';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { TimerDisplay } from '@shared/ui/TimerDisplay';
import { Card } from '@shared/ui/card';

export interface TabCardProps {
  tab: Tab;
  isActive: boolean;
  onSelect: (tabId: string) => void;
  className?: string;
}

function calculateRunningTotal(items: Tab['items']): number {
  return items.reduce((total, item) => {
    const lineTotal = (item.unitPrice + item.modifierPriceDelta) * item.quantity;
    return total + lineTotal;
  }, 0);
}

function durationBadgeStatus(
  tier: ReturnType<typeof getTabDurationTier>
): 'tab_open_ok' | 'tab_open_warn' | 'tab_open_critical' {
  if (tier === 'critical') return 'tab_open_critical';
  if (tier === 'warn') return 'tab_open_warn';
  return 'tab_open_ok';
}

export function TabCard({ tab, isActive, onSelect, className }: TabCardProps) {
  const runningTotal = calculateRunningTotal(tab.items);
  const itemCount = tab.items.length;
  const now = new Date();
  const tier = getTabDurationTier(tab.openedAt, now);
  const badgeStatus = durationBadgeStatus(tier);

  const handleClick = () => {
    onSelect(tab.id);
    if ('vibrate' in navigator) navigator.vibrate(10);
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md min-h-[44px]',
        isActive && 'ring-2 ring-primary',
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Tab for ${tab.customerName}${tab.tableNumber ? `, table ${String(tab.tableNumber)}` : ''}`}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{tab.customerName}</h3>
            {tab.tableNumber !== null && (
              <p className="text-sm text-muted-foreground">Table {tab.tableNumber}</p>
            )}
          </div>
          {tab.status === 'open' && <StatusBadge status={badgeStatus} />}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <TimerDisplay
            mode="tabOpen"
            openedAt={tab.openedAt}
            now={now}
            size="sm"
            warning={tier === 'warn'}
            critical={tier === 'critical'}
          />
          <span>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="pt-2 border-t">
          <MoneyDisplay amount={runningTotal} size="lg" />
        </div>
      </div>
    </Card>
  );
}
