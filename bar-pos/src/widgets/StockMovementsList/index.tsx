/**
 * StockMovementsList widget
 *
 * Read-only append-only ledger for a single ingredient.
 * Rendered inside ManageIngredientsTab edit Dialog below a divider.
 * Delta cells colored green (positive) or red (negative).
 */
import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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

function refTypeLabel(refType: string | null | undefined, t: TFunction<'wPanels'>): string {
  switch (refType) {
    case 'order_item':
      return t('stockMovementsList.refTypeOrder');
    case 'refund':
      return t('stockMovementsList.refTypeRefund');
    case 'prep_production':
      return t('stockMovementsList.refTypePrep');
    case 'manual':
      return t('stockMovementsList.refTypeManual');
    case 'physical_count':
      return t('stockMovementsList.refTypeCount');
    default:
      return refType ?? '—';
  }
}

interface Props {
  ingredientId: string;
  uom: string;
}

export function StockMovementsList({ ingredientId, uom }: Props) {
  const { t } = useTranslation('wPanels');
  const { data: movements, isLoading, error } = useStockMovements(ingredientId);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {t('stockMovementsList.couldNotLoadMovements', { message: error.message })}
      </p>
    );
  }

  const columns: ColumnDef<StockMovement>[] = [
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: t('stockMovementsList.dateHeader'),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'quantityDelta',
      accessorKey: 'quantityDelta',
      header: t('stockMovementsList.changeHeader'),
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
      header: t('stockMovementsList.reasonHeader'),
      cell: ({ row }) => {
        const r = row.original.reason;
        return r.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      },
    },
    {
      id: 'refType',
      accessorKey: 'refType',
      header: t('stockMovementsList.sourceHeader'),
      cell: ({ row }) => refTypeLabel(row.original.refType, t),
    },
    {
      id: 'refId',
      accessorKey: 'refId',
      header: t('stockMovementsList.refHeader'),
      cell: ({ row }) => {
        const id = row.original.refId;
        if (!id) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="font-mono text-xs text-muted-foreground">
            {t('stockMovementsList.truncatedId', { id: id.slice(0, 8) })}
          </span>
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
          title={t('stockMovementsList.noMovementsRecordedTitle')}
          description={t('stockMovementsList.noMovementsRecordedDescription')}
        />
      }
    />
  );
}
