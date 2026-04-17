/**
 * PRODUCT ENTITY - BARREL EXPORT
 */

// Types & Schemas
export { ProductSchema, CategorySchema, ModifierSchema, ProductCreateSchema } from './types';

export type { Product, Category, Modifier, ProductCreate } from './types';

// State Management
export {
  useProductStore,
  selectActiveProducts,
  selectProductById,
  selectCategoryById,
  selectProductsByCategoryId,
  selectModifierById,
  selectModifiersByIds,
} from './store';

// Data Fetching
export { useProducts, useCategories, useModifiers } from './queries';
