import { useQuery, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Shift, Staff } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import {
  err,
  ok,
  supabaseMutation,
  supabaseQuery,
  unknownError,
  type Result,
} from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import type { Tables } from '@shared/lib/supabase.types';
import { useStaffStore } from './store';
import { ShiftSchema, StaffSchema } from './types';

export const staffKeys = {
  all: ['staff'] as const,
  list: () => [...staffKeys.all, 'list'] as const,
};

function mapStaffRow(row: Tables<'profiles'>): Result<Staff> {
  try {
    const email =
      row.email && row.email.length > 0
        ? row.email
        : (`noreply+${row.id.replace(/-/g, '')}@example.com` as const);
    return ok(
      StaffSchema.parse({
        id: row.id,
        name: row.name,
        email,
        role: row.role,
        pin: row.pin,
        isActive: row.is_active,
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

function mapShiftRow(row: Tables<'shifts'>): Result<Shift> {
  try {
    return ok(
      ShiftSchema.parse({
        id: row.id,
        staffId: row.staff_id,
        clockIn: new Date(row.clock_in),
        clockOut: row.clock_out ? new Date(row.clock_out) : null,
        openingCash: row.opening_cash,
        closingCash: row.closing_cash,
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

/** Active staff profiles; syncs {@link useStaffStore} `staffList` on success. */
export function useStaffList() {
  const setStaffList = useStaffStore(s => s.setStaffList);

  const query = useQuery({
    queryKey: staffKeys.list(),
    queryFn: async (): Promise<Result<Staff[]>> => {
      const res = await supabaseQuery(() =>
        supabase.from('profiles').select('*').eq('is_active', true).order('name')
      );

      if (!res.ok) {
        logger.error('staff.list.fetch_failed', { message: res.error.message });
        return res;
      }

      const staff: Staff[] = [];
      for (const row of res.data) {
        const m = mapStaffRow(row);
        if (!m.ok) {
          logger.error('staff.list.map_failed', { message: m.error.message });
          return m;
        }
        staff.push(m.data);
      }
      return ok(staff);
    },
  });

  useEffect(() => {
    if (query.data?.ok) {
      setStaffList(query.data.data);
    }
  }, [query.data, setStaffList]);

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: query.isSuccess && !!r?.ok && r.data.length === 0,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

type ClockContext = { previousShift: Shift | null | undefined };

export function useMutationClockIn() {
  return useMutation({
    mutationFn: async ({
      staffId,
      openingCash,
    }: {
      staffId: string;
      openingCash: number;
    }): Promise<Result<Shift>> => {
      const res = await supabaseMutation(() =>
        supabase
          .from('shifts')
          .insert({
            staff_id: staffId,
            opening_cash: openingCash,
          })
          .select()
          .single()
      );

      if (!res.ok) {
        logger.error('staff.clock_in.insert_failed', { message: res.error.message });
        return res;
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- narrow for mapShiftRow
      if (res.data == null) {
        return err(unknownError('no_row'));
      }

      return mapShiftRow(res.data);
    },

    onMutate: ({ staffId, openingCash }): ClockContext => {
      const previousShift = useStaffStore.getState().currentShift;
      const tempId = crypto.randomUUID();
      const optimistic = ShiftSchema.parse({
        id: tempId,
        staffId,
        clockIn: new Date(),
        clockOut: null,
        openingCash,
        closingCash: null,
      });
      useStaffStore.getState().updateShift(optimistic);
      return { previousShift };
    },

    onSuccess: (result, _vars, ctx) => {
      const c = ctx as ClockContext | undefined;
      if (!result.ok) {
        logger.error('staff.clock_in.failed', { message: result.error.message });
        if (c?.previousShift) {
          useStaffStore.getState().updateShift(c.previousShift);
        } else {
          useStaffStore.setState({ currentShift: null });
        }
        return;
      }
      useStaffStore.getState().updateShift(result.data);
    },

    onError: (_e, _v, ctx) => {
      const c = ctx;
      if (c?.previousShift) {
        useStaffStore.getState().updateShift(c.previousShift);
      } else {
        useStaffStore.setState({ currentShift: null });
      }
    },
  });
}

export function useMutationClockOut() {
  return useMutation({
    mutationFn: async ({
      shiftId,
      closingCash,
    }: {
      shiftId: string;
      closingCash: number;
    }): Promise<Result<Shift>> => {
      const res = await supabaseMutation(() =>
        supabase
          .from('shifts')
          .update({
            clock_out: new Date().toISOString(),
            closing_cash: closingCash,
          })
          .eq('id', shiftId)
          .select()
          .single()
      );

      if (!res.ok) {
        logger.error('staff.clock_out.update_failed', { message: res.error.message });
        return res;
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- narrow for mapShiftRow
      if (res.data == null) {
        return err(unknownError('no_row'));
      }

      return mapShiftRow(res.data);
    },

    onMutate: ({ shiftId, closingCash }): ClockContext => {
      const previousShift = useStaffStore.getState().currentShift;
      const cur = previousShift;
      if (cur && cur.id === shiftId) {
        useStaffStore.getState().updateShift({
          ...cur,
          clockOut: new Date(),
          closingCash,
        });
      }
      return { previousShift };
    },

    onSuccess: (result, _vars, ctx) => {
      const c = ctx as ClockContext | undefined;
      if (!result.ok) {
        logger.error('staff.clock_out.failed', { message: result.error.message });
        if (c?.previousShift) {
          useStaffStore.getState().updateShift(c.previousShift);
        }
        return;
      }
      useStaffStore.getState().updateShift(result.data);
    },

    onError: (_e, _v, ctx) => {
      const prev = ctx?.previousShift;
      if (prev) {
        useStaffStore.getState().updateShift(prev);
      }
    },
  });
}
