/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * ManageIngredientsTab (widget layer)
 *
 * Top-level Settings tab for ingredient management.
 * Composes IngredientsTable + StockMovementsList (widgets) + IngredientForm +
 * CsvImportSheet + AdjustStockMovementDialog (features).
 *
 * Lives in widgets/ because FSD forbids features from importing widgets —
 * this component needs both layers.
 *
 * Uses supabase as any pre-regen cast for ingredient mutations.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { IngredientsTable } from '@widgets/IngredientsTable';
import { StockMovementsList } from '@widgets/StockMovementsList';
import { AdjustStockMovementDialog } from '@features/adjust-stock-movement';
import { CsvImportSheet } from '@features/import-ingredients-csv';
import { IngredientForm } from '@features/manage-ingredients';
import { useIngredients, ingredientKeys } from '@entities/ingredient';
import type { Ingredient, IngredientCreate } from '@entities/ingredient';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
import { ConfirmDialog } from '@shared/ui/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';

const db = supabase as any;

// ============================================================================
// Mutation hooks
// ============================================================================

function useMutationCreateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IngredientCreate) => {
      const { error } = await db.from('ingredients').insert({
        name: input.name,
        uom: input.uom,
        purchase_uom: input.purchaseUom ?? null,
        purchase_to_base_factor: input.purchaseToBaseFactor,
        cost_per_base_unit: input.costPerBaseUnit,
        reorder_point: input.reorderPoint ?? null,
        is_prep: input.isPrep,
        is_active: true,
        category: input.category ?? null,
      });
      if (error) {
        logger.error('useMutationCreateIngredient: insert failed', { error });
        throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ingredientKeys.lists() });
      toast.success('Ingredient added');
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Failed to save ingredient');
    },
  });
}

function useMutationUpdateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: IngredientCreate }) => {
      const { error } = await db
        .from('ingredients')
        .update({
          name: input.name,
          uom: input.uom,
          purchase_uom: input.purchaseUom ?? null,
          purchase_to_base_factor: input.purchaseToBaseFactor,
          cost_per_base_unit: input.costPerBaseUnit,
          reorder_point: input.reorderPoint ?? null,
          is_prep: input.isPrep,
          is_active: input.isActive,
          category: input.category ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) {
        logger.error('useMutationUpdateIngredient: update failed', { error });
        throw error;
      }
    },
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ingredientKeys.lists() });
      void qc.invalidateQueries({ queryKey: ingredientKeys.detail(id) });
      toast.success('Ingredient saved');
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Failed to save ingredient');
    },
  });
}

function useMutationDeleteIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete — set is_active=false to preserve ledger history
      const { error } = await db
        .from('ingredients')
        .update({ is_active: false })
        .eq('id', id);
      if (error) {
        logger.error('useMutationDeleteIngredient: soft delete failed', { error });
        throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ingredientKeys.lists() });
      toast.success('Ingredient removed');
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Failed to delete ingredient');
    },
  });
}

// ============================================================================
// Dialog state union
// ============================================================================

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit'; ingredient: Ingredient }
  | { kind: 'delete'; ingredient: Ingredient }
  | { kind: 'adjust'; ingredient: Ingredient };

// ============================================================================
// Component
// ============================================================================

export function ManageIngredientsTab() {
  const { data: ingredients, isLoading, error: queryError } = useIngredients();
  const createMutation = useMutationCreateIngredient();
  const updateMutation = useMutationUpdateIngredient();
  const deleteMutation = useMutationDeleteIngredient();

  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [csvSheetOpen, setCsvSheetOpen] = useState(false);

  if (queryError) {
    return (
      <p className="text-sm text-destructive">
        Could not load ingredients: {queryError.message}
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading ingredients…</p>;
  }

  function handleCreate(data: IngredientCreate) {
    createMutation.mutate(data, {
      onSuccess: () => {
        setDialogState(null);
      },
    });
  }

  function handleEdit(data: IngredientCreate) {
    if (dialogState?.kind !== 'edit') return;
    updateMutation.mutate(
      { id: dialogState.ingredient.id, input: data },
      {
        onSuccess: () => {
          setDialogState(null);
        },
      },
    );
  }

  function handleDelete() {
    if (dialogState?.kind !== 'delete') return;
    deleteMutation.mutate(dialogState.ingredient.id, {
      onSuccess: () => {
        setDialogState(null);
      },
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Manage raw ingredients and prep items. Stock levels update automatically when orders are
        processed.
      </p>

      <IngredientsTable
        ingredients={ingredients ?? []}
        isLoading={isLoading}
        onAddClick={() => {
          setDialogState({ kind: 'create' });
        }}
        onEditClick={ingredient => {
          setDialogState({ kind: 'edit', ingredient });
        }}
        onDeleteClick={ingredient => {
          setDialogState({ kind: 'delete', ingredient });
        }}
        onImportClick={() => {
          setCsvSheetOpen(true);
        }}
      />

      {/* Create Dialog */}
      <Dialog
        open={dialogState?.kind === 'create'}
        onOpenChange={o => {
          if (!o) setDialogState(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>New ingredient</DialogTitle>
          </DialogHeader>
          {dialogState?.kind === 'create' && (
            <IngredientForm
              ingredient={null}
              isPending={createMutation.isPending}
              onSubmit={handleCreate}
              onCancel={() => {
                setDialogState(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog — includes StockMovementsList + "Record adjustment" button */}
      <Dialog
        open={dialogState?.kind === 'edit'}
        onOpenChange={o => {
          if (!o && dialogState?.kind === 'edit') setDialogState(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {dialogState?.kind === 'edit' ? `Edit "${dialogState.ingredient.name}"` : 'Edit'}
            </DialogTitle>
          </DialogHeader>
          {dialogState?.kind === 'edit' && (
            <div className="space-y-6">
              <IngredientForm
                key={dialogState.ingredient.id}
                ingredient={dialogState.ingredient}
                isPending={updateMutation.isPending}
                onSubmit={handleEdit}
                onCancel={() => {
                  setDialogState(null);
                }}
              />
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Stock movements</h3>
                  <button
                    type="button"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                    onClick={() => {
                      setDialogState({ kind: 'adjust', ingredient: dialogState.ingredient });
                    }}
                  >
                    Record adjustment
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Append-only ledger for {dialogState.ingredient.name}. All adjustments and sales
                  are recorded here.
                </p>
                <StockMovementsList
                  ingredientId={dialogState.ingredient.id}
                  uom={dialogState.ingredient.uom}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete ConfirmDialog */}
      {dialogState?.kind === 'delete' && (
        <ConfirmDialog
          open
          title={`Delete "${dialogState.ingredient.name}"?`}
          description="This will hide the ingredient from the list. Its stock movement history is preserved and it can be restored from the database if needed."
          confirmLabel="Delete ingredient"
          variant="destructive"
          isLoading={deleteMutation.isPending}
          onConfirm={handleDelete}
          onCancel={() => {
            setDialogState(null);
          }}
        />
      )}

      {/* Adjust stock movement dialog */}
      {dialogState?.kind === 'adjust' && (
        <AdjustStockMovementDialog
          ingredient={dialogState.ingredient}
          open
          onOpenChange={o => {
            if (!o) setDialogState(null);
          }}
        />
      )}

      {/* CSV Import Sheet */}
      <CsvImportSheet open={csvSheetOpen} onOpenChange={setCsvSheetOpen} />
    </div>
  );
}
