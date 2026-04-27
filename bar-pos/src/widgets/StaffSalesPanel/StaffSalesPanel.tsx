import type { ColumnDef } from '@tanstack/react-table';
import { Users } from 'lucide-react';
import { useMemo } from 'react';
import { ExportButtons } from '@features/export-report';
import { useStaffMetrics } from '@entities/staff';
import type { StaffMetric } from '@shared/lib/domain';
import { DataTable, EmptyState, LoadingSpinner, MoneyDisplay } from '@shared/ui';

type Props = { dateRange: { from: Date; to: Date } };

export function StaffSalesPanel({ dateRange }: Props) {
  const { data: result, isLoading } = useStaffMetrics(dateRange.from, dateRange.to);
  const rows = useMemo(() => (result?.ok ? result.data : []), [result]);

  const columns: ColumnDef<StaffMetric>[] = useMemo(
    () => [
      {
        accessorKey: 'staffName',
        header: 'Staff Member',
        cell: info => <span className="font-medium">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'revenue',
        header: 'Revenue',
        cell: info => <MoneyDisplay amount={info.getValue<number>()} size="sm" />,
      },
      {
        accessorKey: 'transactionCount',
        header: 'Transactions',
        cell: info => <span className="tabular-nums">{info.getValue<number>()}</span>,
      },
      {
        accessorKey: 'avgCheckSize',
        header: 'Avg Check',
        cell: info => <MoneyDisplay amount={info.getValue<number>()} size="sm" />,
      },
      {
        accessorKey: 'voidCount',
        header: 'Voids',
        cell: info => (
          <span className="tabular-nums text-muted-foreground">{info.getValue<number>()}</span>
        ),
      },
    ],
    []
  );

  const toolbar =
    rows.length > 0 ? <ExportButtons reportType="staff" data={{ rows, dateRange }} /> : null;

  if (isLoading) return <LoadingSpinner />;

  return (
    <DataTable
      columns={columns}
      data={rows}
      toolbar={toolbar}
      emptyState={
        <EmptyState
          icon={Users}
          title="No staff activity"
          description="No staff activity in this date range."
        />
      }
    />
  );
}
