import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { resourceKeys } from '@entities/resource/model/queries';
import { useResourceStore } from '@entities/resource/model/store';
import { tabKeys } from '@entities/tab/model/queries';
import {
  ok,
  supabaseMutation,
  supabaseQuery,
  versionedMutation,
  type Result,
} from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import { handleVersionError, TERMINAL_ID } from '@shared/lib/version-error';

export interface StopAndMoveInput {
  sessionId: string;
  tableId: string;
  tabId: string;
  ratePerHour: number;
  newTableNumber: number;
  /** Optimistic-concurrency version from the cached session row (Phase 15). */
  version: number | undefined;
}

export function useStopAndMoveSession() {
  const qc = useQueryClient();
  const expectedTabVersionRef = useRef(0);

  return useMutation({
    mutationFn: async (input: StopAndMoveInput): Promise<Result<void>> => {
      // Step 1/2: Stop the pool session via the server-authoritative RPC —
      // it computes billing and bumps `version` atomically (bump_version_on_update
      // trigger rejects any pool_sessions UPDATE that doesn't advance version by 1;
      // see useMutationStopSession in entities/resource/model/queries.ts for the
      // sibling call site this mirrors).
      const rpcRes = await supabaseQuery(() =>
        supabase.rpc('stop_pool_session', {
          p_session_id: input.sessionId,
          ...(input.version !== undefined ? { p_expected_version: input.version } : {}),
        })
      );

      if (!rpcRes.ok) return rpcRes;

      // Step 3: Mark pool table as available and clear session reference
      const tableRes = await supabaseMutation(() =>
        supabase
          .from('resources')
          .update({ status: 'available', current_session_id: null })
          .eq('id', input.tableId)
      );

      if (!tableRes.ok) return tableRes;

      // Step 4: Update tab's table_number to the new regular table.
      // tabs also has a bump_version_on_update trigger (trg_tabs_version) —
      // fetch the current version first, same pattern as pool_sessions above.
      const tabVersionRes = await supabaseQuery<{ version: number }>(() =>
        supabase.from('tabs').select('version').eq('id', input.tabId).single()
      );
      if (!tabVersionRes.ok) return tabVersionRes;
      expectedTabVersionRef.current = tabVersionRes.data.version;

      const tabRes = await versionedMutation(() =>
        supabase
          .from('tabs')
          .update({
            table_number: input.newTableNumber,
            version: tabVersionRes.data.version + 1,
          })
          .eq('id', input.tabId)
          .eq('version', tabVersionRes.data.version)
          .select('id')
      );

      if (!tabRes.ok) return tabRes;

      return ok(undefined);
    },

    onMutate: ({ tableId }) => {
      useResourceStore.getState().updateTableStatus(tableId, 'available');
    },

    onSuccess: (result, input) => {
      if (!result.ok) {
        handleVersionError(result.error, {
          queryClient: qc,
          queryKey: tabKeys.all,
          entity: 'tabs',
          entityId: input.tabId,
          expectedVersion: expectedTabVersionRef.current,
          supabase,
          terminalId: TERMINAL_ID,
        });
        useResourceStore.getState().updateTableStatus(input.tableId, 'occupied');
        return;
      }
      void qc.invalidateQueries({ queryKey: resourceKeys.all });
      // eslint-disable-next-line i18next/no-literal-string -- TanStack Query cache keys, not UI copy
      void qc.invalidateQueries({ queryKey: ['pool-sessions'] });
      // eslint-disable-next-line i18next/no-literal-string -- TanStack Query cache key, not UI copy
      void qc.invalidateQueries({ queryKey: ['tabs'] });
    },

    onError: (_e, input) => {
      useResourceStore.getState().updateTableStatus(input.tableId, 'occupied');
    },
  });
}
