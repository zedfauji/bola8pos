/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * Report-specific queries for the tab entity.
 * Kept in a sibling file to queries.ts to avoid bloating the main queries file.
 */

import { useQuery } from '@tanstack/react-query';
import type {
  HourlyRow,
  ProductSalesRow,
  VoidRefundRow,
  CategoryRevenueRow,
  ComboMixRow,
  RecipeVarianceRow,
  WaitlistMetricsRow,
  RefundRegisterRow,
  ComboOverrideRow,
} from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, unknownError, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

export type { HourlyRow, ProductSalesRow, VoidRefundRow, CategoryRevenueRow, ComboMixRow, RecipeVarianceRow, WaitlistMetricsRow, RefundRegisterRow, ComboOverrideRow };

// Intermediate type used during aggregation before pctTotal is computed
type CategoryRevenueAggregate = Omit<CategoryRevenueRow, 'pctTotal'>;

const db = supabase as any;

// ============================================================================
// PURE HELPER FUNCTIONS (exported for unit tests)
// ============================================================================

/**
 * Computes the percentage of total revenue for each row.
 * Returns an array of percentages (0–100) in the same order as the input rows.
 */
export function computePctTotals(rows: Array<{ revenue: number }>): number[] {
  const total = rows.reduce((sum, r) => sum + r.revenue, 0);
  if (total === 0) return rows.map(() => 0);
  return rows.map(r => Math.round((r.revenue / total) * 10000) / 100);
}

type HourlyItem = {
  orders: { created_at: string } | null;
  quantity: unknown;
  unit_price: unknown;
  modifier_price_delta: unknown;
};

/**
 * Aggregates raw order_item rows into per-hour totals.
 * Exported as a pure function so hourly bucketing can be unit-tested independently.
 */
export function aggregateHourlyRevenue(items: HourlyItem[]): HourlyRow[] {
  const map = new Map<number, { orderCount: number; revenue: number }>();

  for (const item of items) {
    const orderCreatedAt: string = item.orders?.created_at ?? '';
    if (!orderCreatedAt) continue;
    const hour = new Date(orderCreatedAt).getHours();
    const quantity: number = typeof item.quantity === 'number' ? item.quantity : 0;
    const unitPrice: number = typeof item.unit_price === 'number' ? item.unit_price : 0;
    const modDelta: number =
      typeof item.modifier_price_delta === 'number' ? item.modifier_price_delta : 0;
    const lineRev = quantity * (unitPrice + modDelta);

    const existing = map.get(hour);
    if (existing) {
      existing.orderCount += 1;
      existing.revenue += lineRev;
    } else {
      map.set(hour, { orderCount: 1, revenue: lineRev });
    }
  }

  return Array.from(map.entries()).map(([hour, v]) => ({
    hour,
    orderCount: v.orderCount,
    revenue: Math.round(v.revenue * 100) / 100,
  }));
}

/**
 * Fills in missing hours (0–23) with zero-revenue rows.
 * Returns a sorted 24-entry array.
 */
export function fillMissingHours(rows: HourlyRow[]): HourlyRow[] {
  const byHour = new Map<number, HourlyRow>();
  for (const r of rows) byHour.set(r.hour, r);

  const result: HourlyRow[] = [];
  for (let h = 0; h < 24; h++) {
    result.push(byHour.get(h) ?? { hour: h, orderCount: 0, revenue: 0 });
  }
  return result;
}

/**
 * Returns the hour with the highest revenue, or null if all hours are zero.
 */
export function findPeakHour(rows: HourlyRow[]): HourlyRow | null {
  const nonZero = rows.filter(r => r.revenue > 0);
  if (nonZero.length === 0) return null;
  return nonZero.reduce((best, r) => (r.revenue > best.revenue ? r : best));
}

/**
 * Returns the hour with the lowest non-zero revenue, or null if all hours are zero.
 */
export function findSlowestHour(rows: HourlyRow[]): HourlyRow | null {
  const nonZero = rows.filter(r => r.revenue > 0);
  if (nonZero.length === 0) return null;
  return nonZero.reduce((slowest, r) => (r.revenue < slowest.revenue ? r : slowest));
}

/**
 * Fills missing categories (from allCategories list) with zero-revenue rows.
 * Returns rows sorted by revenue descending, with canonical categories always present.
 */
