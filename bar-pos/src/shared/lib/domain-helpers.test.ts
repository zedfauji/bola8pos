import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import type { Category, CartItem, Order, PoolSessionSummary, Product } from './domain';
import {
  calculatePoolCharge,
  resolveProductPrice,
  calculateOrderItemLineTotal,
  calculateTabSubtotal,
  calculateTipAmount,
  formatMoney,
  formatElapsed,
  isHappyHourActive,
  generateIdempotencyKey,
  getDiscountBase,
  calculateDiscountAmount,
} from './domain-helpers';

describe('calculatePoolCharge', () => {
  it('should round 1 minute up to 15-minute block', () => {
    const start = new Date('2024-01-01T10:00:00');
    const stop = new Date('2024-01-01T10:01:00');
    const charge = calculatePoolCharge(start, stop, 10);
    expect(charge).toBe(2.5); // 15 min / 60 * $10 = $2.50
  });

  it('should round 16 minutes up to 30-minute block', () => {
    const start = new Date('2024-01-01T10:00:00');
    const stop = new Date('2024-01-01T10:16:00');
    const charge = calculatePoolCharge(start, stop, 10);
    expect(charge).toBe(5.0); // 30 min / 60 * $10 = $5.00
  });

  it('should handle exactly 60 minutes', () => {
    const start = new Date('2024-01-01T10:00:00');
    const stop = new Date('2024-01-01T11:00:00');
    const charge = calculatePoolCharge(start, stop, 10);
    expect(charge).toBe(10.0); // 60 min / 60 * $10 = $10.00
  });

  it('should handle exactly 15 minutes', () => {
    const start = new Date('2024-01-01T10:00:00');
    const stop = new Date('2024-01-01T10:15:00');
    const charge = calculatePoolCharge(start, stop, 10);
    expect(charge).toBe(2.5); // 15 min / 60 * $10 = $2.50
  });

  it('should round 31 minutes up to 45-minute block', () => {
    const start = new Date('2024-01-01T10:00:00');
    const stop = new Date('2024-01-01T10:31:00');
    const charge = calculatePoolCharge(start, stop, 10);
    expect(charge).toBe(7.5); // 45 min / 60 * $10 = $7.50
  });

  it('should handle different hourly rates', () => {
    const start = new Date('2024-01-01T10:00:00');
    const stop = new Date('2024-01-01T10:01:00');
    const charge = calculatePoolCharge(start, stop, 20);
    expect(charge).toBe(5.0); // 15 min / 60 * $20 = $5.00
  });

  it('should handle 2 hours and 1 minute', () => {
    const start = new Date('2024-01-01T10:00:00');
    const stop = new Date('2024-01-01T12:01:00');
    const charge = calculatePoolCharge(start, stop, 10);
    expect(charge).toBe(22.5); // 121 min â†’ 135 min (rounded to 15-min block) / 60 * $10 = $22.50
  });
});

