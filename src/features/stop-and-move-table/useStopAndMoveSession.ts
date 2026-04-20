import { useMutation, useQueryClient } from '@tanstack/react-query';
import { poolTableKeys } from '@entities/pool-table/model/queries';
import { usePoolTableStore } from '@entities/pool-table/model/store';
import { computePoolSessionBilling } from '@shared/lib/pool-billing';
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

export interface StopAndMoveInput {
  sessionId: string;
  tableId: string;
  tabId: string;
  ratePerHour: number;
  newTableNumber: number;
}

export function useStopAndMoveSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: StopAndMoveInput): Promise<Result<void>> => {
      // Step 1: Fetch the current session to compute billing
      const fetchRes = await supabaseQuery<Tables<'pool_sessions'>>(() =>
        supabase.from('pool_sessions').select('*').eq('id', input.sessionId).single()
      );

      if (!fetchRes.ok) return fetchRes;

      const session = fetchRes.data;
      const startedAt = new Date(session.started_at);
      const stoppedAt = new Date();
      const { billedMinutes, totalCharge } = computePoolSessionBilling({
        startedAt,
        endTime: stoppedAt,
        ratePerHour: input.ratePerHour,
      });

      // Step 2: Stop the pool session
      const sessionRes = await supabaseMutation<Tables<'pool_sessions'>>(() =>
        supabase
          .from('pool_sessions')
          .update({
            stopped_at: stoppedAt.toISOString(),
            billed_minutes: billedMinutes,
            total_charge: totalCharge,
          })
          .eq('id', input.sessionId)
          .select()
          .single()
      );

      if (!sessionRes.ok) return sessionRes;
      if (sessionRes.data === null) return err(unknownError('no_row'));

      // Step 3: Mark pool table as available and clear session reference
      const tableRes = await supabaseMutation(() =>
        supabase
          .from('pool_tables')
          .update({ status: 'available', current_session_id: null })
          .eq('id', input.tableId)
      );

      if (!tableRes.ok) return tableRes;

      // Step 4: Update tab's table_number to the new regular table
      const tabRes = await supabaseMutation(() =>
        supabase.from('tabs').update({ table_number: input.newTableNumber }).eq('id', input.tabId)
      );

      if (!tabRes.ok) return tabRes;

      return ok(undefined);
    },

    onMutate: ({ tableId }) => {
      usePoolTableStore.getState().updateTableStatus(tableId, 'available');
    },

    onSuccess: (result, input) => {
      if (!result.ok) {
        usePoolTableStore.getState().updateTableStatus(input.tableId, 'occupied');
        return;
      }
      void qc.invalidateQueries({ queryKey: poolTableKeys.all });
      void qc.invalidateQueries({ queryKey: ['pool-sessions'] });
      void qc.invalidateQueries({ queryKey: ['tabs'] });
    },

    onError: (_e, input) => {
      usePoolTableStore.getState().updateTableStatus(input.tableId, 'occupied');
    },
  });
}
