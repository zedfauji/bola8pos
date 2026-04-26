/**
 * IngredientsTable widget
 *
 * DataTable rendering the ingredients list with low-stock row highlight.
 * Toolbar has "+ Add ingredient" and "Import CSV" buttons.
 * Used inside ManageIngredientsTab.
 */
import type { ColumnDef } from '@tanstack/react-table';
import { Package2, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Ingredient } from '@entities/ingredient';
import { ChefHatBadge, DataTable, EmptyState, POSButton } from '@shared/ui';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';

type PrepFilter = 'all' | 'prep' | 'raw';

interface Props {
  ingredients: Ingredient[];
  isLoading: boolean;
  onEditClick: (ingredient: Ingredient) => void;
  onDeleteClick: (ingredient: Ingredient) => void;
  onAddClick: () => void;
  onImportClick: () => void;
  /** External filter override. When provided, hides the internal filter toolbar buttons. */
  filterPrep?: 'prep' | 'raw' | 'all';
}

export function IngredientsTable({
  ingredients,
  isLoading,
  onEditClick,
  onDeleteClick,
  onAddClick,
  onImportClick,
  filterPrep,
}: Props) {
  const [prepFilter, setPrepFilter] = useState<PrepFilter>('all');
  const activePrepFilter: PrepFilter = filterPrep ?? prepFilter;

  const filteredIngredients = useMemo(() => {
    if (activePrepFilter === 'prep') return ingredients.filter(i => i.isPrep);
    if (activePrepFilter === 'raw') return ingredients.filter(i => !i.isPrep);
    return ingredients;
  }, [ingredients, activePrepFilter]);

  const columns: ColumnDef<Ingredient>[] = useMemo(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => {
          const item = row.original;
          const isLow =
            item.reorderPoint != null &&
            item.reorderPoint > 0 &&
            item.quantityOnHand <= item.reorderPoint;
          return (
            <div className="flex items-center gap-2">
              <span>{item.name}</span>
              {isLow ? (
                <Badge variant="destructive" className="px-1.5 py-0 text-xs">
                  Low stock
                </Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'category',
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => row.original.category ?? '—',
      },
      {
        id: 'uom',
        accessorKey: 'uom',
        header: 'Base unit',
        cell: ({ row }) => row.original.uom.toUpperCase(),
      },
      {
        id: 'quantityOnHand',
        accessorKey: 'quantityOnHand',
        header: 'Stock',
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.quantityOnHand} {row.original.uom}
          </span>
        ),
      },
      {
        id: 'reorderPoint',
        accessorKey: 'reorderPoint',
        header: 'Reorder at',
        cell: ({ row }) => {
          const rp = row.original.reorderPoint;
          if (rp == null || rp === 0) return '—';
          return (
            <span className="font-mono text-sm">
              {rp} {row.original.uom}
            </span>
          );
        },
      },
      {
        id: 'costPerBaseUnit',
        accessorKey: 'costPerBaseUnit',
        header: 'Cost/unit',
        cell: ({ row }) => (
          <span className="font-mono text-sm">${row.original.costPerBaseUnit.toFixed(4)}</span>
        ),
      },
      {
        id: 'isPrep',
        accessorKey: 'isPrep',
        header: 'Type',
        cell: ({ row }) =>
          row.original.isPrep ? (
            <ChefHatBadge />
          ) : (
            <Badge variant="outline" className="text-xs">
              Raw
            </Badge>
          ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Edit ${item.name}`}
                onClick={e => {
                  e.stopPropagation();
                  onEditClick(item);
                }}
              >
                <Pencil className="size-3.5" />
                <span className="ml-1 text-xs">Edit</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Delete ${item.name}`}
                onClick={e => {
                  e.stopPropagation();
                  onDeleteClick(item);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [onDeleteClick, onEditClick],
  );

  return (
    <DataTable
      columns={columns}
      data={filteredIngredients}
      isLoading={isLoading}
      enableSorting
      initialSorting={[{ id: 'name', desc: false }]}
      searchable
      searchPlaceholder="Search ingredients…"
      getRowClassName={row =>
        row.reorderPoint != null && row.reorderPoint > 0 && row.quantityOnHand <= row.reorderPoint
          ? 'bg-pos-danger/10'
          : ''
      }
      emptyState={
        <EmptyState
          icon={Package2}
          title="No ingredients yet"
          description="Add your first ingredient to start tracking stock levels."
          action={{
            label: 'Add ingredient',
            onClick: onAddClick,
          }}
        />
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {filterPrep == null && (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by prep type">
              <POSButton
                type="button"
                touchSize="default"
                variant={prepFilter === 'all' ? 'default' : 'outline'}
                aria-pressed={prepFilter === 'all'}
                onClick={() => {
                  setPrepFilter('all');
                }}
              >
                All
              </POSButton>
              <POSButton
                type="button"
                touchSize="default"
                variant={prepFilter === 'prep' ? 'default' : 'outline'}
                aria-pressed={prepFilter === 'prep'}
                onClick={() => {
                  setPrepFilter('prep');
                }}
              >
                Prep
              </POSButton>
              <POSButton
                type="button"
                touchSize="default"
                variant={prepFilter === 'raw' ? 'default' : 'outline'}
                aria-pressed={prepFilter === 'raw'}
                onClick={() => {
                  setPrepFilter('raw');
                }}
              >
                Raw
              </POSButton>
            </div>
          )}
          <Button type="button" size="sm" onClick={onAddClick}>
            + Add ingredient
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onImportClick}>
            Import CSV
          </Button>
        </div>
      }
      onRowClick={onEditClick}
    />
  );
}
