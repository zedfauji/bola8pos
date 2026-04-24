/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * entities/payment/model/queries.ts
 *
 * TanStack Query hooks for payment-related data fetching.
 * Uses `const db = supabase as any` pre-regen cast — payments/order_items join
 * not yet in supabase.types.ts until Phase 6 types are transcribed.
 */
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@shared/lib/supabase';
import { PaymentSchema } from './types';
import type { Payment } from './types';

const db = supabase as any;

export const paymentKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentKeys.all, 'list'] as const,
};

export const paymentItemKeys = {
  byPayment: (paymentId: string) => ['payment', 'order-items', paymentId] as const,
};

function mapPaymentRow(row: Record<string, unknown>): Payment {
  return PaymentSchema.parse({
    id: row['id'],
    tabId: row['tab_id'],
    amount: row['amount'],
    tipAmount: row['tip_amount'] ?? 0,
    method: row['method'],
    squarePaymentId: row['square_payment_id'],
    squareReceiptUrl: row['square_receipt_url'],
    tenderedAmount: row['tendered_amount'],
    referenceNumber: row['reference_number'],
    idempotencyKey: row['idempotency_key'],
    processedAt: new Date(row['processed_at'] as string),
    processedBy: row['processed_by'],
    isRefund: row['is_refund'] ?? false,
    refundId: row['refund_id'] ?? null,
  });
}

/** Fetch all recent payments (newest first, limit 100). */
export function usePayments() {
  return useQuery({
    queryKey: paymentKeys.lists(),
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await db
        .from('payments')
        .select('*')
        .order('processed_at', { ascending: false })
        .limit(100);
      if (error) throw error as Error;
      return ((data ?? []) as Record<string, unknown>[]).map(mapPaymentRow);
    },
  });
}

export interface OrderItemForRefund {
  id: string;
  qty: number;
  unit_price: number;
  parent_order_item_id: string | null;
  products: { name: string };
}

/**
 * Fetch order_items for the tab associated with a payment.
 * Uses three sequential queries: payment → orders → order_items.
 */
export function useOrderItemsByPayment(paymentId: string | null) {
  return useQuery({
    queryKey: paymentId
      ? paymentItemKeys.byPayment(paymentId)
      : (['payment', 'order-items', null] as const),
    enabled: paymentId != null,
    queryFn: async (): Promise<OrderItemForRefund[]> => {
      if (paymentId == null) return [];  // guard: enabled only when paymentId != null

      // Step 1: resolve the tab_id from the payment
      const { data: paymentRow, error: payErr } = await db
        .from('payments')
        .select('tab_id')
        .eq('id', paymentId)
        .single();
      if (payErr) throw payErr as Error;

      const tabId = (paymentRow as { tab_id: string }).tab_id;

      // Step 2: resolve order IDs for that tab
      const { data: orders, error: orderErr } = await db
        .from('orders')
        .select('id')
        .eq('tab_id', tabId);
      if (orderErr) throw orderErr as Error;

      const orderIds = ((orders ?? []) as Array<{ id: string }>).map(o => o.id);
      if (orderIds.length === 0) return [];

      // Step 3: fetch top-level order_items (no parent) for those orders
      const { data: items, error: itemErr } = await db
        .from('order_items')
        .select('id, qty, unit_price, parent_order_item_id, products!inner(name)')
        .in('order_id', orderIds)
        .is('parent_order_item_id', null);
      if (itemErr) throw itemErr as Error;

      return (items ?? []) as OrderItemForRefund[];
    },
  });
}
