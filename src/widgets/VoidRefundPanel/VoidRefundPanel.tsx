import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { ExportButtons } from '@features/export-report';
import { useVoidRefundReport, type VoidRefundRow } from '@entities/tab/model/queries-reports';
import { DataTable, EmptyState, LoadingSpinner, MoneyDisplay } from '@shared/ui';

type Props = {
  dateRange: { from: Date; to: Date };
};

const columns: ColumnDef<VoidRefundRow>[] = [
  {
    accessorKey: 'voidedAt',
    header: 'Timestamp',
    cell: info =>
      info.getValue<Date>().toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
  },
  {
    accessorKey: 'staffName',
    header: 'Staff',
    cell: info => <span className="font-medium">{info.getValue<string>()}</span>,
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: info => <MoneyDisplay amount={info.getValue<number>()} size="sm" />,
  },
  {
    accessorKey: 'reason',
    header: 'Reason',
    cell: info => (
      <span className="max-w-xs truncate text-muted-foreground">
        {info.getValue<string>() || '—'}
      </span>
    ),
  },
];

export function VoidRefundPanel({ dateRange }: Props) {
  const { data: result, isLoading } = useVoidRefundReport(dateRange.from, dateRange.to);

  const rows = useMemo(() => (result?.ok ? result.data : []), [result]);

  const exportData = { rows, dateRange };

  const toolbar = rows.length > 0 ? <ExportButtons reportType="voids" data={exportData} /> : null;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <DataTable
      columns={columns}
      data={rows}
      toolbar={toolbar}
      emptyState={
        <EmptyState
          icon={AlertTriangle}
          title="No voids or refunds"
          description="No voids or refunds in this range."
        />
      }
    />
  );
}
