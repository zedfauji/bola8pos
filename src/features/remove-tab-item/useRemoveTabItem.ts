import { useMutation, useQueryClient } from '@tanstack/react-query';

import { tabKeys } from '@entities/tab/model/queries';
import { isOnline } from '@shared/lib/connectivity';
import { logger } from '@shared/lib/logger-instance';
import {
  err,
  networkOfflineError,
  ok,
  supabaseMutation,
  supabaseError,
  type Result,
} from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

export interface RemoveTabItemInput {
  tabId: string;
  orderId: string;
  itemId: string;
  productId: string;
  quantity: number;
}

export function useRemoveTabItem() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: RemoveTabItemInput): Promise<Result<void>> => {
      if (!isOnline()) {
        return err(networkOfflineError());
      }

      // Step 1: Delete the order_item row
      const delRes = await supabaseMutation(() =>
        supabase.from('order_items').delete().eq('id', input.itemId)
      );

      if (!delRes.ok) {
        logger.error('tab.removeItem.delete_failed', {
          itemId: input.itemId,
          orderId: input.orderId,
          tabId: input.tabId,
          message: delRes.error.message,
        });
        return err(supabaseError(delRes.error.message, undefined, delRes.error.raw));
      }

      // Step 2: Check if the order has any remaining items
      const remainingRes = await supabaseMutation(() =>
        supabase.from('order_items').select('id').eq('order_id', input.orderId)
      );

      if (!remainingRes.ok) {
        // Non-fatal: order status update is best-effort
        logger.warn('tab.removeItem.check_remaining_failed', {
          orderId: input.orderId,
          message: remainingRes.error.message,
        });
        return ok(undefined);
      }

      // Step 3: If no items remain, mark the order as voided
      const remaining = remainingRes.data as { id: string }[];
      if (remaining.length === 0) {
        const voidRes = await supabaseMutation(() =>
          supabase.from('orders').update({ status: 'voided' }).eq('id', input.orderId)
        );

        if (!voidRes.ok) {
          logger.warn('tab.removeItem.void_order_failed', {
            orderId: input.orderId,
            message: voidRes.error.message,
          });
          // Non-fatal: item was already deleted successfully
        } else {
          logger.info('tab.removeItem.order_voided', { orderId: input.orderId });
        }
      }

      // TODO: Restore inventory for the removed item. The current inventory
      // restore flow is coupled to the void-order edge function which operates
      // on a full order. A dedicated single-item inventory restore RPC would be
      // needed here. Track as: restore +input.quantity units for input.productId.

      logger.info('tab.removeItem.succeeded', {
        itemId: input.itemId,
        orderId: input.orderId,
        tabId: input.tabId,
        productId: input.productId,
        quantity: input.quantity,
      });

      return ok(undefined);
    },

    onSuccess: (result, input) => {
      if (!result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tabKeys.detail(input.tabId) });
      void queryClient.invalidateQueries({ queryKey: tabKeys.lists() });
    },
  });

  return {
    removeTabItem: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
