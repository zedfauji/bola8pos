// src/entities/category/model/types.ts
export { CategorySchema, CategoryCreateSchema, CategoryUpdateSchema } from '@shared/lib/domain';

export type { Category, CategoryCreate, CategoryUpdate } from '@shared/lib/domain';

// Re-export the tree utilities from shared so consumers of this entity
// don't need to know where the low-level tree functions live.
export {
  buildTree as buildCategoryTree,
  type CategoryTreeNode as CategoryNode,
} from '@shared/lib/category-tree';
