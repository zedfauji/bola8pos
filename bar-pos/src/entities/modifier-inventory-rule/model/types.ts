/**
 * entities/modifier-inventory-rule/model/types.ts
 *
 * Re-exports from domain.ts. Single source of truth is domain.ts;
 * this file exists to keep FSD layer imports consistent.
 */
export type { ModifierInventoryRule, ModifierInventoryRuleCreate } from '@shared/lib/domain';

export { ModifierInventoryRuleSchema, ModifierInventoryRuleCreateSchema } from '@shared/lib/domain';
