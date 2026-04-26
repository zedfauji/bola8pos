import { toast } from 'sonner';

import { useMutationAddWaitlistEntry } from '@entities/waitlist';
import type { WaitlistEntry, WaitlistEntryCreate } from '@entities/waitlist';
import type { Result } from '@shared/lib/result';

export function useAddWaitlistEntry() {
  const mutation = useMutationAddWaitlistEntry();

  async function addEntry(input: WaitlistEntryCreate): Promise<Result<WaitlistEntry>> {
    const result = await mutation.mutateAsync(input);
    if (result.ok) {
      toast.success(`${input.name} added to the waitlist.`);
      return result;
    }
    toast.error('Something went wrong. Check your connection and try again.');
    return result;
  }

  return { addEntry, isPending: mutation.isPending };
}
