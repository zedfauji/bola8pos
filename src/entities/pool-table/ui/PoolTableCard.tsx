import type { PoolSession, PoolTable } from '@shared/lib/domain';
import { cn } from '@shared/lib/utils';
import { POSButton, StatusBadge } from '@shared/ui';
import { Badge } from '@shared/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@shared/ui/card';
import { usePoolTimer } from '../model/usePoolTimer';
import { PoolTableIllustration } from './PoolTableIllustration';

export interface PoolTableCardProps {
  table: PoolTable;
  /** Current session row from server; null when table has no embedded session. */
  session: PoolSession | null;
  /** Resolved customer name when `session.tabId` is set. */
  linkedCustomerName?: string | null;
  onStartSession?: () => void;
  onStopSession?: () => void;
  onReleaseReserved?: () => void;
  /** Navigate to the table status detail page (occupied tables only). */
  onViewStatus?: () => void;
  /** Disable start (e.g. while mutation pending). */
  startDisabled?: boolean;
  startDisabledTitle?: string;
  /** Disable stop session (e.g. RBAC). */
  stopDisabled?: boolean;
  /** Native tooltip when stop is RBAC-disabled. */
  stopDisabledTitle?: string;
}

const statusMessage: Record<string, string> = {
  available: 'Ready for the next game.',
  reserved: 'Held for a customer.',
  maintenance: 'Temporarily out of service.',
};

export function PoolTableCard({
  table,
  session,
  linkedCustomerName,
  onStartSession,
  onStopSession,
  onReleaseReserved,
  onViewStatus,
  startDisabled,
  startDisabledTitle,
  stopDisabled,
  stopDisabledTitle,
}: PoolTableCardProps) {
  const isOccupied = table.status === 'occupied';
  const startDisabledVal = startDisabled ?? false;
  const stopDisabledVal = stopDisabled ?? false;
  const timer = usePoolTimer(isOccupied && session ? session.startedAt : null, table.ratePerHour);

  const handleCardClick = () => {
    if (isOccupied && onViewStatus) {
      onViewStatus();
    }
  };

  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden',
        isOccupied && 'ring-2 ring-inset ring-primary'
      )}
      onClick={isOccupied && onViewStatus ? handleCardClick : undefined}
      style={isOccupied && onViewStatus ? { cursor: 'pointer' } : undefined}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Table {table.number}</p>
          <CardTitle className="truncate text-lg font-bold">{table.label}</CardTitle>
        </div>
        <StatusBadge status={table.status} />
      </CardHeader>

      {/* SVG illustration */}
      <div className="px-3 pb-2">
        <PoolTableIllustration
          status={table.status}
          isOvertime={isOccupied ? timer.elapsedMinutes >= 120 : undefined}
          timer={
            isOccupied && session
              ? { totalSeconds: timer.totalSeconds, currentCharge: timer.currentCharge }
              : undefined
          }
          ratePerHour={table.ratePerHour}
        />
      </div>

      {/* Meta row */}
      <CardContent className="flex-1 pb-3">
        {isOccupied && session ? (
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="max-w-full truncate text-xs">
              {linkedCustomerName ?? 'No tab'}
            </Badge>
            <span className="shrink-0 text-xs text-muted-foreground">
              {Math.floor(timer.elapsedMinutes)} min
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{statusMessage[table.status] ?? ''}</p>
        )}
      </CardContent>

      {/* Single primary action button */}
      <CardFooter className="pt-0">
        {table.status === 'available' && onStartSession && (
          <POSButton
            type="button"
            touchSize="large"
            className="w-full"
            disabled={startDisabledVal}
            title={startDisabledVal ? startDisabledTitle : undefined}
            onClick={e => {
              e.stopPropagation();
              onStartSession();
            }}
          >
            Start Session
          </POSButton>
        )}

        {isOccupied && session && onStopSession && (
          <POSButton
            type="button"
            variant="destructive"
            touchSize="large"
            className="w-full"
            disabled={stopDisabledVal}
            title={stopDisabledVal ? stopDisabledTitle : undefined}
            onClick={e => {
              e.stopPropagation();
              onStopSession();
            }}
          >
            Stop Session
          </POSButton>
        )}

        {table.status === 'reserved' && onReleaseReserved && (
          <POSButton
            type="button"
            variant="outline"
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

        {table.status === 'maintenance' && (
          <POSButton type="button" touchSize="large" className="w-full" disabled>
            Unavailable
          </POSButton>
        )}
      </CardFooter>
    </Card>
  );
}
