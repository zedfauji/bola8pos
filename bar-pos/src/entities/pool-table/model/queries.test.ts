/**
 * Unit tests for useMutationStopSession (Phase 20 Plan 08 — Pitfall 3 RPC rewire).
 *
 * Verifies the pool-session stop write now goes through the
 * `stop_pool_session` SECURITY DEFINER RPC instead of a raw client
 * `.update()`:
 *   - the cached session version is forwarded as p_expected_version
 *   - the RPC's returned jsonb is mapped into a PoolSession carrying the
 *     server-computed total_charge/billed_minutes
 *   - a P0V01 (stale-version) RPC error resolves to a staleVersionError
 *     Result rather than throwing
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PoolSession } from '@shared/lib/domain';
import type { Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import { useMutationStopSession } from './queries';

// ---------------------------------------------------------------------------
// Supabase mock handles (globally mocked in test-setup.ts)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedFrom = vi.mocked(supabase).from;
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedRpc = vi.mocked(supabase).rpc;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const TABLE_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const TAB_ID = 'cccccccc-0000-0000-0000-000000000003';

function makeSessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: SESSION_ID,
    table_id: TABLE_ID,
    tab_id: TAB_ID,
    started_at: '2026-07-09T20:00:00.000Z',
    stopped_at: null,
    billed_minutes: null,
    total_charge: null,
    previous_table_id: null,
    version: 3,
    ...overrides,
  };
}

/** Mocks `.from('pool_sessions').select('*').eq('id', id).single()`. */
function mockSessionFetch(row: Record<string, unknown> | null, error: unknown = null): void {
  mockedFrom.mockImplementation((table: string) => {
    if (table === 'pool_sessions') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: row, error }),
      } as unknown as ReturnType<typeof supabase.from>;
    }
    if (table === 'pool_tables') {
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
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

describe('useMutationStopSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls stop_pool_session with p_session_id + p_expected_version from the cached version', async () => {
    mockSessionFetch(makeSessionRow({ version: 5 }));
    mockedRpc.mockResolvedValue({
      data: {
        id: SESSION_ID,
        stopped_at: '2026-07-09T20:40:00.000Z',
        billed_minutes: 45,
        total_charge: 75,
        version: 6,
        tab_id: TAB_ID,
        table_id: TABLE_ID,
      },
      error: null,
    } as never);

    const { result } = renderHook(() => useMutationStopSession(), { wrapper: makeWrapper() });

    let mutationResult: Result<PoolSession> | undefined;
    await act(async () => {
      mutationResult = await result.current.mutateAsync({
        sessionId: SESSION_ID,
        tableId: TABLE_ID,
        ratePerHour: 100,
      });
    });

    expect(mockedRpc).toHaveBeenCalledWith('stop_pool_session', {
      p_session_id: SESSION_ID,
      p_expected_version: 5,
    });
    expect(mutationResult?.ok).toBe(true);
  });

  it('maps the RPC jsonb payload into a PoolSession with server-provided billed_minutes/total_charge', async () => {
    mockSessionFetch(makeSessionRow({ version: 2 }));
    mockedRpc.mockResolvedValue({
      data: {
        id: SESSION_ID,
        stopped_at: '2026-07-09T20:40:00.000Z',
        billed_minutes: 60,
        total_charge: 100,
        version: 3,
        tab_id: TAB_ID,
        table_id: TABLE_ID,
      },
      error: null,
    } as never);

    const { result } = renderHook(() => useMutationStopSession(), { wrapper: makeWrapper() });

    let mutationResult: Result<PoolSession> | undefined;
    await act(async () => {
      mutationResult = await result.current.mutateAsync({
        sessionId: SESSION_ID,
        tableId: TABLE_ID,
        ratePerHour: 100,
      });
    });

    expect(mutationResult?.ok).toBe(true);
    if (mutationResult?.ok) {
      const session = mutationResult.data;
      expect(session.id).toBe(SESSION_ID);
      expect(session.billedMinutes).toBe(60);
      expect(session.totalCharge).toBe(100);
      expect(session.version).toBe(3);
      expect(session.stoppedAt).toBeInstanceOf(Date);
    }
  });

  it('maps a P0V01 stale-version RPC error to a staleVersionError Result (not a raw throw)', async () => {
    mockSessionFetch(makeSessionRow({ version: 1 }));
    mockedRpc.mockResolvedValue({
      data: null,
      error: { code: 'P0V01', message: 'STALE_VERSION' },
    } as never);

    const { result } = renderHook(() => useMutationStopSession(), { wrapper: makeWrapper() });

    let mutationResult: Result<PoolSession> | undefined;
    await act(async () => {
      mutationResult = await result.current.mutateAsync({
        sessionId: SESSION_ID,
        tableId: TABLE_ID,
        ratePerHour: 100,
      });
    });

    expect(mutationResult?.ok).toBe(false);
    if (mutationResult && !mutationResult.ok) {
      expect(mutationResult.error.code).toBe('STALE_VERSION');
    }

    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isError).toBe(true);
    });
  });
});
