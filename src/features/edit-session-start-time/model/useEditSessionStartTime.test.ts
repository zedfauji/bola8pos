/**
 * Unit tests for useEditSessionStartTime hook.
 */

import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as poolTableQueries from '@entities/pool-table/model/queries';
import type { PoolSession } from '@shared/lib/domain';
import { err, ok } from '@shared/lib/result';

// ---------------------------------------------------------------------------
// Mock useMutationUpdateSessionStartTime
// ---------------------------------------------------------------------------

const mockMutateAsync = vi.fn();
let mockIsPending = false;

vi.mock('@entities/pool-table/model/queries', async importOriginal => {
  const actual = await importOriginal<typeof poolTableQueries>();
  return {
    ...actual,
    useMutationUpdateSessionStartTime: () => ({
      mutateAsync: mockMutateAsync,
      isPending: mockIsPending,
    }),
  };
});

// Import AFTER mocks

import { useEditSessionStartTime } from './useEditSessionStartTime';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = new Date('2026-04-21T12:00:00.000Z');

const baseSession: PoolSession = {
  id: 'session-uuid-001',
  tableId: 'table-uuid-001',
  tabId: 'tab-uuid-001',
  startedAt: new Date('2026-04-21T10:00:00.000Z'),
  stoppedAt: null,
  billedMinutes: null,
  totalCharge: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useEditSessionStartTime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns VALIDATION_ERROR when startedAt is in the future', async () => {
    const { result } = renderHook(() => useEditSessionStartTime());
    const futureDate = new Date('2026-04-21T13:00:00.000Z');

    let res: Awaited<ReturnType<typeof result.current.editStartTime>> | undefined;
    await act(async () => {
      res = await result.current.editStartTime(baseSession, futureDate);
    });

    expect(res?.ok).toBe(false);
    if (res && !res.ok) {
      expect(res.error.code).toBe('VALIDATION_ERROR');
    }
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('returns VALIDATION_ERROR when startedAt is after stoppedAt', async () => {
    const stoppedSession: PoolSession = {
      ...baseSession,
      stoppedAt: new Date('2026-04-21T11:00:00.000Z'),
    };
    const afterStopped = new Date('2026-04-21T11:30:00.000Z');

    const { result } = renderHook(() => useEditSessionStartTime());

    let res: Awaited<ReturnType<typeof result.current.editStartTime>> | undefined;
    await act(async () => {
      res = await result.current.editStartTime(stoppedSession, afterStopped);
    });

    expect(res?.ok).toBe(false);
    if (res && !res.ok) {
      expect(res.error.code).toBe('VALIDATION_ERROR');
    }
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('calls mutation with correct args for a valid past date', async () => {
    const validPastDate = new Date('2026-04-21T09:00:00.000Z');
    mockMutateAsync.mockResolvedValueOnce(ok({ id: 'session-uuid-001' }));

    const { result } = renderHook(() => useEditSessionStartTime());

    let res: Awaited<ReturnType<typeof result.current.editStartTime>> | undefined;
    await act(async () => {
      res = await result.current.editStartTime(baseSession, validPastDate);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      sessionId: baseSession.id,
      startedAt: validPastDate,
    });
    expect(res?.ok).toBe(true);
  });

  it('returns error result when mutation fails', async () => {
    const validPastDate = new Date('2026-04-21T09:00:00.000Z');
    mockMutateAsync.mockResolvedValueOnce(
      err({ code: 'SUPABASE_ERROR' as const, message: 'DB error' })
    );

    const { result } = renderHook(() => useEditSessionStartTime());

    let res: Awaited<ReturnType<typeof result.current.editStartTime>> | undefined;
    await act(async () => {
      res = await result.current.editStartTime(baseSession, validPastDate);
    });

    expect(res?.ok).toBe(false);
    if (res && !res.ok) {
      expect(res.error.code).toBe('SUPABASE_ERROR');
    }
  });

  it('isPending reflects mutation state', () => {
    mockIsPending = true;
    const { result } = renderHook(() => useEditSessionStartTime());
    expect(result.current.isPending).toBe(true);
  });
});