export function fillMissingCategories(
  rows: CategoryRevenueAggregate[],
  allCategories: Array<{ id: string; name: string }>
): CategoryRevenueAggregate[] {
  const existing = new Map(rows.map(r => [r.categoryId, r]));
  const result = allCategories.map(
    cat =>
      existing.get(cat.id) ?? {
        categoryId: cat.id,
        categoryName: cat.name,
        unitsSold: 0,
        orderCount: 0,
        revenue: 0,
      }
  );
  return result.sort((a, b) => b.revenue - a.revenue);
}

/**
 * Aggregates raw order_item rows into per-category totals.
 * Exported as a pure function so aggregation logic can be unit-tested independently.
 */
export function aggregateCategoryRevenue(
  items: Array<{
    quantity: unknown;
    unit_price: unknown;
    modifier_price_delta: unknown;
    products: { categories: { id: string; name: string } | null } | null;
  }>
): CategoryRevenueAggregate[] {
  const map = new Map<
    string,
    { categoryName: string; unitsSold: number; orderCount: number; revenue: number }
  >();

  for (const item of items) {
    const categoryId: string = item.products?.categories?.id ?? 'unknown';
    const categoryName: string = item.products?.categories?.name ?? 'Uncategorized';
    const quantity: number = typeof item.quantity === 'number' ? item.quantity : 0;
    const unitPrice: number = typeof item.unit_price === 'number' ? item.unit_price : 0;
    const modDelta: number =
      typeof item.modifier_price_delta === 'number' ? item.modifier_price_delta : 0;
    const lineRev = quantity * (unitPrice + modDelta);

    const existing = map.get(categoryId);
    if (existing) {
      existing.unitsSold += quantity;
      existing.orderCount += 1;
      existing.revenue += lineRev;
    } else {
      map.set(categoryId, { categoryName, unitsSold: quantity, orderCount: 1, revenue: lineRev });
    }
  }

  return Array.from(map.entries()).map(([categoryId, v]) => ({
    categoryId,
    categoryName: v.categoryName,
    unitsSold: v.unitsSold,
    orderCount: v.orderCount,
    revenue: Math.round(v.revenue * 100) / 100,
  }));
}

// ============================================================================
// PRODUCT SALES REPORT
// ============================================================================

/**
 * Fetches product sales data for the given date range.
 * Groups by product and computes units sold, revenue, and % of total.
 */
export function useProductSalesReport(from: Date, to: Date) {
  return useQuery({
    queryKey: ['reports', 'product-sales', from.toISOString(), to.toISOString()] as const,
    queryFn: async (): Promise<Result<ProductSalesRow[]>> => {
      // Query order_items joined through orders → tabs,
      // filtered by tab.created_at in range, excluding voided orders
      const { data, error } = await db
        .from('order_items')
        .select(
          `
          quantity,
          unit_price,
          modifier_price_delta,
          products(id, name, categories(name)),
          orders!inner(status, tabs!inner(created_at))
          `
        )
        .neq('orders.status', 'voided')
        .gte('orders.tabs.created_at', from.toISOString())
        .lte('orders.tabs.created_at', to.toISOString());

      if (error) {
        logger.error('reports.product_sales.fetch_failed', { message: error.message });
        return err(unknownError(error));
      }

      if (!data || !Array.isArray(data)) return ok([]);

      // Aggregate by product
      const map = new Map<
        string,
        { productName: string; categoryName: string; units: number; revenue: number }
      >();

      for (const item of data) {
        const productId: string = item.products?.id ?? 'unknown';
        const productName: string = item.products?.name ?? 'Unknown Product';
        const categoryName: string = item.products?.categories?.name ?? 'Uncategorized';
        const quantity: number = typeof item.quantity === 'number' ? item.quantity : 0;
        const unitPrice: number = typeof item.unit_price === 'number' ? item.unit_price : 0;
        const modDelta: number =
          typeof item.modifier_price_delta === 'number' ? item.modifier_price_delta : 0;
        const lineRev = quantity * (unitPrice + modDelta);

        const existing = map.get(productId);
        if (existing) {
          existing.units += quantity;
          existing.revenue += lineRev;
        } else {
          map.set(productId, { productName, categoryName, units: quantity, revenue: lineRev });
        }
      }

      // Build rows sorted by revenue descending
      const rows: Array<Omit<ProductSalesRow, 'pctTotal'>> = Array.from(map.entries()).map(
        ([productId, v]) => ({
          productId,
          productName: v.productName,
          categoryName: v.categoryName,
          units: v.units,
          revenue: Math.round(v.revenue * 100) / 100,
        })
      );
      rows.sort((a, b) => b.revenue - a.revenue);

      const pcts = computePctTotals(rows);
      const result: ProductSalesRow[] = rows.map((r, i) => ({ ...r, pctTotal: pcts[i] ?? 0 }));
      return ok(result);
    },
    staleTime: 60_000,
  });
}

