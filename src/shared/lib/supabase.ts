import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Module-level token cache — populated by onAuthStateChange so callProcessPayment
// doesn't rely on getSession() storage reads, which fail in some environments.
let _cachedAccessToken: string | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  _cachedAccessToken = session?.access_token ?? null;
});

/** Returns the current user's JWT access token, or null if not authenticated. */
export function getCachedAccessToken(): string | null {
  return _cachedAccessToken;
}

// Row type aliases for use across the app
export type TabRow = Database['public']['Tables']['tabs']['Row'];
export type OrderRow = Database['public']['Tables']['orders']['Row'];
export type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
export type ProductRow = Database['public']['Tables']['products']['Row'];
export type CategoryRow = Database['public']['Tables']['categories']['Row'];
export type ModifierRow = Database['public']['Tables']['modifiers']['Row'];
export type PoolTableRow = Database['public']['Tables']['pool_tables']['Row'];
export type PoolSessionRow = Database['public']['Tables']['pool_sessions']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ShiftRow = Database['public']['Tables']['shifts']['Row'];
export type PaymentRow = Database['public']['Tables']['payments']['Row'];
export type InventoryRow = Database['public']['Tables']['inventory']['Row'];
