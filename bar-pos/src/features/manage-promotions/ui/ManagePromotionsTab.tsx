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
import { toast } from 'sonner';
import {
  usePromotions,
  useMutationCreatePromotion,
  useMutationUpdatePromotion,
  useMutationDeletePromotion,
} from '@entities/promotion';
import type { Promotion, PromotionTargetType } from '@shared/lib/domain';
import { ConfirmDialog } from '@shared/ui/ConfirmDialog';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Switch } from '@shared/ui/switch';
import { PromotionAvailabilityEditor } from './PromotionAvailabilityEditor';
import { PromotionBuilderForm } from './PromotionBuilderForm';

// ============================================================================
// DISPLAY HELPERS (cosmetic only, never fed into a mutation as a final price)
// ============================================================================

const targetTypeBadgeClasses: Record<PromotionTargetType, string> = {
  item: 'bg-blue-500/20 text-blue-300',
  category: 'bg-purple-500/20 text-purple-300',
  pool_billing: 'bg-cyan-500/20 text-cyan-300',
  pool_grant: 'bg-amber-500/20 text-amber-300',
};

const targetTypeLabel: Record<PromotionTargetType, string> = {
  item: 'Item',
  category: 'Category',
  pool_billing: 'Pool billing',
  pool_grant: 'Pool bonus',
};

/** Row summary — cosmetic display only, never a charged price. */
function formatRowSummary(promo: Promotion): string {
  if (promo.targetType === 'pool_grant') {
    return `+${String(promo.discountValue)} min pool time`;
  }
  switch (promo.discountType) {
    case 'percentage':
      return `${String(promo.discountValue)}% off`;
    case 'fixed_amount':
      return `-$${promo.discountValue.toFixed(2)}`;
    case 'fixed_price':
      return `Fixed at $${promo.discountValue.toFixed(2)}`;
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
      toast.error(e instanceof Error ? e.message : 'Failed to create promotion');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Promotion deleted');
      setDialogState(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete promotion');
    }
  }

  function handleToggleActive(promo: Promotion, next: boolean) {
    updateActiveMutation.mutate(
      { id: promo.id, isActive: next },
      {
        onError: (e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Failed to update promotion');
        },
      }
    );
  }

  if (queryError) {
    return (
      <p className="text-sm text-destructive">Could not load promotions: {queryError.message}</p>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading promotions…</p>;
  }

  const resolvedPromotions = promotions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Manage promotions — automatic discounts on items, categories, or pool time during set
          hours.
        </p>
        <Button
          type="button"
          size="sm"
          disabled={createMutation.isPending}
          onClick={() => {
            void handleCreate();
          }}
        >
          {createMutation.isPending ? 'Creating…' : '+ Add promotion'}
        </Button>
      </div>

      {resolvedPromotions.length === 0 ? (
        <div className="rounded-md border px-4 py-10 text-center space-y-2">
          <p className="font-semibold text-base">No promotions yet</p>
          <p className="text-sm text-muted-foreground">
            Add a promotion to automatically discount items, categories, or pool time during set
            hours.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-2"
            disabled={createMutation.isPending}
            onClick={() => {
              void handleCreate();
            }}
          >
            Add promotion
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
                {targetTypeLabel[promo.targetType]}
              </span>
              <Switch
                checked={promo.isActive}
                aria-label={`${promo.name} active`}
                onCheckedChange={checked => {
                  handleToggleActive(promo, checked);
                }}
              />
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Edit ${promo.name}`}
                  onClick={() => {
                    setDialogState({ kind: 'edit', promotionId: promo.id });
                  }}
                >
                  <Pencil className="size-3.5" />
                  <span className="ml-1 text-xs">Edit</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Delete ${promo.name}`}
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
            <DialogTitle>Edit Promotion</DialogTitle>
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
          title={`Delete '${dialogState.promotion.name}'?`}
          description="This will remove the promotion. Orders that already applied it keep their recorded discount — nothing is retroactively changed."
          confirmLabel="Delete Promotion"
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
