import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tabKeys } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import { supabase } from '@shared/lib/supabase';
import { useCloseTab } from '../index';

vi.mock('@shared/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@entities/tab/model/store', () => ({
  useTabStore: vi.fn(),
}));

const clearSelectionMock = vi.fn();

let poolSessionsResult: { data: unknown; error: unknown };
let tabsMutationResult: { data: unknown; error: unknown };
let tabsUpdateFn: ReturnType<typeof vi.fn>;

describe('useCloseTab', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    vi.clearAllMocks();
    poolSessionsResult = { data: [], error: null };
    tabsMutationResult = { data: null, error: null };

    vi.mocked(useTabStore).mockImplementation(fn =>
      fn({
        clearSelection: clearSelectionMock,
      } as never)
    );

    tabsUpdateFn = vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve(tabsMutationResult)),
    }));

    // eslint-disable-next-line @typescript-eslint/unbound-method -- `from` is a vi.fn() test double, not the real Supabase client
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'pool_sessions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn(() => Promise.resolve(poolSessionsResult)),
        };
      }
      if (table === 'tabs') {
        return {
          update: tabsUpdateFn,
        };
      }
      return {};
    });
  });

  it('closes tab when no running pool sessions', async () => {
    const { result } = renderHook(() => useCloseTab(), { wrapper });
    const closeResult = await result.current.closeTab('tab-123');

    expect(closeResult.ok).toBe(true);
    if (closeResult.ok) {
      expect(closeResult.data).toBeUndefined();
    }
    expect(toast.success).toHaveBeenCalledWith('Tab closed successfully.');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: tabKeys.lists() })
    );
    expect(clearSelectionMock).toHaveBeenCalled();
    expect(tabsUpdateFn).toHaveBeenCalled();
  });

  it('returns session still running when one pool session is active', async () => {
    poolSessionsResult = {
      data: [{ pool_tables: { number: 3 } }],
      error: null,
    };

    const { result } = renderHook(() => useCloseTab(), { wrapper });
    const closeResult = await result.current.closeTab('tab-123');

    expect(closeResult.ok).toBe(false);
    if (!closeResult.ok) {
      expect(closeResult.error.message).toContain('3');
    }
    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(tabsUpdateFn).not.toHaveBeenCalled();
  });

  it('uses first running session table when multiple sessions exist', async () => {
    poolSessionsResult = {
      data: [{ pool_tables: { number: 3 } }, { pool_tables: { number: 7 } }],
      error: null,
    };

    const { result } = renderHook(() => useCloseTab(), { wrapper });
    const closeResult = await result.current.closeTab('tab-123');

    expect(closeResult.ok).toBe(false);
    if (!closeResult.ok) {
      expect(closeResult.error.message).toContain('3');
      expect(closeResult.error.message).not.toContain('7');
    }
    expect(tabsUpdateFn).not.toHaveBeenCalled();
  });

  it('defaults table number when pool_tables is null', async () => {
    poolSessionsResult = {
      data: [{ pool_tables: null }],
      error: null,
    };

    const { result } = renderHook(() => useCloseTab(), { wrapper });
    const closeResult = await result.current.closeTab('tab-123');

    expect(closeResult.ok).toBe(false);
    if (!closeResult.ok) {
      expect(closeResult.error.message).toContain('1');
    }
    expect(tabsUpdateFn).not.toHaveBeenCalled();
  });

  it('returns error when pool_sessions query fails', async () => {
    poolSessionsResult = {
      data: null,
      error: { message: 'network error', code: 'NET_ERROR' },
    };

    const { result } = renderHook(() => useCloseTab(), { wrapper });
    const closeResult = await result.current.closeTab('tab-123');

    expect(closeResult.ok).toBe(false);
    expect(toast.error).toHaveBeenCalled();
    expect(tabsUpdateFn).not.toHaveBeenCalled();
  });
});
