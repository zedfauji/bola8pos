import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ExportButtons } from '@features/export-report';
import {
  useHourlyBreakdown,
  findPeakHour,
  findSlowestHour,
  type HourlyRow,
} from '@entities/tab/model/queries-reports';
import { EmptyState, LoadingSpinner, MoneyDisplay } from '@shared/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';

type Props = {
  dateRange: { from: Date; to: Date };
};

function formatHour(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return `${String(h12)}:00 ${ampm}`;
}

export function HourlyBreakdownPanel({ dateRange }: Props) {
  const { t } = useTranslation('wAdmin');
  const { data: result, isLoading } = useHourlyBreakdown(dateRange.from, dateRange.to);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const rows: HourlyRow[] = result?.ok ? result.data : [];
  const allZero = rows.every(r => r.revenue === 0);

  if (allZero) {
    return (
      <EmptyState
        icon={Clock}
        title={t('hourlyBreakdownPanel.emptyTitle')}
        description={t('hourlyBreakdownPanel.emptyDescription')}
      />
    );
  }

  const peakHour = findPeakHour(rows);
  const slowestHour = findSlowestHour(rows);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons reportType="hourly" data={rows} />
      </div>

      {/* Callout row */}
      {(peakHour ?? slowestHour) && (
        <div className="flex flex-wrap gap-4 rounded-lg border bg-muted/30 px-4 py-2 text-sm">
          {peakHour && (
            <span>
              {t('hourlyBreakdownPanel.peakLabel')}{' '}
              <span className="font-semibold text-emerald-500">
                {t('hourlyBreakdownPanel.hourRevenueValue', {
                  hour: formatHour(peakHour.hour),
                  revenue: peakHour.revenue.toFixed(2),
                })}
              </span>
            </span>
          )}
          {slowestHour && (
            <span>
              {t('hourlyBreakdownPanel.slowestLabel')}{' '}
              <span className="font-semibold text-amber-400">
                {t('hourlyBreakdownPanel.hourRevenueValue', {
                  hour: formatHour(slowestHour.hour),
                  revenue: slowestHour.revenue.toFixed(2),
                })}
              </span>
            </span>
          )}
        </div>
      )}

      {/* 24-row table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('hourlyBreakdownPanel.columnHour')}</TableHead>
              <TableHead>{t('hourlyBreakdownPanel.columnOrders')}</TableHead>
              <TableHead>{t('hourlyBreakdownPanel.columnRevenue')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => {
              const isPeak = peakHour !== null && row.hour === peakHour.hour;
              const isSlowest = slowestHour !== null && row.hour === slowestHour.hour && !isPeak;
              return (
                <TableRow
                  key={row.hour}
                  className={
                    isPeak
                      ? 'border-l-2 border-l-emerald-500 bg-emerald-500/5 text-emerald-400'
                      : isSlowest
                        ? 'border-l-2 border-l-amber-400 bg-amber-500/5 text-amber-400'
                        : undefined
                  }
                >
                  <TableCell className="font-mono">{formatHour(row.hour)}</TableCell>
                  <TableCell className="tabular-nums">{row.orderCount}</TableCell>
                  <TableCell>
                    <MoneyDisplay amount={row.revenue} size="sm" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
