/**
 * OPEN TAB FEATURE HOOK
 *
 * Handles the business logic for opening a new tab.
 * Coordinates between TanStack Query mutation and Zustand UI state.
 */

import { useMutationOpenTab } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import type { CreateTab } from '@entities/tab/model/types';
import { logger } from '@shared/lib/logger';

export function useOpenTab() {
  const mutation = useMutationOpenTab();
  const { selectTab, closeDrawer } = useTabStore();

  const openTab = async (input: CreateTab) => {
    const result = await mutation.mutateAsync(input);

    if (!result.ok) {
      logger.error('tab.open.failed', {
        customerName: input.customerName,
        tableNumber: input.tableNumber,
        message: result.error.message,
      });
      return {
        ok: false as const,
        error: {
          code: 'SUPABASE_ERROR' as const,
          message: result.error.message,
        },
      };
    }

    const tab = result.data;
    logger.info('tab.opened', {
      tabId: tab.id,
      customerName: tab.customerName,
      tableNumber: tab.tableNumber,
    });

    selectTab(tab.id);
    closeDrawer();

    return { ok: true as const, data: tab };
  };

  return {
    openTab,
    isPending: mutation.isPending,
  };
}
