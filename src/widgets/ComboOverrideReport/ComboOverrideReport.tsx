import { ShieldOff } from 'lucide-react';
import { ExportButtons } from '@features/export-report';
import { useComboOverrides } from '@entities/tab/model/queries-reports';
import type { ComboOverrideRow } from '@shared/lib/domain';
import { EmptyState, LoadingSpinner } from '@shared/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';

type Props = { dateRange: { from: Date; to: Date } };

export function ComboOverrideReport({ dateRange }: Props) {
  const { data: result, isLoading } = useComboOverrides(dateRange.from, dateRange.to);

  if (isLoading) return <LoadingSpinner />;

  const rows: ComboOverrideRow[] = result?.ok ? result.data : [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="No overrides"
        description="No combo availability overrides found for this date range."
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
              <TableHead>Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Combo</TableHead>
              <TableHead>Reason</TableHead>
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
