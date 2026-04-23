import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@shared/lib/domain';
import { err, ok } from '@shared/lib/result';
import { useVoidOrder } from './useVoidOrder';

const invalidateQueriesMock = vi.fn();
const callVoidOrderMock = vi.fn();
const loggerErrorMock = vi.fn();
const loggerInfoMock = vi.fn();

vi.mock('@shared/lib/edge-function-contracts', () => ({
  callVoidOrder: (...args: unknown[]) => callVoidOrderMock(...args),
}));

vi.mock('@shared/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: (...args: unknown[]) => loggerInfoMock(...args),
    error: (...args: unknown[]) => loggerErrorMock(...args),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  logger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
    error: (...args: unknown[]) => loggerErrorMock(...args),
  },
}));

vi.mock('@shared/lib/logger-instance', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('useVoidOrder', () => {
  const order: Order = {
    id: '11111111-1111-1111-1111-111111111111',
    tabId: '22222222-2222-2222-2222-222222222222',
    staffId: '33333333-3333-3333-3333-333333333333',
    createdAt: new Date('2026-04-17T11:00:00.000Z'),
    status: 'pending',
    notes: null,
    items: [
      {
        id: '44444444-4444-4444-4444-444444444444',
        orderId: '11111111-1111-1111-1111-111111111111',
        productId: '55555555-5555-5555-5555-555555555555',
        quantity: 2,
        unitPrice: 12,
        modifierIds: [],
        modifierPriceDelta: 1,
        notes: null,
        kdsStatus: 'pending',
        modifiers: [],
      },
      {
        id: '66666666-6666-6666-6666-666666666666',
        orderId: '11111111-1111-1111-1111-111111111111',
        productId: '77777777-7777-7777-7777-777777777777',
        quantity: 1,
        unitPrice: 9,
        modifierIds: [],
        modifierPriceDelta: 0,
        notes: null,
        kdsStatus: 'pending',
        modifiers: [],
      },
    ],
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(invalidateQueriesMock);
    callVoidOrderMock.mockResolvedValue(ok({ success: true }));
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('returns success and logs void event', async () => {
    const { result } = renderHook(() => useVoidOrder(), { wrapper });

    const response = await result.current.voidOrder({
      tabId: order.tabId,
      order,
      reason: 'Wrong tab selected',
      staffId: order.staffId,
    });

    expect(response).toEqual(ok(undefined));
    expect(callVoidOrderMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'order.void.succeeded',
      expect.objectContaining({
        orderId: order.id,
        reason: 'Wrong tab selected',
        staffId: order.staffId,
        amount: 35,
      })
    );
  });

  it('sends inventory restore entries for each order item', async () => {
    const { result } = renderHook(() => useVoidOrder(), { wrapper });

    await result.current.voidOrder({
      tabId: order.tabId,
      order,
      reason: 'Drink entered twice',
      staffId: order.staffId,
    });

    expect(callVoidOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: order.id,
        reason: 'Drink entered twice',
        staffId: order.staffId,
        amount: 35,
        inventoryRestoreItems: [
          {
            orderItemId: '44444444-4444-4444-4444-444444444444',
            productId: '55555555-5555-5555-5555-555555555555',
            quantity: 2,
          },
          {
            orderItemId: '66666666-6666-6666-6666-666666666666',
            productId: '77777777-7777-7777-7777-777777777777',
            quantity: 1,
          },
        ],
      })
    );
  });

  it('returns an error result when edge call fails', async () => {
    callVoidOrderMock.mockResolvedValue(
      err({
        code: 'EDGE_FUNCTION_ERROR',
        message: 'void failed',
      })
    );

    const { result } = renderHook(() => useVoidOrder(), { wrapper });
    const response = await result.current.voidOrder({
      tabId: order.tabId,
      order,
      reason: 'Mistake',
      staffId: order.staffId,
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('SUPABASE_ERROR');
      expect(response.error.message).toBe('void failed');
    }
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});
