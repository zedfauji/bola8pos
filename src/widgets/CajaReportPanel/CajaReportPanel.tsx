import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { ExportButtons } from '@features/export-report';
import { useCajaList, useCajaReport } from '@entities/caja';
import type { CajaEntry, CajaReport, CajaSession } from '@shared/lib/domain';
import { DataTable } from '@shared/ui/DataTable';
import { LoadingSpinner } from '@shared/ui/LoadingSpinner';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { SectionHeader } from '@shared/ui/SectionHeader';
import { Badge } from '@shared/ui/badge';

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const topProductsColumns: ColumnDef<CajaReport['topProducts'][number]>[] = [
  { accessorKey: 'productName', header: 'Product' },
  { accessorKey: 'quantity', header: 'Qty' },
  {
    accessorKey: 'revenue',
    header: 'Revenue',
    cell: ({ row }) => <MoneyDisplay amount={row.original.revenue} size="sm" />,
  },
];

const staffColumns: ColumnDef<CajaReport['staffSummary'][number]>[] = [
  { accessorKey: 'staffName', header: 'Staff' },
  { accessorKey: 'orderCount', header: 'Orders' },
  {
    accessorKey: 'salesTotal',
    header: 'Sales Total',
    cell: ({ row }) => <MoneyDisplay amount={row.original.salesTotal} size="sm" />,
  },
];

const entriesColumns: ColumnDef<CajaEntry>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <Badge
        variant={row.original.type === 'expense' ? 'destructive' : 'default'}
        className="capitalize"
      >
        {row.original.type}
      </Badge>
    ),
  },
  { accessorKey: 'concept', header: 'Concept' },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => (
      <span className={row.original.type === 'expense' ? 'text-red-400' : 'text-green-400'}>
        {row.original.type === 'expense' ? '-' : '+'}${row.original.amount.toFixed(2)}
      </span>
    ),
  },
  {
    accessorKey: 'staffName',
    header: 'Staff',
    cell: ({ row }) => <span>{row.original.staffName ?? '—'}</span>,
  },
  {
    accessorKey: 'createdAt',
    header: 'Time',
    cell: ({ row }) =>
      row.original.createdAt.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }),
  },
];

export function CajaReportPanel() {
  const { data: listResult, isLoading: listLoading } = useCajaList();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessions = listResult?.ok ? listResult.data : [];
  const effectiveId = selectedId ?? sessions[0]?.id ?? null;

  const { data: reportResult, isLoading: reportLoading } = useCajaReport(effectiveId);
  const report = reportResult?.ok ? reportResult.data : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader title="Daily Caja Report" description="Sales summary for a business day." />

      {listLoading && <LoadingSpinner />}

      {!listLoading && (
        <div className="flex items-center gap-3">
          <label htmlFor="caja-selector" className="text-sm font-medium">
            Select session
          </label>
          <select
            id="caja-selector"
            value={effectiveId ?? ''}
            onChange={e => {
              setSelectedId(e.target.value || null);
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {sessions.map((s: CajaSession) => (
              <option key={s.id} value={s.id}>
                {formatDate(s.openedAt)} {s.status === 'open' ? '(open)' : ''}
              </option>
            ))}
          </select>
          {report && <ExportButtons reportType="caja" data={report} />}
        </div>
      )}

      {reportLoading && <LoadingSpinner />}

      {report && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {[
              { label: 'Total Revenue', value: report.summary.totalRevenue },
              { label: 'Cash Sales', value: report.summary.cashSales },
              { label: 'Card Sales', value: report.summary.cardSales },
              { label: 'Rappi Sales', value: report.summary.rappiSales },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <MoneyDisplay amount={value} size="lg" className="mt-1 font-bold" />
              </div>
            ))}
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Tabs / Orders</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {report.summary.tabCount} / {report.summary.orderCount}
              </p>
            </div>
          </div>

          {/* Cash reconciliation */}
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-semibold">Cash Reconciliation</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Opening cash', value: report.cashReconciliation.openingCash },
                { label: 'Cash collected', value: report.cashReconciliation.cashSales },
                { label: 'Expected in drawer', value: report.cashReconciliation.expectedCash },
                { label: 'Closing count', value: report.cashReconciliation.closingCash },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  {value != null ? (
                    <MoneyDisplay amount={value} size="sm" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              ))}
              {report.summary.totalIncome > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">+ Income entries</span>
                  <span className="text-green-400">${report.summary.totalIncome.toFixed(2)}</span>
                </div>
              )}
              {report.summary.totalExpenses > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">- Expense entries</span>
                  <span className="text-red-400">${report.summary.totalExpenses.toFixed(2)}</span>
                </div>
              )}
              {(report.summary.totalExpenses > 0 || report.summary.totalIncome > 0) && (
                <div className="flex justify-between font-semibold">
                  <span>= Net Balance</span>
                  <MoneyDisplay amount={report.summary.netBalance} size="sm" />
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Variance</span>
                {report.cashReconciliation.variance != null ? (
                  <span
                    className={
                      report.cashReconciliation.variance === 0
                        ? 'text-green-500'
                        : 'text-destructive'
                    }
                  >
                    {report.cashReconciliation.variance > 0 ? '+' : ''}
                    {report.cashReconciliation.variance.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Top products */}
          <div>
            <h3 className="mb-3 font-semibold">Top 10 Products</h3>
            {report.topProducts.length > 0 ? (
              <DataTable columns={topProductsColumns} data={report.topProducts} />
            ) : (
              <p className="text-sm text-muted-foreground">No products sold in this session.</p>
            )}
          </div>

          {/* Expenses & Income entries */}
          <div>
            <h3 className="mb-3 font-semibold">Expenses & Income</h3>
            {report.cajaEntries.length > 0 ? (
              <>
                <DataTable columns={entriesColumns} data={report.cajaEntries} />
                <div className="mt-2 flex gap-4 text-sm">
                  <span>
                    Total Expenses:{' '}
                    <span className="text-red-400 font-mono">
                      ${report.summary.totalExpenses.toFixed(2)}
                    </span>
                  </span>
                  <span>
                    Total Income:{' '}
                    <span className="text-green-400 font-mono">
                      ${report.summary.totalIncome.toFixed(2)}
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No entries for this session.</p>
            )}
          </div>

          {/* Staff performance */}
          <div>
            <h3 className="mb-3 font-semibold">Staff Performance</h3>
            {report.staffSummary.length > 0 ? (
              <DataTable columns={staffColumns} data={report.staffSummary} />
            ) : (
              <p className="text-sm text-muted-foreground">No staff activity in this session.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
