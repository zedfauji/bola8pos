import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as EntityResource from '@entities/resource';
import { err, ok } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

// ---------------------------------------------------------------------------
// Mock useMutationAddResource from the resource entity barrel — Task 1 composes
// the new hook on top of this mutation rather than hand-rolling the insert.
// ---------------------------------------------------------------------------

const mockAddResource = vi.fn();

vi.mock('@entities/resource', async importOriginal => {
  const actual = await importOriginal<typeof EntityResource>();
  return {
    ...actual,
    useMutationAddResource: () => ({
      mutateAsync: mockAddResource,
      isPending: false,
    }),
  };
});

// ---------------------------------------------------------------------------
// Import the hooks AFTER mocks are set up
// ---------------------------------------------------------------------------

import { useSeatAtNewTable } from './useSeatWaitlistParty';

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedFrom = vi.mocked(supabase).from;

function mockWaitlistUpdate(error: unknown = null): void {
  mockedFrom.mockImplementation((table: string) => {
    if (table === 'waitlist_entries') {
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error }),
      } as unknown as ReturnType<typeof supabase.from>;
    }
    throw new Error(`Unexpected table in mock: ${table}`);
  });
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

const EXISTING_TABLES = [
  { number: 1, ratePerHour: 10 },
  { number: 3, ratePerHour: 15 },
];

describe('useSeatAtNewTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWaitlistUpdate(null);
  });

  it('computes the next number as one greater than the max existing number', async () => {
    mockAddResource.mockResolvedValueOnce(
      ok({
        id: 'new-table-id',
        number: 4,
        label: 'Table 4',
        ratePerHour: 15,
        status: 'available' as const,
        tableType: 'floating' as const,
        isTemp: true,
        currentSessionId: null,
      })
    );

    const { result } = renderHook(() => useSeatAtNewTable(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.seatAtNewTable({
        entryId: 'entry-1',
        entryName: 'García',
        tables: EXISTING_TABLES,
      });
    });

    expect(mockAddResource).toHaveBeenCalledWith(
      expect.objectContaining({ number: 4, ratePerHour: 15 })
    );
  });

  it('yields number 1 when there are no existing tables', async () => {
    mockAddResource.mockResolvedValueOnce(
      ok({
        id: 'new-table-id',
        number: 1,
        label: 'Table 1',
        ratePerHour: 12,
        status: 'available' as const,
        tableType: 'floating' as const,
        isTemp: true,
        currentSessionId: null,
      })
    );

    const { result } = renderHook(() => useSeatAtNewTable(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.seatAtNewTable({ entryId: 'entry-1', entryName: 'García', tables: [] });
    });

    expect(mockAddResource).toHaveBeenCalledWith(
      expect.objectContaining({ number: 1, ratePerHour: 12 })
    );
  });

  it('carries the floating type and temp flag on create', async () => {
    mockAddResource.mockResolvedValueOnce(
      ok({
        id: 'new-table-id',
        number: 4,
        label: 'Table 4',
        ratePerHour: 15,
        status: 'available' as const,
        tableType: 'floating' as const,
        isTemp: true,
        currentSessionId: null,
      })
    );

    const { result } = renderHook(() => useSeatAtNewTable(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.seatAtNewTable({
        entryId: 'entry-1',
        entryName: 'García',
        tables: EXISTING_TABLES,
      });
    });

    expect(mockAddResource).toHaveBeenCalledWith(
      expect.objectContaining({ tableType: 'floating', isTemp: true })
    );
  });

  it('seats the waitlist entry at the newly created resource id on success', async () => {
    mockAddResource.mockResolvedValueOnce(
      ok({
        id: 'new-table-id',
        number: 4,
        label: 'Table 4',
        ratePerHour: 15,
        status: 'available' as const,
        tableType: 'floating' as const,
        isTemp: true,
        currentSessionId: null,
      })
    );

    const { result } = renderHook(() => useSeatAtNewTable(), { wrapper: makeWrapper() });

    let res: Awaited<ReturnType<typeof result.current.seatAtNewTable>> | undefined;
    await act(async () => {
      res = await result.current.seatAtNewTable({
        entryId: 'entry-1',
        entryName: 'García',
        tables: EXISTING_TABLES,
      });
    });

    expect(res?.ok).toBe(true);
    // The seat path targets the created resource id via the waitlist_entries update chain.
    const fromCalls = mockedFrom.mock.calls.map(call => call[0]);
    expect(fromCalls).toContain('waitlist_entries');
  });

  it('does not attempt to seat when creation fails, and surfaces the error', async () => {
    mockAddResource.mockResolvedValueOnce(err({ code: 'SUPABASE_ERROR', message: 'insert failed' }));

    const { result } = renderHook(() => useSeatAtNewTable(), { wrapper: makeWrapper() });

    let res: Awaited<ReturnType<typeof result.current.seatAtNewTable>> | undefined;
    await act(async () => {
      res = await result.current.seatAtNewTable({
        entryId: 'entry-1',
        entryName: 'García',
        tables: EXISTING_TABLES,
      });
    });

    expect(res?.ok).toBe(false);
    if (res && !res.ok) {
      expect(res.error.code).toBe('SUPABASE_ERROR');
    }
    // waitlist_entries update must never be attempted when create fails.
    const fromCalls = mockedFrom.mock.calls.map(call => call[0]);
    expect(fromCalls).not.toContain('waitlist_entries');
  });

  it('surfaces a failure Result (not swallowed) when create succeeds but seating fails', async () => {
    mockAddResource.mockResolvedValueOnce(
      ok({
        id: 'new-table-id',
        number: 4,
        label: 'Table 4',
        ratePerHour: 15,
        status: 'available' as const,
        tableType: 'floating' as const,
        isTemp: true,
        currentSessionId: null,
      })
    );
    mockWaitlistUpdate({ message: 'seat update failed' });

    const { result } = renderHook(() => useSeatAtNewTable(), { wrapper: makeWrapper() });

    let res: Awaited<ReturnType<typeof result.current.seatAtNewTable>> | undefined;
    await act(async () => {
      res = await result.current.seatAtNewTable({
        entryId: 'entry-1',
        entryName: 'García',
        tables: EXISTING_TABLES,
      });
    });

    expect(res?.ok).toBe(false);
  });
});