describe('resolveProductPrice', () => {
  const baseProduct: Product = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Beer',
    categoryId: '123e4567-e89b-12d3-a456-426614174001',
    basePrice: 6.0,
    happyHourPrice: 4.0,
    sku: null,
    isActive: true,
    imageUrl: null,
    stock_threshold: null,
    comboEligible: true,
    isCombo: false,
    modifiers: [],
  };

  const happyHourCategory: Category = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Drinks',
    color: '#FF0000',
    sortOrder: 0,
    happyHourStart: '16:00',
    happyHourEnd: '18:00',
    routing: 'NONE',
    createdAt: new Date(),
  };

  it('should return happy hour price during happy hour', () => {
    const time = new Date('2024-01-01T17:00:00'); // 5pm
    const price = resolveProductPrice(baseProduct, happyHourCategory, time);
    expect(price).toBe(4.0);
  });

  it('should return base price outside happy hour', () => {
    const time = new Date('2024-01-01T20:00:00'); // 8pm
    const price = resolveProductPrice(baseProduct, happyHourCategory, time);
    expect(price).toBe(6.0);
  });

  it('should return base price at start of happy hour', () => {
    const time = new Date('2024-01-01T16:00:00'); // 4pm exactly
    const price = resolveProductPrice(baseProduct, happyHourCategory, time);
    expect(price).toBe(4.0);
  });

  it('should return base price at end of happy hour', () => {
    const time = new Date('2024-01-01T18:00:00'); // 6pm exactly
    const price = resolveProductPrice(baseProduct, happyHourCategory, time);
    expect(price).toBe(6.0);
  });

  it('should return base price if no happy hour configured', () => {
    const noHappyHourCategory: Category = {
      ...happyHourCategory,
      happyHourStart: null,
      happyHourEnd: null,
    };
    const time = new Date('2024-01-01T17:00:00');
    const price = resolveProductPrice(baseProduct, noHappyHourCategory, time);
    expect(price).toBe(6.0);
  });

  it('should return base price if product has no happy hour price', () => {
    const noHappyHourProduct: Product = {
      ...baseProduct,
      happyHourPrice: null,
    };
    const time = new Date('2024-01-01T17:00:00');
    const price = resolveProductPrice(noHappyHourProduct, happyHourCategory, time);
    expect(price).toBe(6.0);
  });

  it('should use current time if not provided', () => {
    // This test depends on current time, so we just verify it returns a valid price
    const price = resolveProductPrice(baseProduct, happyHourCategory);
    expect(price).toBeGreaterThan(0);
    expect([4.0, 6.0]).toContain(price);
  });
});

describe('calculateOrderItemLineTotal', () => {
  const baseCartItem: CartItem = {
    tempId: 'temp-1',
    product: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Beer',
      categoryId: '123e4567-e89b-12d3-a456-426614174001',
      basePrice: 5.0,
      happyHourPrice: null,
      sku: null,
      isActive: true,
      imageUrl: null,
      stock_threshold: null,
      comboEligible: true,
      isCombo: false,
      modifiers: [],
    },
    quantity: 1,
    selectedModifiers: [],
    unitPrice: 5.0,
    notes: '',
    lineTotal: 0,
  };

  it('should calculate line total without modifiers', () => {
    const total = calculateOrderItemLineTotal(baseCartItem);
    expect(total).toBe(5.0);
  });

  it('should calculate line total with positive modifier', () => {
    const item: CartItem = {
      ...baseCartItem,
      selectedModifiers: [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Double Shot',
          priceDelta: 2.0,
          sortOrder: 0,
        },
      ],
    };
    const total = calculateOrderItemLineTotal(item);
    expect(total).toBe(7.0); // (5.00 + 2.00) * 1
  });

  it('should calculate line total with negative modifier', () => {
    const item: CartItem = {
      ...baseCartItem,
      selectedModifiers: [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'No Ice',
          priceDelta: -0.5,
          sortOrder: 0,
        },
      ],
    };
    const total = calculateOrderItemLineTotal(item);
    expect(total).toBe(4.5); // (5.00 - 0.50) * 1
  });

  it('should calculate line total with multiple modifiers', () => {
    const item: CartItem = {
      ...baseCartItem,
      selectedModifiers: [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Double Shot',
          priceDelta: 2.0,
          sortOrder: 0,
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174003',
          name: 'Extra Lime',
          priceDelta: 0.5,
          sortOrder: 1,
        },
      ],
    };
    const total = calculateOrderItemLineTotal(item);
    expect(total).toBe(7.5); // (5.00 + 2.00 + 0.50) * 1
  });

  it('should calculate line total with quantity', () => {
    const item: CartItem = {
      ...baseCartItem,
      quantity: 3,
    };
    const total = calculateOrderItemLineTotal(item);
    expect(total).toBe(15.0); // 5.00 * 3
  });

  it('should calculate line total with modifiers and quantity', () => {
    const item: CartItem = {
      ...baseCartItem,
      quantity: 2,
      selectedModifiers: [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Double Shot',
          priceDelta: 2.0,
          sortOrder: 0,
        },
      ],
    };
    const total = calculateOrderItemLineTotal(item);
    expect(total).toBe(14.0); // (5.00 + 2.00) * 2
  });

  it('should round to 2 decimal places', () => {
    const item: CartItem = {
      ...baseCartItem,
      unitPrice: 5.555,
      quantity: 3,
    };
    const total = calculateOrderItemLineTotal(item);
    expect(total).toBe(16.67); // 5.555 * 3 = 16.665 â†’ 16.67
  });
});

