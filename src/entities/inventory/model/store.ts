import { create } from 'zustand';
import type { Inventory } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';

interface InventoryState {
  inventory: Inventory[];
  lowStockProductIds: string[];
}

interface InventoryActions {
  /** Replaces the full inventory list; called by TanStack Query on success. */
  setInventory: (items: Inventory[]) => void;

  /**
   * Optimistically decrements a product's quantity on hand by the given amount.
   * Clamps to zero — never goes negative.
   */
  decrementQuantity: (productId: string, amount: number) => void;

  /** Recomputes lowStockProductIds from the current inventory list. */
  refreshAlerts: () => void;
}

type InventoryStore = InventoryState & InventoryActions;

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  inventory: [],
  lowStockProductIds: [],

  setInventory: items => {
    logger.info('inventory.loaded', { count: items.length });
    set({ inventory: items });
    get().refreshAlerts();
  },

  decrementQuantity: (productId, amount) => {
    logger.debug('inventory.decrement', { productId, amount });
    set(state => ({
      inventory: state.inventory.map(item =>
        item.productId === productId
          ? { ...item, quantityOnHand: Math.max(0, item.quantityOnHand - amount) }
          : item
      ),
    }));
    get().refreshAlerts();
  },

  refreshAlerts: () => {
    const lowStockProductIds = get()
      .inventory.filter(item => item.quantityOnHand <= item.lowStockThreshold)
      .map(item => item.productId);

    logger.debug('inventory.alerts.refreshed', { lowStockCount: lowStockProductIds.length });
    set({ lowStockProductIds });
  },
}));

/** Returns the inventory record for a given product, or undefined. */
export const selectInventoryByProductId = (productId: string): Inventory | undefined =>
  useInventoryStore.getState().inventory.find(i => i.productId === productId);

/** Returns true if the product ID is in the low-stock alert list. */
export const selectIsLowStock = (productId: string): boolean =>
  useInventoryStore.getState().lowStockProductIds.includes(productId);
