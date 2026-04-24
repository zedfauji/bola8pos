/**
 * Ingredient entity public API.
 *
 * Import from here: `import { useIngredients } from '@entities/ingredient'`
 *
 * FSD boundary: features and widgets may import from this index only.
 * Deep imports into model/ are NOT allowed from outside this entity.
 */
export {
  useIngredients,
  useIngredientsActive,
  useIngredient,
  useStockMovements,
  ingredientKeys,
} from './model/queries';

export type {
  Ingredient,
  IngredientCreate,
  IngredientUpdate,
  ManualAdjustReason,
  Uom,
  BaseUom,
} from './model/types';

export {
  IngredientSchema,
  IngredientCreateSchema,
  IngredientUpdateSchema,
  ManualAdjustReasonSchema,
  UomSchema,
  BaseUomSchema,
} from './model/types';
