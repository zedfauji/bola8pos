/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * entities/combo/model/queries.ts
 *
 * TanStack Query hooks for combo data.
 * Uses `const db = supabase as any` pre-regen cast — combo tables not yet in supabase.types.ts.
 * Regenerate types after migrations applied: npx supabase gen types typescript --local
 */
import { useQuery } from '@tanstack/react-query';
import {
  ComboSlotSchema,
  ComboSlotOptionSchema,
  ComboAvailabilitySchema,
} from '@shared/lib/domain';
import type { Product } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';
import type { ComboSlot, ComboSlotOption, ComboAvailability } from './types';

// Pre-regen cast — remove once supabase.types.ts is regenerated after combo migrations
const db = supabase as any;

export const comboKeys = {
  all: ['combos'] as const,
  lists: () => [...comboKeys.all, 'list'] as const,
  detail: (id: string) => [...comboKeys.all, 'detail', id] as const,
  slots: (comboId: string) => [...comboKeys.all, 'slots', comboId] as const,
  slotOptions: (slotId: string) => [...comboKeys.all, 'slotOptions', slotId] as const,
  availability: (comboId: string) => [...comboKeys.all, 'availability', comboId] as const,
};

/** Fetch all products where is_combo=true. */
export function useCombos() {
  return useQuery({
    queryKey: comboKeys.lists(),
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await db
        .from('products')
        .select('*, categories(*)')
        .eq('is_combo', true)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) {
        logger.error('useCombos: query failed', { error });
        throw error;
      }
      return (data ?? []) as Product[];
    },
  });
}

/** Fetch a single combo product by id. */
export function useCombo(id: string | null) {
  return useQuery({
    queryKey: comboKeys.detail(id ?? ''),
    enabled: id != null && id.length > 0,
    queryFn: async (): Promise<Product | null> => {
      if (!id) return null;
      const { data, error } = await db
        .from('products')
        .select('*, categories(*)')
        .eq('id', id)
        .eq('is_combo', true)
        .single();
      if (error) {
        logger.error('useCombo: query failed', { error, id });
        throw error;
      }
      return data as Product | null;
    },
  });
}

/** Fetch all slots for a combo product, ordered by sort_order. */
export function useComboSlots(comboId: string | null) {
  return useQuery({
    queryKey: comboKeys.slots(comboId ?? ''),
    enabled: comboId != null && comboId.length > 0,
    queryFn: async (): Promise<ComboSlot[]> => {
      if (!comboId) return [];
      const { data, error } = await db
        .from('combo_slots')
        .select('*')
        .eq('combo_product_id', comboId)
        .order('sort_order', { ascending: true });
      if (error) {
        logger.error('useComboSlots: query failed', { error, comboId });
        throw error;
      }
      return ((data ?? []) as unknown[]).map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return ComboSlotSchema.parse({
          id: r['id'],
          comboProductId: r['combo_product_id'],
          label: r['label'],
          slotType: r['slot_type'],
          minQty: r['min_qty'],
          maxQty: r['max_qty'],
          isRequired: r['is_required'],
          sortOrder: r['sort_order'],
          createdAt: new Date(r['created_at'] as string),
        });
      });
    },
  });
}

/** Fetch all options for a slot, ordered by sort_order. */
export function useComboSlotOptions(slotId: string | null) {
  return useQuery({
    queryKey: comboKeys.slotOptions(slotId ?? ''),
    enabled: slotId != null && slotId.length > 0,
    queryFn: async (): Promise<ComboSlotOption[]> => {
      if (!slotId) return [];
      const { data, error } = await db
        .from('combo_slot_options')
        .select('*, products(*)')
        .eq('combo_slot_id', slotId)
        .order('sort_order', { ascending: true });
      if (error) {
        logger.error('useComboSlotOptions: query failed', { error, slotId });
        throw error;
      }
      return ((data ?? []) as unknown[]).map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return ComboSlotOptionSchema.parse({
          id: r['id'],
          comboSlotId: r['combo_slot_id'],
          childProductId: r['child_product_id'] ?? null,
          prepaidMinutes: r['prepaid_minutes'] ?? null,
          sortOrder: r['sort_order'],
          createdAt: new Date(r['created_at'] as string),
        });
      });
    },
  });
}

/** Fetch all availability windows for a combo, ordered by created_at. */
export function useComboAvailabilityWindows(comboId: string | null) {
  return useQuery({
    queryKey: [...comboKeys.availability(comboId ?? ''), 'windows'],
    enabled: comboId != null && comboId.length > 0,
    queryFn: async (): Promise<ComboAvailability[]> => {
      if (!comboId) return [];
      const { data, error } = await db
        .from('combo_availability')
        .select('*')
        .eq('combo_product_id', comboId)
        .order('created_at', { ascending: true });
      if (error) {
        logger.error('useComboAvailabilityWindows: query failed', { error, comboId });
        throw error;
      }
      return ((data ?? []) as unknown[]).map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return ComboAvailabilitySchema.parse({
          id: r['id'],
          comboProductId: r['combo_product_id'],
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
 * Check if a combo is available right now via the server-side is_combo_available() function.
 * staleTime=30s — availability windows are minute-granular; short cache is fine.
 * Fails open (returns true) if the RPC errors — RPC re-validates server-side.
 */
export function useComboAvailability(comboId: string | null) {
  return useQuery({
    queryKey: comboKeys.availability(comboId ?? ''),
    enabled: comboId != null && comboId.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<boolean> => {
      if (!comboId) return true;
      const { data, error } = await supabase.rpc('is_combo_available' as any, {
        p_combo_id: comboId,
        p_ts: new Date().toISOString(),
      });
      if (error) {
        // T-2-03-05: fail open — UX choice; RPC re-validates server-side
        logger.error('useComboAvailability: rpc failed', { error, comboId });
        return true;
      }
      return data as boolean;
    },
  });
}
