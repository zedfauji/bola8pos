import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tabKeys } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import {
  err,
  ok,
  sessionStillRunningError,
  supabaseMutation,
  supabaseQuery,
  type Result,
} from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

type PoolSessionRunningRow = {
  pool_tables: { number: number } | null;
};

export function useCloseTab() {
  const queryClient = useQueryClient();
  const clearSelection = useTabStore(s => s.clearSelection);

  const mutation = useMutation({
    mutationFn: async (tabId: string): Promise<Result<void>> => {
      const sessionsRes = await supabaseQuery<PoolSessionRunningRow[]>(() =>
        supabase
          .from('pool_sessions')
          .select('pool_tables!pool_sessions_table_id_fkey(number)')
          .eq('tab_id', tabId)
          .is('stopped_at', null)
      );

      if (!sessionsRes.ok) {
        return sessionsRes;
      }

      if (sessionsRes.data.length > 0) {
        const tableNumber = sessionsRes.data[0]?.pool_tables?.number ?? 1;
        return err(sessionStillRunningError(tableNumber));
      }

      // tabs has a bump_version_on_update trigger (Phase 15) that rejects any
      // UPDATE not explicitly advancing `version` by 1 — fetch it first.
      const versionRes = await supabaseQuery<{ version: number }>(() =>
        supabase.from('tabs').select('version').eq('id', tabId).single()
      );
      if (!versionRes.ok) {
        return versionRes;
      }

      const upd = await supabaseMutation(() =>
        supabase
          .from('tabs')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            version: versionRes.data.version + 1,
          })
          .eq('id', tabId)
          .eq('version', versionRes.data.version)
      );

      if (!upd.ok) {
        return upd;
      }

      return ok(undefined);
    },
  });

  const closeTab = async (tabId: string): Promise<Result<void>> => {
    const result = await mutation.mutateAsync(tabId);
    if (!result.ok) {
      toast.error(result.error.message);
      return result;
    }
    toast.success('Tab closed successfully.');
    await queryClient.invalidateQueries({ queryKey: tabKeys.lists() });
    clearSelection();
    return result;
  };

  return { closeTab, isClosing: mutation.isPending };
}
