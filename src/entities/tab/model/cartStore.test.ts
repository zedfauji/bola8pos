import { describe, it, expect, beforeEach } from 'vitest';
import type { Product, Modifier } from '@shared/lib/domain';
import { useCartStore } from './cartStore';

describe('cartStore', () => {
  const mockProduct: Product = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Margarita',
    categoryId: 'cat-1',
    basePrice: 12.0,
    happyHourPrice: 9.0,
    imageUrl: null,
    isActive: true,
    sku: 'COCKTAIL-MARG',
    stock_threshold: null,
    comboEligible: true,
    isCombo: false,
    modifiers: [],
  };

  const mockModifier: Modifier = {
    id: 'mod-1',
    name: 'Double Shot',
    priceDelta: 3.0,
    sortOrder: 1,
  };

  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  describe('addItem', () => {
    it('should add a new item to the cart', () => {
      useCartStore.getState().addItem(mockProduct, []);

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0]!.product.id).toBe(mockProduct.id);
      expect(items[0]!.quantity).toBe(1);
      expect(items[0]!.tempId).toBeTruthy();
    });

    it('should increment quantity if same product and modifiers exist', () => {
      const { addItem } = useCartStore.getState();
      addItem(mockProduct, [mockModifier]);
      addItem(mockProduct, [mockModifier]);

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0]!.quantity).toBe(2);
    });

    it('should add separate item if modifiers differ', () => {
      const { addItem } = useCartStore.getState();
      addItem(mockProduct, []);
      addItem(mockProduct, [mockModifier]);

      expect(useCartStore.getState().items).toHaveLength(2);
    });

    it('should compute lineTotal correctly', () => {
      useCartStore.getState().addItem(mockProduct, [mockModifier]);

      const item = useCartStore.getState().items[0]!;
      expect(item.lineTotal).toBe(15.0); // 12 + 3
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart by tempId', () => {
      useCartStore.getState().addItem(mockProduct, []);
      const tempId = useCartStore.getState().items[0]!.tempId;

      useCartStore.getState().removeItem(tempId);

      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('updateQuantity', () => {
    it('should increase quantity', () => {
      useCartStore.getState().addItem(mockProduct, []);
      const tempId = useCartStore.getState().items[0]!.tempId;

      useCartStore.getState().updateQuantity(tempId, 1);

      expect(useCartStore.getState().items[0]!.quantity).toBe(2);
    });

    it('should decrease quantity', () => {
      const { addItem } = useCartStore.getState();
      addItem(mockProduct, []);
      const tempId = useCartStore.getState().items[0]!.tempId;
      useCartStore.getState().updateQuantity(tempId, 1);
      useCartStore.getState().updateQuantity(tempId, -1);

      expect(useCartStore.getState().items[0]!.quantity).toBe(1);
    });

    it('should remove item if quantity becomes 0', () => {
      useCartStore.getState().addItem(mockProduct, []);
      const tempId = useCartStore.getState().items[0]!.tempId;

      useCartStore.getState().updateQuantity(tempId, -1);

      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('should update lineTotal when quantity changes', () => {
      useCartStore.getState().addItem(mockProduct, [mockModifier]);
      const tempId = useCartStore.getState().items[0]!.tempId;
      useCartStore.getState().updateQuantity(tempId, 1);

      expect(useCartStore.getState().items[0]!.lineTotal).toBe(30.0); // (12+3)*2
    });
  });

  describe('clearCart', () => {
    it('should remove all items', () => {
      const { addItem, clearCart } = useCartStore.getState();
      addItem(mockProduct, []);
      addItem(mockProduct, [mockModifier]);
      clearCart();

      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('totalAmount', () => {
    it('should calculate total with no modifiers', () => {
      useCartStore.getState().addItem(mockProduct, []);
      expect(useCartStore.getState().totalAmount()).toBe(12.0);
    });

    it('should calculate total with modifiers', () => {
      useCartStore.getState().addItem(mockProduct, [mockModifier]);
      expect(useCartStore.getState().totalAmount()).toBe(15.0);
    });

    it('should calculate total with multiple quantities', () => {
      useCartStore.getState().addItem(mockProduct, [mockModifier]);
      const tempId = useCartStore.getState().items[0]!.tempId;
      useCartStore.getState().updateQuantity(tempId, 1);

      expect(useCartStore.getState().totalAmount()).toBe(30.0); // (12+3)*2
    });

    it('should calculate total with multiple items', () => {
      const product2: Product = { ...mockProduct, id: 'product-2', basePrice: 8.0 };
      useCartStore.getState().addItem(mockProduct, []);
      useCartStore.getState().addItem(product2, []);

      expect(useCartStore.getState().totalAmount()).toBe(20.0);
    });
  });

  describe('itemCount', () => {
    it('should count total items', () => {
      const { addItem } = useCartStore.getState();
      addItem(mockProduct, []);
      addItem(mockProduct, [mockModifier]);

      expect(useCartStore.getState().itemCount()).toBe(2);
    });

    it('should count quantities correctly', () => {
      useCartStore.getState().addItem(mockProduct, []);
      const tempId = useCartStore.getState().items[0]!.tempId;
      useCartStore.getState().updateQuantity(tempId, 1);
      useCartStore.getState().updateQuantity(tempId, 1);

      expect(useCartStore.getState().itemCount()).toBe(3);
    });
  });

  describe('isCartEmpty', () => {
    it('should return true when cart has no items', () => {
      expect(useCartStore.getState().isCartEmpty()).toBe(true);
    });

    it('should return false when cart has items', () => {
      useCartStore.getState().addItem(mockProduct, []);
      expect(useCartStore.getState().isCartEmpty()).toBe(false);
    });
  });

  describe('addItem — unitPrice override (Sprint 2)', () => {
    it('addItem with explicit unitPrice stores that price, not product.basePrice', () => {
      useCartStore.getState().addItem(mockProduct, [], 4.5);

      const item = useCartStore.getState().items[0]!;
      expect(item.unitPrice).toBe(4.5);
      expect(item.lineTotal).toBe(4.5);
    });

    it('addItem without unitPrice falls back to product.basePrice', () => {
      useCartStore.getState().addItem(mockProduct, []);

      const item = useCartStore.getState().items[0]!;
      expect(item.unitPrice).toBe(mockProduct.basePrice);
    });

    it('addItem increments existing item preserving original unitPrice', () => {
      const { addItem } = useCartStore.getState();
      addItem(mockProduct, [], 4.5);
      addItem(mockProduct, [], 4.5);

      const item = useCartStore.getState().items[0]!;
      expect(item.quantity).toBe(2);
      expect(item.lineTotal).toBe(4.5 * 2);
    });
  });

  describe('setLineQuantity', () => {
    it('should set absolute quantity and lineTotal', () => {
      useCartStore.getState().addItem(mockProduct, [mockModifier]);
      const tempId = useCartStore.getState().items[0]!.tempId;
      useCartStore.getState().setLineQuantity(tempId, 5);

      const item = useCartStore.getState().items[0]!;
      expect(item.quantity).toBe(5);
      expect(item.lineTotal).toBe(75.0); // (12+3)*5
    });

    it('should clamp to max 99', () => {
      useCartStore.getState().addItem(mockProduct, []);
      const tempId = useCartStore.getState().items[0]!.tempId;
      useCartStore.getState().setLineQuantity(tempId, 500);

      expect(useCartStore.getState().items[0]!.quantity).toBe(99);
    });

    it('should remove line when quantity is 0', () => {
      useCartStore.getState().addItem(mockProduct, []);
      const tempId = useCartStore.getState().items[0]!.tempId;
      useCartStore.getState().setLineQuantity(tempId, 0);

      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });
});
