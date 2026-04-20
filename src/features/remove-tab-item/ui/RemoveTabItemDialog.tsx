import { toast } from 'sonner';

import type { OrderItem } from '@shared/lib/domain';
import { ConfirmDialog, MoneyDisplay } from '@shared/ui';

import { useRemoveTabItem } from '../useRemoveTabItem';

export interface RemoveTabItemDialogProps {
  /** Whether the confirm dialog is open (shown after PIN verified externally). */
  open: boolean;
  /** The order item to remove, or null when dialog is closed. */
  item: OrderItem | null;
  tabId: string;
  orderId: string;
  /** Called when the dialog should close (on cancel or after success). */
  onClose: () => void;
}

/**
 * RemoveTabItemDialog — Step 2 of the remove-item flow.
 *
 * Renders a destructive ConfirmDialog for removing a single order item from a tab.
 * Manager PIN gate (Step 1) is intentionally excluded: cross-feature imports violate
 * FSD. The parent widget must compose ManagerPinDialog and only open this dialog
 * after PIN is verified (see TableStatusPanel for the full two-step orchestration).
 */
export function RemoveTabItemDialog({
  open,
  item,
  tabId,
  orderId,
  onClose,
}: RemoveTabItemDialogProps) {
  const { removeTabItem, isPending } = useRemoveTabItem();

  if (!item) return null;

  const lineTotal = (item.unitPrice + item.modifierPriceDelta) * item.quantity;
  const productName = item.product?.name ?? 'Unknown item';

  const handleConfirm = async () => {
    const result = await removeTabItem({
      tabId,
      orderId,
      itemId: item.id,
      productId: item.productId,
      quantity: item.quantity,
    });

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success(`${productName} removed from order.`);
    onClose();
  };

  return (
    <ConfirmDialog
      open={open}
      title="Remove item?"
      description="This item will be permanently removed from the order. This cannot be undone."
      confirmLabel="Remove item"
      variant="destructive"
      isLoading={isPending}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="rounded-md border border-border/70 p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-muted-foreground">
            {item.quantity}x {productName}
          </span>
          <MoneyDisplay amount={lineTotal} size="sm" />
        </div>
      </div>
    </ConfirmDialog>
  );
}
