import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useStaffStore } from '@entities/staff/model/store';
import type { Order } from '@shared/lib/domain';
import { ConfirmDialog, Input, MoneyDisplay } from '@shared/ui';
import { useVoidOrder } from '../model/useVoidOrder';

type VoidOrderDialogProps = {
  open: boolean;
  tabId: string;
  order: Order | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

function formatOrderTime(date: Date): string {
  return date.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

function calculateOrderTotal(order: Order): number {
  return order.items.reduce(
    (sum, item) => sum + (item.unitPrice + item.modifierPriceDelta) * item.quantity,
    0
  );
}

export function VoidOrderDialog({
  open,
  tabId,
  order,
  onOpenChange,
  onSuccess,
}: VoidOrderDialogProps) {
  const currentStaff = useStaffStore(state => state.currentStaff);
  const { voidOrder, isPending } = useVoidOrder();
  const [reason, setReason] = useState('');

  const total = useMemo(() => (order ? calculateOrderTotal(order) : 0), [order]);
  const trimmedReason = reason.trim();
  const canConfirm = Boolean(order) && trimmedReason.length > 0 && Boolean(currentStaff?.id);

  const handleClose = () => {
    if (!isPending) {
      setReason('');
      onOpenChange(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title="Void order?"
      description="This will mark the order voided, restore inventory, and remove it from tab totals."
      confirmLabel="Void order"
      confirmClassName="min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring"
      variant="destructive"
      isLoading={isPending}
      confirmDisabled={!canConfirm}
      onCancel={handleClose}
      onConfirm={async () => {
        if (!order || !currentStaff?.id) return;

        const result = await voidOrder({
          tabId,
          order,
          reason: trimmedReason,
          staffId: currentStaff.id,
        });

        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }

        toast.success('Order voided.');
        handleClose();
        onSuccess?.();
      }}
    >
      {order && (
        <div className="space-y-4">
          <div className="rounded-md border border-border/70 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Order time</span>
              <span>{formatOrderTime(order.createdAt)}</span>
            </div>
            <ul className="mt-3 space-y-2">
              {order.items.map(item => (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {item.quantity}x {item.product?.name ?? 'Unknown item'}
                  </span>
                  <MoneyDisplay
                    amount={(item.unitPrice + item.modifierPriceDelta) * item.quantity}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2 font-semibold">
              <span>Total voided</span>
              <MoneyDisplay amount={total} size="sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="void-order-reason" className="text-sm font-medium">
              Void reason
            </label>
            <Input
              id="void-order-reason"
              value={reason}
              onChange={event => {
                setReason(event.target.value);
              }}
              placeholder="Required reason"
              required
            />
          </div>
        </div>
      )}
    </ConfirmDialog>
  );
}
