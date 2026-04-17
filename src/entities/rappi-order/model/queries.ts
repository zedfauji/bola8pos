import { useQuery, type QueryKey } from '@tanstack/react-query';
import type { RappiOrder } from '@shared/lib/domain';
import { supabaseQuery, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import type { Tables } from '@shared/lib/supabase.types';
import { mapRappiOrderRow } from './map-row';

export const rappiOrderKeys = {
  all: ['rappi-orders'] as const,
  list: () => [...rappiOrderKeys.all, 'list'] as const,
};

const KITCHEN_STATUSES = [
  'pending_acceptance',
  'accepted',
  'preparing',
  'ready_for_pickup',
] as const;

export function useRappiOrdersList() {
  return useQuery({
    queryKey: rappiOrderKeys.list(),
    queryFn: async (): Promise<Result<RappiOrder[]>> => {
      const res = await supabaseQuery(() =>
        supabase
          .from('rappi_orders')
          .select('*')
          .in('status', [...KITCHEN_STATUSES])
          .order('received_at', { ascending: false })
          .limit(200)
      );

      if (!res.ok) return res;

      const rows = res.data as Tables<'rappi_orders'>[];
      const orders: RappiOrder[] = [];
      for (const row of rows) {
        const m = mapRappiOrderRow(row);
        if (!m.ok) continue;
        orders.push(m.data);
      }
      return ok(orders);
    },
  });
}

export function rappiOrdersListQueryKey(): QueryKey {
  return rappiOrderKeys.list();
}
