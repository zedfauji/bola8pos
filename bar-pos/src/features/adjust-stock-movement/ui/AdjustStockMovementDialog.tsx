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
import { toast } from 'sonner';
import type { Ingredient, ManualAdjustReason } from '@entities/ingredient';
import { ingredientKeys } from '@entities/ingredient';
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

const REASON_LABELS: Record<ManualAdjustReason, string> = {
  waste: 'Waste',
  delivery: 'Delivery',
  correction: 'Correction',
  physical_count: 'Physical count',
};

const REASONS: ManualAdjustReason[] = ['waste', 'delivery', 'correction', 'physical_count'];

interface Props {
  ingredient: Ingredient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdjustStockMovementDialog({ ingredient, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<ManualAdjustReason | ''>('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const parsedDelta = parseFloat(delta);
      if (isNaN(parsedDelta) || parsedDelta === 0) {
        throw new Error('Quantity cannot be zero');
      }
      if (!reason) {
        throw new Error('Reason is required');
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
          throw new Error(
            'Insufficient stock. Use "Correction" or "Physical count" reason to force a negative balance.',
          );
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
      toast.success('Adjustment recorded');
      setDelta('');
      setReason('');
      setNotes('');
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Failed to record adjustment');
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
          <DialogTitle>Record adjustment — {ingredient.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="delta">Quantity change</Label>
            <Input
              id="delta"
              type="number"
              step="any"
              placeholder="e.g. -500 for waste"
              value={delta}
              onChange={e => {
                setDelta(e.target.value);
              }}
              disabled={mutation.isPending}
              required
            />
            <p className="text-xs text-muted-foreground">
              Positive to add stock, negative to remove (e.g. -500 for waste)
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <select
              id="reason"
              value={reason}
              onChange={e => {
                setReason(e.target.value as ManualAdjustReason | '');
              }}
              disabled={mutation.isPending}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                Select reason…
              </option>
              {REASONS.map(r => (
                <option key={r} value={r}>
                  {REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              type="text"
              placeholder="e.g. Weekly physical count — 3 trays of wings"
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
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !delta || !reason}>
              {mutation.isPending ? 'Saving…' : 'Record adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