// ============================================================================
// HOURLY BREAKDOWN REPORT
// ============================================================================

/**
 * Fetches hourly revenue breakdown for the given date range.
 * Groups order_items by the hour of orders.created_at.
 * Missing hours are filled with zeros client-side.
 */
export function useHourlyBreakdown(from: Date, to: Date) {
  return useQuery({
    queryKey: ['reports', 'hourly-breakdown', from.toISOString(), to.toISOString()] as const,
    queryFn: async (): Promise<Result<HourlyRow[]>> => {
      // Fetch order_items with order created_at to extract hour
      const { data, error } = await db
        .from('order_items')
        .select(
          `
          quantity,
          unit_price,
          modifier_price_delta,
          orders!inner(created_at, status, tabs!inner(created_at))
          `
        )
        .neq('orders.status', 'voided')
        .gte('orders.tabs.created_at', from.toISOString())
        .lte('orders.tabs.created_at', to.toISOString());

      if (error) {
        logger.error('reports.hourly_breakdown.fetch_failed', { message: error.message });
        return err(unknownError(error));
      }

      if (!data || !Array.isArray(data)) return ok(fillMissingHours([]));

      const sparse = aggregateHourlyRevenue(data as HourlyItem[]);
      return ok(fillMissingHours(sparse));
    },
    staleTime: 60_000,
  });
}

// ============================================================================
// VOID / REFUND REPORT
// ============================================================================

/**
 * Filters void refund rows to those whose voidedAt falls within [from, to].
 * Exported for unit tests.
 */
export function filterVoidRefundRows(rows: VoidRefundRow[], from: Date, to: Date): VoidRefundRow[] {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  return rows.filter(r => {
    const t = r.voidedAt.getTime();
    return t >= fromMs && t <= toMs;
  });
}

/**
 * Fetches all voided orders for the given date range (filtered by voided_at,
 * falling back to updated_at when voided_at is null).
 * Joins profiles for staff name and order_items for computing amount.
 */
export function useVoidRefundReport(from: Date, to: Date) {
  return useQuery({
    queryKey: ['reports', 'void-refund', from.toISOString(), to.toISOString()] as const,
    queryFn: async (): Promise<Result<VoidRefundRow[]>> => {
      const { data, error } = await db
        .from('orders')
        .select(
          `
          id,
          void_reason,
          voided_at,
          updated_at,
          notes,
          profiles!orders_staff_id_fkey(name),
          order_items(quantity, unit_price, modifier_price_delta)
          `
        )
        .eq('status', 'voided')
        .gte('updated_at', from.toISOString())
        .lte('updated_at', to.toISOString())
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error('reports.void_refund.fetch_failed', { message: error.message });
        return err(unknownError(error));
      }

      if (!data || !Array.isArray(data)) return ok([]);

      const rows: VoidRefundRow[] = [];

      for (const order of data) {
        const orderId: string = order.id ?? '';
        const rawVoidedAt: string | null = order.voided_at ?? null;
        const rawUpdatedAt: string = order.updated_at ?? new Date().toISOString();
        const voidedAt = new Date(rawVoidedAt ?? rawUpdatedAt);

        const staffName: string = order.profiles?.name ?? 'Unknown';
        const reason: string = order.void_reason ?? order.notes ?? '';

        const items: Array<{ quantity: number; unit_price: number; modifier_price_delta: number }> =
          Array.isArray(order.order_items) ? order.order_items : [];

        const amount = items.reduce((sum: number, item) => {
          const qty: number = typeof item.quantity === 'number' ? item.quantity : 0;
          const price: number = typeof item.unit_price === 'number' ? item.unit_price : 0;
          const mod: number =
            typeof item.modifier_price_delta === 'number' ? item.modifier_price_delta : 0;
          return sum + qty * (price + mod);
        }, 0);

        rows.push({
          orderId,
          voidedAt,
          staffName,
          amount: Math.round(amount * 100) / 100,
          reason,
        });
      }

      return ok(rows);
    },
    staleTime: 60_000,
  });
}

