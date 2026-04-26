import { Receipt } from 'lucide-react';
import { ExportButtons } from '@features/export-report';
import { useRefundsRegister } from '@entities/tab/model/queries-reports';
import type { RefundRegisterRow } from '@shared/lib/domain';
import { EmptyState, LoadingSpinner } from '@shared/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';

type Props = { dateRange: { from: Date; to: Date } };

export function RefundsRegister({ dateRange }: Props) {
  const { data: result, isLoading } = useRefundsRegister(dateRange.from, dateRange.to);

  if (isLoading) return <LoadingSpinner />;

  const rows: RefundRegisterRow[] = result?.ok ? result.data : [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No refunds"
        description="No refunds issued in this date range."
      />
    );
  }

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalItems = rows.reduce((s, r) => s + r.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="ml-auto">
          <ExportButtons
            reportType="refunds-register"
            data={{ rows, dateRange }}
          />
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Tab</TableHead>
              <TableHead className="tabular-nums">Items</TableHead>
              <TableHead className="tabular-nums">Amount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="tabular-nums">Restock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">
                  {new Date(row.date).toLocaleDateString('es-MX')}
                </TableCell>
                <TableCell>{row.operatorName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.originalPaymentId.slice(0, 8)}…
                </TableCell>
                <TableCell className="tabular-nums">{row.items.length}</TableCell>
                <TableCell className="tabular-nums">${row.amount.toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground">{row.reason}</TableCell>
                <TableCell className="tabular-nums">
                  {row.restockCount > 0 ? row.restockCount : '—'}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 font-semibold">
              <TableCell>Total</TableCell>
              <TableCell>—</TableCell>
              <TableCell>—</TableCell>
              <TableCell className="tabular-nums">{totalItems}</TableCell>
              <TableCell className="tabular-nums">${totalAmount.toFixed(2)}</TableCell>
              <TableCell>—</TableCell>
              <TableCell>—</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
