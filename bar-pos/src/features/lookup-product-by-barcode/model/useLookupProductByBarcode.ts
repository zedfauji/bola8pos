import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Product } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';

export function useLookupProductByBarcode() {
  const queryClient = useQueryClient();

  const findCached = useCallback(
    (code: string): Product | null => {
      const cached = queryClient.getQueryData<Product[] | undefined>(['products']);
      if (Array.isArray(cached)) {
        const hit = cached.find(p => p.barcode === code);
        if (hit) return hit;
      }
      return null;
    },
    [queryClient]
  );

  const lookup = useCallback(
    async (code: string): Promise<Product | null> => {
      const cached = findCached(code);
      if (cached) return cached;

      const { data, error } = await supabase
        .from('products')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select('id, name, barcode' as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq('barcode' as any, code)
        .maybeSingle();
      if (error) {
        logger.error('barcode_lookup.failed', { code: error.code, message: error.message });
        return null;
      }
      if (!data) return null;
      // Fall back to cached list to resolve the full product.
      const full = findCached(code);
      return full;
    },
    [findCached]
  );

  return { lookup };
}
