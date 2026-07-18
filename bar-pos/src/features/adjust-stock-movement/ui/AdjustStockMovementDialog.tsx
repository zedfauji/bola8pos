/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * AdjustStockMovementDialog
 *
 * Manual stock adjustment for a single ingredient.
 * Calls record_stock_movement RPC with p_ref_type='manual'.
 * Uses supabase as any pre-regen cast — ingredients/stock_movements not in supabase.types.ts yet.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Ingredient, ManualAdjustReason } from '@entities/ingredient';
import { ingredientKeys } from '@entities/ingredient';
import i18n from '@shared/lib/i18n';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
import { Button } from '@shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';

const TERMINAL_ID = (import.meta.env.VITE_TERMINAL_ID as string | undefined) ?? 'POS-1';

/* eslint-disable i18next/no-literal-string -- i18next key identifiers (looked up via t()), not literal UI copy themselves */
const REASON_LABEL_KEYS: Record<ManualAdjustReason, string> = {
  waste: 'adjustStockMovement.reasonWaste',
  delivery: 'adjustStockMovement.reasonDelivery',
  correction: 'adjustStockMovement.reasonCorrection',
  physical_count: 'adjustStockMovement.reasonPhysicalCount',
};
/* eslint-enable i18next/no-literal-string */

const REASONS: ManualAdjustReason[] = ['waste', 'delivery', 'correction', 'physical_count'];

interface Props {
  ingredient: Ingredient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdjustStockMovementDialog({ ingredient, open, onOpenChange }: Props) {
  const { t } = useTranslation('featMgmt');
  const qc = useQueryClient();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<ManualAdjustReason | ''>('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const parsedDelta = parseFloat(delta);
      if (isNaN(parsedDelta) || parsedDelta === 0) {
        throw new Error(i18n.t('featMgmt:adjustStockMovement.quantityCannotBeZero'));
      }
      if (!reason) {
        throw new Error(i18n.t('featMgmt:adjustStockMovement.reasonRequired'));
      }

      const { error } = await (supabase as any).rpc('record_stock_movement', {
        p_ingredient_id: ingredient.id,
        p_delta: parsedDelta.toString(), // string to preserve numeric precision — RESEARCH.md Pitfall 1
        p_reason: reason,
        p_ref_type: 'manual',
        p_ref_id: null,
        p_notes: notes.trim().length > 0 ? notes.trim() : null,
        p_terminal_id: TERMINAL_ID,
      });

      if (error) {
        logger.error('AdjustStockMovementDialog: rpc failed', { error });
        if ((error.message as string).includes('INVENTORY_NEGATIVE')) {
          throw new Error(i18n.t('featMgmt:adjustStockMovement.insufficientStock'));
        }
        throw new Error(error.message as string);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ingredientKeys.lists() });
      void qc.invalidateQueries({
        queryKey: ingredientKeys.movements(ingredient.id),
      });
      void qc.invalidateQueries({ queryKey: ingredientKeys.detail(ingredient.id) });
      toast.success(t('adjustStockMovement.adjustmentRecorded'));
      setDelta('');
      setReason('');
      setNotes('');
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t('adjustStockMovement.failedToRecord'));
      // Do NOT close dialog on error — let user correct reason or quantity
    },
  });

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {t('adjustStockMovement.dialogTitle', { name: ingredient.name })}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="delta">{t('adjustStockMovement.quantityChangeLabel')}</Label>
            <Input
              id="delta"
              type="number"
              step="any"
              placeholder={t('adjustStockMovement.quantityChangePlaceholder')}
              value={delta}
              onChange={e => {
                setDelta(e.target.value);
              }}
              disabled={mutation.isPending}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t('adjustStockMovement.quantityChangeHelp')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">{t('adjustStockMovement.reasonLabel')}</Label>
            <select
              id="reason"
              value={reason}
              onChange={e => {
                setReason(e.target.value as ManualAdjustReason | '');
              }}
              disabled={mutation.isPending}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                {t('adjustStockMovement.selectReason')}
              </option>
              {REASONS.map(r => (
                <option key={r} value={r}>
                  {t(REASON_LABEL_KEYS[r])}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">{t('adjustStockMovement.notesLabel')}</Label>
            <Input
              id="notes"
              type="text"
              placeholder={t('adjustStockMovement.notesPlaceholder')}
              value={notes}
              onChange={e => {
                setNotes(e.target.value);
              }}
              maxLength={200}
              disabled={mutation.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
              disabled={mutation.isPending}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !delta || !reason}>
              {mutation.isPending
                ? t('common:actions.saving')
                : t('adjustStockMovement.recordAdjustment')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
