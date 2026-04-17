import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PoolTable, PoolSession } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';

interface PoolTableState {
  tables: PoolTable[];
  sessions: PoolSession[];
}

interface PoolTableActions {
  /** Updates a single table's status in place. */
  updateTableStatus: (id: string, status: PoolTable['status']) => void;

  /** Replaces the full sessions list; called by TanStack Query on success. */
  setSessionsFromQuery: (sessions: PoolSession[]) => void;

  /** Replaces the full tables list; called by TanStack Query on success. */
  setTablesFromQuery: (tables: PoolTable[]) => void;

  /** Applies a Supabase Realtime INSERT / UPDATE / DELETE for pool_tables or pool_sessions. */
  handleRealtimeUpdate: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    table: 'pool_tables' | 'pool_sessions';
    new: Partial<PoolTable | PoolSession>;
    old: Partial<PoolTable | PoolSession>;
  }) => void;
}

type PoolTableStore = PoolTableState & PoolTableActions;

export const usePoolTableStore = create<PoolTableStore>()(
  persist(
    set => ({
      tables: [],
      sessions: [],

      updateTableStatus: (id, status) => {
        logger.info('poolTable.status.updated', { tableId: id, status });
        set(state => ({
          tables: state.tables.map(t => (t.id === id ? { ...t, status } : t)),
        }));
      },

      setSessionsFromQuery: sessions => {
        logger.info('poolTable.sessions.loaded', { count: sessions.length });
        set({ sessions });
      },

      setTablesFromQuery: tables => {
        logger.info('poolTable.tables.loaded', { count: tables.length });
        set({ tables });
      },

      handleRealtimeUpdate: ({ eventType, table, new: newRecord, old: oldRecord }) => {
        logger.debug('poolTable.realtime', {
          eventType,
          table,
          id: newRecord.id ?? oldRecord.id,
        });

        if (table === 'pool_tables') {
          set(state => {
            switch (eventType) {
              case 'INSERT':
                if (newRecord.id && !state.tables.some(t => t.id === newRecord.id)) {
                  return { tables: [...state.tables, newRecord as PoolTable] };
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
      name: 'pool-table-store',
      partialize: state => ({ tables: state.tables, sessions: state.sessions }),
    }
  )
);

/** Returns a pool table by ID, or undefined. */
export const selectTableById = (id: string): PoolTable | undefined =>
  usePoolTableStore.getState().tables.find(t => t.id === id);

/** Returns the active (not stopped) session for a given table, or undefined. */
export const selectActiveSessionForTable = (tableId: string): PoolSession | undefined =>
  usePoolTableStore.getState().sessions.find(s => s.tableId === tableId && s.stoppedAt === null);

/** Returns the count of tables whose status is 'available'. */
export const selectAvailableTableCount = (): number =>
  usePoolTableStore.getState().tables.filter(t => t.status === 'available').length;

/** Returns all sessions associated with a specific tab. */
export const selectSessionsByTabId = (tabId: string): PoolSession[] =>
  usePoolTableStore.getState().sessions.filter(s => s.tabId === tabId);
