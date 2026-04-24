/**
 * Recipe entity public API.
 *
 * Import from here: `import { useRecipe } from '@entities/recipe'`
 *
 * FSD boundary: features and widgets may import from this index only.
 * Deep imports into model/ are NOT allowed from outside this entity.
 */
export type {
  Recipe,
  RecipeCreate,
  RecipeItem,
  RecipeItemCreate,
  RecipeUpdate,
  RecipeWithItems,
} from './model/types';

export {
  RecipeSchema,
  RecipeItemSchema,
  RecipeWithItemsSchema,
  RecipeCreateSchema,
  RecipeItemCreateSchema,
  RecipeUpdateSchema,
} from './model/types';

export { recipeKeys, useRecipe, useMutationSaveRecipe } from './model/queries';

export { RecipePreviewPanel } from './ui/RecipePreviewPanel';
