import { Clock } from 'lucide-react';
import type { PoolSessionSummary } from '@shared/lib/domain';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';

interface PoolChargeItemProps {
  charge: PoolSessionSummary;
}

function formatBilledTime(billedMinutes: number): string {
  const h = Math.floor(billedMinutes / 60);
  const m = billedMinutes % 60;
  if (h === 0) return `${String(m)}m`;
  return m === 0 ? `${String(h)}h` : `${String(h)}h ${String(m)}m`;
}

export function PoolChargeItem({ charge }: PoolChargeItemProps) {
  const duration = formatBilledTime(charge.billedMinutes);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/40 p-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium leading-snug">
          Pool Table #{charge.tableNumber} — {duration} @{' '}
          <MoneyDisplay amount={charge.ratePerHour} size="sm" className="inline align-baseline" />
          /hr ={' '}
          <MoneyDisplay amount={charge.totalCharge} size="sm" className="inline align-baseline" />
        </p>
      </div>
    </div>
  );
}
