/**
 * Category entity public API.
 *
 * Import from here: `import { useCategories } from '@entities/category'`
 *
 * FSD boundary: features and widgets may import from this index only.
 * Deep imports into model/ are NOT allowed from outside this entity.
 */

export {
  CategorySchema,
  CategoryCreateSchema,
  CategoryUpdateSchema,
  buildCategoryTree,
  CATEGORY_QUERY_KEY,
  useCategories,
  useCategoryTree,
  useMutationCreateCategory,
  useMutationUpdateCategory,
} from './model';

export type { Category, CategoryCreate, CategoryUpdate, CategoryNode } from './model';
