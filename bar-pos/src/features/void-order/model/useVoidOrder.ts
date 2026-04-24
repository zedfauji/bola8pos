import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tabKeys } from '@entities/tab/model/queries';
import type { Order } from '@shared/lib/domain';
import { callVoidOrder } from '@shared/lib/edge-function-contracts';
import { logger } from '@shared/lib/logger';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

type VoidOrderInput = {
  tabId: string;
  order: Order;
  reason: string;
  staffId: string;
};

type VoidOrderInventoryItem = {
  orderItemId: string;
  productId: string;
  quantity: number;
};

function buildInventoryRestoreItems(order: Order): VoidOrderInventoryItem[] {
  return order.items.map(item => ({
    orderItemId: item.id,
    productId: item.productId,
    quantity: item.quantity,
  }));
}

function getOrderAmount(order: Order): number {
  return order.items.reduce(
    (sum, item) => sum + (item.unitPrice + item.modifierPriceDelta) * item.quantity,
    0
  );
}

export function useVoidOrder() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: VoidOrderInput): Promise<Result<void>> => {
      const trimmedReason = input.reason.trim();
      if (trimmedReason.length === 0) {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'Void reason is required.',
        });
      }

      const amount = getOrderAmount(input.order);
      const inventoryRestoreItems = buildInventoryRestoreItems(input.order);
      const result = await callVoidOrder({
        orderId: input.order.id,
        reason: trimmedReason,
        staffId: input.staffId,
        amount,
        inventoryRestoreItems,
      });

      if (!result.ok) {
        logger.error('order.void.failed', {
          orderId: input.order.id,
          staffId: input.staffId,
          reason: trimmedReason,
          amount,
          code: result.error.code,
          message: result.error.message,
        });
        return err({
          code: 'SUPABASE_ERROR',
          message: result.error.message,
        });
      }

      // Phase 4: Reverse ingredient depletion for each voided order item.
      // Not atomic with void (edge function is remote) — eventual consistency acceptable.
      // Idempotent: duplicate reversal calls produce 23505 (unique_violation) — safe to ignore.
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
         @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      const deplDb = supabase as any;
      for (const item of input.order.items) {
        const { error: deplError } = await deplDb.rpc('deplete_for_order_item', {
          p_order_item_id: item.id,
          p_direction: -1,
        });
        if (deplError != null) {
          const isIdempotent = (deplError as { code?: string }).code === '23505';
          if (!isIdempotent) {
            logger.warn('void_order.depletion_reversal_failed', {
              orderItemId: item.id,
              orderId: input.order.id,
              errorCode: (deplError as { code?: string }).code,
            });
          }
        }
      }
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
         @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

      logger.info('order.void.succeeded', {
        orderId: input.order.id,
        staffId: input.staffId,
        reason: trimmedReason,
        amount,
      });

      return ok(undefined);
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: tabKeys.detail(variables.tabId) });
      void queryClient.invalidateQueries({ queryKey: tabKeys.lists() });
    },
  });

  return {
    voidOrder: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
