import { ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@features/add-item-to-tab/model/cartStore';
import { useAuthStore } from '@entities/staff/model/authStore';
import { useMutationAddOrder } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import type { CreateOrderItem } from '@entities/tab/model/types';
import { CartItem } from '@entities/tab/ui/CartItem';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { POSButton } from '@shared/ui/POSButton';
import { ScrollArea } from '@shared/ui/ScrollArea';

export function CartPanel() {
  const activeTabId = useTabStore(s => s.activeTabId);
  const { items, setLineQuantity, removeItem, clearCart, totalAmount, itemCount } = useCartStore();
  const selectedStaff = useAuthStore(s => s.selectedStaff);
  const addOrderMutation = useMutationAddOrder();

  const total = totalAmount();
  const count = itemCount();
  const isEmpty = items.length === 0;
  const canPlaceOrder = !isEmpty && activeTabId !== null && !addOrderMutation.isPending;

  const handlePlaceOrder = async () => {
    if (!activeTabId || items.length === 0) {
      return;
    }
    if (!selectedStaff?.id) {
      toast.error('Select staff and clock in before placing orders.');
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

    const result = await addOrderMutation.mutateAsync({
      tabId: activeTabId,
      order: {
        staffId: selectedStaff.id,
        status: 'pending',
        notes: null,
      },
      items: orderItems,
    });

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success('Order placed successfully');
    clearCart();
  };

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
    </div>
  );
}
