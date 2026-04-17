import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Category, Modifier, Product } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, supabaseQuery, unknownError, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import type { Tables } from '@shared/lib/supabase.types';
import { useProductStore } from './store';
import { ProductSchema, CategorySchema, ModifierSchema } from './types';

type ProductModifierJoin = {
  modifier: Tables<'modifiers'> | null;
};

type ProductRow = Tables<'products'> & {
  category: Tables<'categories'> | null;
  product_modifiers: ProductModifierJoin[] | null;
};

function mapProductRow(row: ProductRow): Result<Product> {
  try {
    const modifiers = (row.product_modifiers ?? [])
      .map(pm => pm.modifier)
      .filter((m): m is Tables<'modifiers'> => Boolean(m))
      .map(m =>
        ModifierSchema.parse({
          id: m.id,
          name: m.name,
          priceDelta: m.price_delta,
          sortOrder: m.sort_order,
        })
      );

    const category =
      row.category != null
        ? CategorySchema.parse({
            id: row.category.id,
            name: row.category.name,
            color: row.category.color,
            sortOrder: row.category.sort_order,
            happyHourStart: row.category.happy_hour_start,
            happyHourEnd: row.category.happy_hour_end,
            createdAt: new Date(row.category.created_at),
          })
        : undefined;

    return ok(
      ProductSchema.parse({
        id: row.id,
        name: row.name,
        categoryId: row.category_id,
        basePrice: row.base_price,
        happyHourPrice: row.happy_hour_price ?? null,
        sku: row.sku,
        isActive: row.is_active,
        imageUrl: row.image_url,
        modifiers,
        category,
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

function mapCategoryRow(row: Tables<'categories'>): Result<Category> {
  try {
    return ok(
      CategorySchema.parse({
        id: row.id,
        name: row.name,
        color: row.color,
        sortOrder: row.sort_order,
        happyHourStart: row.happy_hour_start,
        happyHourEnd: row.happy_hour_end,
        createdAt: new Date(row.created_at),
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

function mapModifierRow(row: Tables<'modifiers'>): Result<Modifier> {
  try {
    return ok(
      ModifierSchema.parse({
        id: row.id,
        name: row.name,
        priceDelta: row.price_delta,
        sortOrder: row.sort_order,
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

/**
 * Fetches all active products with their category and modifiers.
 * On success updates {@link useProductStore}; returns `Result` (never throws).
 */
export function useProducts() {
  const setProducts = useProductStore(state => state.setProducts);

  const query = useQuery({
    queryKey: ['products'],
    queryFn: async (): Promise<Result<Product[]>> => {
      const res = await supabaseQuery(() =>
        supabase
          .from('products')
          .select(
            `
            *,
            category:categories(*),
            product_modifiers(
              modifier:modifiers(*)
            )
          `
          )
          .eq('is_active', true)
          .order('name')
      );

      if (!res.ok) {
        logger.error('products.fetch_failed', {
          code: res.error.code,
          message: res.error.message,
        });
        return res;
      }

      const products: Product[] = [];
      for (const row of res.data as ProductRow[]) {
        const mapped = mapProductRow(row);
        if (!mapped.ok) {
          logger.error('products.map_failed', { message: mapped.error.message });
          return mapped;
        }
        products.push(mapped.data);
      }
      return ok(products);
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data?.ok) setProducts(query.data.data);
  }, [query.data, setProducts]);

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: query.isSuccess && !!r?.ok && r.data.length === 0,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

/**
 * Fetches all categories sorted by sort_order.
 * On success updates {@link useProductStore}; returns `Result` (never throws).
 */
export function useCategories() {
  const setCategories = useProductStore(state => state.setCategories);

  const query = useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Result<Category[]>> => {
      const res = await supabaseQuery(() =>
        supabase.from('categories').select('*').order('sort_order')
      );

      if (!res.ok) {
        logger.error('categories.fetch_failed', {
          code: res.error.code,
          message: res.error.message,
        });
        return res;
      }

      const categories: Category[] = [];
      for (const row of res.data) {
        const mapped = mapCategoryRow(row);
        if (!mapped.ok) {
          logger.error('categories.map_failed', { message: mapped.error.message });
          return mapped;
        }
        categories.push(mapped.data);
      }
      return ok(categories);
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data?.ok) setCategories(query.data.data);
  }, [query.data, setCategories]);

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: query.isSuccess && !!r?.ok && r.data.length === 0,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

/**
 * Fetches all modifiers sorted by sort_order.
 * On success updates {@link useProductStore}; returns `Result` (never throws).
 */
export function useModifiers() {
  const setModifiers = useProductStore(state => state.setModifiers);

  const query = useQuery({
    queryKey: ['modifiers'],
    queryFn: async (): Promise<Result<Modifier[]>> => {
      const res = await supabaseQuery(() =>
        supabase.from('modifiers').select('*').order('sort_order')
      );

      if (!res.ok) {
        logger.error('modifiers.fetch_failed', {
          code: res.error.code,
          message: res.error.message,
        });
        return res;
      }

      const modifiers: Modifier[] = [];
      for (const row of res.data) {
        const mapped = mapModifierRow(row);
        if (!mapped.ok) {
          logger.error('modifiers.map_failed', { message: mapped.error.message });
          return mapped;
        }
        modifiers.push(mapped.data);
      }
      return ok(modifiers);
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data?.ok) setModifiers(query.data.data);
  }, [query.data, setModifiers]);

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: query.isSuccess && !!r?.ok && r.data.length === 0,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}
