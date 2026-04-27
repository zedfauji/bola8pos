/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { waitlistKeys } from '@entities/waitlist';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

const db = supabase as any;

export function useMarkNoShow() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: { entryId: string; entryName: string }): Promise<Result<void>> => {
      const { error } = await db
        .from('waitlist_entries')
        .update({ status: 'no_show' })
        .eq('id', input.entryId);

      if (error) {
        logger.error('waitlist.noshow.failed', { entryId: input.entryId, error });
        return err({ code: 'SUPABASE_ERROR', message: (error as { message: string }).message });
      }
      return ok(undefined);
    },
    onSuccess: (result, input) => {
      if (!result.ok) {
        toast.error('Could not mark no-show. Try again or refresh the waitlist.');
        return;
      }
      toast.success(`${input.entryName} marked as no-show.`);
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.waitingCount() });
    },
  });

  return { markNoShow: mutation.mutateAsync, isPending: mutation.isPending };
}
