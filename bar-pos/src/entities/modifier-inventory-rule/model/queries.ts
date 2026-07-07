/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * entities/modifier-inventory-rule/model/queries.ts
 *
 * TanStack Query hooks for modifier_inventory_rules data.
 * Uses `const db = supabase as any` pre-regen cast (CLAUDE.md workaround) —
 * table exists in the DB (17-03) but generic query builder overloads are not
 * yet regenerated.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ModifierInventoryRuleSchema } from '@shared/lib/domain';
import type { ModifierInventoryRule, ModifierInventoryRuleCreate } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

// Pre-regen cast — remove once supabase.types.ts generics are regenerated for this table
const db = supabase as any;

// ============================================================================
// Query key factory
// ============================================================================

export const modifierInventoryRuleKeys = {
  all: ['modifier_inventory_rules'] as const,
  byModifier: (id: string) => [...modifierInventoryRuleKeys.all, 'modifier', id] as const,
};

// ============================================================================
// Row mappers
// ============================================================================

function mapModifierInventoryRuleRow(row: Record<string, unknown>): ModifierInventoryRule {
  return ModifierInventoryRuleSchema.parse({
    id: row['id'],
    modifierId: row['modifier_id'],
    ingredientId: row['ingredient_id'],
    delta: Number(row['delta']),
  });
}

// ============================================================================
// Query hooks
// ============================================================================

/**
 * Fetch all inventory rules for a given modifier.
 */
export function useModifierInventoryRules(modifierId: string | null) {
  return useQuery({
    queryKey: modifierInventoryRuleKeys.byModifier(modifierId ?? ''),
    enabled: modifierId != null && modifierId.length > 0,
    queryFn: async (): Promise<ModifierInventoryRule[]> => {
      const { data, error } = await db
        .from('modifier_inventory_rules')
        .select('*')
        .eq('modifier_id', modifierId);
      if (error) {
        logger.error('useModifierInventoryRules: query failed', { modifierId, error });
        throw error;
      }
      return ((data ?? []) as Record<string, unknown>[]).map(mapModifierInventoryRuleRow);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Mutation hooks
// ============================================================================

type SaveModifierInventoryRulesInput = {
  modifierId: string;
  rules: ModifierInventoryRuleCreate[];
};

/**
 * Replace all inventory rules for a modifier (delete-all-then-insert, D-03:
 * supports N ingredient rows per modifier). No parent-upsert step — the
 * modifier row already exists (unlike recipes, which upsert their parent row).
 * Returns Result<ModifierInventoryRule[]> — Ok on success, Err on any Supabase error.
 */
export function useMutationSaveModifierInventoryRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: SaveModifierInventoryRulesInput,
    ): Promise<Result<ModifierInventoryRule[]>> => {
      // 1. Delete existing rules for this modifier (replace strategy)
      const { error: deleteError } = await db
        .from('modifier_inventory_rules')
        .delete()
        .eq('modifier_id', input.modifierId);
      if (deleteError) {
        logger.error('useMutationSaveModifierInventoryRules: delete failed', {
          error: deleteError,
        });
        return err({ code: 'SUPABASE_ERROR', message: deleteError.message });
      }

      // 2. Insert new rules (if any)
      if (input.rules.length > 0) {
        const rows = input.rules.map(rule => ({
          modifier_id: input.modifierId,
          ingredient_id: rule.ingredientId,
          delta: rule.delta,
        }));
        const { error: insertError } = await db.from('modifier_inventory_rules').insert(rows);
        if (insertError) {
          logger.error('useMutationSaveModifierInventoryRules: insert failed', {
            error: insertError,
          });
          return err({ code: 'SUPABASE_ERROR', message: insertError.message });
        }
      }

      // 3. Re-select canonical rows
      const { data: freshData, error: fetchError } = await db
        .from('modifier_inventory_rules')
        .select('*')
        .eq('modifier_id', input.modifierId);
      if (fetchError) {
        logger.error('useMutationSaveModifierInventoryRules: re-select failed', {
          error: fetchError,
        });
        return err({ code: 'SUPABASE_ERROR', message: fetchError.message });
      }

      const parsed = (freshData as Record<string, unknown>[]).map(mapModifierInventoryRuleRow);
      return ok(parsed);
    },
    onSuccess: (result, variables) => {
      if (!result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: modifierInventoryRuleKeys.byModifier(variables.modifierId),
      });
    },
  });
}
