import type { PoolSession, PoolTable } from '@shared/lib/domain';
import { cn } from '@shared/lib/utils';
import { MoneyDisplay, POSButton, StatusBadge, TimerDisplay } from '@shared/ui';
import { Badge } from '@shared/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@shared/ui/card';
import { usePoolTimer } from '../model/usePoolTimer';

export interface PoolTableCardProps {
  table: PoolTable;
  /** Current session row from server; null when table has no embedded session. */
  session: PoolSession | null;
  /** Resolved customer name when `session.tabId` is set. */
  linkedCustomerName?: string | null;
  onStartSession?: () => void;
  onStopSession?: () => void;
  onAssignToTab?: () => void;
  onReleaseReserved?: () => void;
  /** Disable start (e.g. while mutation pending). */
  startDisabled?: boolean;
}

export function PoolTableCard({
  table,
  session,
  linkedCustomerName,
  onStartSession,
  onStopSession,
  onAssignToTab,
  onReleaseReserved,
  startDisabled = false,
}: PoolTableCardProps) {
  const isOccupied = table.status === 'occupied';
  const timer = usePoolTimer(isOccupied && session ? session.startedAt : null, table.ratePerHour);

  return (
    <Card className={cn('flex h-full flex-col', isOccupied && 'border-primary')}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-medium">Table {table.number}</p>
          <CardTitle className="truncate text-lg font-bold">{table.label}</CardTitle>
        </div>
        <StatusBadge status={table.status} />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {table.status === 'available' && (
          <p className="text-muted-foreground text-sm">Ready for the next game.</p>
        )}

        {table.status === 'reserved' && (
          <p className="text-muted-foreground text-sm">Held for a customer.</p>
        )}

        {table.status === 'maintenance' && (
          <p className="text-muted-foreground text-sm">Temporarily out of service.</p>
        )}

        {isOccupied && session && (
          <>
            <div className="flex flex-col gap-1">
              <TimerDisplay
                totalSeconds={timer.totalSeconds}
                className="font-mono text-2xl text-primary"
              />
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground text-xs">Current charge</span>
                <MoneyDisplay amount={timer.currentCharge} size="lg" />
              </div>
            </div>
            {linkedCustomerName ? (
              <Badge variant="secondary" className="w-fit max-w-full truncate">
                {linkedCustomerName}
              </Badge>
            ) : null}
          </>
        )}
      </CardContent>
      <CardFooter className="mt-auto flex flex-col gap-2 pt-0">
        {table.status === 'available' && onStartSession && (
          <POSButton
            type="button"
            touchSize="large"
            className="w-full"
            disabled={startDisabled}
            onClick={e => {
              e.stopPropagation();
              onStartSession();
            }}
          >
            Start Session
          </POSButton>
        )}

        {isOccupied && session && (
          <>
            {onStopSession && (
              <POSButton
                type="button"
                variant="destructive"
                touchSize="large"
                className="w-full"
                onClick={e => {
                  e.stopPropagation();
                  onStopSession();
                }}
              >
                Stop Session
              </POSButton>
            )}
            {!session.tabId && onAssignToTab && (
              <POSButton
                type="button"
                variant="secondary"
                touchSize="large"
                className="w-full"
                onClick={e => {
                  e.stopPropagation();
                  onAssignToTab();
                }}
              >
                Assign to Tab
              </POSButton>
            )}
          </>
        )}

        {table.status === 'reserved' && onReleaseReserved && (
          <POSButton
            type="button"
            touchSize="large"
            className="w-full"
            onClick={e => {
              e.stopPropagation();
              onReleaseReserved();
            }}
          >
            Release
          </POSButton>
        )}
      </CardFooter>
    </Card>
  );
}
