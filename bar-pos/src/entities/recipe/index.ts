/**
 * Recipe entity public API.
 *
 * Import from here: `import { useRecipe } from '@entities/recipe'`
 *
 * FSD boundary: features and widgets may import from this index only.
 * Deep imports into model/ are NOT allowed from outside this entity.
 */

export { useRecipe, useMutationSaveRecipe } from './model/queries';

export { RecipePreviewPanel } from './ui/RecipePreviewPanel';
