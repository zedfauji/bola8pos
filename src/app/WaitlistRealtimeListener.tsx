import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { waitlistKeys } from '@entities/waitlist/model/queries';
import { supabase } from '@shared/lib/supabase';

/**
 * App-level Realtime listener for the waitlist feature.
 *
 * Subscribes to:
 *  - waitlist_entries postgres_changes → invalidates waitlistKeys
 *  - pool_tables postgres_changes → invalidates pool_tables cache
 *  - broadcast 'notified' event (from send-waitlist-notification edge fn) → invalidates waitlistKeys
 *
 * ONE channel ('waitlist:pos-sync') with multiple .on() handlers.
 * Mirrors PoolRealtimeListener pattern.
 */
export function WaitlistRealtimeListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateWaitlist = () => {
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.all });
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.waitingCount() });
    };

    const invalidateTables = () => {
      // pool_tables entity key — inline constant (poolTableKeys not yet defined in this codebase)
      void queryClient.invalidateQueries({ queryKey: ['pool_tables'] });
    };

    // ONE channel, multiple .on() handlers — do NOT create two separate channels
    const channel = supabase
      .channel('waitlist:pos-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waitlist_entries' },
        invalidateWaitlist,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pool_tables' },
        invalidateTables,
      )
      .on('broadcast', { event: 'notified' }, invalidateWaitlist)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
