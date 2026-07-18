/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * ManageCombosTab
 *
 * Top-level admin tab for combo CRUD. Lists combos, allows creating, editing,
 * and deleting combo products.
 *
 * Uses `const db = supabase as any` pre-regen cast — products/combo tables not yet
 * fully typed in supabase.types.ts.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCombos, comboKeys } from '@entities/combo';
import type { Product } from '@shared/lib/domain';
import i18n from '@shared/lib/i18n';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
import { ConfirmDialog } from '@shared/ui/ConfirmDialog';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { ComboAvailabilityEditor } from './ComboAvailabilityEditor';
import { ComboBuilderForm } from './ComboBuilderForm';

// Pre-regen cast — remove once supabase.types.ts is regenerated after combo migrations
const db = supabase as any;

// ============================================================================
// MUTATIONS
// ============================================================================

function useMutationCreateCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      /* eslint-disable i18next/no-literal-string -- Supabase query-builder table/column identifiers, not UI copy */
      const { data, error } = await db
        .from('products')
        .insert({
          name: i18n.t('featMgmt:manageCombos.tab.newComboDefaultName'),
          base_price: 0,
          is_combo: true,
          is_active: true,
          category_id: null,
        })
        .select('id')
        .single();
      /* eslint-enable i18next/no-literal-string */
      if (error) {
        logger.error('useMutationCreateCombo: insert failed', { error });
        throw error;
      }
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.lists() });
    },
  });
}

function useMutationDeleteCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('products').delete().eq('id', id);
      if (error) {
        logger.error('useMutationDeleteCombo: delete failed', { error, id });
        throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.all });
    },
  });
}

// ============================================================================
// MONEY HELPER
// ============================================================================

function formatPrice(product: Product): string {
  if (product.comboPriceOverride != null) {
    return `$${product.comboPriceOverride.toFixed(2)}`;
  }
  return i18n.t('featMgmt:manageCombos.tab.sumOfChildren');
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type ComboDialogState = { kind: 'edit'; comboId: string } | { kind: 'delete'; combo: Product };

export function ManageCombosTab() {
  const { t } = useTranslation('featMgmt');
  const { data: combos, isLoading, error: queryError } = useCombos();
  const createMutation = useMutationCreateCombo();
  const deleteMutation = useMutationDeleteCombo();

  const [dialogState, setDialogState] = useState<ComboDialogState | null>(null);

  async function handleCreate() {
    try {
      const newId = await createMutation.mutateAsync();
      setDialogState({ kind: 'edit', comboId: newId });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('manageCombos.tab.failedToCreateCombo'));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t('manageCombos.tab.comboDeleted'));
      setDialogState(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('manageCombos.tab.failedToDeleteCombo'));
    }
  }

  if (queryError) {
    return (
      <p className="text-sm text-destructive">
        {t('manageCombos.tab.loadError', { message: queryError.message })}
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('manageCombos.tab.loading')}</p>;
  }

  const resolvedCombos = combos ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('manageCombos.tab.headerHelp')}</p>
        <Button
          type="button"
          size="sm"
          disabled={createMutation.isPending}
          onClick={() => {
            void handleCreate();
          }}
        >
          {createMutation.isPending
            ? t('manageCombos.tab.creating')
            : t('manageCombos.tab.addComboButton')}
        </Button>
      </div>

      {resolvedCombos.length === 0 ? (
        <div className="rounded-md border px-4 py-10 text-center space-y-2">
          <p className="font-semibold text-base">{t('manageCombos.tab.emptyTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('manageCombos.tab.emptyHelp')}</p>
          <Button
            type="button"
            size="sm"
            className="mt-2"
            disabled={createMutation.isPending}
            onClick={() => {
              void handleCreate();
            }}
          >
            {t('manageCombos.tab.addCombo')}
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {resolvedCombos.map((combo: Product) => (
            <li key={combo.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{combo.name}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(combo)}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t('manageCombos.tab.editAria', { name: combo.name })}
                  onClick={() => {
                    setDialogState({ kind: 'edit', comboId: combo.id });
                  }}
                >
                  <Pencil className="size-3.5" />
                  <span className="ml-1 text-xs">{t('manageCombos.tab.edit')}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t('manageCombos.tab.deleteAria', { name: combo.name })}
                  onClick={() => {
                    setDialogState({ kind: 'delete', combo });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Edit dialog */}
      <Dialog
        open={dialogState?.kind === 'edit'}
        onOpenChange={o => {
          if (!o) setDialogState(null);
        }}
      >
        <DialogContent
          className="max-w-lg sm:max-w-lg overflow-y-auto max-h-[90vh]"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>{t('manageCombos.tab.editComboTitle')}</DialogTitle>
          </DialogHeader>
          {dialogState?.kind === 'edit' && (
            <div className="space-y-6">
              <ComboBuilderForm
                key={dialogState.comboId}
                comboId={dialogState.comboId}
                onSaved={() => {
                  // keep dialog open so user can continue editing availability
                }}
              />
              <div className="border-t pt-4">
                <ComboAvailabilityEditor comboId={dialogState.comboId} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      {dialogState?.kind === 'delete' && (
        <ConfirmDialog
          open
          title={t('manageCombos.tab.deleteComboTitle', { name: dialogState.combo.name })}
          description={t('manageCombos.tab.deleteComboDescription')}
          confirmLabel={t('manageCombos.tab.deleteComboConfirmLabel')}
          variant="destructive"
          isLoading={deleteMutation.isPending}
          onConfirm={() => {
            void handleDelete(dialogState.combo.id);
          }}
          onCancel={() => {
            setDialogState(null);
          }}
        />
      )}
    </div>
  );
}
