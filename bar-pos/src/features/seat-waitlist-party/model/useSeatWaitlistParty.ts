/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { waitlistKeys } from '@entities/waitlist';
import i18n from '@shared/lib/i18n';
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
      /* eslint-disable i18next/no-literal-string -- Supabase query-builder chain:
         table/column names + status enum value, not UI copy */
      const { error } = await db
        .from('waitlist_entries')
        .update({
          status: 'seated',
          table_id: input.tableId,
          seated_at: new Date().toISOString(),
        })
        .eq('id', input.entryId);
      /* eslint-enable i18next/no-literal-string */

      if (error) {
        logger.error('waitlist.seat.failed', { entryId: input.entryId, error });
        return err({ code: 'SUPABASE_ERROR', message: (error as { message: string }).message });
      }
      logger.info('waitlist.seat.succeeded', { entryId: input.entryId, tableId: input.tableId });
      return ok(undefined);
    },
    onSuccess: (result, input) => {
      if (!result.ok) {
        toast.error(i18n.t('featMgmt:seatWaitlistParty.errorToast'));
        return;
      }
      toast.success(
        i18n.t('featMgmt:seatWaitlistParty.successToast', {
          name: input.entryName,
          table: input.tableName,
        })
      );
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.waitingCount() });
    },
  });

  return { seatParty: mutation.mutateAsync, isPending: mutation.isPending };
}
