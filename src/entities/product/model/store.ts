import { create } from 'zustand';
import type { Product, Category, Modifier } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';

interface ProductState {
  products: Product[];
  categories: Category[];
  modifiers: Modifier[];
  lastFetchedAt: Date | null;
}

interface ProductActions {
  /** Replaces the products list; called by TanStack Query on success. */
  setProducts: (products: Product[]) => void;

  /** Replaces the categories list; called by TanStack Query on success. */
  setCategories: (categories: Category[]) => void;

  /** Replaces the modifiers list; called by TanStack Query on success. */
  setModifiers: (modifiers: Modifier[]) => void;
}

type ProductStore = ProductState & ProductActions;

/** Read-only in POS — no mutations. Server state is owned by TanStack Query. */
export const useProductStore = create<ProductStore>(set => ({
  products: [],
  categories: [],
  modifiers: [],
  lastFetchedAt: null,

  setProducts: products => {
    logger.info('products.loaded', { count: products.length });
    set({ products, lastFetchedAt: new Date() });
  },

  setCategories: categories => {
    logger.info('categories.loaded', { count: categories.length });
    set({ categories });
  },

  setModifiers: modifiers => {
    logger.info('modifiers.loaded', { count: modifiers.length });
    set({ modifiers });
  },
}));

/** Returns a product by ID, or undefined. */
export const selectProductById = (id: string): Product | undefined =>
  useProductStore.getState().products.find(p => p.id === id);

/** Returns all active products. */
export const selectActiveProducts = (): Product[] =>
  useProductStore.getState().products.filter(p => p.isActive);

/** Returns a category by ID, or undefined. */
export const selectCategoryById = (id: string): Category | undefined =>
  useProductStore.getState().categories.find(c => c.id === id);

/** Returns all active products in a given category. */
export const selectProductsByCategoryId = (categoryId: string): Product[] =>
  useProductStore.getState().products.filter(p => p.categoryId === categoryId && p.isActive);

/** Returns a modifier by ID, or undefined. */
export const selectModifierById = (id: string): Modifier | undefined =>
  useProductStore.getState().modifiers.find(m => m.id === id);

/** Returns all modifiers matching the provided IDs. */
export const selectModifiersByIds = (ids: string[]): Modifier[] =>
  useProductStore.getState().modifiers.filter(m => ids.includes(m.id));
