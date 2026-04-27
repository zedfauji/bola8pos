/**
 * StockMovementsList widget
 *
 * Read-only append-only ledger for a single ingredient.
 * Rendered inside ManageIngredientsTab edit Dialog below a divider.
 * Delta cells colored green (positive) or red (negative).
 */
import type { ColumnDef } from '@tanstack/react-table';
import { History } from 'lucide-react';
import { useStockMovements } from '@entities/ingredient';
import type { StockMovement } from '@shared/lib/domain';
import { DataTable } from '@shared/ui/DataTable';
import { EmptyState } from '@shared/ui/EmptyState';

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

function refTypeLabel(refType: string | null | undefined): string {
  switch (refType) {
    case 'order_item':
      return 'Order';
    case 'refund':
      return 'Refund';
    case 'prep_production':
      return 'Prep';
    case 'manual':
      return 'Manual';
    case 'physical_count':
      return 'Count';
    default:
      return refType ?? '—';
  }
}

interface Props {
  ingredientId: string;
  uom: string;
}

export function StockMovementsList({ ingredientId, uom }: Props) {
  const { data: movements, isLoading, error } = useStockMovements(ingredientId);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load movements: {error.message}
      </p>
    );
  }

  const columns: ColumnDef<StockMovement>[] = [
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'quantityDelta',
      accessorKey: 'quantityDelta',
      header: 'Change',
      cell: ({ row }) => {
        const delta = row.original.quantityDelta;
        const isPositive = delta > 0;
        return (
          <span
            className={`font-mono text-sm ${isPositive ? 'text-pos-accent' : 'text-pos-danger'}`}
          >
            {isPositive ? '+' : ''}
            {delta} {uom}
          </span>
        );
      },
    },
    {
      id: 'reason',
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => {
        const r = row.original.reason;
        return r.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      },
    },
    {
      id: 'refType',
      accessorKey: 'refType',
      header: 'Source',
      cell: ({ row }) => refTypeLabel(row.original.refType),
    },
    {
      id: 'refId',
      accessorKey: 'refId',
      header: 'Ref',
      cell: ({ row }) => {
        const id = row.original.refId;
        if (!id) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="font-mono text-xs text-muted-foreground">{id.slice(0, 8)}…</span>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={movements ?? []}
      isLoading={isLoading}
      enableSorting
      initialSorting={[{ id: 'createdAt', desc: true }]}
      searchable={false}
      emptyState={
        <EmptyState
          icon={History}
          title="No movements recorded"
          description="Stock movements will appear here as orders are processed and adjustments are made."
        />
      }
    />
  );
}