// ============================================================================
// CATEGORY REVENUE REPORT
// ============================================================================

/**
 * Fetches category revenue data for the given date range.
 * Groups by category and computes units sold, order count, revenue, and % of total.
 * All categories from the DB are always present in the result (zero-revenue rows filled in).
 */
export function useCategoryRevenueReport(from: Date, to: Date) {
  return useQuery({
    queryKey: ['reports', 'category-revenue', from.toISOString(), to.toISOString()] as const,
    queryFn: async (): Promise<Result<CategoryRevenueRow[]>> => {
      // Fetch canonical category list so zero-revenue categories always appear
      const { data: cats, error: catsError } = await db
        .from('categories')
        .select('id, name')
        .order('name');

      if (catsError) {
        logger.error('reports.category_revenue.categories_fetch_failed', {
          message: catsError.message,
        });
        return err(unknownError(catsError));
      }

      const allCategories: Array<{ id: string; name: string }> = Array.isArray(cats) ? cats : [];

      const { data, error } = await db
        .from('order_items')
        .select(
          `
          quantity,
          unit_price,
          modifier_price_delta,
          products(id, categories(id, name)),
          orders!inner(status, tabs!inner(created_at))
          `
        )
        .neq('orders.status', 'voided')
        .gte('orders.tabs.created_at', from.toISOString())
        .lte('orders.tabs.created_at', to.toISOString());

      if (error) {
        logger.error('reports.category_revenue.fetch_failed', { message: error.message });
        return err(unknownError(error));
      }

      type RawItem = Parameters<typeof aggregateCategoryRevenue>[0][number];
      const rawItems: RawItem[] = Array.isArray(data) ? (data as RawItem[]) : [];
      const aggregated = aggregateCategoryRevenue(rawItems);
      const filled = fillMissingCategories(aggregated, allCategories);
      const pcts = computePctTotals(filled);
      const result: CategoryRevenueRow[] = filled.map((r, i) => ({ ...r, pctTotal: pcts[i] ?? 0 }));
      return ok(result);
    },
    staleTime: 60_000,
  });
}

// ============================================================================
// Phase 8 S6-01/03-09: Date-range guard + new report hooks
// ============================================================================

