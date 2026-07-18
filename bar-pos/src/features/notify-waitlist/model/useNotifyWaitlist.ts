/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { waitlistKeys } from '@entities/waitlist';
import i18n from '@shared/lib/i18n';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import { sendManagerNotification } from '@shared/lib/tauri-notify';

type NotifyWaitlistInput = {
  entryId: string;
  entryName: string;
  hasPhone: boolean;
};

const db = supabase as any;

export function useNotifyWaitlist() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: NotifyWaitlistInput): Promise<Result<void>> => {
      // UPDATE status → 'notified'; pg_net trigger fires edge function automatically
      /* eslint-disable i18next/no-literal-string -- Supabase query-builder chain:
         table/column names + status enum value, not UI copy */
      const { error } = await db
        .from('waitlist_entries')
        .update({
          status: 'notified',
          notified_at: new Date().toISOString(),
        })
        .eq('id', input.entryId);
      /* eslint-enable i18next/no-literal-string */

      if (error) {
        logger.error('waitlist.notify.failed', { entryId: input.entryId, error });
        return err({ code: 'SUPABASE_ERROR', message: (error as { message: string }).message });
      }

      // Tauri desktop notification fallback when no phone (manager sees queue, but gets native alert too)
      if (!input.hasPhone) {
        await sendManagerNotification(
          i18n.t('featMgmt:notifyWaitlist.partyReadyTitle'),
          i18n.t('featMgmt:notifyWaitlist.partyReadyBody', { name: input.entryName })
        );
      }

      logger.info('waitlist.notify.succeeded', { entryId: input.entryId });
      return ok(undefined);
    },
    onSuccess: (result, input) => {
      if (!result.ok) {
        toast.error(
          i18n.t('featMgmt:notifyWaitlist.errorToast', { name: input.entryName })
        );
        return;
      }
      if (input.hasPhone) {
        toast.success(i18n.t('featMgmt:notifyWaitlist.whatsappSentToast', { name: input.entryName }));
      } else {
        toast.success(i18n.t('featMgmt:notifyWaitlist.managerNotifiedToast', { name: input.entryName }));
      }
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.lists() });
    },
  });

  return {
    notifyEntry: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
