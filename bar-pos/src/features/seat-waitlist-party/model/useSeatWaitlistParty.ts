/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { waitlistKeys } from '@entities/waitlist';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

type SeatPartyInput = {
  entryId: string;
  entryName: string;
  tableId: string;
  tableName: string;
};

const db = supabase as any;

export function useSeatWaitlistParty() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: SeatPartyInput): Promise<Result<void>> => {
      const { error } = await db
        .from('waitlist_entries')
        .update({
          status: 'seated',
          table_id: input.tableId,
          seated_at: new Date().toISOString(),
        })
        .eq('id', input.entryId);

      if (error) {
        logger.error('waitlist.seat.failed', { entryId: input.entryId, error });
        return err({ code: 'SUPABASE_ERROR', message: (error as { message: string }).message });
      }
      logger.info('waitlist.seat.succeeded', { entryId: input.entryId, tableId: input.tableId });
      return ok(undefined);
    },
    onSuccess: (result, input) => {
      if (!result.ok) {
        toast.error('Something went wrong. Check your connection and try again.');
        return;
      }
      toast.success(`${input.entryName} seated at ${input.tableName}.`);
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.waitingCount() });
    },
  });

  return { seatParty: mutation.mutateAsync, isPending: mutation.isPending };
}