export function assertDateRangeValid(from: Date, to: Date): void {
  const daysDiff = Math.abs((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 365) {
    throw new Error('Date range exceeds 365 days. Please select a shorter range.');
  }
}

// ----------------------------------------------------------------------------
// Phase 8 S6-01/S6-03: ComboMixReport hook
// ----------------------------------------------------------------------------
export function useComboMixReport(from: Date, to: Date) {
  return useQuery({
    queryKey: ['reports', 'combo-mix', from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<Result<ComboMixRow[]>> => {
      assertDateRangeValid(from, to);
      const { data, error } = await db
        .from('combo_mix_daily')
        .select('*')
        .gte('date', from.toISOString().split('T')[0])
        .lte('date', to.toISOString().split('T')[0])
        .order('date', { ascending: false });
      if (error) return err(unknownError(error));
      return ok(
        (data as Array<Record<string, unknown>>).map(r => ({
          date: r['date'] as string,
          comboProductId: r['combo_product_id'] as string,
          comboName: r['combo_name'] as string,
          qtySold: r['qty_sold'] as number,
          netRevenue: r['net_revenue'] as number,
          avgPrice: r['avg_price'] as number,
          overrideCount: r['override_count'] as number,
        }))
      );
    },
  });
}

// ----------------------------------------------------------------------------
// Phase 8 S6-01/S6-04: RecipeVarianceReport hook
// ----------------------------------------------------------------------------
export function useRecipeVarianceReport(from: Date, to: Date) {
  return useQuery({
    queryKey: ['reports', 'recipe-variance', from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<Result<RecipeVarianceRow[]>> => {
      assertDateRangeValid(from, to);
      const { data, error } = await db
        .from('recipe_variance_daily')
        .select('*')
        .gte('date', from.toISOString().split('T')[0])
        .lte('date', to.toISOString().split('T')[0])
        .order('date', { ascending: false });
      if (error) return err(unknownError(error));
      return ok(
        (data as Array<Record<string, unknown>>).map(r => ({
          date: r['date'] as string,
          ingredientId: r['ingredient_id'] as string,
          ingredientName: r['ingredient_name'] as string,
          theoreticalUsed: r['theoretical_used'] as number,
          physicalDelta: r['physical_delta'] as number,
          variancePct: r['variance_pct'] as number,
        }))
      );
    },
  });
}

// ----------------------------------------------------------------------------
// Phase 8 S6-01/S6-05: WaitlistAnalyticsReport hook
// ----------------------------------------------------------------------------
export function useWaitlistAnalyticsReport(from: Date, to: Date) {
  return useQuery({
    queryKey: ['reports', 'waitlist-analytics', from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<Result<WaitlistMetricsRow[]>> => {
      assertDateRangeValid(from, to);
      const { data, error } = await db
        .from('waitlist_metrics_daily')
        .select('*')
        .gte('date', from.toISOString().split('T')[0])
        .lte('date', to.toISOString().split('T')[0])
        .order('date', { ascending: false });
      if (error) return err(unknownError(error));
      return ok(
        (data as Array<Record<string, unknown>>).map(r => ({
          date: r['date'] as string,
          partiesSeated: (r['parties_seated'] as number | null) ?? 0,
          avgQuotedWait: r['avg_quoted_wait'] as number | null,
          avgActualWait: r['avg_actual_wait'] as number | null,
          noShowRate: r['no_show_rate'] as number | null,
        }))
      );
    },
  });
}

// ----------------------------------------------------------------------------
// Phase 8 S6-01/S6-06: RefundsRegister hook
// ----------------------------------------------------------------------------
export function useRefundsRegister(from: Date, to: Date) {
  return useQuery({
    queryKey: ['reports', 'refunds-register', from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<Result<RefundRegisterRow[]>> => {
      assertDateRangeValid(from, to);
      const { data, error } = await db
        .from('refunds')
        .select(`
          id,
          created_at,
          original_payment_id,
          amount,
          reason,
          profiles!created_by ( full_name ),
          refund_items ( id, restock )
        `)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false });
      if (error) return err(unknownError(error));
      return ok(
        (data as Array<Record<string, unknown>>).map(r => {
          const profile = r['profiles'] as Record<string, unknown> | null;
          const items = (r['refund_items'] as Array<{ id: string; restock: boolean }> | null) ?? [];
          return {
            id: r['id'] as string,
            date: r['created_at'] as string,
            operatorName: (profile?.['full_name'] as string | undefined) ?? '—',
            originalPaymentId: r['original_payment_id'] as string,
            amount: r['amount'] as number,
            reason: r['reason'] as string,
            restockCount: items.filter(i => i.restock).length,
            items: [],
          };
        })
      );
    },
  });
}

// ----------------------------------------------------------------------------
// Phase 8 S6-09: ComboOverride hook — reads audit_log
// ----------------------------------------------------------------------------
export function useComboOverrides(from: Date, to: Date) {
  return useQuery({
    queryKey: ['reports', 'combo-overrides', from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<Result<ComboOverrideRow[]>> => {
      assertDateRangeValid(from, to);
      const { data, error } = await db
        .from('audit_log')
        .select(`
          id,
          ts,
          action,
          details,
          profiles!actor_id ( full_name )
        `)
        .eq('action', 'combo_availability_override')
        .gte('ts', from.toISOString())
        .lte('ts', to.toISOString())
        .order('ts', { ascending: false });
      if (error) return err(unknownError(error));
      return ok(
        (data as Array<Record<string, unknown>>).map(r => {
          const profile = r['profiles'] as Record<string, unknown> | null;
          const details = r['details'] as Record<string, unknown> | null;
          return {
            id: r['id'] as string,
            ts: r['ts'] as string,
            actorName: (profile?.['full_name'] as string | undefined) ?? '—',
            comboName: (details?.['combo_name'] as string | undefined) ?? '—',
            reason: (details?.['reason'] as string | null | undefined) ?? null,
          };
        })
      );
    },
  });
}
