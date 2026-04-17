import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@shared/lib/supabase';
import {
  staffKeys,
  useMutationClockIn,
  useMutationClockOut,
  useShiftClosePreview,
} from './queries';
import { useStaffStore } from './store';

vi.mock('@shared/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

const shiftId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const staffId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tabId1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const staffRow = {
  id: staffId,
  staff_id: staffId,
  clock_in: '2026-04-17T08:00:00.000Z',
  clock_out: null,
  opening_cash: 50,
  closing_cash: null,
};

describe('useShiftClosePreview', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  let tabsEqResult: { data: { id: string }[] | null; error: unknown };
  let shiftSingleResult: { data: { clock_in: string }; error: unknown };
  let ordersInResult: { data: { id: string }[]; error: unknown };
  let paymentsInResult: { data: { amount: number }[]; error: unknown };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    tabsEqResult = { data: [], error: null };
    shiftSingleResult = {
      data: { clock_in: '2026-04-17T08:00:00.000Z' },
      error: null,
    };
    ordersInResult = { data: [{ id: 'o1' }], error: null };
    paymentsInResult = { data: [{ amount: 40 }, { amount: 10 }], error: null };

    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(supabase.from).mockReset();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'tabs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(() => Promise.resolve(tabsEqResult)),
        };
      }
      if (table === 'shifts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(() => Promise.resolve(shiftSingleResult)),
        };
      }
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn(() => Promise.resolve(ordersInResult)),
        };
      }
      if (table === 'payments') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn(() => Promise.resolve(paymentsInResult)),
        };
      }
      return {};
    });
  });

  it('does not run query when shiftId or staffId is null', () => {
    const { result } = renderHook(() => useShiftClosePreview(null, null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns zeros when tab list empty and loads shift start', async () => {
    const { result } = renderHook(() => useShiftClosePreview(shiftId, staffId), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const d = result.current.data;
    expect(d?.orderCount).toBe(0);
    expect(d?.totalSales).toBe(0);
    expect(d?.shiftStartedAt).toEqual(new Date('2026-04-17T08:00:00.000Z'));
  });

  it('aggregates orders and payments when tabs exist', async () => {
    tabsEqResult = { data: [{ id: tabId1 }], error: null };

    const { result } = renderHook(() => useShiftClosePreview(shiftId, staffId), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.orderCount).toBe(1);
    expect(result.current.data?.totalSales).toBe(50);
  });

  it('surfaces resultError when tabs query fails', async () => {
    tabsEqResult = { data: null, error: { message: 'db', code: 'PGRST301' } };

    const { result } = renderHook(() => useShiftClosePreview(shiftId, staffId), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
    expect(result.current.resultError).toBeDefined();
  });
});

describe('useMutationClockIn', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  let insertSingleResult: { data: typeof staffRow | null; error: unknown };

  beforeEach(() => {
    insertSingleResult = {
      data: {
        ...staffRow,
        id: shiftId,
      },
      error: null,
    };

    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(supabase.from).mockReset();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'shifts') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn(() => Promise.resolve(insertSingleResult)),
        };
      }
      return {};
    });

    useStaffStore.setState({
      currentStaff: {
        id: staffId,
        name: 'T',
        email: 't@t.dev',
        role: 'bartender',
        pin: '123456',
        isActive: true,
      },
      currentShift: null,
      staffList: [],
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useStaffStore.getState().logout();
  });

  it('applies optimistic shift for current staff and replaces on success', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('dddddddd-dddd-4ddd-8ddd-dddddddddddd');

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useMutationClockIn(), { wrapper });

    const mutationResult = await result.current.mutateAsync({
      staffId,
      openingCash: 75,
    });

    expect(mutationResult.ok).toBe(true);
    const shiftAfter = useStaffStore.getState().currentShift;
    expect(shiftAfter?.id).toBe(shiftId);
    expect(shiftAfter?.openingCash).toBe(50);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: staffKeys.openShifts() })
    );
  });

  it('does not apply optimistic shift for other staff', async () => {
    const otherId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    insertSingleResult = {
      data: {
        ...staffRow,
        id: shiftId,
        staff_id: otherId,
      },
      error: null,
    };

    const { result } = renderHook(() => useMutationClockIn(), { wrapper });

    await result.current.mutateAsync({
      staffId: otherId,
      openingCash: 10,
    });

    expect(useStaffStore.getState().currentShift).toBeNull();
  });

  it('rolls back optimistic shift when mutation returns err', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    insertSingleResult = {
      data: null,
      error: { message: 'fail', code: '23505', name: 'PostgrestError', details: '', hint: '' },
    };

    const { result } = renderHook(() => useMutationClockIn(), { wrapper });

    const mutationResult = await result.current.mutateAsync({
      staffId,
      openingCash: 20,
    });

    expect(mutationResult.ok).toBe(false);
    expect(useStaffStore.getState().currentShift).toBeNull();
  });
});

describe('useMutationClockOut', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const openShift = {
    id: shiftId,
    staffId,
    clockIn: new Date('2026-04-17T08:00:00.000Z'),
    clockOut: null,
    openingCash: 50,
    closingCash: null,
  };

  let updateSingleResult: {
    data: {
      id: string;
      staff_id: string;
      clock_in: string;
      clock_out: string;
      opening_cash: number;
      closing_cash: number;
    } | null;
    error: unknown;
  };

  beforeEach(() => {
    updateSingleResult = {
      data: {
        id: shiftId,
        staff_id: staffId,
        clock_in: '2026-04-17T08:00:00.000Z',
        clock_out: '2026-04-17T20:00:00.000Z',
        opening_cash: 50,
        closing_cash: 120,
      },
      error: null,
    };

    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(supabase.from).mockReset();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'shifts') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn(() => Promise.resolve(updateSingleResult)),
        };
      }
      return {};
    });

    useStaffStore.setState({
      currentStaff: {
        id: staffId,
        name: 'T',
        email: 't@t.dev',
        role: 'bartender',
        pin: '123456',
        isActive: true,
      },
      currentShift: openShift,
      staffList: [],
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    useStaffStore.getState().logout();
  });

  it('optimistically sets clockOut then commits server shift', async () => {
    const { result } = renderHook(() => useMutationClockOut(), { wrapper });

    const mutationResult = await result.current.mutateAsync({
      shiftId,
      staffId,
      closingCash: 120,
    });

    expect(mutationResult.ok).toBe(true);
    if (mutationResult.ok) {
      expect(mutationResult.data.closingCash).toBe(120);
    }
    expect(useStaffStore.getState().currentShift?.clockOut).toEqual(
      new Date('2026-04-17T20:00:00.000Z')
    );
  });

  it('rolls back optimistic update when mutation returns err', async () => {
    const previous = { ...openShift };
    updateSingleResult = {
      data: null,
      error: { message: 'nope', code: 'PGRST116', name: 'PostgrestError', details: '', hint: '' },
    };

    const { result } = renderHook(() => useMutationClockOut(), { wrapper });

    const mutationResult = await result.current.mutateAsync({
      shiftId,
      staffId,
      closingCash: 99,
    });

    expect(mutationResult.ok).toBe(false);
    const cur = useStaffStore.getState().currentShift;
    expect(cur?.clockOut).toEqual(previous.clockOut);
    expect(cur?.closingCash).toBeNull();
  });
});
