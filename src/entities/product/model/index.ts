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
export {
  useProducts,
  useProductsForManagement,
  useCategories,
  useModifiers,
  useMutationCreateProduct,
  useMutationUpdateProduct,
  useMutationDeactivateProduct,
  useMutationCreateCategory,
  useMutationUpdateCategory,
  useMutationCreateModifier,
  useMutationUpdateModifier,
  useMutationDeleteModifier,
} from './queries';

export type { CreateProductInput, UpdateProductInput } from './queries';
