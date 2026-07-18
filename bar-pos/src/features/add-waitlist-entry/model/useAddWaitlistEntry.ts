import { toast } from 'sonner';

import { useMutationAddWaitlistEntry } from '@entities/waitlist';
import type { WaitlistEntry, WaitlistEntryCreate } from '@entities/waitlist';
import i18n from '@shared/lib/i18n';
import type { Result } from '@shared/lib/result';

export function useAddWaitlistEntry() {
  const mutation = useMutationAddWaitlistEntry();

  async function addEntry(input: WaitlistEntryCreate): Promise<Result<WaitlistEntry>> {
    const result = await mutation.mutateAsync(input);
    if (result.ok) {
      toast.success(i18n.t('featMgmt:addWaitlistEntry.addedToast', { name: input.name }));
      return result;
    }
    toast.error(i18n.t('featMgmt:addWaitlistEntry.genericError'));
    return result;
  }

  return { addEntry, isPending: mutation.isPending };
}