describe('calculateTabSubtotal', () => {
  it('should calculate subtotal with no orders or pool charges', () => {
    const subtotal = calculateTabSubtotal([], []);
    expect(subtotal).toBe(0);
  });

  it('should calculate subtotal with orders only', () => {
    const orders: Order[] = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tabId: '123e4567-e89b-12d3-a456-426614174001',
        staffId: '123e4567-e89b-12d3-a456-426614174002',
        createdAt: new Date(),
        status: 'pending',
        notes: null,
        items: [
          {
            id: '123e4567-e89b-12d3-a456-426614174003',
            orderId: '123e4567-e89b-12d3-a456-426614174000',
            productId: '123e4567-e89b-12d3-a456-426614174004',
            quantity: 1,
            unitPrice: 10.0,
            modifierIds: [],
            modifierPriceDelta: 0,
            notes: null,
            kdsStatus: 'pending',
            modifiers: [],
            lineTotal: 10.0,
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174005',
            orderId: '123e4567-e89b-12d3-a456-426614174000',
            productId: '123e4567-e89b-12d3-a456-426614174006',
            quantity: 1,
            unitPrice: 5.5,
            modifierIds: [],
            modifierPriceDelta: 0,
            notes: null,
            kdsStatus: 'pending',
            modifiers: [],
            lineTotal: 5.5,
          },
        ],
      },
    ];
    const subtotal = calculateTabSubtotal(orders, []);
    expect(subtotal).toBe(15.5);
  });

  it('should calculate subtotal with pool charges only', () => {
    const poolCharges: PoolSessionSummary[] = [
      {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        tableNumber: 1,
        tableLabel: 'Table 1',
        billedMinutes: 60,
        ratePerHour: 10,
        totalCharge: 10.0,
      },
      {
        sessionId: '123e4567-e89b-12d3-a456-426614174001',
        tableNumber: 2,
        tableLabel: 'Table 2',
        billedMinutes: 30,
        ratePerHour: 10,
        totalCharge: 5.0,
      },
    ];
    const subtotal = calculateTabSubtotal([], poolCharges);
    expect(subtotal).toBe(15.0);
  });

  it('should calculate subtotal with both orders and pool charges', () => {
    const orders: Order[] = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tabId: '123e4567-e89b-12d3-a456-426614174001',
        staffId: '123e4567-e89b-12d3-a456-426614174002',
        createdAt: new Date(),
        status: 'pending',
        notes: null,
        items: [
          {
            id: '123e4567-e89b-12d3-a456-426614174003',
            orderId: '123e4567-e89b-12d3-a456-426614174000',
            productId: '123e4567-e89b-12d3-a456-426614174004',
            quantity: 1,
            unitPrice: 10.0,
            modifierIds: [],
            modifierPriceDelta: 0,
            notes: null,
            kdsStatus: 'pending',
            modifiers: [],
            lineTotal: 10.0,
          },
        ],
      },
    ];
    const poolCharges: PoolSessionSummary[] = [
      {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        tableNumber: 1,
        tableLabel: 'Table 1',
        billedMinutes: 60,
        ratePerHour: 10,
        totalCharge: 7.5,
      },
    ];
    const subtotal = calculateTabSubtotal(orders, poolCharges);
    expect(subtotal).toBe(17.5);
  });

  it('should handle multiple orders', () => {
    const orders: Order[] = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tabId: '123e4567-e89b-12d3-a456-426614174001',
        staffId: '123e4567-e89b-12d3-a456-426614174002',
        createdAt: new Date(),
        status: 'pending',
        notes: null,
        items: [
          {
            id: '123e4567-e89b-12d3-a456-426614174003',
            orderId: '123e4567-e89b-12d3-a456-426614174000',
            productId: '123e4567-e89b-12d3-a456-426614174004',
            quantity: 1,
            unitPrice: 10.0,
            modifierIds: [],
            modifierPriceDelta: 0,
            notes: null,
            kdsStatus: 'pending',
            modifiers: [],
            lineTotal: 10.0,
          },
        ],
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174005',
        tabId: '123e4567-e89b-12d3-a456-426614174001',
        staffId: '123e4567-e89b-12d3-a456-426614174002',
        createdAt: new Date(),
        status: 'pending',
        notes: null,
        items: [
          {
            id: '123e4567-e89b-12d3-a456-426614174006',
            orderId: '123e4567-e89b-12d3-a456-426614174005',
            productId: '123e4567-e89b-12d3-a456-426614174007',
            quantity: 1,
            unitPrice: 8.0,
            modifierIds: [],
            modifierPriceDelta: 0,
            notes: null,
            kdsStatus: 'pending',
            modifiers: [],
            lineTotal: 8.0,
          },
        ],
      },
    ];
    const subtotal = calculateTabSubtotal(orders, []);
    expect(subtotal).toBe(18.0);
  });

  it('should round to 2 decimal places', () => {
    const orders: Order[] = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        tabId: '123e4567-e89b-12d3-a456-426614174001',
        staffId: '123e4567-e89b-12d3-a456-426614174002',
        createdAt: new Date(),
        status: 'pending',
        notes: null,
        items: [
          {
            id: '123e4567-e89b-12d3-a456-426614174003',
            orderId: '123e4567-e89b-12d3-a456-426614174000',
            productId: '123e4567-e89b-12d3-a456-426614174004',
            quantity: 1,
            unitPrice: 10.555,
            modifierIds: [],
            modifierPriceDelta: 0,
            notes: null,
            kdsStatus: 'pending',
            modifiers: [],
            lineTotal: 10.555,
          },
        ],
      },
    ];
    const subtotal = calculateTabSubtotal(orders, []);
    expect(subtotal).toBe(10.56);
  });
});

