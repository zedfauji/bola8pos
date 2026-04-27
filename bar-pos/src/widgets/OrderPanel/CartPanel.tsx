import { useQueryClient } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ManagerPinDialog } from '@features/manager-pin-gate';
import { useOverrideNegativeStock, type OverrideInput } from '@features/override-negative-stock';
import { inventoryKeys, inventoryStore } from '@entities/inventory';
import { useStaffStore } from '@entities/staff/model/store';
import { useCartStore } from '@entities/tab/model/cartStore';
import { useMutationAddOrder } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import type { CreateOrderItem } from '@entities/tab/model/types';
import { CartItem } from '@entities/tab/ui/CartItem';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { POSButton } from '@shared/ui/POSButton';
import { ScrollArea } from '@shared/ui/ScrollArea';

export function CartPanel() {
  const queryClient = useQueryClient();
  const activeTabId = useTabStore(s => s.activeTabId);
  const { items, setLineQuantity, removeItem, setItemNotes, clearCart, totalAmount, itemCount } = useCartStore();
  const currentStaff = useStaffStore(s => s.currentStaff);
  const addOrderMutation = useMutationAddOrder();
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [pendingOverride, setPendingOverride] = useState<OverrideInput | null>(null);
  const overrideMutation = useOverrideNegativeStock();

  const total = totalAmount();
  const count = itemCount();
  const isEmpty = items.length === 0;
  const canPlaceOrder = !isEmpty && activeTabId !== null && !addOrderMutation.isPending;

  const handlePlaceOrder = async () => {
    if (!activeTabId || items.length === 0) {
      return;
    }
    if (!currentStaff?.id) {
      toast.error('Sign in and start a shift before placing orders.');
      return;
    }

    const orderItems: Omit<CreateOrderItem, 'orderId'>[] = items.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      modifierIds: item.selectedModifiers.map(m => m.id),
      modifierPriceDelta: item.selectedModifiers.reduce((s, m) => s + m.priceDelta, 0),
      notes: item.notes.trim() === '' ? null : item.notes,
    }));

    const inventoryDecrementLines = items.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
    }));

    let result: Awaited<ReturnType<typeof addOrderMutation.mutateAsync>>;
    try {
      result = await addOrderMutation.mutateAsync({
        tabId: activeTabId,
        order: {
          staffId: currentStaff.id,
          status: 'pending',
          notes: null,
        },
        items: orderItems,
      });
    } catch {
      toast.error('Failed to place order. Please try again.');
      return;
    }

    if (!result.ok) {
      if (result.error.code === 'NETWORK_OFFLINE') {
        // Queued for replay when connectivity returns — clear the cart optimistically.
        clearCart();
        return;
      }
      // Phase 4: INVENTORY_NEGATIVE override flow
      if (
        result.error.code === 'INVENTORY_NEGATIVE' ||
        result.error.message.includes('INVENTORY_NEGATIVE')
      ) {
        setPendingOverride({
          tabId: activeTabId,
          staffId: currentStaff.id,
          items: orderItems,
          actorId: currentStaff.id,
        });
        toast.error('An ingredient is out of stock. Manager PIN required to override.', {
          duration: 6000,
          action: {
            label: 'Allow override',
            onClick: () => { setIsPinDialogOpen(true); },
          },
        });
        return;
      }
      toast.error(result.error.message);
      return;
    }

    inventoryStore.getState().decrementQuantities(inventoryDecrementLines);
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });

    toast.success('Order placed successfully');
    clearCart();
  };

  function handleOverrideSuccess(override: OverrideInput) {
    setIsPinDialogOpen(false);
    void overrideMutation.mutateAsync(override).then(result => {
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success('Order placed with manager override');
      clearCart();
      setPendingOverride(null);
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" aria-hidden />
          <h2 className="font-semibold">Current Order</h2>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 p-4">
        {isEmpty ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-muted-foreground">
            <ShoppingCart className="mb-2 h-12 w-12 opacity-20" aria-hidden />
            <p className="text-sm">Cart is empty</p>
            <p className="text-xs">Add items to get started</p>
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Cart items">
            {items.map(item => (
              <li key={item.tempId}>
                <CartItem
                  item={item}
                  onQuantitySet={qty => {
                    setLineQuantity(item.tempId, qty);
                  }}
                  onRemove={() => {
                    removeItem(item.tempId);
                  }}
                  onNotesChange={notes => {
                    setItemNotes(item.tempId, notes);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="space-y-3 border-t p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {count} {count === 1 ? 'item' : 'items'}
          </span>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total</div>
            <MoneyDisplay amount={total} size="xl" />
          </div>
        </div>

        <POSButton
          type="button"
          touchSize="xl"
          className="w-full"
          disabled={!canPlaceOrder}
          onClick={() => {
            void handlePlaceOrder();
          }}
        >
          Place Order
        </POSButton>

        {!isEmpty && (
          <div className="text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground underline decoration-muted-foreground/60 underline-offset-2 hover:text-foreground"
              onClick={() => {
                clearCart();
              }}
            >
              Clear Cart
            </button>
          </div>
        )}

        {!activeTabId && !isEmpty && (
          <p className="text-center text-xs text-muted-foreground">
            Select or create a tab to place order
          </p>
        )}
      </div>

      {/* Phase 4: Manager PIN override for INVENTORY_NEGATIVE */}
      {pendingOverride !== null && (
        <ManagerPinDialog
          open={isPinDialogOpen}
          onOpenChange={open => {
            setIsPinDialogOpen(open);
            if (!open) setPendingOverride(null);
          }}
          requiredAction="void_order"
          onSuccess={() => {
            // pendingOverride is guaranteed non-null here — this block only renders when pendingOverride !== null
            handleOverrideSuccess(pendingOverride);
          }}
        />
      )}
    </div>
  );
}
