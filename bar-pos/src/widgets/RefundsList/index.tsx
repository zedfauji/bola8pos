/**
 * RefundsList widget
 *
 * Read-only DataTable of all processed refunds.
 * Rendered on the Refunds tab of PaymentsPage.
 */
import type { ColumnDef } from '@tanstack/react-table';
import { ReceiptText } from 'lucide-react';
import { useRefunds } from '@entities/refund';
import type { Refund } from '@shared/lib/domain';
import { DataTable } from '@shared/ui/DataTable';
import { EmptyState } from '@shared/ui/EmptyState';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { Badge } from '@shared/ui/badge';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function capitalizeReason(reason: string): string {
  return reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const columns: ColumnDef<Refund>[] = [
  {
    id: 'created_at',
    accessorKey: 'createdAt',
    header: 'Date',
    cell: ({ row }) => (
      <span className="font-mono text-sm text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: 'original_payment_id',
    accessorKey: 'originalPaymentId',
    header: 'Payment ref',
    cell: ({ row }) => (
      <span className="font-mono text-sm text-muted-foreground">
        {row.original.originalPaymentId.slice(0, 8)}…
      </span>
    ),
  },
  {
    id: 'reason',
    accessorKey: 'reason',
    header: 'Reason',
    cell: ({ row }) => (
      <span className="text-sm">{capitalizeReason(row.original.reason)}</span>
    ),
  },
  {
    id: 'items_count',
    header: 'Items',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.items.length} item(s)</span>
    ),
  },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    enableSorting: true,
    cell: ({ row }) => (
      <MoneyDisplay amount={row.original.amount} size="sm" negative={true} />
    ),
  },
  {
    id: 'restocked',
    header: 'Restocked',
    cell: ({ row }) => {
      const hasRestock = row.original.items.some(i => i.restock);
      return hasRestock ? (
        <Badge variant="outline" className="text-pos-accent border-pos-accent">
          Yes
        </Badge>
      ) : (
        <Badge variant="outline">No</Badge>
      );
    },
  },
  {
    id: 'created_by',
    header: 'Staff',
    cell: ({ row }) => (
      <span className="font-mono text-sm text-muted-foreground">
        {row.original.createdBy.slice(0, 8)}…
      </span>
    ),
  },
];

export function RefundsList() {
  const { data: refunds, isLoading } = useRefunds();

  return (
    <DataTable
      columns={columns}
      data={refunds ?? []}
      isLoading={isLoading}
      enableSorting
      initialSorting={[{ id: 'created_at', desc: true }]}
      searchable={false}
      emptyState={
        <EmptyState
          icon={ReceiptText}
          title="No refunds yet"
          description="Refunds processed on paid orders will appear here."
        />
      }
    />
  );
}
