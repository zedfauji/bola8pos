import { Users } from 'lucide-react';
import { ExportButtons } from '@features/export-report';
import { useWaitlistAnalyticsReport } from '@entities/tab/model/queries-reports';
import type { WaitlistMetricsRow } from '@shared/lib/domain';
import { EmptyState } from '@shared/ui';
import { Skeleton } from '@shared/ui/skeleton';

type Props = { dateRange: { from: Date; to: Date } };

function heatmapBgColor(count: number, max: number): string {
  if (max === 0) return 'var(--muted)';
  const intensity = count / max;
  return `oklch(${(0.72 - intensity * 0.3).toFixed(3)} ${(intensity * 0.19).toFixed(3)} 145)`;
}

export function WaitlistAnalyticsReport({ dateRange }: Props) {
  const { data: result, isLoading } = useWaitlistAnalyticsReport(dateRange.from, dateRange.to);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const rows: WaitlistMetricsRow[] = result?.ok ? result.data : [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No waitlist activity"
        description="No waitlist entries found for this date range."
      />
    );
  }

  // Aggregate totals for metric cards
  const totalSeated = rows.reduce((s, r) => s + r.partiesSeated, 0);

  const actualWaitRows = rows.filter(r => r.avgActualWait !== null);
  const avgActualWait =
    actualWaitRows.length > 0
      ? actualWaitRows.reduce((s, r) => s + (r.avgActualWait ?? 0), 0) / actualWaitRows.length
      : null;

  const quotedWaitRows = rows.filter(r => r.avgQuotedWait !== null);
  const avgQuotedWait =
    quotedWaitRows.length > 0
      ? quotedWaitRows.reduce((s, r) => s + (r.avgQuotedWait ?? 0), 0) / quotedWaitRows.length
      : null;

  const noShowRows = rows.filter(r => r.noShowRate !== null);
  const avgNoShowRate =
    noShowRows.length > 0
      ? noShowRows.reduce((s, r) => s + (r.noShowRate ?? 0), 0) / noShowRows.length
      : null;

  // Heatmap: 24 hours — placeholder counts (hourly breakdown not in current view schema)
  const hourCounts = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  const maxCount = Math.max(...hourCounts.map(h => h.count), 1);

  const metrics = [
    { label: 'Parties Seated', value: String(totalSeated) },
    {
      label: 'No-Show Rate',
      value: avgNoShowRate !== null ? `${avgNoShowRate.toFixed(1)}%` : '—',
    },
    {
      label: 'Avg Quoted Wait',
      value: avgQuotedWait !== null ? `${avgQuotedWait.toFixed(1)} min` : '—',
    },
    {
      label: 'Avg Actual Wait',
      value: avgActualWait !== null ? `${avgActualWait.toFixed(1)} min` : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map(m => (
          <div key={m.label} className="rounded-lg border bg-card p-4 text-center">
            <div className="text-xl font-semibold">{m.value}</div>
            <div className="text-sm text-muted-foreground">{m.label}</div>
          </div>
        ))}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-normal text-muted-foreground">Queue Length by Hour</h3>
        <div className="grid grid-cols-12 gap-1">
          {hourCounts.map(({ hour, count }) => (
            <div
              key={hour}
              className="flex flex-col items-center gap-1"
              title={`${String(hour).padStart(2, '0')}:00 — ${String(count)} parties`}
            >
              <div
                className="h-8 w-full rounded-sm"
                style={{ backgroundColor: heatmapBgColor(count, maxCount) }}
              />
              <span className="text-xs text-muted-foreground">{hour}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <ExportButtons
          reportType={'waitlist-analytics' as never} // temporary until ExportButtons extended in Plan 08-04
          data={{ rows, dateRange } as never}
        />
      </div>
    </div>
  );
}
