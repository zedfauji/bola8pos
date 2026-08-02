import type { ColumnDef } from '@tanstack/react-table';
import { ListOrdered, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PrepProductionForm } from '@features/produce-prep-batch';
import { useIngredientsActive } from '@entities/ingredient';
import { PrepOnHandCard, usePrepProductions, type PrepProduction } from '@entities/prep';
import { useStaffList } from '@entities/staff';
import { DataTable, EmptyState, POSButton } from '@shared/ui';

type BatchRow = PrepProduction & { ingredientName: string };

export function KitchenPrepDashboard() {
  const { t } = useTranslation('wPanels');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: ingredients = [], isLoading: ingLoading } = useIngredientsActive();
  const prepIngredients = useMemo(() => ingredients.filter(i => i.isPrep), [ingredients]);
  const { data: productions = [], isLoading: prodLoading } = usePrepProductions();
  const { data: staffList = [] } = useStaffList();

  const staffById = useMemo(() => new Map(staffList.map(s => [s.id, s.name] as const)), [staffList]);
  const ingById = useMemo(() => new Map(ingredients.map(i => [i.id, i] as const)), [ingredients]);

  const batchRows: BatchRow[] = useMemo(
    () =>
      productions.map(p => ({
        ...p,
        ingredientName: ingById.get(p.prepIngredientId)?.name ?? t('kitchenPrepDashboard.unknown'),
      })),
    [productions, ingById, t],
  );

  const columns: ColumnDef<BatchRow>[] = useMemo(
    () => [
      {
        accessorKey: 'createdAt',
        header: t('kitchenPrepDashboard.recordedHeader'),
        cell: ({ row }) =>
          // eslint-disable-next-line i18next/no-literal-string -- fixed Intl locale identifier, not UI copy
          new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
            row.original.createdAt,
          ),
      },
      {
        accessorKey: 'ingredientName',
        header: t('kitchenPrepDashboard.prepItemHeader'),
        cell: ({ row }) => row.original.ingredientName,
      },
      {
        accessorKey: 'qtyProduced',
        header: t('kitchenPrepDashboard.qtyHeader'),
        cell: ({ row }) => {
          const uom = ingById.get(row.original.prepIngredientId)?.uom ?? '';
          return (
            <span className="font-mono text-sm tabular-nums">
              {/* eslint-disable-next-line no-restricted-syntax -- quantity in a unit of measure (uom), not money; the money formatter would wrongly print a currency symbol here */}
              {row.original.qtyProduced.toFixed(2)} {uom}
            </span>
          );
        },
      },
      {
        id: 'producedBy',
        header: t('kitchenPrepDashboard.recordedByHeader'),
        cell: ({ row }) => {
          const id = row.original.producedBy;
          if (id == null) return '—';
          return staffById.get(id) ?? id.slice(0, 8);
        },
      },
      {
        accessorKey: 'notes',
        header: t('kitchenPrepDashboard.notesHeader'),
        cell: ({ row }) => {
          const n = row.original.notes;
          if (n == null || n === '') return '—';
          return n.length > 40 ? `${n.slice(0, 40)}…` : n;
        },
      },
    ],
    [ingById, staffById, t],
  );

  return (
    <div className="space-y-8" aria-label={t('kitchenPrepDashboard.dashboardAriaLabel')}>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListOrdered className="size-5" aria-hidden />
            <h2 className="text-lg font-semibold">{t('kitchenPrepDashboard.prepOnHand')}</h2>
          </div>
          <POSButton
            type="button"
            touchSize="large"
            aria-label={t('kitchenPrepDashboard.recordNewBatchAriaLabel')}
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden />
            {t('kitchenPrepDashboard.newBatch')}
          </POSButton>
        </div>
        {prepIngredients.length === 0 && !ingLoading ? (
          <EmptyState
            icon={ListOrdered}
            title={t('kitchenPrepDashboard.noPrepIngredientsTitle')}
            description={t('kitchenPrepDashboard.markIngredientsDescription')}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {prepIngredients.map(i => (
              <PrepOnHandCard
                key={i.id}
                name={i.name}
                uom={i.uom}
                qtyOnHand={i.quantityOnHand}
                reorderPoint={i.reorderPoint ?? null}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <ListOrdered className="size-5" aria-hidden />
          <h2 className="text-lg font-semibold">{t('kitchenPrepDashboard.recentBatches')}</h2>
        </div>
        <DataTable columns={columns} data={batchRows} isLoading={prodLoading} />
      </section>

      <PrepProductionForm
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
