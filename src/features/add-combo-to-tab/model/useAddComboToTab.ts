/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * useAddComboToTab — TanStack mutation hook for calling the add_combo_to_tab RPC.
 *
 * Maps all 5 known DB exception codes to specific toast messages per UI-SPEC.
 * Uses `supabase as any` pre-regen cast — combo tables not yet in supabase.types.ts.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { tabKeys } from '@entities/tab/model/queries';
import type { AddComboToTabInput } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';

export function useAddComboToTab() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddComboToTabInput): Promise<string> => {
      const { data, error } = await (supabase as any).rpc('add_combo_to_tab', {
        p_combo_product_id: input.comboProductId,
        p_tab_id: input.tabId,
        p_slot_selections: input.slotSelections,
        p_override_availability: input.overrideAvailability,
        p_override_reason: input.overrideReason ?? null,
      });
      if (error) {
        logger.error('useAddComboToTab: rpc failed', { error });
        throw error;
      }
      return data as string;
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: tabKeys.all });
      logger.info('useAddComboToTab: success', { comboProductId: input.comboProductId });
      toast.success('Added combo');
    },
    onError: (error: unknown) => {
      const msg = (error as { message?: string }).message ?? '';
      if (msg.includes('COMBO_UNAVAILABLE')) {
        toast.error('This combo is not available right now. Ask a manager to override.');
      } else if (msg.includes('SLOT_MIN_MAX_VIOLATION')) {
        toast.error('Selection error — check all slot quantities.');
      } else if (msg.includes('INVALID_CHILD')) {
        toast.error('One or more selections are not valid for this combo.');
      } else if (msg.includes('NESTED_COMBO_FORBIDDEN')) {
        toast.error('Nested combos are not allowed.');
      } else if (msg.includes('AUTH_FORBIDDEN')) {
        toast.error('Manager PIN required to override availability.');
      } else {
        toast.error('Could not add combo. Try again.');
      }
    },
  });
}
