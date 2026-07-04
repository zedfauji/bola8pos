/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * TanStack Query hooks for prep production data.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PrepProductionSchema, RecipeItemSchema, RecipeWithItemsSchema } from '@shared/lib/domain';
import type { PrepProduction, PrepProductionCreate, RecipeWithItems } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

const TERMINAL_ID =
  (import.meta.env.VITE_TERMINAL_ID as string | undefined) ?? 'POS-1';

const db = supabase as any;

export const prepKeys = {
  all: ['prep_productions'] as const,
  lists: () => [...prepKeys.all, 'list'] as const,
  byIngredient: (id: string) => [...prepKeys.all, 'ingredient', id] as const,
};

function mapPrepProductionRow(row: Record<string, unknown>): PrepProduction {
  return PrepProductionSchema.parse({
    id: row['id'],
    prepIngredientId: row['prep_ingredient_id'],
    qtyProduced: Number(row['qty_produced']),
    notes: row['notes'] ?? null,
    producedBy: row['produced_by'] ?? null,
    createdAt: new Date(row['created_at'] as string),
  });
}

function mapRecipeJoinRow(row: Record<string, unknown>): RecipeWithItems {
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

export function usePrepProductions(prepIngredientId?: string) {
  return useQuery({
    queryKey: prepIngredientId ? prepKeys.byIngredient(prepIngredientId) : prepKeys.lists(),
    queryFn: async (): Promise<PrepProduction[]> => {
      let query = db.from('prep_productions').select('*').order('created_at', { ascending: false });
      if (prepIngredientId) {
        query = query.eq('prep_ingredient_id', prepIngredientId);
      }
      const { data, error } = await query;
      if (error) {
        logger.error('usePrepProductions: query failed', { error });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map(mapPrepProductionRow);
    },
    staleTime: 30 * 1000,
  });
}

export function useMutationCreatePrepProduction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PrepProductionCreate): Promise<Result<PrepProduction>> => {
      const { data, error } = await db.rpc('produce_prep_batch', {
        p_prep_ingredient_id: input.prepIngredientId,
        p_qty_produced: input.qtyProduced,
        p_notes: input.notes ?? null,
        p_produced_by: input.producedBy ?? null,
        p_terminal_id: TERMINAL_ID,
      });

      if (error) {
        const msg: string = (error as { message?: string }).message ?? '';
        if (msg.includes('PREP_INGREDIENT_REQUIRED')) {
          return err({ code: 'PREP_INGREDIENT_REQUIRED', message: msg });
        }
        if (msg.includes('INGREDIENT_NOT_FOUND')) {
          return err({ code: 'NOT_FOUND', message: msg });
        }
        if (msg.includes('INVENTORY_NEGATIVE')) {
          return err({ code: 'INVENTORY_NEGATIVE', message: msg });
        }
        logger.error('useMutationCreatePrepProduction: insert failed', { error });
        return err({ code: 'SUPABASE_ERROR', message: msg });
      }

      const parsed = PrepProductionSchema.safeParse(mapPrepProductionRow(data as Record<string, unknown>));
      if (!parsed.success) {
        return err({ code: 'VALIDATION_ERROR', message: 'Invalid prep production data returned' });
      }
      return ok(parsed.data);
    },
    onSuccess: (result, variables) => {
      if (!result.ok) return;
      void queryClient.invalidateQueries({ queryKey: prepKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: prepKeys.byIngredient(variables.prepIngredientId) });
      void queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
  });
}

export function useRecipeByPrepIngredient(prepIngredientId: string | null) {
  return useQuery({
    queryKey: [...prepKeys.all, 'recipe', prepIngredientId],
    queryFn: async (): Promise<RecipeWithItems | null> => {
      if (!prepIngredientId) return null;
      const { data, error } = await db
        .from('recipes')
        .select('*, recipe_items(*)')
        .eq('prep_ingredient_id', prepIngredientId)
        .maybeSingle();
      if (error) {
        logger.error('useRecipeByPrepIngredient: query failed', { error });
        throw error;
      }
      if (data == null) return null;
      return mapRecipeJoinRow(data as Record<string, unknown>);
    },
    enabled: !!prepIngredientId,
    staleTime: 60 * 1000,
  });
}
