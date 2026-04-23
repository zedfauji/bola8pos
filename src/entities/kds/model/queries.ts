/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import { useKdsStore } from './store';
import type { KdsOrderItem } from './types';

export const kdsKeys = {
  all: ['kds'] as const,
  items: () => [...kdsKeys.all, 'items'] as const,
};

export function useKdsItems() {
  return useQuery({
    queryKey: kdsKeys.items(),
    queryFn: async (): Promise<Result<KdsOrderItem[]>> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db
        .from('order_items')
        .select(
          `
          id,
          order_id,
          product_id,
          quantity,
          notes,
          kds_status,
          created_at,
          orders!inner(
            id,
            tabs!inner(
              id,
              customer_name
            )
          ),
          products!inner(
            id,
            name,
            categories!inner(
              id,
              is_food
            )
          )
        `
        )
        .neq('kds_status', 'done')
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('kds.useKdsItems', { error });
        return err({
          code: 'SUPABASE_ERROR',
          message: (error as { message: string }).message,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data ?? []) as any[];
      const items: KdsOrderItem[] = [];
      for (const row of rows) {
        const isFood = row.products?.categories?.is_food as boolean | undefined;
        if (!isFood) continue;

        items.push({
          id: row.id as string,
          orderId: row.order_id as string,
          productId: row.product_id as string,
          productName: (row.products?.name as string | undefined) ?? 'Unknown',
          categoryId: (row.products?.categories?.id as string | undefined) ?? '',
          isFood: true,
          quantity: row.quantity as number,
          notes: row.notes as string | null,
          kdsStatus: row.kds_status as KdsOrderItem['kdsStatus'],
          createdAt: new Date(row.created_at as string),
          tabCustomerName: (row.orders?.tabs?.customer_name as string | undefined) ?? null,
          tableNumber: null,
        });
      }

      useKdsStore.getState().setItems(items);
      return ok(items);
    },
  });
}

export function useKdsRealtimeBridge(): void {
  const queryClient = useQueryClient();
  const handleRealtimeUpdate = useKdsStore(s => s.handleRealtimeUpdate);

  useEffect(() => {
    const channel = supabase
      .channel('kds:order_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, payload => {
        handleRealtimeUpdate({
          eventType: payload.eventType,
          new: payload.new as Record<string, unknown>,
          old: payload.old as Record<string, unknown>,
        });
        void queryClient.invalidateQueries({ queryKey: kdsKeys.items() });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, handleRealtimeUpdate]);
}
