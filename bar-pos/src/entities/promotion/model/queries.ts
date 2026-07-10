/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * entities/promotion/model/queries.ts
 *
 * TanStack Query hooks for promotion data.
 * Uses `const db = supabase as any` pre-regen cast — promotion tables not yet in
 * supabase.types.ts. Regenerate types after migrations applied:
 * npx supabase gen types typescript --local (remove this cast in Plan 20-06).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PromotionSchema, PromotionAvailabilitySchema } from '@shared/lib/domain';
import type { Promotion, PromotionAvailability, PromotionUpdate } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';

// Pre-regen cast — remove once supabase.types.ts is regenerated after promotions migrations (Plan 20-06)
const db = supabase as any;

export const promotionKeys = {
  all: ['promotions'] as const,
  lists: () => [...promotionKeys.all, 'list'] as const,
  detail: (id: string) => [...promotionKeys.all, 'detail', id] as const,
  availability: (promotionId: string) => [...promotionKeys.all, 'availability', promotionId] as const,
};

export function mapPromotionRow(row: Record<string, unknown>): Promotion {
  return PromotionSchema.parse({
    id: row['id'],
    name: row['name'],
    discountType: row['discount_type'],
    discountValue: Number(row['discount_value']),
    targetType: row['target_type'],
    targetProductId: row['target_product_id'] ?? null,
    targetCategoryId: row['target_category_id'] ?? null,
    priority: row['priority'],
    isActive: row['is_active'],
    createdAt: new Date(row['created_at'] as string),
  });
}

/** Fetch all promotions, ordered by priority (ascending — lower number applies first). */
export function usePromotions() {
  return useQuery({
    queryKey: promotionKeys.lists(),
    queryFn: async (): Promise<Promotion[]> => {
      const { data, error } = await db
        .from('promotions')
        .select('*')
        .order('priority', { ascending: true });
      if (error) {
        logger.error('usePromotions: query failed', { error });
        throw error;
      }
      return ((data ?? []) as unknown[]).map((row: unknown) =>
        mapPromotionRow(row as Record<string, unknown>)
      );
    },
  });
}

/** Fetch a single promotion by id. */
export function usePromotion(id: string | null) {
  return useQuery({
    queryKey: promotionKeys.detail(id ?? ''),
    enabled: id != null && id.length > 0,
    queryFn: async (): Promise<Promotion | null> => {
      if (!id) return null;
      const { data, error } = await db.from('promotions').select('*').eq('id', id).single();
      if (error) {
        logger.error('usePromotion: query failed', { error, id });
        throw error;
      }
      return data ? mapPromotionRow(data as Record<string, unknown>) : null;
    },
  });
}

/**
 * Create a draft promotion row and return its id. Defaults `is_active: false`
 * (draft is safe-to-leave-incomplete, per 20-UI-SPEC.md §1 — mirrors combo's
 * `is_combo: true` draft pattern).
 */
export function useMutationCreatePromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await db
        .from('promotions')
        .insert({
          name: 'New Promotion',
          discount_type: 'percentage',
          discount_value: 0,
          target_type: 'item',
          priority: 0,
          is_active: false,
        })
        .select('id')
        .single();
      if (error) {
        logger.error('useMutationCreatePromotion: insert failed', { error });
        throw error;
      }
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promotionKeys.lists() });
    },
  });
}

function promotionUpdatePayload(input: Omit<PromotionUpdate, 'id'>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row['name'] = input.name;
  if (input.discountType !== undefined) row['discount_type'] = input.discountType;
  if (input.discountValue !== undefined) row['discount_value'] = input.discountValue;
  if (input.targetType !== undefined) row['target_type'] = input.targetType;
  if (input.targetProductId !== undefined) row['target_product_id'] = input.targetProductId;
  if (input.targetCategoryId !== undefined) row['target_category_id'] = input.targetCategoryId;
  if (input.priority !== undefined) row['priority'] = input.priority;
  if (input.isActive !== undefined) row['is_active'] = input.isActive;
  return row;
}

/** Update a promotion by id with a partial camelCase input mapped to snake_case columns. */
export function useMutationUpdatePromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PromotionUpdate): Promise<void> => {
      const { id, ...rest } = input;
      const row = promotionUpdatePayload(rest);
      if (Object.keys(row).length === 0) return;
      const { error } = await db.from('promotions').update(row).eq('id', id);
      if (error) {
        logger.error('useMutationUpdatePromotion: update failed', { error, id });
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: promotionKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: promotionKeys.detail(variables.id) });
    },
  });
}

/** Delete a promotion by id. */
export function useMutationDeletePromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await db.from('promotions').delete().eq('id', id);
      if (error) {
        logger.error('useMutationDeletePromotion: delete failed', { error, id });
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promotionKeys.lists() });
    },
  });
}

/** Fetch all availability windows for a promotion, ordered by created_at. */
export function usePromotionAvailabilityWindows(promotionId: string | null) {
  return useQuery({
    queryKey: [...promotionKeys.availability(promotionId ?? ''), 'windows'],
    enabled: promotionId != null && promotionId.length > 0,
    queryFn: async (): Promise<PromotionAvailability[]> => {
      if (!promotionId) return [];
      const { data, error } = await db
        .from('promotion_availability')
        .select('*')
        .eq('promotion_id', promotionId)
        .order('created_at', { ascending: true });
      if (error) {
        logger.error('usePromotionAvailabilityWindows: query failed', { error, promotionId });
        throw error;
      }
      return ((data ?? []) as unknown[]).map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return PromotionAvailabilitySchema.parse({
          id: r['id'],
          promotionId: r['promotion_id'],
          daysOfWeek: r['days_of_week'],
          startTime: r['start_time'] ?? null,
          endTime: r['end_time'] ?? null,
          startDate: r['start_date'] ?? null,
          endDate: r['end_date'] ?? null,
          createdAt: new Date(r['created_at'] as string),
        });
      });
    },
  });
}

/**
 * Check if a promotion is available right now via the server-side
 * is_promotion_available() function.
 * staleTime=30s — availability windows are minute-granular; short cache is fine.
 * Fails open (returns true) if the RPC errors — the order-time RPC re-validates
 * server-side, mirroring useComboAvailability's T-2-03-05 fail-open UX choice.
 */
export function usePromotionActive(promotionId: string | null) {
  return useQuery({
    queryKey: promotionKeys.availability(promotionId ?? ''),
    enabled: promotionId != null && promotionId.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<boolean> => {
      if (!promotionId) return true;
      const { data, error } = await supabase.rpc('is_promotion_available' as any, {
        p_promotion_id: promotionId,
        p_ts: new Date().toISOString(),
      });
      if (error) {
        logger.error('usePromotionActive: rpc failed', { error, promotionId });
        return true;
      }
      return data as boolean;
    },
  });
}
