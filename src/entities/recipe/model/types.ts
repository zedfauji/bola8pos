/**
 * entities/recipe/model/types.ts
 *
 * Re-exports from domain.ts. Single source of truth is domain.ts;
 * this file exists to keep FSD layer imports consistent.
 */
export type {
  Recipe,
  RecipeCreate,
  RecipeItem,
  RecipeItemCreate,
  RecipeUpdate,
  RecipeWithItems,
} from '@shared/lib/domain';

export {
  RecipeSchema,
  RecipeItemSchema,
  RecipeWithItemsSchema,
  RecipeCreateSchema,
  RecipeItemCreateSchema,
  RecipeUpdateSchema,
} from '@shared/lib/domain';
