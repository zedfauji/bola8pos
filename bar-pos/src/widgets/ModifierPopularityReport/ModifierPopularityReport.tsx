import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  Rectangle,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type BarShapeProps,
} from 'recharts';
import { ExportButtons } from '@features/export-report';
import { useModifierPopularityReport } from '@entities/tab/model/queries-reports';
import type { ModifierPopularityRow } from '@shared/lib/domain';
import { EmptyState, LoadingSpinner } from '@shared/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';

const CHART_COLORS = [
  'var(--chart-1)',
  'oklch(0.72 0.19 145)', // --pos-accent green for top series
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

type Props = { dateRange: { from: Date; to: Date } };

function chartColor(index: number): string {
  // eslint-disable-next-line i18next/no-literal-string -- CSS custom-property value, not UI copy
  return CHART_COLORS[index % CHART_COLORS.length] ?? 'var(--chart-1)';
}

export function ModifierPopularityReport({ dateRange }: Props) {
  const { t } = useTranslation('wAdmin');
  const { data: result, isLoading } = useModifierPopularityReport(dateRange.from, dateRange.to);

  if (isLoading) return <LoadingSpinner />;

  const rows: ModifierPopularityRow[] = result?.ok ? result.data : [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title={t('modifierPopularityReport.emptyTitle')}
        description={t('modifierPopularityReport.emptyDescription')}
      />
    );
  }

  // Sort by attach-count desc (D-09 default sort) — top bar/row is the #1 modifier.
  const sorted = [...rows].sort((a, b) => b.attachCount - a.attachCount);
  const topId = sorted[0]?.modifierId;
  // On-screen cap only (D-10) — full uncapped `rows` still flows to ExportButtons below.
  const capped = sorted.slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons reportType="modifier-popularity" data={{ rows, dateRange }} />
      </div>
      <div className="rounded-lg border p-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={capped} layout="vertical">
            <XAxis type="number" />
            <YAxis type="category" dataKey="modifierName" width={120} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="attachCount"
              name={t('modifierPopularityReport.columnAttachCount')}
              shape={(props: BarShapeProps) => {
                const row = props.payload as ModifierPopularityRow;
                return (
                  <Rectangle
                    {...props}
                    fill={row.modifierId === topId ? chartColor(1) : chartColor(0)}
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('modifierPopularityReport.columnModifier')}</TableHead>
              <TableHead className="tabular-nums">
                {t('modifierPopularityReport.columnAttachCount')}
              </TableHead>
              <TableHead className="tabular-nums">
                {t('modifierPopularityReport.columnRevenue')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {capped.map(row => (
              <TableRow
                key={row.modifierId}
                className={
                  row.modifierId === topId
                    ? 'border-l-2 border-l-emerald-500 bg-emerald-500/5'
                    : undefined
                }
              >
                <TableCell>{row.modifierName}</TableCell>
                <TableCell className="tabular-nums">{row.attachCount}</TableCell>
                <TableCell className="tabular-nums">${row.revenue.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="px-4 py-2 text-xs text-muted-foreground">
          {t('modifierPopularityReport.top20Note')}
        </p>
      </div>
    </div>
  );
}
