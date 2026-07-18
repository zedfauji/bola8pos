import { ShieldOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ExportButtons } from '@features/export-report';
import { useComboOverrides } from '@entities/tab/model/queries-reports';
import type { ComboOverrideRow } from '@shared/lib/domain';
import { EmptyState, LoadingSpinner } from '@shared/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';

type Props = { dateRange: { from: Date; to: Date } };

export function ComboOverrideReport({ dateRange }: Props) {
  const { t } = useTranslation('wAdmin');
  const { data: result, isLoading } = useComboOverrides(dateRange.from, dateRange.to);

  if (isLoading) return <LoadingSpinner />;

  const rows: ComboOverrideRow[] = result?.ok ? result.data : [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ShieldOff}
        title={t('comboOverrideReport.emptyTitle')}
        description={t('comboOverrideReport.emptyDescription')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons
          reportType="combo-overrides"
          data={{ rows, dateRange }}
        />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('comboOverrideReport.columnTimestamp')}</TableHead>
              <TableHead>{t('comboOverrideReport.columnActor')}</TableHead>
              <TableHead>{t('comboOverrideReport.columnCombo')}</TableHead>
              <TableHead>{t('comboOverrideReport.columnReason')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">
                  {new Date(row.ts).toLocaleString('es-MX')}
                </TableCell>
                <TableCell>{row.actorName}</TableCell>
                <TableCell>{row.comboName}</TableCell>
                <TableCell className="text-muted-foreground">{row.reason ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
