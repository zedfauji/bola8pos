import { useEffect, useRef } from 'react';
import {
  useMutationStartSession,
  useMutationStopSession,
} from '@entities/pool-table/model/queries';
import { useMutationOpenTab } from '@entities/tab/model/queries';
import { useMutationAddOrder } from '@entities/tab/model/queries';
import { useTabStore, type OfflineAction } from '@entities/tab/model/store';
import { useOnlineStatus } from '@shared/lib/connectivity';
import { logger } from '@shared/lib/logger-instance';

/**
 * Headless component that replays the offline action queue when connectivity
 * returns. Must be rendered inside <QueryClientProvider>.
 *
 * Actions are replayed sequentially in the order they were enqueued.
 * Each action is dequeued regardless of outcome (to avoid infinite retries).
 */
export function OfflineQueueProcessor() {
  const isOnline = useOnlineStatus();
  const wasOnlineRef = useRef<boolean>(isOnline);
  const isReplayingRef = useRef<boolean>(false);

  const openTab = useMutationOpenTab();
  const addOrder = useMutationAddOrder();
  const startSession = useMutationStartSession();
  const stopSession = useMutationStopSession();

  useEffect(() => {
    const previouslyOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    const transitionedOnline = isOnline && !previouslyOnline;
    if (!transitionedOnline) return;

    const queue = useTabStore.getState().offlineQueue;
    if (queue.length === 0) return;
    if (isReplayingRef.current) return;

    void replayQueue(queue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  async function replayQueue(queue: OfflineAction[]) {
    isReplayingRef.current = true;
    const { setSyncing, dequeueOfflineAction } = useTabStore.getState();

    setSyncing(true);
    logger.info('offline.queue.replay.start', { count: queue.length });

    for (const action of queue) {
      try {
        const result = await dispatchAction(action);
        if (result && !result.ok) {
          logger.error('offline.queue.replay.action_failed', {
            actionId: action.id,
            type: action.type,
            code: result.error.code,
            message: result.error.message,
          });
        } else {
          logger.info('offline.queue.replay.action_ok', {
            actionId: action.id,
            type: action.type,
          });
        }
      } catch (e) {
        logger.error('offline.queue.replay.action_threw', {
          actionId: action.id,
          type: action.type,
          error: e,
        });
      } finally {
        dequeueOfflineAction(action.id);
      }
    }

    setSyncing(false);
    isReplayingRef.current = false;
    logger.info('offline.queue.replay.done', { count: queue.length });
  }

  async function dispatchAction(action: OfflineAction) {
    switch (action.type) {
      case 'open-tab': {
        return openTab.mutateAsync(action.payload as Parameters<typeof openTab.mutateAsync>[0]);
      }
      case 'place-order': {
        return addOrder.mutateAsync(action.payload as Parameters<typeof addOrder.mutateAsync>[0]);
      }
      case 'start-pool-timer': {
        return startSession.mutateAsync(
          action.payload as Parameters<typeof startSession.mutateAsync>[0]
        );
      }
      case 'stop-pool-timer': {
        return stopSession.mutateAsync(
          action.payload as Parameters<typeof stopSession.mutateAsync>[0]
        );
      }
      default: {
        logger.warn('offline.queue.replay.unknown_type', { type: action.type });
        return undefined;
      }
    }
  }

  return null;
}
