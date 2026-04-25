/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { waitlistKeys } from '@entities/waitlist';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

const db = supabase as any;

export function useMarkCancelled() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: { entryId: string; entryName: string }): Promise<Result<void>> => {
      const { error } = await db
        .from('waitlist_entries')
        .update({ status: 'cancelled' })
        .eq('id', input.entryId);

      if (error) {
        logger.error('waitlist.cancel.failed', { entryId: input.entryId, error });
        return err({ code: 'SUPABASE_ERROR', message: (error as { message: string }).message });
      }
      return ok(undefined);
    },
    onSuccess: (result, input) => {
      if (!result.ok) {
        toast.error('Something went wrong. Check your connection and try again.');
        return;
      }
      toast.success(`Entry for ${input.entryName} cancelled.`);
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.waitingCount() });
    },
  });

  return { markCancelled: mutation.mutateAsync, isPending: mutation.isPending };
}
