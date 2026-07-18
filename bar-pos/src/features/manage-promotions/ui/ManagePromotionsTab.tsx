/**
 * ManagePromotionsTab
 *
 * Top-level admin tab for promotion CRUD. Lists promotions, allows creating,
 * editing, and deleting. Clone of ManageCombosTab.tsx structure, adapted per
 * 20-UI-SPEC.md §1. All row summaries are cosmetic display only —
 * evaluate_promotions_for_item (server) is the sole writer of a charged price.
 */

import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  usePromotions,
  useMutationCreatePromotion,
  useMutationUpdatePromotion,
  useMutationDeletePromotion,
} from '@entities/promotion';
import type { Promotion, PromotionTargetType } from '@shared/lib/domain';
import i18n from '@shared/lib/i18n';
import { ConfirmDialog } from '@shared/ui/ConfirmDialog';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Switch } from '@shared/ui/switch';
import { PromotionAvailabilityEditor } from './PromotionAvailabilityEditor';
import { PromotionBuilderForm } from './PromotionBuilderForm';

// ============================================================================
// DISPLAY HELPERS (cosmetic only, never fed into a mutation as a final price)
// ============================================================================

/* eslint-disable i18next/no-literal-string -- Tailwind class strings, not UI copy */
const targetTypeBadgeClasses: Record<PromotionTargetType, string> = {
  item: 'bg-blue-500/20 text-blue-300',
  category: 'bg-purple-500/20 text-purple-300',
  pool_billing: 'bg-cyan-500/20 text-cyan-300',
  pool_grant: 'bg-amber-500/20 text-amber-300',
};
/* eslint-enable i18next/no-literal-string */

/* eslint-disable i18next/no-literal-string -- i18next key identifiers (looked up via t()), not literal UI copy themselves */
const targetTypeLabelKey: Record<PromotionTargetType, string> = {
  item: 'managePromotions.tab.targetTypeItem',
  category: 'managePromotions.tab.targetTypeCategory',
  pool_billing: 'managePromotions.tab.targetTypePoolBilling',
  pool_grant: 'managePromotions.tab.targetTypePoolGrant',
};
/* eslint-enable i18next/no-literal-string */

/** Row summary — cosmetic display only, never a charged price. */
function formatRowSummary(promo: Promotion): string {
  if (promo.targetType === 'pool_grant') {
    return i18n.t('featMgmt:managePromotions.tab.summaryPoolGrant', {
      minutes: promo.discountValue,
    });
  }
  switch (promo.discountType) {
    case 'percentage':
      return i18n.t('featMgmt:managePromotions.tab.summaryPercentage', {
        value: promo.discountValue,
      });
    case 'fixed_amount':
      return i18n.t('featMgmt:managePromotions.tab.summaryFixedAmount', {
        value: promo.discountValue.toFixed(2),
      });
    case 'fixed_price':
      return i18n.t('featMgmt:managePromotions.tab.summaryFixedPrice', {
        value: promo.discountValue.toFixed(2),
      });
    default:
      return '';
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type PromotionDialogState =
  | { kind: 'edit'; promotionId: string }
  | { kind: 'delete'; promotion: Promotion };

export function ManagePromotionsTab() {
  const { t } = useTranslation('featMgmt');
  const { data: promotions, isLoading, error: queryError } = usePromotions();
  const createMutation = useMutationCreatePromotion();
  const updateActiveMutation = useMutationUpdatePromotion();
  const deleteMutation = useMutationDeletePromotion();

  const [dialogState, setDialogState] = useState<PromotionDialogState | null>(null);

  async function handleCreate() {
    try {
      const newId = await createMutation.mutateAsync();
      setDialogState({ kind: 'edit', promotionId: newId });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('managePromotions.tab.failedToCreate'));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t('managePromotions.tab.promotionDeleted'));
      setDialogState(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('managePromotions.tab.failedToDelete'));
    }
  }

  function handleToggleActive(promo: Promotion, next: boolean) {
    updateActiveMutation.mutate(
      { id: promo.id, isActive: next },
      {
        onError: (e: unknown) => {
          toast.error(e instanceof Error ? e.message : t('managePromotions.tab.failedToUpdate'));
        },
      }
    );
  }

  if (queryError) {
    return (
      <p className="text-sm text-destructive">
        {t('managePromotions.tab.loadError', { message: queryError.message })}
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('managePromotions.tab.loading')}</p>;
  }

  const resolvedPromotions = promotions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('managePromotions.tab.headerHelp')}</p>
        <Button
          type="button"
          size="sm"
          disabled={createMutation.isPending}
          onClick={() => {
            void handleCreate();
          }}
        >
          {createMutation.isPending
            ? t('managePromotions.tab.creating')
            : t('managePromotions.tab.addPromotionButton')}
        </Button>
      </div>

      {resolvedPromotions.length === 0 ? (
        <div className="rounded-md border px-4 py-10 text-center space-y-2">
          <p className="font-semibold text-base">{t('managePromotions.tab.emptyTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('managePromotions.tab.emptyHelp')}</p>
          <Button
            type="button"
            size="sm"
            className="mt-2"
            disabled={createMutation.isPending}
            onClick={() => {
              void handleCreate();
            }}
          >
            {t('managePromotions.tab.addPromotion')}
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {resolvedPromotions.map((promo: Promotion) => (
            <li key={promo.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{promo.name}</p>
                <p className="text-xs text-muted-foreground">{formatRowSummary(promo)}</p>
              </div>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${targetTypeBadgeClasses[promo.targetType]}`}
              >
                {t(targetTypeLabelKey[promo.targetType])}
              </span>
              <Switch
                checked={promo.isActive}
                aria-label={t('managePromotions.tab.activeAria', { name: promo.name })}
                onCheckedChange={checked => {
                  handleToggleActive(promo, checked);
                }}
              />
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t('managePromotions.tab.editAria', { name: promo.name })}
                  onClick={() => {
                    setDialogState({ kind: 'edit', promotionId: promo.id });
                  }}
                >
                  <Pencil className="size-3.5" />
                  <span className="ml-1 text-xs">{t('managePromotions.tab.edit')}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t('managePromotions.tab.deleteAria', { name: promo.name })}
                  onClick={() => {
                    setDialogState({ kind: 'delete', promotion: promo });
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
        <DialogContent className="max-w-lg sm:max-w-lg overflow-y-auto max-h-[90vh]" showCloseButton>
          <DialogHeader>
            <DialogTitle>{t('managePromotions.tab.editPromotionTitle')}</DialogTitle>
          </DialogHeader>
          {dialogState?.kind === 'edit' && (
            <div className="space-y-6">
              <PromotionBuilderForm
                key={dialogState.promotionId}
                promotionId={dialogState.promotionId}
                onSaved={() => {
                  // keep dialog open so user can continue editing availability
                }}
              />
              <div className="border-t pt-4">
                <PromotionAvailabilityEditor promotionId={dialogState.promotionId} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      {dialogState?.kind === 'delete' && (
        <ConfirmDialog
          open
          title={t('managePromotions.tab.deletePromotionTitle', {
            name: dialogState.promotion.name,
          })}
          description={t('managePromotions.tab.deletePromotionDescription')}
          confirmLabel={t('managePromotions.tab.deletePromotionConfirmLabel')}
          variant="destructive"
          isLoading={deleteMutation.isPending}
          onConfirm={() => {
            void handleDelete(dialogState.promotion.id);
          }}
          onCancel={() => {
            setDialogState(null);
          }}
        />
      )}
    </div>
  );
}
