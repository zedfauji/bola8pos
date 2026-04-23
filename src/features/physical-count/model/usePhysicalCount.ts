import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryKeys } from '@entities/inventory';
import type { Inventory } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { ok, supabaseMutation, supabaseQuery, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import type { Tables, TablesInsert } from '@shared/lib/supabase.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PhysicalCountEntry = {
  /** inventory.product_id */
  productId: string;
  productName: string;
  /** Stock currently recorded in the DB */
  expectedStock: number;
  /** Actual physical count entered by manager */
  actualCount: number;
};

export type PhysicalCountVarianceRow = {
  productId: string;
  productName: string;
  expectedStock: number;
  actualCount: number;
  /** positive = surplus, negative = shortage */
  variance: number;
};

export type PhysicalCountResult = {
  /** Only products where actual != expected */
  adjustedRows: PhysicalCountVarianceRow[];
  /** All products (for full variance display) */
  allRows: PhysicalCountVarianceRow[];
};

type PhysicalCountInput = {
  /** Map of productId → actual count entered by manager */
  entries: Map<string, number>;
  /** Current inventory snapshot (product name + expected stock) */
  inventory: Inventory[];
  staffId: string;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Submits a physical inventory count.
 *
 * For each product where actual != expected, writes an inventory_log entry
 * with reason='physical_count' and delta=(actual - expected), then updates
 * the inventory.quantity_on_hand.
 *
 * Returns a Result<PhysicalCountResult> with variance rows for display.
 */
export function usePhysicalCount() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: PhysicalCountInput): Promise<Result<PhysicalCountResult>> => {
      const { entries, inventory, staffId } = input;

      const allRows: PhysicalCountVarianceRow[] = inventory.map(item => {
        const actual = entries.get(item.productId) ?? item.quantityOnHand;
        return {
          productId: item.productId,
          productName: item.product?.name ?? 'Unknown',
          expectedStock: item.quantityOnHand,
          actualCount: actual,
          variance: actual - item.quantityOnHand,
        };
      });

      // Only rows where actual differs from expected need DB writes
      const changedRows = allRows.filter(row => row.variance !== 0);

      if (changedRows.length === 0) {
        logger.info('physical_count.no_changes', { total: allRows.length });
        return ok({ adjustedRows: [], allRows });
      }

      logger.info('physical_count.submitting', {
        changed: changedRows.length,
        total: allRows.length,
      });

      // Process each changed product sequentially to avoid race conditions
      for (const row of changedRows) {
        // Fetch current quantity to compute safe delta
        const fetchRes = await supabaseQuery<Tables<'inventory'>>(() =>
          supabase.from('inventory').select('*').eq('product_id', row.productId).single()
        );

        if (!fetchRes.ok) {
          logger.error('physical_count.fetch_failed', {
            productId: row.productId,
            message: fetchRes.error.message,
          });
          return fetchRes;
        }

        const currentQty = fetchRes.data.quantity_on_hand;
        const newQty = row.actualCount;
        const delta = newQty - currentQty;

        // Update inventory quantity
        const updateRes = await supabaseMutation<Tables<'inventory'>>(() =>
          supabase
            .from('inventory')
            .update({ quantity_on_hand: newQty })
            .eq('product_id', row.productId)
            .select()
            .single()
        );

        if (!updateRes.ok) {
          logger.error('physical_count.update_failed', {
            productId: row.productId,
            message: updateRes.error.message,
          });
          return updateRes;
        }

        // Write inventory_log entry
        const logInsert: TablesInsert<'inventory_log'> = {
          product_id: row.productId,
          quantity_delta: delta,
          reason: 'physical_count',
          staff_id: staffId,
        };

        const logRes = await supabaseMutation<Tables<'inventory_log'>>(() =>
          supabase.from('inventory_log').insert(logInsert).select().single()
        );

        if (!logRes.ok) {
          logger.error('physical_count.log_failed', {
            productId: row.productId,
            message: logRes.error.message,
          });
          return logRes;
        }
      }

      logger.info('physical_count.success', { changed: changedRows.length });
      return ok({ adjustedRows: changedRows, allRows });
    },

    onSuccess: result => {
      if (!result.ok) return;
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.alerts() });
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.lowStock() });
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.log() });
    },
  });

  return {
    submitPhysicalCount: mutation.mutateAsync,
    isPending: mutation.isPending,
    reset: mutation.reset,
  };
}
