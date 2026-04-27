import { create } from 'zustand';
import type { CartItem, Product, Modifier } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';

interface CartState {
  items: CartItem[];
}

interface CartActions {
  /**
   * Adds a product to the cart with the chosen modifiers.
   * If an identical product+modifier combination already exists, increments quantity instead.
   * Pass unitPrice to override the base price (e.g. happy hour resolved price).
   */
  addItem: (product: Product, modifiers: Modifier[], unitPrice?: number) => void;

  /** Removes a cart line by its tempId. */
  removeItem: (tempId: string) => void;

  /** Updates the notes field on a cart line. */
  setItemNotes: (tempId: string, notes: string) => void;

  /**
   * Adjusts the quantity of a cart line by delta (+1 or -1).
   * Removes the line if quantity would drop to zero.
   */
  updateQuantity: (tempId: string, delta: 1 | -1) => void;

  /** Sets absolute quantity (1–99). Removes the line if quantity is 0 or less. */
  setLineQuantity: (tempId: string, quantity: number) => void;

  /** Empties the cart. */
  clearCart: () => void;
}

interface CartSelectors {
  /** Sum of all line totals in the cart. */
  totalAmount: () => number;

  /** Total number of individual units across all cart lines. */
  itemCount: () => number;

  /** True when the cart has no items. */
  isCartEmpty: () => boolean;
}

type CartStore = CartState & CartActions & CartSelectors;

const calcLineTotal = (unitPrice: number, modifiers: Modifier[], quantity: number): number =>
  (unitPrice + modifiers.reduce((sum, m) => sum + m.priceDelta, 0)) * quantity;

/** Client-only — never persisted. */
export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (product, modifiers, unitPrice?) => {
    const state = get();
    const modifierKey = modifiers
      .map(m => m.id)
      .sort()
      .join(',');

    const existingIndex = state.items.findIndex(
      item =>
        item.product.id === product.id &&
        item.selectedModifiers
          .map(m => m.id)
          .sort()
          .join(',') === modifierKey
    );

    if (existingIndex >= 0) {
      const updated = [...state.items];
      const existing = updated[existingIndex];
      if (!existing) {
        return;
      }
      const quantity = existing.quantity + 1;
      updated[existingIndex] = {
        ...existing,
        quantity,
        lineTotal: calcLineTotal(existing.unitPrice, existing.selectedModifiers, quantity),
      };
      logger.debug('cart.item.incremented', { tempId: existing.tempId, quantity });
      set({ items: updated });
    } else {
      const resolvedUnitPrice = unitPrice ?? product.basePrice;
      const newItem: CartItem = {
        tempId: crypto.randomUUID(),
        product,
        quantity: 1,
        selectedModifiers: modifiers,
        unitPrice: resolvedUnitPrice,
        notes: '',
        lineTotal: calcLineTotal(resolvedUnitPrice, modifiers, 1),
      };
      logger.debug('cart.item.added', { tempId: newItem.tempId, productId: product.id });
      set({ items: [...state.items, newItem] });
    }
  },

  removeItem: tempId => {
    logger.debug('cart.item.removed', { tempId });
    set(state => ({ items: state.items.filter(item => item.tempId !== tempId) }));
  },

  setItemNotes: (tempId, notes) => {
    const clamped = notes.slice(0, 200);
    set(state => ({
      items: state.items.map(item => (item.tempId === tempId ? { ...item, notes: clamped } : item)),
    }));
    logger.debug('cart.item.notes_set', { tempId });
  },

  updateQuantity: (tempId, delta) => {
    set(state => {
      const updated = state.items
        .map(item => {
          if (item.tempId !== tempId) return item;
          const quantity = item.quantity + delta;
          if (quantity <= 0) return null;
          return {
            ...item,
            quantity,
            lineTotal: calcLineTotal(item.unitPrice, item.selectedModifiers, quantity),
          };
        })
        .filter((item): item is CartItem => item !== null);
      logger.debug('cart.quantity.updated', { tempId, delta });
      return { items: updated };
    });
  },

  setLineQuantity: (tempId, quantity) => {
    set(state => {
      if (quantity <= 0) {
        logger.debug('cart.quantity.removed_line', { tempId });
        return { items: state.items.filter(item => item.tempId !== tempId) };
      }
      const clamped = Math.min(99, Math.max(1, Math.floor(quantity)));
      const updated = state.items.map(item => {
        if (item.tempId !== tempId) return item;
        return {
          ...item,
          quantity: clamped,
          lineTotal: calcLineTotal(item.unitPrice, item.selectedModifiers, clamped),
        };
      });
      logger.debug('cart.quantity.set', { tempId, quantity: clamped });
      return { items: updated };
    });
  },

  clearCart: () => {
    logger.info('cart.cleared');
    set({ items: [] });
  },

  totalAmount: () => get().items.reduce((sum, item) => sum + item.lineTotal, 0),

  itemCount: () => get().items.reduce((count, item) => count + item.quantity, 0),

  isCartEmpty: () => get().items.length === 0,
}));
