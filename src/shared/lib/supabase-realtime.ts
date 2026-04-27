/**
 * Supabase Realtime Subscriptions
 *
 * Sets up realtime listeners for critical tables and syncs changes
 * to Zustand stores for optimistic UI updates.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { TabRow, OrderRow, PoolTableRow, PoolSessionRow } from './supabase';

// Store update functions will be imported from entity stores
// For now, we'll define the interface they should implement
interface RealtimeUpdateHandler<T> {
  updateFromRealtime: (record: T) => void;
  removeFromRealtime?: (id: string) => void;
}

// Placeholder store references (will be replaced with actual stores)
let tabStore: RealtimeUpdateHandler<TabRow> | null = null;
let orderStore: RealtimeUpdateHandler<OrderRow> | null = null;
let poolTableStore: RealtimeUpdateHandler<PoolTableRow> | null = null;
let poolSessionStore: RealtimeUpdateHandler<PoolSessionRow> | null = null;

/**
 * Register store handlers for realtime updates
 * Call this from each entity store's initialization
 */
export function registerRealtimeHandlers(handlers: {
  tabs?: RealtimeUpdateHandler<TabRow>;
  orders?: RealtimeUpdateHandler<OrderRow>;
  poolTables?: RealtimeUpdateHandler<PoolTableRow>;
  poolSessions?: RealtimeUpdateHandler<PoolSessionRow>;
}) {
  if (handlers.tabs) tabStore = handlers.tabs;
  if (handlers.orders) orderStore = handlers.orders;
  if (handlers.poolTables) poolTableStore = handlers.poolTables;
  if (handlers.poolSessions) poolSessionStore = handlers.poolSessions;
}

/**
 * Setup realtime subscriptions for all critical tables
 * Returns an unsubscribe function to clean up on app unmount
 */
export function setupRealtimeSubscriptions(): () => void {
  const channels: RealtimeChannel[] = [];

  // Subscribe to tabs table
  const tabsChannel = supabase
    .channel('tabs-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tabs',
      },
      payload => {
        if (!tabStore) return;

        switch (payload.eventType) {
          case 'INSERT':
          case 'UPDATE':
            tabStore.updateFromRealtime(payload.new as TabRow);
            break;
          case 'DELETE':
            if (tabStore.removeFromRealtime) {
              tabStore.removeFromRealtime((payload.old as TabRow).id);
            }
            break;
        }
      }
    )
    .subscribe();

  channels.push(tabsChannel);

  // Subscribe to orders table
  const ordersChannel = supabase
    .channel('orders-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      payload => {
        if (!orderStore) return;

        switch (payload.eventType) {
          case 'INSERT':
          case 'UPDATE':
            orderStore.updateFromRealtime(payload.new as OrderRow);
            break;
          case 'DELETE':
            if (orderStore.removeFromRealtime) {
              orderStore.removeFromRealtime((payload.old as OrderRow).id);
            }
            break;
        }
      }
    )
    .subscribe();

  channels.push(ordersChannel);

  // Subscribe to pool_tables table
  const poolTablesChannel = supabase
    .channel('pool-tables-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pool_tables',
      },
      payload => {
        if (!poolTableStore) return;

        switch (payload.eventType) {
          case 'INSERT':
          case 'UPDATE':
            poolTableStore.updateFromRealtime(payload.new as PoolTableRow);
            break;
          case 'DELETE':
            if (poolTableStore.removeFromRealtime) {
              poolTableStore.removeFromRealtime((payload.old as PoolTableRow).id);
            }
            break;
        }
      }
    )
    .subscribe();

  channels.push(poolTablesChannel);

  // Subscribe to pool_sessions table
  const poolSessionsChannel = supabase
    .channel('pool-sessions-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pool_sessions',
      },
      payload => {
        if (!poolSessionStore) return;

        switch (payload.eventType) {
          case 'INSERT':
          case 'UPDATE':
            poolSessionStore.updateFromRealtime(payload.new as PoolSessionRow);
            break;
          case 'DELETE':
            if (poolSessionStore.removeFromRealtime) {
              poolSessionStore.removeFromRealtime((payload.old as PoolSessionRow).id);
            }
            break;
        }
      }
    )
    .subscribe();

  channels.push(poolSessionsChannel);

  // Return unsubscribe function
  return () => {
    void Promise.all(channels.map(channel => supabase.removeChannel(channel))).catch(() => {
      /* ignore unsubscribe errors */
    });
  };
}

/**
 * Check if realtime connection is active
 */
export function isRealtimeConnected(): boolean {
  return supabase.realtime.isConnected();
}

/**
 * Get realtime connection status
 */
export function getRealtimeStatus(): string {
  const channels = supabase.getChannels();
  return `Connected: ${String(isRealtimeConnected())}, Active channels: ${String(channels.length)}`;
}
