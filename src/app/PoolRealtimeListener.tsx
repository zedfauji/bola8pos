import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { poolTableKeys } from '@entities/pool-table/model/queries';
import { tabKeys } from '@entities/tab/model/queries';
import { supabase } from '@shared/lib/supabase';

/**
 * Keeps TanStack Query pool + tab caches fresh when other terminals mutate via Supabase.
 */
export function PoolRealtimeListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: poolTableKeys.all });
      void queryClient.invalidateQueries({ queryKey: tabKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['pool-sessions'] });
    };

    const channel = supabase
      .channel('pool-pos-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_tables' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_sessions' }, invalidate)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
