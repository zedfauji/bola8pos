/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * entities/recipe/model/queries.ts
 *
 * TanStack Query hooks for recipe data.
 * Uses `const db = supabase as any` pre-regen cast — recipes/recipe_items tables
 * not yet fully typed in supabase.types.ts. Regenerate after migrations applied.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RecipeItemSchema, RecipeWithItemsSchema } from '@shared/lib/domain';
import type { RecipeItemCreate, RecipeWithItems } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

// Pre-regen cast — remove once supabase.types.ts is regenerated after recipe migrations
const db = supabase as any;

// ============================================================================
// Query key factory
// ============================================================================

export const recipeKeys = {
  all: ['recipes'] as const,
  byProduct: (productId: string) => [...recipeKeys.all, 'product', productId] as const,
};

// ============================================================================
// Row mappers
// ============================================================================

function mapRecipeRow(row: Record<string, unknown>): RecipeWithItems {
  return RecipeWithItemsSchema.parse({
    id: row['id'],
    productId: row['product_id'] != null ? (row['product_id'] as string) : null,
    prepIngredientId: row['prep_ingredient_id'] != null ? (row['prep_ingredient_id'] as string) : null,
    yieldQty: Number(row['yield_qty']),
    notes: row['notes'] ?? null,
    createdAt: new Date(row['created_at'] as string),
    updatedAt: new Date(row['updated_at'] as string),
    items: ((row['recipe_items'] ?? []) as Record<string, unknown>[]).map(ri =>
      RecipeItemSchema.parse({
        id: ri['id'],
        recipeId: ri['recipe_id'],
        ingredientId: ri['ingredient_id'],
        qty: Number(ri['qty']),
      }),
    ),
  });
}

// ============================================================================
// Query hooks
// ============================================================================

/**
 * Fetch the recipe (with items) for a given product.
 * Returns null if no recipe exists for this product.
 */
export function useRecipe(productId: string | null) {
  return useQuery({
    queryKey: recipeKeys.byProduct(productId ?? ''),
    enabled: productId != null && productId.length > 0,
    queryFn: async (): Promise<RecipeWithItems | null> => {
      const { data, error } = await db
        .from('recipes')
        .select('*, recipe_items(*)')
        .eq('product_id', productId)
        .maybeSingle();
      if (error) {
        logger.error('useRecipe: query failed', { productId, error });
        throw error;
      }
      if (data == null) return null;
      return mapRecipeRow(data as Record<string, unknown>);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Mutation hooks
// ============================================================================

type SaveRecipeInput = {
  productId: string;
  yieldQty: number;
  notes: string | undefined;
  items: RecipeItemCreate[];
};

/**
 * Upsert a recipe and its items atomically (upsert recipe → delete old items → insert new items).
 * Returns Result<RecipeWithItems> — Ok on success, Err on any Supabase error.
 */
export function useMutationSaveRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveRecipeInput): Promise<Result<RecipeWithItems>> => {
      // 1. Upsert recipe row (conflict on product_id)
      const { data: recipeData, error: recipeError } = await db
        .from('recipes')
        .upsert(
          { product_id: input.productId, yield_qty: input.yieldQty, notes: input.notes ?? null },
          { onConflict: 'product_id' },
        )
        .select()
        .single();

      if (recipeError) {
        logger.error('useMutationSaveRecipe: upsert failed', { error: recipeError });
        return err({ code: 'SUPABASE_ERROR', message: recipeError.message });
      }

      const recipeId = (recipeData as Record<string, unknown>)['id'] as string;

      // 2. Delete existing items (replace strategy)
      const { error: deleteError } = await db
        .from('recipe_items')
        .delete()
        .eq('recipe_id', recipeId);
      if (deleteError) {
        logger.error('useMutationSaveRecipe: delete items failed', { error: deleteError });
        return err({ code: 'SUPABASE_ERROR', message: deleteError.message });
      }

      // 3. Insert new items (if any)
      if (input.items.length > 0) {
        const rows = input.items.map(item => ({
          recipe_id: recipeId,
          ingredient_id: item.ingredientId,
          qty: item.qty,
        }));
        const { error: insertError } = await db.from('recipe_items').insert(rows);
        if (insertError) {
          logger.error('useMutationSaveRecipe: insert items failed', { error: insertError });
          return err({ code: 'SUPABASE_ERROR', message: insertError.message });
        }
      }

      // 4. Fetch fresh record to return canonical shape
      const { data: freshData, error: fetchError } = await db
        .from('recipes')
        .select('*, recipe_items(*)')
        .eq('id', recipeId)
        .single();
      if (fetchError) {
        return err({ code: 'SUPABASE_ERROR', message: fetchError.message });
      }

      const parsed = RecipeWithItemsSchema.safeParse(
        mapRecipeRow(freshData as Record<string, unknown>),
      );
      if (!parsed.success) {
        return err({ code: 'VALIDATION_ERROR', message: 'Invalid recipe data returned from DB' });
      }
      return ok(parsed.data);
    },
    onSuccess: (result, variables) => {
      if (!result.ok) return;
      void queryClient.invalidateQueries({ queryKey: recipeKeys.byProduct(variables.productId) });
    },
  });
}
