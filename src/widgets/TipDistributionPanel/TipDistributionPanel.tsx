import type { ColumnDef } from '@tanstack/react-table';
import { DollarSign } from 'lucide-react';
import { useMemo } from 'react';
import { ExportButtons } from '@features/export-report';
import { useStaffTips } from '@entities/staff';
import type { StaffTips } from '@shared/lib/domain';
import { DataTable, EmptyState, LoadingSpinner, MoneyDisplay } from '@shared/ui';

type Props = { dateRange: { from: Date; to: Date } };

export function TipDistributionPanel({ dateRange }: Props) {
  const { data: result, isLoading } = useStaffTips(dateRange.from, dateRange.to);
  const rows = useMemo(() => (result?.ok ? result.data : []), [result]);

  const columns: ColumnDef<StaffTips>[] = useMemo(
    () => [
      {
        accessorKey: 'staffName',
        header: 'Staff Member',
        cell: info => <span className="font-medium">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'totalTips',
        header: 'Total Tips',
        cell: info => <MoneyDisplay amount={info.getValue<number>()} size="sm" />,
      },
    ],
    []
  );

  const toolbar =
    rows.length > 0 ? <ExportButtons reportType="tips" data={{ rows, dateRange }} /> : null;

  if (isLoading) return <LoadingSpinner />;

  return (
    <DataTable
      columns={columns}
      data={rows}
      toolbar={toolbar}
      emptyState={
        <EmptyState
          icon={DollarSign}
          title="No tip data"
          description="No tip data in this date range."
        />
      }
    />
  );
}
