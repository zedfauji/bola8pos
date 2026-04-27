/**
 * SUPABASE CONTRACTS
 *
 * Defines the EXACT shape of every Supabase query we will make in this app.
 * Extends the auto-generated supabase.types.ts with typed query result shapes.
 */

import type { PostgrestError } from '@supabase/supabase-js';

// ============================================================================
// DATABASE TYPES (to be generated from Supabase)
// ============================================================================

/**
 * Placeholder for Supabase generated types.
 * Run: supabase gen types typescript --project-id YOUR_PROJECT_ID > src/shared/lib/supabase.types.ts
 */
export type Database = {
  public: {
    Tables: {
      tabs: {
        Row: {
          id: string;
          customer_name: string;
          table_number: number | null;
          staff_id: string;
          shift_id: string;
          opened_at: string;
          closed_at: string | null;
          status: 'open' | 'closed' | 'paid' | 'voided';
          notes: string | null;
        };
        Insert: unknown;
        Update: unknown;
      };
      orders: {
        Row: {
          id: string;
          tab_id: string;
          staff_id: string;
          created_at: string;
          status: 'pending' | 'served' | 'voided';
          notes: string | null;
        };
        Insert: unknown;
        Update: unknown;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          modifier_ids: string[];
          modifier_price_delta: number;
          notes: string | null;
        };
        Insert: unknown;
        Update: unknown;
      };
      products: {
        Row: {
          id: string;
          name: string;
          category_id: string;
          base_price: number;
          happy_hour_price: number | null;
          sku: string | null;
          is_active: boolean;
          image_url: string | null;
        };
        Insert: unknown;
        Update: unknown;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          color: string;
          sort_order: number;
          happy_hour_start: string | null;
          happy_hour_end: string | null;
          created_at: string;
        };
        Insert: unknown;
        Update: unknown;
      };
      modifiers: {
        Row: {
          id: string;
          name: string;
          price_delta: number;
          sort_order: number;
        };
        Insert: unknown;
        Update: unknown;
      };
      pool_tables: {
        Row: {
          id: string;
          number: number;
          label: string;
          rate_per_hour: number;
          status: 'available' | 'occupied' | 'reserved' | 'maintenance';
          current_session_id: string | null;
        };
        Insert: unknown;
        Update: unknown;
      };
      pool_sessions: {
        Row: {
          id: string;
          table_id: string;
          tab_id: string | null;
          started_at: string;
          stopped_at: string | null;
          billed_minutes: number | null;
          total_charge: number | null;
        };
        Insert: unknown;
        Update: unknown;
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          role: 'bartender' | 'manager' | 'admin';
          pin: string;
          is_active: boolean;
        };
        Insert: unknown;
        Update: unknown;
      };
      shifts: {
        Row: {
          id: string;
          staff_id: string;
          clock_in: string;
          clock_out: string | null;
          opening_cash: number;
          closing_cash: number | null;
        };
        Insert: unknown;
        Update: unknown;
      };
      payments: {
        Row: {
          id: string;
          tab_id: string;
          amount: number;
          tip_amount: number;
          method: 'cash' | 'card' | 'rappi';
          square_payment_id: string | null;
          square_receipt_url: string | null;
          processed_at: string;
          processed_by: string;
        };
        Insert: unknown;
        Update: unknown;
      };
      inventory: {
        Row: {
          id: string;
          product_id: string;
          quantity_on_hand: number;
          low_stock_threshold: number;
          unit: string;
        };
        Insert: unknown;
        Update: unknown;
      };
      stock_movements: {
        Row: {
          id: string;
          product_id: string;
          quantity_delta: number;
          reason:
            | 'sale'
            | 'manual_adjustment'
            | 'waste'
            | 'delivery'
            | 'correction'
            | 'physical_count'
            | 'prep_production'
            | 'prep_consumption'
            | 'combo_component'
            | 'refund'
            | 'void';
          staff_id: string;
          created_at: string;
        };
        Insert: unknown;
        Update: unknown;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

// ============================================================================
// QUERY RESULT WRAPPER
// ============================================================================

/**
 * Wraps Supabase query responses with data and error.
 */
export type SupabaseQueryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

// ============================================================================
// TYPED QUERY RESULT SHAPES
// ============================================================================

/**
 * Full tab with all orders and items (used in tab detail view).
 *
 * Query example:
 * ```typescript
 * supabase
 *   .from('tabs')
 *   .select(`
 *     *,
 *     orders (
 *       *,
 *       order_items (
 *         *,
 *         product:products (*)
 *       )
 *     ),
 *     staff:profiles (*)
 *   `)
 *   .eq('id', tabId)
 *   .single()
 * ```
 */
export type TabWithOrders = Database['public']['Tables']['tabs']['Row'] & {
  orders: Array<
    Database['public']['Tables']['orders']['Row'] & {
      order_items: Array<
        Database['public']['Tables']['order_items']['Row'] & {
          product: Database['public']['Tables']['products']['Row'];
        }
      >;
    }
  >;
  staff: Database['public']['Tables']['profiles']['Row'];
};

/**
 * Pool table with current session (used in pool table grid).
 *
 * Query example:
 * ```typescript
 * supabase
 *   .from('pool_tables')
 *   .select(`
 *     *,
 *     current_session:pool_sessions!current_session_id (*),
 *     tab:tabs (*)
 *   `)
 * ```
 */
export type PoolTableWithSession = Database['public']['Tables']['pool_tables']['Row'] & {
  current_session: Database['public']['Tables']['pool_sessions']['Row'] | null;
  tab: Database['public']['Tables']['tabs']['Row'] | null;
};

/**
 * Product with category and modifiers (used in POS product grid).
 *
 * Query example:
 * ```typescript
 * supabase
 *   .from('products')
 *   .select(`
 *     *,
 *     category:categories (*),
 *     modifiers (*)
 *   `)
 *   .eq('is_active', true)
 * ```
 */
export type ProductWithDetails = Database['public']['Tables']['products']['Row'] & {
  category: Database['public']['Tables']['categories']['Row'];
  modifiers: Database['public']['Tables']['modifiers']['Row'][];
};

/**
 * Inventory with product info (used in inventory page).
 *
 * Query example:
 * ```typescript
 * supabase
 *   .from('inventory')
 *   .select(`
 *     *,
 *     product:products (
 *       *,
 *       category:categories (*)
 *     )
 *   `)
 * ```
 */
export type InventoryWithProduct = Database['public']['Tables']['inventory']['Row'] & {
  product: ProductWithDetails;
};

/**
 * Shift with staff info (used in shift management).
 *
 * Query example:
 * ```typescript
 * supabase
 *   .from('shifts')
 *   .select(`
 *     *,
 *     staff:profiles (*)
 *   `)
 *   .is('clock_out', null)
 * ```
 */
export type ShiftWithStaff = Database['public']['Tables']['shifts']['Row'] & {
  staff: Database['public']['Tables']['profiles']['Row'];
};

/**
 * Order with items and products (used in order history).
 *
 * Query example:
 * ```typescript
 * supabase
 *   .from('orders')
 *   .select(`
 *     *,
 *     order_items (
 *       *,
 *       product:products (*)
 *     )
 *   `)
 *   .eq('tab_id', tabId)
 * ```
 */
export type OrderWithItems = Database['public']['Tables']['orders']['Row'] & {
  order_items: Array<
    Database['public']['Tables']['order_items']['Row'] & {
      product: Database['public']['Tables']['products']['Row'];
    }
  >;
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for TabWithOrders.
 */
export function isTabWithOrders(data: unknown): data is TabWithOrders {
  if (!data || typeof data !== 'object') return false;
  const tab = data as Record<string, unknown>;
  return (
    typeof tab.id === 'string' &&
    typeof tab.customer_name === 'string' &&
    Array.isArray(tab.orders) &&
    typeof tab.staff === 'object' &&
    tab.staff !== null
  );
}

/**
 * Type guard for PoolTableWithSession.
 */
export function isPoolTableWithSession(data: unknown): data is PoolTableWithSession {
  if (!data || typeof data !== 'object') return false;
  const table = data as Record<string, unknown>;
  return (
    typeof table.id === 'string' &&
    typeof table.number === 'number' &&
    typeof table.label === 'string' &&
    (table.current_session === null || typeof table.current_session === 'object')
  );
}

/**
 * Type guard for ProductWithDetails.
 */
export function isProductWithDetails(data: unknown): data is ProductWithDetails {
  if (!data || typeof data !== 'object') return false;
  const product = data as Record<string, unknown>;
  return (
    typeof product.id === 'string' &&
    typeof product.name === 'string' &&
    typeof product.category === 'object' &&
    product.category !== null &&
    Array.isArray(product.modifiers)
  );
}

/**
 * Type guard for InventoryWithProduct.
 */
export function isInventoryWithProduct(data: unknown): data is InventoryWithProduct {
  if (!data || typeof data !== 'object') return false;
  const inventory = data as Record<string, unknown>;
  return (
    typeof inventory.id === 'string' &&
    typeof inventory.product_id === 'string' &&
    typeof inventory.product === 'object' &&
    inventory.product !== null &&
    isProductWithDetails(inventory.product)
  );
}

/**
 * Type guard for ShiftWithStaff.
 */
export function isShiftWithStaff(data: unknown): data is ShiftWithStaff {
  if (!data || typeof data !== 'object') return false;
  const shift = data as Record<string, unknown>;
  return (
    typeof shift.id === 'string' &&
    typeof shift.staff_id === 'string' &&
    typeof shift.staff === 'object' &&
    shift.staff !== null
  );
}

/**
 * Type guard for OrderWithItems.
 */
export function isOrderWithItems(data: unknown): data is OrderWithItems {
  if (!data || typeof data !== 'object') return false;
  const order = data as Record<string, unknown>;
  return (
    typeof order.id === 'string' &&
    typeof order.tab_id === 'string' &&
    Array.isArray(order.order_items)
  );
}

// ============================================================================
// SUPABASE ERROR CODES
// ============================================================================

/**
 * Supabase/PostgreSQL error codes we handle in the application.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 * @see https://postgrest.org/en/stable/errors.html
 */
export const SUPABASE_ERROR_CODES = {
  /** Unique constraint violation (e.g., duplicate email) */
  UNIQUE_VIOLATION: '23505',
  /** Foreign key constraint violation (e.g., invalid reference) */
  FOREIGN_KEY_VIOLATION: '23503',
  /** Not null constraint violation (e.g., missing required field) */
  NOT_NULL_VIOLATION: '23502',
  /** Row not found (PostgREST specific) */
  ROW_NOT_FOUND: 'PGRST116',
  /** Row-level security violation (permission denied) */
  RLS_VIOLATION: '42501',
  /** Check constraint violation */
  CHECK_VIOLATION: '23514',
} as const;

// ============================================================================
// APPLICATION ERROR TYPE
// ============================================================================

/**
 * Application-level error type.
 * Maps Supabase errors to user-friendly messages.
 */
export type AppError = {
  code: string;
  message: string;
  details?: string;
  hint?: string;
};

// ============================================================================
// ERROR PARSING
// ============================================================================

/**
 * Parses a Supabase error into an application error.
 *
 * Maps Supabase error codes to user-friendly messages.
 *
 * @param error - The Supabase error
 * @returns Application error with user-friendly message
 *
 * @example
 * ```typescript
 * const { data, error } = await supabase.from('tabs').insert(newTab)
 * if (error) {
 *   const appError = parseSupabaseError(error)
 *   console.error(appError.message)
 * }
 * ```
 */
export function parseSupabaseError(error: PostgrestError): AppError {
  const code = error.code || 'UNKNOWN';

  switch (code) {
    case SUPABASE_ERROR_CODES.UNIQUE_VIOLATION:
      return {
        code,
        message: 'This record already exists',
        details: error.details,
        hint: error.hint,
      };

    case SUPABASE_ERROR_CODES.FOREIGN_KEY_VIOLATION:
      return {
        code,
        message: 'Invalid reference to related record',
        details: error.details,
        hint: error.hint,
      };

    case SUPABASE_ERROR_CODES.NOT_NULL_VIOLATION:
      return {
        code,
        message: 'Required field is missing',
        details: error.details,
        hint: error.hint,
      };

    case SUPABASE_ERROR_CODES.ROW_NOT_FOUND:
      return {
        code,
        message: 'Record not found',
        details: error.details,
        hint: error.hint,
      };

    case SUPABASE_ERROR_CODES.RLS_VIOLATION:
      return {
        code,
        message: 'Permission denied',
        details: error.details,
        hint: 'You do not have permission to perform this action',
      };

    case SUPABASE_ERROR_CODES.CHECK_VIOLATION:
      return {
        code,
        message: 'Invalid data',
        details: error.details,
        hint: error.hint,
      };

    default:
      return {
        code,
        message: error.message || 'An unexpected error occurred',
        details: error.details,
        hint: error.hint,
      };
  }
}

/**
 * Checks if an error is a specific Supabase error code.
 *
 * @param error - The Supabase error
 * @param code - The error code to check
 * @returns True if the error matches the code
 *
 * @example
 * ```typescript
 * if (isSupabaseError(error, SUPABASE_ERROR_CODES.UNIQUE_VIOLATION)) {
 *   console.log('Duplicate record')
 * }
 * ```
 */
export function isSupabaseError(
  error: PostgrestError | null,
  code: (typeof SUPABASE_ERROR_CODES)[keyof typeof SUPABASE_ERROR_CODES]
): boolean {
  return error?.code === code;
}

/**
 * Checks if a query result has an error.
 *
 * @param result - The query result
 * @returns True if the result has an error
 *
 * @example
 * ```typescript
 * const result = await supabase.from('tabs').select('*')
 * if (hasError(result)) {
 *   console.error(parseSupabaseError(result.error))
 * }
 * ```
 */
export function hasError<T>(
  result: SupabaseQueryResult<T>
): result is SupabaseQueryResult<T> & { error: PostgrestError; data: null } {
  return result.error !== null;
}

/**
 * Checks if a query result has data.
 *
 * @param result - The query result
 * @returns True if the result has data
 *
 * @example
 * ```typescript
 * const result = await supabase.from('tabs').select('*')
 * if (hasData(result)) {
 *   console.log(result.data)
 * }
 * ```
 */
export function hasData<T>(
  result: SupabaseQueryResult<T>
): result is SupabaseQueryResult<T> & { data: T; error: null } {
  return result.data !== null && result.error === null;
}
