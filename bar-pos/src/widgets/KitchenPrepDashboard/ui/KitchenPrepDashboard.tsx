import type { ColumnDef } from '@tanstack/react-table';
import { ListOrdered, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PrepProductionForm } from '@features/produce-prep-batch';
import { useIngredientsActive } from '@entities/ingredient';
import { PrepOnHandCard, usePrepProductions, type PrepProduction } from '@entities/prep';
import { useStaffList } from '@entities/staff';
import { DataTable, EmptyState, POSButton } from '@shared/ui';

type BatchRow = PrepProduction & { ingredientName: string };

export function KitchenPrepDashboard() {
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
        ingredientName: ingById.get(p.prepIngredientId)?.name ?? 'Unknown',
      })),
    [productions, ingById],
  );

  const columns: ColumnDef<BatchRow>[] = useMemo(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Recorded',
        cell: ({ row }) =>
          new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
            row.original.createdAt,
          ),
      },
      {
        accessorKey: 'ingredientName',
        header: 'Prep item',
        cell: ({ row }) => row.original.ingredientName,
      },
      {
        accessorKey: 'qtyProduced',
        header: 'Qty',
        cell: ({ row }) => {
          const uom = ingById.get(row.original.prepIngredientId)?.uom ?? '';
          return (
            <span className="font-mono text-sm tabular-nums">
              {row.original.qtyProduced.toFixed(2)} {uom}
            </span>
          );
        },
      },
      {
        id: 'producedBy',
        header: 'Recorded by',
        cell: ({ row }) => {
          const id = row.original.producedBy;
          if (id == null) return '—';
          return staffById.get(id) ?? id.slice(0, 8);
        },
      },
      {
        accessorKey: 'notes',
        header: 'Notes',
        cell: ({ row }) => {
          const n = row.original.notes;
          if (n == null || n === '') return '—';
          return n.length > 40 ? `${n.slice(0, 40)}…` : n;
        },
      },
    ],
    [ingById, staffById],
  );

  return (
    <div className="space-y-8" aria-label="Kitchen prep dashboard">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5" aria-hidden />
            <h2 className="text-lg font-semibold">Prep on hand</h2>
          </div>
          <POSButton
            type="button"
            touchSize="large"
            aria-label="Record new prep batch"
            onClick={() => {
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            New batch
          </POSButton>
        </div>
        {prepIngredients.length === 0 && !ingLoading ? (
          <EmptyState
            icon={ListOrdered}
            title="No prep ingredients"
            description="Mark ingredients as prep in Settings → Ingredients."
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
          <ListOrdered className="h-5 w-5" aria-hidden />
          <h2 className="text-lg font-semibold">Recent batches</h2>
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
