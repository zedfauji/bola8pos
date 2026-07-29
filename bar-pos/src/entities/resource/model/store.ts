import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Resource, PoolSession } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
/* eslint-disable i18next/no-literal-string -- zustand persist store name below
   is a localStorage key, not UI copy. */

interface ResourceState {
  tables: Resource[];
  sessions: PoolSession[];
}

interface ResourceActions {
  /** Updates a single table's status in place. */
  updateTableStatus: (id: string, status: Resource['status']) => void;

  /** Replaces the full sessions list; called by TanStack Query on success. */
  setSessionsFromQuery: (sessions: PoolSession[]) => void;

  /** Replaces the full tables list; called by TanStack Query on success. */
  setTablesFromQuery: (tables: Resource[]) => void;

  /** Applies a Supabase Realtime INSERT / UPDATE / DELETE for resources or pool_sessions. */
  handleRealtimeUpdate: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    table: 'resources' | 'pool_sessions';
    new: Partial<Resource | PoolSession>;
    old: Partial<Resource | PoolSession>;
  }) => void;
}

type ResourceStore = ResourceState & ResourceActions;

export const useResourceStore = create<ResourceStore>()(
  persist(
    set => ({
      tables: [],
      sessions: [],

      updateTableStatus: (id, status) => {
        logger.info('resource.status.updated', { tableId: id, status });
        set(state => ({
          tables: state.tables.map(t => (t.id === id ? { ...t, status } : t)),
        }));
      },

      setSessionsFromQuery: sessions => {
        logger.info('resource.sessions.loaded', { count: sessions.length });
        set({ sessions });
      },

      setTablesFromQuery: tables => {
        logger.info('resource.tables.loaded', { count: tables.length });
        set({ tables });
      },

      handleRealtimeUpdate: ({ eventType, table, new: newRecord, old: oldRecord }) => {
        logger.debug('resource.realtime', {
          eventType,
          table,
          id: newRecord.id ?? oldRecord.id,
        });

        if (table === 'resources') {
          set(state => {
            switch (eventType) {
              case 'INSERT':
                if (newRecord.id && !state.tables.some(t => t.id === newRecord.id)) {
                  return { tables: [...state.tables, newRecord as Resource] };
                }
                return state;
              case 'UPDATE':
                return {
                  tables: state.tables.map(t =>
                    t.id === newRecord.id ? { ...t, ...newRecord } : t
                  ),
                };
              case 'DELETE':
                return { tables: state.tables.filter(t => t.id !== oldRecord.id) };
              default:
                return state;
            }
          });
        } else {
          set(state => {
            switch (eventType) {
              case 'INSERT':
                if (newRecord.id && !state.sessions.some(s => s.id === newRecord.id)) {
                  return { sessions: [...state.sessions, newRecord as PoolSession] };
                }
                return state;
              case 'UPDATE':
                return {
                  sessions: state.sessions.map(s =>
                    s.id === newRecord.id ? { ...s, ...newRecord } : s
                  ),
                };
              case 'DELETE':
                return { sessions: state.sessions.filter(s => s.id !== oldRecord.id) };
              default:
                return state;
            }
          });
        }
      },
    }),
    {
      name: 'resource-store',
      partialize: state => ({ tables: state.tables, sessions: state.sessions }),
    }
  )
);

/** Returns a resource by ID, or undefined. */
export const selectTableById = (id: string): Resource | undefined =>
  useResourceStore.getState().tables.find(t => t.id === id);

/** Returns the active (not stopped) session for a given table, or undefined. */
export const selectActiveSessionForTable = (tableId: string): PoolSession | undefined =>
  useResourceStore.getState().sessions.find(s => s.tableId === tableId && s.stoppedAt === null);

/** Returns the count of tables whose status is 'available'. */
export const selectAvailableTableCount = (): number =>
  useResourceStore.getState().tables.filter(t => t.status === 'available').length;

/** Returns all sessions associated with a specific tab. */
export const selectSessionsByTabId = (tabId: string): PoolSession[] =>
  useResourceStore.getState().sessions.filter(s => s.tabId === tabId);
