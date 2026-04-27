/**
 * OPEN TAB HOOK TESTS
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as queries from '@entities/tab/model/queries';
import * as store from '@entities/tab/model/store';
import { ok, err } from '@shared/lib/result';
import { useOpenTab } from './useOpenTab';

// Mock the dependencies
vi.mock('@entities/tab/model/queries');
vi.mock('@entities/tab/model/store');
vi.mock('@shared/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
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

describe('useOpenTab', () => {
  let queryClient: QueryClient;
  const mockSelectTab = vi.fn();
  const mockCloseDrawer = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();

    // Mock useTabStore
    vi.mocked(store.useTabStore).mockReturnValue({
      selectedTabId: null,
      isTabDrawerOpen: false,
      selectTab: mockSelectTab,
      clearSelection: vi.fn(),
      openDrawer: vi.fn(),
      closeDrawer: mockCloseDrawer,
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should open a tab successfully', async () => {
    const mockTab = {
      id: 'tab-123',
      customerName: 'John Doe',
      tableNumber: 5,
      staffId: 'staff-123',
      shiftId: 'shift-123',
      openedAt: new Date(),
      closedAt: null,
      status: 'open' as const,
      notes: null,
      orders: [],
      items: [],
      poolCharges: [],
    };

    const mockMutateAsync = vi.fn().mockResolvedValue(ok(mockTab));
    vi.mocked(queries.useMutationOpenTab).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);

    const { result } = renderHook(() => useOpenTab(), { wrapper });

    const openResult = await result.current.openTab({
      customerName: 'John Doe',
      tableNumber: 5,
      staffId: 'staff-123',
      shiftId: 'shift-123',
      status: 'open',
      notes: null,
      items: [],
    });

    await waitFor(() => {
      expect(openResult.ok).toBe(true);
    });

    if (openResult.ok) {
      expect(openResult.data).toEqual(mockTab);
      expect(mockSelectTab).toHaveBeenCalledWith('tab-123');
      expect(mockCloseDrawer).toHaveBeenCalled();
    }
  });

  it('should handle errors when opening a tab fails', async () => {
    const mockMutateAsync = vi
      .fn()
      .mockResolvedValue(err({ code: 'SUPABASE_ERROR', message: 'Database connection failed' }));

    vi.mocked(queries.useMutationOpenTab).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);

    const { result } = renderHook(() => useOpenTab(), { wrapper });

    const openResult = await result.current.openTab({
      customerName: 'Jane Doe',
      tableNumber: null,
      staffId: 'staff-456',
      shiftId: 'shift-456',
      status: 'open',
      notes: null,
      items: [],
    });

    expect(openResult.ok).toBe(false);
    if (!openResult.ok) {
      expect(openResult.error.code).toBe('SUPABASE_ERROR');
      expect(openResult.error.message).toBe('Database connection failed');
    }

    expect(mockSelectTab).not.toHaveBeenCalled();
    expect(mockCloseDrawer).not.toHaveBeenCalled();
  });

  it('should expose isPending state from mutation', () => {
    vi.mocked(queries.useMutationOpenTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as any);

    const { result } = renderHook(() => useOpenTab(), { wrapper });

    expect(result.current.isPending).toBe(true);
  });
});
