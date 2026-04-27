import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { tabKeys } from '@entities/tab/model/queries';
import * as connectivity from '@shared/lib/connectivity';
import { supabase } from '@shared/lib/supabase';

import { useRemoveTabItem, type RemoveTabItemInput } from './useRemoveTabItem';

// ---------------------------------------------------------------------------
// Mocks — Supabase is globally mocked by test-setup.ts.
// isOnline is mocked via the module namespace.
// ---------------------------------------------------------------------------

vi.mock('@shared/lib/connectivity', () => ({
  isOnline: vi.fn(() => true),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseInput: RemoveTabItemInput = {
  tabId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  orderId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  itemId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  productId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  quantity: 1,
};

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

/** Returns a chainable Supabase builder that resolves with the given result. */
function makeBuilder(resolved: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolved),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
    then: (resolve: (v: typeof resolved) => void) => Promise.resolve(resolved).then(resolve),
  };
  return builder;
}

// supabase.from is already a vi.fn() from the global mock in test-setup.ts.
// vi.mocked guarantees this is a mock function; the unbound-method warning does not apply.
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedFrom = vi.mocked(supabase).from;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRemoveTabItem', () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = makeQueryClient();
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(connectivity.isOnline).mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('returns ok and invalidates tab queries on successful delete', async () => {
    // DELETE succeeds, remaining items check returns empty list → void order
    const deleteBuilder = makeBuilder({ data: null, error: null });
    const remainingBuilder = makeBuilder({ data: [], error: null });
    const voidBuilder = makeBuilder({ data: null, error: null });

    let callCount = 0;
    mockedFrom.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) return deleteBuilder as unknown as ReturnType<typeof supabase.from>;
      if (callCount === 2) return remainingBuilder as unknown as ReturnType<typeof supabase.from>;
      return voidBuilder as unknown as ReturnType<typeof supabase.from>;
    });

    const wrapper = makeWrapper(queryClient);
    const { result } = renderHook(() => useRemoveTabItem(), { wrapper });

    const res = await result.current.removeTabItem(baseInput);

    expect(res.ok).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: tabKeys.detail(baseInput.tabId) })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: tabKeys.lists() })
    );
  });

  it('does NOT void order when items remain after removal', async () => {
    const deleteBuilder = makeBuilder({ data: null, error: null });
    // Remaining check returns 1 item → order should NOT be voided
    const remainingBuilder = makeBuilder({
      data: [{ id: 'item-still-there' }],
      error: null,
    });
    const voidBuilder = makeBuilder({ data: null, error: null });

    let callCount = 0;
    mockedFrom.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) return deleteBuilder as unknown as ReturnType<typeof supabase.from>;
      if (callCount === 2) return remainingBuilder as unknown as ReturnType<typeof supabase.from>;
      return voidBuilder as unknown as ReturnType<typeof supabase.from>;
    });

    const wrapper = makeWrapper(queryClient);
    const { result } = renderHook(() => useRemoveTabItem(), { wrapper });

    const res = await result.current.removeTabItem(baseInput);

    expect(res.ok).toBe(true);
    // Void builder should NOT have been reached (only 2 from() calls)
    expect(callCount).toBe(2);
  });

  it('voids order when last item is removed', async () => {
    const deleteBuilder = makeBuilder({ data: null, error: null });
    const remainingBuilder = makeBuilder({ data: [], error: null });
    const voidBuilder = makeBuilder({ data: null, error: null });

    let callCount = 0;
    mockedFrom.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) return deleteBuilder as unknown as ReturnType<typeof supabase.from>;
      if (callCount === 2) return remainingBuilder as unknown as ReturnType<typeof supabase.from>;
      return voidBuilder as unknown as ReturnType<typeof supabase.from>;
    });

    const wrapper = makeWrapper(queryClient);
    const { result } = renderHook(() => useRemoveTabItem(), { wrapper });

    const res = await result.current.removeTabItem(baseInput);

    expect(res.ok).toBe(true);
    // void builder must have been called (3 from() calls total)
    expect(callCount).toBe(3);
  });

  it('returns SUPABASE_ERROR when DELETE fails', async () => {
    const failBuilder = makeBuilder({
      data: null,
      error: { message: 'delete failed', code: '500', details: '', hint: '' },
    });

    mockedFrom.mockReturnValue(failBuilder as unknown as ReturnType<typeof supabase.from>);

    const wrapper = makeWrapper(queryClient);
    const { result } = renderHook(() => useRemoveTabItem(), { wrapper });

    const res = await result.current.removeTabItem(baseInput);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('SUPABASE_ERROR');
    }
  });

  it('returns NETWORK_OFFLINE error without calling Supabase when offline', async () => {
    vi.mocked(connectivity.isOnline).mockReturnValue(false);

    const wrapper = makeWrapper(queryClient);
    const { result } = renderHook(() => useRemoveTabItem(), { wrapper });

    const res = await result.current.removeTabItem(baseInput);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('NETWORK_OFFLINE');
    }
    expect(mockedFrom).not.toHaveBeenCalled();
  });
});
