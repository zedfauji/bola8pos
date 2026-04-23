import { useState } from 'react';
import { toast } from 'sonner';
import { useInventory } from '@entities/inventory';
import { useStaffStore } from '@entities/staff/model/store';
import { logger } from '@shared/lib/logger-instance';
import { Button } from '@shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Skeleton } from '@shared/ui/skeleton';
import type { PhysicalCountVarianceRow } from '../model/usePhysicalCount';
import { usePhysicalCount } from '../model/usePhysicalCount';
import { VarianceReport } from './VarianceReport';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Phase = 'entry' | 'report';

/**
 * Physical Inventory Count dialog.
 *
 * Phase 1 (entry): Shows all products with a number input pre-filled with
 *   current stock. Manager adjusts actuals and submits.
 *
 * Phase 2 (report): Shows the VarianceReport for the submitted count.
 *   Manager can close or run another count.
 */
export function PhysicalCountForm({ open, onOpenChange }: Props) {
  const { data: inventory, isIdleOrLoading } = useInventory();
  const staffId = useStaffStore(s => s.currentStaff?.id);

  const { submitPhysicalCount, isPending } = usePhysicalCount();

  // Local state: productId → actual count input value
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [phase, setPhase] = useState<Phase>('entry');
  const [varianceRows, setVarianceRows] = useState<PhysicalCountVarianceRow[]>([]);

  // When dialog opens/closes, reset form state
  function handleOpenChange(next: boolean) {
    if (!next) {
      setCounts(new Map());
      setPhase('entry');
      setVarianceRows([]);
    }
    onOpenChange(next);
  }

  function getCount(productId: string, fallback: number): number {
    return counts.get(productId) ?? fallback;
  }

  function handleCountChange(productId: string, raw: string) {
    const parsed = parseInt(raw, 10);
    setCounts(prev => {
      const next = new Map(prev);
      next.set(productId, isNaN(parsed) || parsed < 0 ? 0 : parsed);
      return next;
    });
  }

  async function handleSubmit() {
    if (!inventory || !staffId) {
      toast.error('Cannot submit: inventory data or staff session is missing.');
      return;
    }

    // Build final entries map: productId → actual count
    const entries = new Map<string, number>();
    for (const item of inventory) {
      entries.set(item.productId, getCount(item.productId, item.quantityOnHand));
    }

    const result = await submitPhysicalCount({ entries, inventory, staffId });

    if (!result.ok) {
      logger.error('physical_count.submit_failed', { message: result.error.message });
      toast.error(`Physical count failed: ${result.error.message}`);
      return;
    }

    toast.success(
      result.data.adjustedRows.length === 0
        ? 'Physical count complete — no variances found.'
        : `Physical count complete — ${String(result.data.adjustedRows.length)} product(s) adjusted.`
    );

    setVarianceRows(result.data.allRows);
    setPhase('report');
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Physical Inventory Count</DialogTitle>
          <DialogDescription>
            {phase === 'entry'
              ? 'Enter the actual quantity on hand for each product. Leave unchanged if the count matches.'
              : 'Review the variance report. Red rows indicate a shortage; green rows indicate a surplus.'}
          </DialogDescription>
        </DialogHeader>

        {phase === 'entry' ? (
          <>
            <div className="max-h-[60vh] overflow-auto space-y-2 py-2">
              {isIdleOrLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))
              ) : !inventory || inventory.length === 0 ? (
                <p
                  className="text-center text-sm text-muted-foreground py-4"
                  data-testid="physical-count-empty"
                >
                  No inventory items found.
                </p>
              ) : (
                inventory.map(item => (
                  <div
                    key={item.productId}
                    data-testid={`physical-count-row-${item.productId}`}
                    className="flex items-center gap-4 rounded-md border px-3 py-2"
                  >
                    <Label
                      htmlFor={`count-${item.productId}`}
                      className="flex-1 text-sm font-medium truncate"
                    >
                      {item.product?.name ?? 'Unknown'}
                    </Label>
                    <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
                      Expected: {item.quantityOnHand}
                    </span>
                    <Input
                      id={`count-${item.productId}`}
                      type="number"
                      min={0}
                      value={getCount(item.productId, item.quantityOnHand)}
                      onChange={e => {
                        handleCountChange(item.productId, e.target.value);
                      }}
                      className="w-24 text-right shrink-0"
                    />
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  handleOpenChange(false);
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                data-testid="physical-count-submit"
                onClick={() => {
                  void handleSubmit();
                }}
                disabled={isPending || isIdleOrLoading || !inventory}
              >
                {isPending ? 'Saving…' : 'Submit Count'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <VarianceReport rows={varianceRows} />

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCounts(new Map());
                  setPhase('entry');
                  setVarianceRows([]);
                }}
              >
                New Count
              </Button>
              <Button
                onClick={() => {
                  handleOpenChange(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
