import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { resourceKeys } from '@entities/resource/model/queries';
import { waitlistKeys } from '@entities/waitlist/model/queries';
import { supabase } from '@shared/lib/supabase';

/**
 * App-level Realtime listener for the waitlist feature.
 *
 * Subscribes to:
 *  - waitlist_entries postgres_changes → invalidates waitlistKeys
 *  - resources postgres_changes → invalidates resources cache
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
      void queryClient.invalidateQueries({ queryKey: resourceKeys.all });
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
        { event: '*', schema: 'public', table: 'resources' },
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
