import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@shared/lib/domain';
import { isHappyHourActive } from './isHappyHourActive';

// ---------------------------------------------------------------------------
// Minimal fixture helpers
// ---------------------------------------------------------------------------

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Build a minimal Order fixture. Items default to empty; override as needed. */
function makeOrder(overrides: DeepPartial<Order> = {}): Order {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tabId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    staffId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    createdAt: new Date('2026-01-01T12:00:00Z'),
    status: 'pending',
    notes: null,
    items: [],
    ...overrides,
  } as Order;
}

/** Build an order item whose product category has the given HH window. */
function makeOrderWithHH(start: string, end: string): Order {
  return makeOrder({
    items: [
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        productId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        quantity: 1,
        unitPrice: 50,
        modifierIds: [],
        modifierPriceDelta: 0,
        notes: null,
        modifiers: [],
        product: {
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          name: 'Cerveza',
          categoryId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          basePrice: 50,
          happyHourPrice: null,
          sku: null,
          isActive: true,
          imageUrl: null,
          modifiers: [],
          category: {
            id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            name: 'Bebidas',
            color: '#ff0000',
            sortOrder: 0,
            happyHourStart: start,
            happyHourEnd: end,
            createdAt: new Date('2026-01-01T00:00:00Z'),
          },
        },
      },
    ],
  } as unknown as Order);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isHappyHourActive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for empty orders array', () => {
    vi.setSystemTime(new Date('2026-01-01T14:30:00'));
    expect(isHappyHourActive([])).toBe(false);
  });

  it('returns false when orders have no category data', () => {
    vi.setSystemTime(new Date('2026-01-01T14:30:00'));
    const order = makeOrder({
      items: [
        {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          productId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          quantity: 1,
          unitPrice: 50,
          modifierIds: [],
          modifierPriceDelta: 0,
          notes: null,
          modifiers: [],
          // product has no category
          product: {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            name: 'Agua',
            categoryId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            basePrice: 20,
            happyHourPrice: null,
            sku: null,
            isActive: true,
            imageUrl: null,
            modifiers: [],
          },
        },
      ],
    } as unknown as Order);
    expect(isHappyHourActive([order])).toBe(false);
  });

  it('returns false when category happyHourStart/End are null', () => {
    vi.setSystemTime(new Date('2026-01-01T14:30:00'));
    const order = makeOrderWithHH('', '');
    // Override with null values directly
    const nullOrder = makeOrder({
      items: [
        {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          productId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          quantity: 1,
          unitPrice: 50,
          modifierIds: [],
          modifierPriceDelta: 0,
          notes: null,
          modifiers: [],
          product: {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            name: 'Cerveza',
            categoryId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            basePrice: 50,
            happyHourPrice: null,
            sku: null,
            isActive: true,
            imageUrl: null,
            modifiers: [],
            category: {
              id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
              name: 'Bebidas',
              color: '#ff0000',
              sortOrder: 0,
              happyHourStart: null,
              happyHourEnd: null,
              createdAt: new Date('2026-01-01T00:00:00Z'),
            },
          },
        },
      ],
    } as unknown as Order);
    void order; // suppress unused var
    expect(isHappyHourActive([nullOrder])).toBe(false);
  });

  // --- Non-midnight-crossing window (13:00–16:00) ---

  it('returns true when current time is within HH window (non-crossing)', () => {
    // 14:30 is between 13:00 and 16:00
    vi.setSystemTime(new Date('2026-01-01T14:30:00'));
    expect(isHappyHourActive([makeOrderWithHH('13:00', '16:00')])).toBe(true);
  });

  it('returns false when current time is before HH window start', () => {
    // 12:59 is before 13:00
    vi.setSystemTime(new Date('2026-01-01T12:59:00'));
    expect(isHappyHourActive([makeOrderWithHH('13:00', '16:00')])).toBe(false);
  });

  it('returns false when current time is at or after HH window end', () => {
    // 16:00 is NOT included (strict < end)
    vi.setSystemTime(new Date('2026-01-01T16:00:00'));
    expect(isHappyHourActive([makeOrderWithHH('13:00', '16:00')])).toBe(false);
  });

  it('returns true at the exact start minute of HH window', () => {
    vi.setSystemTime(new Date('2026-01-01T13:00:00'));
    expect(isHappyHourActive([makeOrderWithHH('13:00', '16:00')])).toBe(true);
  });

  // --- Midnight-crossing window (22:00–02:00) ---

  it('returns true when time is inside a midnight-crossing HH window (after start)', () => {
    // 23:00 is between 22:00 and 02:00 (wrapping)
    vi.setSystemTime(new Date('2026-01-01T23:00:00'));
    expect(isHappyHourActive([makeOrderWithHH('22:00', '02:00')])).toBe(true);
  });

  it('returns true when time is inside a midnight-crossing HH window (before end)', () => {
    // 01:30 is before 02:00 on the next day side
    vi.setSystemTime(new Date('2026-01-02T01:30:00'));
    expect(isHappyHourActive([makeOrderWithHH('22:00', '02:00')])).toBe(true);
  });

  it('returns false when time is outside a midnight-crossing HH window', () => {
    // 10:00 is outside both 22:00+ and <02:00
    vi.setSystemTime(new Date('2026-01-01T10:00:00'));
    expect(isHappyHourActive([makeOrderWithHH('22:00', '02:00')])).toBe(false);
  });

  it('returns false just after end of midnight-crossing window', () => {
    // 02:00 is the end boundary — should be excluded
    vi.setSystemTime(new Date('2026-01-02T02:00:00'));
    expect(isHappyHourActive([makeOrderWithHH('22:00', '02:00')])).toBe(false);
  });

  // --- Multiple categories ---

  it('returns true when at least one category is in HH but others are not', () => {
    // current time 14:30 — first category 09:00–11:00 (not active), second 13:00–16:00 (active)
    vi.setSystemTime(new Date('2026-01-01T14:30:00'));
    const orderA = makeOrderWithHH('09:00', '11:00');
    const orderB = makeOrderWithHH('13:00', '16:00');
    expect(isHappyHourActive([orderA, orderB])).toBe(true);
  });

  it('returns false when no category is in HH across multiple orders', () => {
    vi.setSystemTime(new Date('2026-01-01T12:00:00'));
    const orderA = makeOrderWithHH('09:00', '11:00');
    const orderB = makeOrderWithHH('14:00', '17:00');
    expect(isHappyHourActive([orderA, orderB])).toBe(false);
  });
});
