import { TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ExportButtons } from '@features/export-report';
import { useComboMixReport } from '@entities/tab/model/queries-reports';
import type { ComboMixRow } from '@shared/lib/domain';
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
  return CHART_COLORS[index % CHART_COLORS.length] ?? 'var(--chart-1)';
}

export function ComboMixReport({ dateRange }: Props) {
  const { data: result, isLoading } = useComboMixReport(dateRange.from, dateRange.to);

  if (isLoading) return <LoadingSpinner />;

  const rows: ComboMixRow[] = result?.ok ? result.data : [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No combo sales"
        description="No combo orders recorded in this date range."
      />
    );
  }

  // Build day-of-week aggregated data for stacked bar chart
  const comboNames = Array.from(new Set(rows.map(r => r.comboName)));
  const dayMap = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const day = new Date(row.date).toLocaleDateString('es-MX', { weekday: 'short' });
    const existing: Record<string, number> = dayMap.get(day) ?? { dow: 0 };
    existing[row.comboName] = (existing[row.comboName] ?? 0) + row.qtySold;
    dayMap.set(day, existing);
  }
  // Add dow label separately for chart axis
  const chartData = Array.from(dayMap.entries()).map(([dow, counts]) => ({ dow, ...counts }));

  // Summary table: sort by net_revenue descending for top-row highlight
  const sorted = [...rows].sort((a, b) => b.netRevenue - a.netRevenue);
  const topId = sorted[0]?.comboProductId;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons
          reportType="combo-mix"
          data={{ rows, dateRange }}
        />
      </div>
      <div className="rounded-lg border p-4">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="dow" />
            <YAxis />
            <Tooltip />
            <Legend />
            {comboNames.map((name, i) => (
              <Bar key={name} dataKey={name} stackId="a" fill={chartColor(i)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Combo</TableHead>
              <TableHead className="tabular-nums">Units Sold</TableHead>
              <TableHead className="tabular-nums">Gross Revenue</TableHead>
              <TableHead className="tabular-nums">Avg Price</TableHead>
              <TableHead className="tabular-nums">Overrides</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(row => (
              <TableRow
                key={`${row.date}-${row.comboProductId}`}
                className={
                  row.comboProductId === topId
                    ? 'border-l-2 border-l-emerald-500 bg-emerald-500/5'
                    : undefined
                }
              >
                <TableCell>{row.comboName}</TableCell>
                <TableCell className="tabular-nums">{row.qtySold}</TableCell>
                <TableCell className="tabular-nums">${row.netRevenue.toFixed(2)}</TableCell>
                <TableCell className="tabular-nums">${row.avgPrice.toFixed(2)}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {row.overrideCount > 0 ? row.overrideCount : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
