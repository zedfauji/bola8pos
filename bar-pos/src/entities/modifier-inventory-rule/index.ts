/**
 * Modifier Inventory Rule entity public API.
 *
 * Import from here: `import { useModifierInventoryRules } from '@entities/modifier-inventory-rule'`
 *
 * FSD boundary: features and widgets may import from this index only.
 * Deep imports into model/ are NOT allowed from outside this entity.
 */
export type { ModifierInventoryRule, ModifierInventoryRuleCreate } from './model/types';

export { ModifierInventoryRuleSchema, ModifierInventoryRuleCreateSchema } from './model/types';

export {
  modifierInventoryRuleKeys,
  useModifierInventoryRules,
  useMutationSaveModifierInventoryRules,
} from './model/queries';
