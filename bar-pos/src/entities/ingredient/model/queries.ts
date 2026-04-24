/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * entities/ingredient/model/queries.ts
 *
 * TanStack Query hooks for ingredient data.
 * Uses `const db = supabase as any` pre-regen cast — ingredients table not yet
 * in supabase.types.ts. Regenerate after migrations applied:
 *   npx supabase gen types typescript --local > src/shared/lib/supabase.types.ts
 */
import { useQuery } from '@tanstack/react-query';
import { IngredientSchema } from '@shared/lib/domain';
import type { Ingredient, StockMovement } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { supabase } from '@shared/lib/supabase';

// Pre-regen cast — remove once supabase.types.ts is regenerated after ingredient migrations
const db = supabase as any;

// ============================================================================
// Query key factory
// ============================================================================

export const ingredientKeys = {
  all: ['ingredients'] as const,
  lists: () => [...ingredientKeys.all, 'list'] as const,
  detail: (id: string) => [...ingredientKeys.all, 'detail', id] as const,
  movements: (ingredientId: string) =>
    [...ingredientKeys.all, 'movements', ingredientId] as const,
};

// ============================================================================
// Row mappers
// ============================================================================

function mapIngredientRow(row: Record<string, unknown>): Ingredient {
  return IngredientSchema.parse({
    id: row['id'],
    name: row['name'],
    uom: row['uom'],
    purchaseUom: row['purchase_uom'] ?? null,
    purchaseToBaseFactor: Number(row['purchase_to_base_factor']),
    costPerBaseUnit: Number(row['cost_per_base_unit']),
    quantityOnHand: Number(row['quantity_on_hand']),
    reorderPoint: row['reorder_point'] != null ? Number(row['reorder_point']) : null,
    isPrep: row['is_prep'],
    isActive: row['is_active'],
    category: row['category'] ?? null,
    createdAt: new Date(row['created_at'] as string),
    updatedAt: new Date(row['updated_at'] as string),
  });
}

/**
 * Map a stock_movements DB row to a StockMovement type.
 * Uses direct casting since supabase.types.ts is pre-regen and StockMovementSchema
 * reflects the pre-Phase-3 shape (productId required). Post-regen: replace with
 * StockMovementSchema.parse() once supabase.types.ts is updated.
 */
function mapMovementRow(row: Record<string, unknown>): StockMovement {
  return {
    id: row['id'] as string,
    productId: (row['product_id'] ?? '') as string,
    ingredientId: (row['ingredient_id'] ?? null) as string | null | undefined,
    quantityDelta: Number(row['quantity_delta']),
    reason: row['reason'] as StockMovement['reason'],
    refType: (row['ref_type'] ?? null) as string | null | undefined,
    refId: (row['ref_id'] ?? null) as string | null | undefined,
    staffId: (row['staff_id'] ?? '') as string,
    createdAt: new Date(row['created_at'] as string),
  };
}

// ============================================================================
// Query hooks
// ============================================================================

/** All active ingredients, ordered alphabetically by name. */
export function useIngredients() {
  return useQuery({
    queryKey: ingredientKeys.lists(),
    queryFn: async (): Promise<Ingredient[]> => {
      const { data, error } = await db
        .from('ingredients')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) {
        logger.error('useIngredients: query failed', { error });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map(mapIngredientRow);
    },
  });
}

/** Alias for useIngredients — returns only active ingredients. Used for recipe autocomplete in Phase 4. */
export function useIngredientsActive() {
  return useIngredients();
}

/** Single ingredient by ID. Disabled when id is null or empty. */
export function useIngredient(id: string | null) {
  return useQuery({
    queryKey: ingredientKeys.detail(id ?? ''),
    enabled: id != null && id.length > 0,
    queryFn: async (): Promise<Ingredient | null> => {
      if (!id) return null;
      const { data, error } = await db
        .from('ingredients')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        logger.error('useIngredient: query failed', { error, id });
        throw error;
      }
      if (!data) return null;
      return mapIngredientRow(data as Record<string, unknown>);
    },
  });
}

/** Stock movements for a single ingredient, newest-first. Disabled when ingredientId is null or empty. */
export function useStockMovements(ingredientId: string | null) {
  return useQuery({
    queryKey: ingredientKeys.movements(ingredientId ?? ''),
    enabled: ingredientId != null && ingredientId.length > 0,
    queryFn: async (): Promise<StockMovement[]> => {
      if (!ingredientId) return [];
      const { data, error } = await db
        .from('stock_movements')
        .select('*')
        .eq('ingredient_id', ingredientId)
        .order('created_at', { ascending: false });
      if (error) {
        logger.error('useStockMovements: query failed', { error, ingredientId });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map(mapMovementRow);
    },
  });
}
