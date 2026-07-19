import { useTranslation } from 'react-i18next';
import type { PoolSession, PoolTable, PoolTableType } from '@shared/lib/domain';
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
  firstHourMode: 'full' | 'prorated';
}

// eslint-disable-next-line i18next/no-literal-string -- object keys (PoolTableType enum values), not UI copy
const TABLE_TYPE_LABEL_KEY: Record<PoolTableType, string> = {
  pool: 'poolTableCard.tableType.pool',
  carom: 'poolTableCard.tableType.carom',
  consumption: 'poolTableCard.tableType.consumption',
};

const TABLE_TYPE_VARIANT: Record<PoolTableType, 'default' | 'secondary' | 'outline'> = {
  pool: 'default',
  carom: 'secondary',
  consumption: 'outline',
};

// eslint-disable-next-line i18next/no-literal-string -- object keys (table status enum values), not UI copy
const STATUS_MESSAGE_KEY: Record<string, string> = {
  available: 'poolTableCard.statusMessage.available',
  reserved: 'poolTableCard.statusMessage.reserved',
  maintenance: 'poolTableCard.statusMessage.maintenance',
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
  firstHourMode,
}: PoolTableCardProps) {
  const { t } = useTranslation('entities');
  const isOccupied = table.status === 'occupied';
  const startDisabledVal = startDisabled ?? false;
  const stopDisabledVal = stopDisabled ?? false;
  const timer = usePoolTimer(
    isOccupied && session ? session.startedAt : null,
    table.ratePerHour,
    firstHourMode
  );

  const handleCardClick = () => {
    if (isOccupied && onViewStatus) {
      onViewStatus();
    }
  };

  return (
    <Card
      data-testid="pool-table-card"
      className={cn(
        'flex flex-col overflow-hidden',
        isOccupied && 'ring-2 ring-inset ring-primary'
      )}
      onClick={isOccupied && onViewStatus ? handleCardClick : undefined}
      style={isOccupied && onViewStatus ? { cursor: 'pointer' } : undefined}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {t('poolTableCard.tableNumber', { number: table.number })}
          </p>
          <CardTitle className="truncate text-lg font-bold">{table.label}</CardTitle>
          <Badge
            data-testid="table-type-badge"
            variant={TABLE_TYPE_VARIANT[table.tableType]}
            className="mt-1 text-xs"
          >
            {t(TABLE_TYPE_LABEL_KEY[table.tableType])}
          </Badge>
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
              {linkedCustomerName ?? t('poolTableCard.noTab')}
            </Badge>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t('poolTableCard.elapsedMinutes', { minutes: Math.floor(timer.elapsedMinutes) })}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {(() => {
              const key = STATUS_MESSAGE_KEY[table.status];
              return key ? t(key) : '';
            })()}
          </p>
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
            {t('poolTableCard.startSession')}
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
            {t('poolTableCard.stopSession')}
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
            {t('poolTableCard.release')}
          </POSButton>
        )}

        {table.status === 'maintenance' && (
          <POSButton type="button" touchSize="large" className="w-full" disabled>
            {t('poolTableCard.unavailable')}
          </POSButton>
        )}
      </CardFooter>
    </Card>
  );
}
