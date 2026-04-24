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

const db = supabase as any;

export const paymentItemKeys = {
  byPayment: (paymentId: string) => ['payment', 'order-items', paymentId] as const,
};

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
      // Step 1: resolve the tab_id from the payment
      const { data: paymentRow, error: payErr } = await db
        .from('payments')
        .select('tab_id')
        .eq('id', paymentId!)
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