describe('calculateTipAmount', () => {
  it('should calculate percentage tip', () => {
    const tip = calculateTipAmount(50.0, 20, null);
    expect(tip).toBe(10.0);
  });

  it('should calculate flat tip', () => {
    const tip = calculateTipAmount(50.0, null, 5.0);
    expect(tip).toBe(5.0);
  });

  it('should return 0 if no tip', () => {
    const tip = calculateTipAmount(50.0, null, null);
    expect(tip).toBe(0);
  });

  it('should prioritize percentage over flat', () => {
    const tip = calculateTipAmount(50.0, 20, 5.0);
    expect(tip).toBe(10.0); // Uses percentage
  });

  it('should round percentage tip to 2 decimal places', () => {
    const tip = calculateTipAmount(33.33, 15, null);
    expect(tip).toBe(5.0); // 33.33 * 0.15 = 4.9995 â†’ 5.00
  });

  it('should handle 0% tip', () => {
    const tip = calculateTipAmount(50.0, 0, null);
    expect(tip).toBe(0);
  });

  it('should handle large percentage tips', () => {
    const tip = calculateTipAmount(100.0, 100, null);
    expect(tip).toBe(100.0);
  });
});

describe('formatMoney', () => {
  it('should format positive amounts', () => {
    expect(formatMoney(12.5)).toBe('$12.50');
  });

  it('should format negative amounts', () => {
    expect(formatMoney(-3.0)).toBe('-$3.00');
  });

  it('should format zero', () => {
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('should always show 2 decimal places', () => {
    expect(formatMoney(10)).toBe('$10.00');
  });

  it('should handle large amounts', () => {
    expect(formatMoney(1234.56)).toBe('$1234.56');
  });

  it('should handle small amounts', () => {
    expect(formatMoney(0.01)).toBe('$0.01');
  });

  it('should round to 2 decimal places', () => {
    expect(formatMoney(12.555)).toBe('$12.55'); // toFixed uses banker's rounding
  });
});

describe('formatElapsed', () => {
  it('should format seconds only', () => {
    expect(formatElapsed(45)).toBe('00:45');
  });

  it('should format minutes and seconds', () => {
    expect(formatElapsed(90)).toBe('01:30');
  });

  it('should format exactly 1 hour', () => {
    expect(formatElapsed(3600)).toBe('1:00:00');
  });

  it('should format hours, minutes, and seconds', () => {
    expect(formatElapsed(3661)).toBe('1:01:01');
  });

  it('should pad minutes and seconds in hour format', () => {
    expect(formatElapsed(3605)).toBe('1:00:05');
  });

  it('should handle zero', () => {
    expect(formatElapsed(0)).toBe('00:00');
  });

  it('should handle large durations', () => {
    expect(formatElapsed(7200)).toBe('2:00:00');
  });

  it('should format 59 minutes 59 seconds', () => {
    expect(formatElapsed(3599)).toBe('59:59');
  });
});

describe('isHappyHourActive', () => {
  const category: Category = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Drinks',
    color: '#FF0000',
    sortOrder: 0,
    happyHourStart: '16:00',
    happyHourEnd: '18:00',
    routing: 'NONE',
    createdAt: new Date(),
  };

  it('should return true during happy hour', () => {
    const time = new Date('2024-01-01T17:00:00');
    expect(isHappyHourActive(category, time)).toBe(true);
  });

  it('should return false before happy hour', () => {
    const time = new Date('2024-01-01T15:00:00');
    expect(isHappyHourActive(category, time)).toBe(false);
  });

  it('should return false after happy hour', () => {
    const time = new Date('2024-01-01T19:00:00');
    expect(isHappyHourActive(category, time)).toBe(false);
  });

  it('should return true at start of happy hour', () => {
    const time = new Date('2024-01-01T16:00:00');
    expect(isHappyHourActive(category, time)).toBe(true);
  });

  it('should return false at end of happy hour', () => {
    const time = new Date('2024-01-01T18:00:00');
    expect(isHappyHourActive(category, time)).toBe(false);
  });

  it('should return false if no happy hour configured', () => {
    const noHappyHour: Category = {
      ...category,
      happyHourStart: null,
      happyHourEnd: null,
    };
    const time = new Date('2024-01-01T17:00:00');
    expect(isHappyHourActive(noHappyHour, time)).toBe(false);
  });

  it('should handle midnight crossing (10pm - 2am)', () => {
    const midnightCategory: Category = {
      ...category,
      happyHourStart: '22:00',
      happyHourEnd: '02:00',
    };

    // 11pm should be active
    const time1 = new Date('2024-01-01T23:00:00');
    expect(isHappyHourActive(midnightCategory, time1)).toBe(true);

    // 1am should be active
    const time2 = new Date('2024-01-01T01:00:00');
    expect(isHappyHourActive(midnightCategory, time2)).toBe(true);

    // 3am should not be active
    const time3 = new Date('2024-01-01T03:00:00');
    expect(isHappyHourActive(midnightCategory, time3)).toBe(false);

    // 9pm should not be active
    const time4 = new Date('2024-01-01T21:00:00');
    expect(isHappyHourActive(midnightCategory, time4)).toBe(false);
  });

  it('should handle edge case at midnight', () => {
    const midnightCategory: Category = {
      ...category,
      happyHourStart: '22:00',
      happyHourEnd: '02:00',
    };

    const midnight = new Date('2024-01-01T00:00:00');
    expect(isHappyHourActive(midnightCategory, midnight)).toBe(true);
  });

  it('should use current time if not provided', () => {
    // This test just verifies it doesn't throw
    const result = isHappyHourActive(category);
    expect(typeof result).toBe('boolean');
  });
});

describe('generateIdempotencyKey', () => {
  it('should generate key with correct format', () => {
    const key = generateIdempotencyKey('payment');
    expect(key).toMatch(/^payment_\d+_[a-f0-9]{8}$/);
  });

  it('should generate unique keys', () => {
    const key1 = generateIdempotencyKey('payment');
    const key2 = generateIdempotencyKey('payment');
    expect(key1).not.toBe(key2);
  });

  it('should include prefix', () => {
    const key = generateIdempotencyKey('refund');
    expect(key).toMatch(/^refund_/);
  });

  it('should handle different prefixes', () => {
    const paymentKey = generateIdempotencyKey('payment');
    const refundKey = generateIdempotencyKey('refund');
    expect(paymentKey.startsWith('payment_')).toBe(true);
    expect(refundKey.startsWith('refund_')).toBe(true);
  });

  it('should generate 8-character random ID', () => {
    const key = generateIdempotencyKey('test');
    const parts = key.split('_');
    expect(parts[2]).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// Sprint 2 — Discount helpers
// ---------------------------------------------------------------------------

describe('getDiscountBase', () => {
  it("scope 'all' returns itemsSubtotal + poolTotal", () => {
    expect(getDiscountBase(80, 20, 'all')).toBe(100);
  });

  it("scope 'pool_only' returns only poolTotal", () => {
    expect(getDiscountBase(80, 20, 'pool_only')).toBe(20);
  });

  it("scope 'consumptions_only' returns only itemsSubtotal", () => {
    expect(getDiscountBase(80, 20, 'consumptions_only')).toBe(80);
  });
});

describe('calculateDiscountAmount', () => {
  it('percent 10% on $100 base → $10.00', () => {
    expect(calculateDiscountAmount(100, 'percent', 10)).toBe(10);
  });

  it('percent 0% → $0', () => {
    expect(calculateDiscountAmount(100, 'percent', 0)).toBe(0);
  });

  it('fixed $20 on $100 base → $20.00', () => {
    expect(calculateDiscountAmount(100, 'fixed', 20)).toBe(20);
  });

  it('fixed $200 on $100 base → clamped to $100.00', () => {
    expect(calculateDiscountAmount(100, 'fixed', 200)).toBe(100);
  });

  it('percent 100% → equals base', () => {
    expect(calculateDiscountAmount(100, 'percent', 100)).toBe(100);
  });

  it('base $0 → always $0', () => {
    expect(calculateDiscountAmount(0, 'percent', 50)).toBe(0);
    expect(calculateDiscountAmount(0, 'fixed', 50)).toBe(0);
  });

  it('calculateDiscountAmount never exceeds base (fast-check)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
        fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
        fc.oneof(fc.constant('percent' as const), fc.constant('fixed' as const)),
        (base, value, type) => {
          const result = calculateDiscountAmount(base, type, value);
          // The function rounds to 2 decimal places; allow up to 0.005 rounding tolerance.
          // The result must never exceed the 2dp-rounded base by more than the rounding epsilon.
          const roundedBase = Math.round(base * 100) / 100;
          return result <= roundedBase + 0.005 && result >= 0;
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// Sprint 2 — isHappyHourActive boundary tests
// ---------------------------------------------------------------------------

describe('isHappyHourActive — boundary tests (Sprint 2)', () => {
  const category: Category = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Drinks',
    color: '#FF0000',
    sortOrder: 0,
    happyHourStart: '16:00',
    happyHourEnd: '18:00',
    routing: 'NONE',
    createdAt: new Date(),
  };

  it('time at exactly startMinutes → true', () => {
    const time = new Date('2024-01-01T16:00:00'); // exactly 16:00
    expect(isHappyHourActive(category, time)).toBe(true);
  });

  it('time at exactly endMinutes → false (exclusive end)', () => {
    const time = new Date('2024-01-01T18:00:00'); // exactly 18:00
    expect(isHappyHourActive(category, time)).toBe(false);
  });

  it('midnight crossing: 10pm-2am, time at 11pm → true', () => {
    const midnightCategory: Category = {
      ...category,
      happyHourStart: '22:00',
      happyHourEnd: '02:00',
    };
    expect(isHappyHourActive(midnightCategory, new Date('2024-01-01T23:00:00'))).toBe(true);
  });

  it('midnight crossing: 10pm-2am, time at 1:59am → true', () => {
    const midnightCategory: Category = {
      ...category,
      happyHourStart: '22:00',
      happyHourEnd: '02:00',
    };
    expect(isHappyHourActive(midnightCategory, new Date('2024-01-01T01:59:00'))).toBe(true);
  });

  it('midnight crossing: 10pm-2am, time at 2:00am → false', () => {
    const midnightCategory: Category = {
      ...category,
      happyHourStart: '22:00',
      happyHourEnd: '02:00',
    };
    expect(isHappyHourActive(midnightCategory, new Date('2024-01-01T02:00:00'))).toBe(false);
  });
});
