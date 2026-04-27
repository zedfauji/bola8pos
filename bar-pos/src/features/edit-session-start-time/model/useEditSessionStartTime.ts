import { useMutationUpdateSessionStartTime } from '@entities/pool-table/model/queries';
import type { PoolSession } from '@shared/lib/domain';
import { err, validationError } from '@shared/lib/result';

export function useEditSessionStartTime() {
  const mutation = useMutationUpdateSessionStartTime();

  const editStartTime = async (session: PoolSession, startedAt: Date) => {
    const now = new Date();
    if (startedAt >= now) {
      return err(validationError({ startedAt: 'Start time must be in the past' }));
    }
    if (session.stoppedAt && startedAt >= session.stoppedAt) {
      return err(validationError({ startedAt: 'Start time must be before the session ended' }));
    }
    return mutation.mutateAsync({ sessionId: session.id, startedAt });
  };

  return { editStartTime, isPending: mutation.isPending };
}
