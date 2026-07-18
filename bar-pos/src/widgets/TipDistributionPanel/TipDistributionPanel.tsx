import type { ColumnDef } from '@tanstack/react-table';
import { DollarSign } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExportButtons } from '@features/export-report';
import { useStaffTips } from '@entities/staff';
import type { StaffTips } from '@shared/lib/domain';
import { DataTable, EmptyState, LoadingSpinner, MoneyDisplay } from '@shared/ui';

type Props = { dateRange: { from: Date; to: Date } };

export function TipDistributionPanel({ dateRange }: Props) {
  const { t } = useTranslation('wAdmin');
  const { data: result, isLoading } = useStaffTips(dateRange.from, dateRange.to);
  const rows = useMemo(() => (result?.ok ? result.data : []), [result]);

  const columns: ColumnDef<StaffTips>[] = useMemo(
    () => [
      {
        accessorKey: 'staffName',
        header: t('tipDistributionPanel.columnStaffMember'),
        cell: info => <span className="font-medium">{info.getValue<string>()}</span>,
      },
      {
        accessorKey: 'totalTips',
        header: t('tipDistributionPanel.columnTotalTips'),
        cell: info => <MoneyDisplay amount={info.getValue<number>()} size="sm" />,
      },
    ],
    [t]
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
          title={t('tipDistributionPanel.emptyTitle')}
          description={t('tipDistributionPanel.emptyDescription')}
        />
      }
    />
  );
}
