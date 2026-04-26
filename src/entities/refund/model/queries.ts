/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * entities/refund/model/queries.ts
 *
 * TanStack Query hooks for refund data.
 * Uses `const db = supabase as any` pre-regen cast — refunds table not yet
 * in supabase.types.ts until Phase 6 types are transcribed.
 */
import { useQuery } from '@tanstack/react-query';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
import type { Refund, RefundItem } from './types';

const db = supabase as any;

export const refundKeys = {
  all: ['refunds'] as const,
  lists: () => [...refundKeys.all, 'list'] as const,
  byPayment: (paymentId: string) => [...refundKeys.all, 'by-payment', paymentId] as const,
  detail: (id: string) => [...refundKeys.all, 'detail', id] as const,
};

function mapRefundRow(row: Record<string, unknown>): Refund {
  return {
    id: row['id'] as string,
    originalPaymentId: row['original_payment_id'] as string,
    reason: row['reason'] as Refund['reason'],
    amount: row['amount'] as number,
    createdBy: row['created_by'] as string,
    createdAt: new Date(row['created_at'] as string),
    items: ((row['refund_items'] as Record<string, unknown>[] | null) ?? []).map(
      (item): RefundItem => ({
        id: item['id'] as string,
        refundId: item['refund_id'] as string,
        orderItemId: item['order_item_id'] as string,
        qty: item['qty'] as number,
        amount: item['amount'] as number,
        restock: item['restock'] as boolean,
        createdAt: new Date(item['created_at'] as string),
      })
    ),
  };
}

export function useRefunds() {
  return useQuery({
    queryKey: refundKeys.lists(),
    queryFn: async (): Promise<Refund[]> => {
      const { data, error } = await db
        .from('refunds')
        .select('*, refund_items(*)')
        .order('created_at', { ascending: false });
      if (error) {
        logger.error('useRefunds: query failed', { error });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map(mapRefundRow);
    },
  });
}

export function useRefundsByPayment(paymentId: string | null) {
  return useQuery({
    queryKey: refundKeys.byPayment(paymentId ?? ''),
    enabled: paymentId != null && paymentId.length > 0,
    queryFn: async (): Promise<Refund[]> => {
      if (!paymentId) return [];
      const { data, error } = await db
        .from('refunds')
        .select('*, refund_items(*)')
        .eq('original_payment_id', paymentId)
        .order('created_at', { ascending: false });
      if (error) {
        logger.error('useRefundsByPayment: query failed', { error, paymentId });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map(mapRefundRow);
    },
  });
}
