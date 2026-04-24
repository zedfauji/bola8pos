/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * useProcessRefund — TanStack mutation hook for calling the process_refund RPC.
 *
 * Maps REFUND_EXCEEDS_ORIGINAL, ITEM_NOT_IN_ORIGINAL_ORDER, and AUTH_FORBIDDEN
 * error codes to typed AppError results. Uses `supabase as any` pre-regen cast —
 * refunds table not yet in supabase.types.ts until Phase 6 types are transcribed.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { refundKeys } from '@entities/refund';
import { tabKeys } from '@entities/tab';
import type { AppErrorCode, Result } from '@shared/lib/result';
import { err, ok } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

const db = supabase as any;

export interface RefundItemInput {
  order_item_id: string;
  qty: number;
  amount: number;    // positive decimal (e.g. 8.50)
  restock: boolean;
}

export interface ProcessRefundInput {
  originalPaymentId: string;
  items: RefundItemInput[];
  reason: string;   // RefundReason enum value
}

export function useProcessRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProcessRefundInput): Promise<Result<string>> => {
      const { data, error } = await db.rpc('process_refund', {
        p_original_payment_id: input.originalPaymentId,
        p_items: input.items,
        p_reason: input.reason,
        p_manager_pin: '',  // PIN already verified by ManagerPinDialog; RPC re-checks role via auth.uid()
      });
      if (error) {
        if ((error.message as string).includes('REFUND_EXCEEDS_ORIGINAL')) {
          return err({ code: 'REFUND_EXCEEDS_ORIGINAL' as AppErrorCode, message: 'Refund amount exceeds the remaining refundable balance.' });
        }
        if ((error.message as string).includes('ITEM_NOT_IN_ORIGINAL_ORDER')) {
          return err({ code: 'ITEM_NOT_IN_ORIGINAL_ORDER' as AppErrorCode, message: 'One or more items were not part of the original order.' });
        }
        if ((error.message as string).includes('AUTH_FORBIDDEN')) {
          return err({ code: 'AUTH_FORBIDDEN' as AppErrorCode, message: 'Manager approval is required to process a refund.' });
        }
        return err({ code: 'SUPABASE_ERROR' as AppErrorCode, message: error.message as string, raw: error });
      }
      void qc.invalidateQueries({ queryKey: refundKeys.lists() });
      void qc.invalidateQueries({ queryKey: refundKeys.byPayment(input.originalPaymentId) });
      void qc.invalidateQueries({ queryKey: tabKeys.lists() });
      return ok(data as string);
    },
  });
}
