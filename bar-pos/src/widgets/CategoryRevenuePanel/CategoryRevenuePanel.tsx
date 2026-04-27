import { PieChart } from 'lucide-react';
import { ExportButtons } from '@features/export-report';
import {
  useCategoryRevenueReport,
  type CategoryRevenueRow,
} from '@entities/tab/model/queries-reports';
import { EmptyState, LoadingSpinner, MoneyDisplay } from '@shared/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';

type Props = {
  dateRange: { from: Date; to: Date };
};

export function CategoryRevenuePanel({ dateRange }: Props) {
  const { data: result, isLoading } = useCategoryRevenueReport(dateRange.from, dateRange.to);

  if (isLoading) return <LoadingSpinner />;

  const rows: CategoryRevenueRow[] = result?.ok ? result.data : [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={PieChart}
        title="No category data"
        description="No revenue recorded in this date range."
      />
    );
  }

  const exportData = { rows, dateRange };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons reportType="categories" data={exportData} />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Units Sold</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>% of Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow
                key={row.categoryId}
                className={
                  idx === 0 ? 'border-l-2 border-l-emerald-500 bg-emerald-500/5' : undefined
                }
              >
                <TableCell className="font-medium">{row.categoryName}</TableCell>
                <TableCell className="tabular-nums">{row.unitsSold}</TableCell>
                <TableCell className="tabular-nums">{row.orderCount}</TableCell>
                <TableCell>
                  <MoneyDisplay amount={row.revenue} size="sm" />
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {row.pctTotal}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
