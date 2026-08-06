/**
 * Ingredient entity public API.
 *
 * Import from here: `import { useIngredients } from '@entities/ingredient'`
 *
 * FSD boundary: features and widgets may import from this index only.
 * Deep imports into model/ are NOT allowed from outside this entity.
 */
export { useIngredients, useIngredientsActive, useStockMovements, ingredientKeys } from './model/queries';

export type { Ingredient, IngredientCreate, ManualAdjustReason } from './model/types';

export { IngredientCreateSchema } from './model/types';
