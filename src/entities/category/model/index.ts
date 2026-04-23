/**
 * CATEGORY ENTITY MODEL - BARREL EXPORT
 */

// Types & Schemas
export {
  CategorySchema,
  CategoryCreateSchema,
  CategoryUpdateSchema,
  buildCategoryTree,
} from './types';
export type { Category, CategoryCreate, CategoryUpdate, CategoryNode } from './types';

// Query key (for external invalidation if needed)
export { CATEGORY_QUERY_KEY } from './queries';

// Data Fetching & Mutations
export {
  useCategories,
  useCategoryTree,
  useMutationCreateCategory,
  useMutationUpdateCategory,
} from './queries';
