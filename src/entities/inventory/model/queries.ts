import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Inventory, InventoryLog, Product } from '@shared/lib/domain';
import { CategorySchema, ProductSchema } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import {
  err,
  ok,
  supabaseMutation,
  supabaseQuery,
  unknownError,
  type Result,
} from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import type { Tables, TablesInsert } from '@shared/lib/supabase.types';
import { useInventoryStore } from './store';
import { InventorySchema, InventoryLogSchema } from './types';

export const inventoryKeys = {
  all: ['inventory'] as const,
  product: (id: string) => [...inventoryKeys.all, 'product', id] as const,
  lowStock: () => [...inventoryKeys.all, 'low-stock'] as const,
  log: (productId?: string) => [...inventoryKeys.all, 'log', productId ?? 'all'] as const,
};

type ProductJoined = Tables<'products'> & {
  category: Tables<'categories'> | null;
};

type InventoryRow = Tables<'inventory'> & {
  product: ProductJoined | null;
};

function mapInventoryRow(row: InventoryRow): Result<Inventory> {
  try {
    let product: Product | undefined;
    if (row.product) {
      const cat =
        row.product.category != null
          ? CategorySchema.parse({
              id: row.product.category.id,
              name: row.product.category.name,
              color: row.product.category.color,
              sortOrder: row.product.category.sort_order,
              happyHourStart: row.product.category.happy_hour_start,
              happyHourEnd: row.product.category.happy_hour_end,
              createdAt: new Date(row.product.category.created_at),
            })
          : undefined;
      product = ProductSchema.parse({
        id: row.product.id,
        name: row.product.name,
        categoryId: row.product.category_id,
        basePrice: row.product.base_price,
        happyHourPrice: row.product.happy_hour_price,
        sku: row.product.sku,
        isActive: row.product.is_active,
        imageUrl: row.product.image_url,
        modifiers: [],
        category: cat,
      });
    }

    return ok(
      InventorySchema.parse({
        id: row.id,
        productId: row.product_id,
        quantityOnHand: row.quantity_on_hand,
        lowStockThreshold: row.low_stock_threshold,
        unit: row.unit,
        product,
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

export function useInventory() {
  const query = useQuery({
    queryKey: inventoryKeys.all,
    queryFn: async (): Promise<Result<Inventory[]>> => {
      const res = await supabaseQuery(() =>
        supabase
          .from('inventory')
          .select(
            `
          *,
          product:products(*, category:categories(*))
        `
          )
          .order('product(name)')
      );

      if (!res.ok) {
        logger.error('inventory.fetch_failed', { message: res.error.message });
        return res;
      }

      const list: Inventory[] = [];
      for (const row of res.data as InventoryRow[]) {
        const m = mapInventoryRow(row);
        if (!m.ok) {
          logger.error('inventory.map_failed', { message: m.error.message });
          return m;
        }
        list.push(m.data);
      }
      return ok(list);
    },
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (query.data?.ok) {
      useInventoryStore.getState().setInventory(query.data.data);
    }
  }, [query.data]);

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: query.isSuccess && !!r?.ok && r.data.length === 0,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

export function useInventoryByProduct(productId: string) {
  const query = useQuery({
    queryKey: inventoryKeys.product(productId),
    enabled: Boolean(productId),
    queryFn: async (): Promise<Result<Inventory>> => {
      const res = await supabaseQuery<Tables<'inventory'>>(() =>
        supabase.from('inventory').select('*').eq('product_id', productId).single()
      );

      if (!res.ok) {
        logger.error('inventory.by_product.fetch_failed', { message: res.error.message });
        return res;
      }

      try {
        return ok(
          InventorySchema.parse({
            id: res.data.id,
            productId: res.data.product_id,
            quantityOnHand: res.data.quantity_on_hand,
            lowStockThreshold: res.data.low_stock_threshold,
            unit: res.data.unit,
          })
        );
      } catch (e) {
        return err(unknownError(e));
      }
    },
  });

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: false,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

export function useLowStockInventory() {
  const query = useQuery({
    queryKey: inventoryKeys.lowStock(),
    queryFn: async (): Promise<Result<Inventory[]>> => {
      const res = await supabaseQuery(() =>
        supabase
          .from('inventory')
          .select(
            `
          *,
          product:products(*, category:categories(*))
        `
          )
          .order('quantity_on_hand')
      );

      if (!res.ok) {
        logger.error('inventory.low_stock.fetch_failed', { message: res.error.message });
        return res;
      }

      const lowStockRows = (res.data as InventoryRow[]).filter(
        row => row.quantity_on_hand <= row.low_stock_threshold
      );
      const list: Inventory[] = [];
      for (const row of lowStockRows) {
        const m = mapInventoryRow(row);
        if (!m.ok) return m;
        list.push(m.data);
      }
      return ok(list);
    },
    staleTime: 60 * 1000,
  });

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: query.isSuccess && !!r?.ok && r.data.length === 0,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

type AdjustInventoryContext = { previousList?: Result<Inventory[]> };

export function useMutationAdjustInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      quantityDelta,
      reason,
      staffId,
    }: {
      productId: string;
      quantityDelta: number;
      reason: string;
      staffId: string;
    }): Promise<Result<{ inventory: Inventory; log: InventoryLog }>> => {
      const currentRes = await supabaseQuery<Tables<'inventory'>>(() =>
        supabase.from('inventory').select('*').eq('product_id', productId).single()
      );

      if (!currentRes.ok) {
        logger.error('inventory.adjust.fetch_failed', { message: currentRes.error.message });
        return currentRes;
      }

      const newQuantity = currentRes.data.quantity_on_hand + quantityDelta;
      if (newQuantity < 0) {
        logger.error('inventory.adjust.negative', { productId, newQuantity });
        return err(unknownError('quantity_negative'));
      }

      const updateRes = await supabaseMutation<Tables<'inventory'>>(() =>
        supabase
          .from('inventory')
          .update({ quantity_on_hand: newQuantity })
          .eq('product_id', productId)
          .select()
          .single()
      );

      if (!updateRes.ok) {
        logger.error('inventory.adjust.update_failed', {
          message: updateRes.error.message,
        });
        return updateRes;
      }
      if (updateRes.data === null) {
        return err(unknownError('no_row'));
      }

      const logInsert: TablesInsert<'inventory_log'> = {
        product_id: productId,
        quantity_delta: quantityDelta,
        reason,
        staff_id: staffId,
      };

      const logRes = await supabaseMutation<Tables<'inventory_log'>>(() =>
        supabase.from('inventory_log').insert(logInsert).select().single()
      );

      if (!logRes.ok) {
        logger.error('inventory.adjust.log_failed', {
          message: logRes.error.message,
        });
        return logRes;
      }
      if (logRes.data === null) {
        return err(unknownError('no_row'));
      }

      try {
        const inventory = InventorySchema.parse({
          id: updateRes.data.id,
          productId: updateRes.data.product_id,
          quantityOnHand: updateRes.data.quantity_on_hand,
          lowStockThreshold: updateRes.data.low_stock_threshold,
          unit: updateRes.data.unit,
        });
        const log = InventoryLogSchema.parse({
          id: logRes.data.id,
          productId: logRes.data.product_id,
          quantityDelta: logRes.data.quantity_delta,
          reason: logRes.data.reason as InventoryLog['reason'],
          staffId: logRes.data.staff_id,
          createdAt: new Date(logRes.data.created_at),
        });
        return ok({ inventory, log });
      } catch (e) {
        return err(unknownError(e));
      }
    },

    onMutate: async ({ productId, quantityDelta }) => {
      await queryClient.cancelQueries({ queryKey: inventoryKeys.all });
      const previousList = queryClient.getQueryData<Result<Inventory[]>>(inventoryKeys.all);
      useInventoryStore.setState(s => ({
        inventory: s.inventory.map(i =>
          i.productId === productId
            ? { ...i, quantityOnHand: Math.max(0, i.quantityOnHand + quantityDelta) }
            : i
        ),
      }));
      useInventoryStore.getState().refreshAlerts();
      queryClient.setQueryData<Result<Inventory[]>>(inventoryKeys.all, old => {
        if (!old?.ok) return old;
        return ok(
          old.data.map(i =>
            i.productId === productId
              ? { ...i, quantityOnHand: Math.max(0, i.quantityOnHand + quantityDelta) }
              : i
          )
        );
      });
      return { previousList } as AdjustInventoryContext;
    },

    onSuccess: (result, variables, ctx) => {
      const c = ctx as AdjustInventoryContext | undefined;
      if (!result.ok) {
        if (c?.previousList !== undefined) {
          queryClient.setQueryData(inventoryKeys.all, c.previousList);
          if (c.previousList.ok) {
            useInventoryStore.getState().setInventory(c.previousList.data);
          }
        }
        return;
      }
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.log() });
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.product(variables.productId) });
    },

    onError: (_e, _v, ctx) => {
      const prev = ctx?.previousList;
      if (prev !== undefined) {
        queryClient.setQueryData(inventoryKeys.all, prev);
        if (prev.ok) useInventoryStore.getState().setInventory(prev.data);
      }
    },
  });
}

export function useInventoryLog(productId?: string) {
  const query = useQuery({
    queryKey: inventoryKeys.log(productId),
    queryFn: async (): Promise<Result<InventoryLog[]>> => {
      const base = supabase
        .from('inventory_log')
        .select(
          `
          *,
          product:products(
            id,
            name,
            sku
          ),
          staff:profiles(
            id,
            name
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(100);

      const res = await supabaseQuery(() => (productId ? base.eq('product_id', productId) : base));

      if (!res.ok) {
        logger.error('inventory.log.fetch_failed', { message: res.error.message });
        return res;
      }

      const logs: InventoryLog[] = [];
      for (const row of res.data) {
        try {
          logs.push(
            InventoryLogSchema.parse({
              id: row.id,
              productId: row.product_id,
              quantityDelta: row.quantity_delta,
              reason: row.reason,
              staffId: row.staff_id,
              createdAt: new Date(row.created_at),
            })
          );
        } catch (e) {
          return err(unknownError(e));
        }
      }
      return ok(logs);
    },
  });

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: query.isSuccess && !!r?.ok && r.data.length === 0,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}
