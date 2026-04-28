import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { tabKeys } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import type { PoolSession, PoolTable, PoolTableType } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { computePoolSessionBilling } from '@shared/lib/pool-billing';
import {
  err,
  ok,
  staleVersionError,
  supabaseMutation,
  supabaseQuery,
  unknownError,
  type Result,
} from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import type { Json } from '@shared/lib/supabase.types';
import type { Tables, TablesInsert, TablesUpdate } from '@shared/lib/supabase.types';
import { handleVersionError } from '@shared/lib/version-error';
import { usePoolTableStore } from './store';
import { PoolTableSchema, PoolSessionSchema } from './types';

export const poolTableKeys = {
  all: ['pool-tables'] as const,
  detail: (id: string) => [...poolTableKeys.all, 'detail', id] as const,
};

type PoolSessionRowWithPrevious = Tables<'pool_sessions'> & {
  previous_table: { number: number } | null;
};

type PoolTableRow = Tables<'pool_tables'> & {
  current_session: PoolSessionRowWithPrevious | null;
};

const TERMINAL_ID =
  (import.meta.env.VITE_TERMINAL_ID as string | undefined) ?? 'POS-1';

function mapPoolSessionRow(
  row: Tables<'pool_sessions'> | PoolSessionRowWithPrevious
): Result<PoolSession> {
  try {
    const previousTable = 'previous_table' in row ? row.previous_table : null;
    return ok(
      PoolSessionSchema.omit({ table: true }).parse({
        id: row.id,
        tableId: row.table_id,
        tabId: row.tab_id,
        startedAt: new Date(row.started_at),
        stoppedAt: row.stopped_at ? new Date(row.stopped_at) : null,
        billedMinutes: row.billed_minutes,
        totalCharge: row.total_charge,
        previousTableId: row.previous_table_id,
        previousTableNumber: previousTable?.number ?? null,
        // Phase 15: optimistic-concurrency version (column added 20260512000001)
        ...(typeof (row as { version?: number }).version === 'number'
          ? { version: (row as { version?: number }).version }
          : {}),
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

function mapPoolTableRow(row: PoolTableRow): Result<PoolTable> {
  try {
    const currentSession =
      row.current_session != null ? mapPoolSessionRow(row.current_session) : null;
    if (currentSession && !currentSession.ok) return currentSession;

    return ok(
      PoolTableSchema.parse({
        id: row.id,
        number: row.number,
        label: row.label,
        ratePerHour: row.rate_per_hour,
        status: row.status,
        tableType: row.table_type,
        currentSessionId: row.current_session_id,
        currentSession: currentSession?.ok ? currentSession.data : undefined,
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

export function usePoolTables() {
  const query = useQuery({
    queryKey: poolTableKeys.all,
    queryFn: async (): Promise<Result<PoolTable[]>> => {
      const res = await supabaseQuery(() =>
        supabase
          .from('pool_tables')
          .select(
            `
          *,
          current_session:pool_sessions!fk_pool_tables_current_session(
            *,
            previous_table:pool_tables!pool_sessions_previous_table_id_fkey(number)
          )
        `
          )
          .order('number')
      );

      if (!res.ok) {
        logger.error('pool_tables.fetch_failed', {
          code: res.error.code,
          message: res.error.message,
        });
        return res;
      }

      const tables: PoolTable[] = [];
      for (const row of res.data as PoolTableRow[]) {
        const m = mapPoolTableRow(row);
        if (!m.ok) {
          logger.error('pool_tables.map_failed', { message: m.error.message });
          return m;
        }
        tables.push(m.data);
      }
      return ok(tables);
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (query.data?.ok) {
      const tables = query.data.data;
      usePoolTableStore.getState().setTablesFromQuery(tables);
      const sessions = tables
        .map(t => t.currentSession)
        .filter((s): s is PoolSession => Boolean(s && s.stoppedAt == null));
      usePoolTableStore.getState().setSessionsFromQuery(sessions);
    }
  }, [query.data]);

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: query.isSuccess && !!r?.ok && r.data.length === 0,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

export function usePoolTable(id: string) {
  const query = useQuery({
    queryKey: poolTableKeys.detail(id),
    enabled: Boolean(id),
    queryFn: async (): Promise<Result<PoolTable>> => {
      const res = await supabaseQuery(() =>
        supabase
          .from('pool_tables')
          .select(
            `
          *,
          current_session:pool_sessions!fk_pool_tables_current_session(
            *,
            previous_table:pool_tables!pool_sessions_previous_table_id_fkey(number)
          )
        `
          )
          .eq('id', id)
          .single()
      );

      if (!res.ok) {
        logger.error('pool_tables.detail.fetch_failed', {
          tableId: id,
          code: res.error.code,
          message: res.error.message,
        });
        return res;
      }

      return mapPoolTableRow(res.data as unknown as PoolTableRow);
    },
  });

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: false,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

type PoolTablesSnapshot = Result<PoolTable[]> | undefined;

export function useMutationStartSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tableId,
      tabId,
    }: {
      tableId: string;
      tabId: string | null;
    }): Promise<Result<PoolSession>> => {
      const sessionInsert: TablesInsert<'pool_sessions'> = {
        table_id: tableId,
        tab_id: tabId,
      };

      const sessionRes = await supabaseMutation<Tables<'pool_sessions'>>(() =>
        supabase.from('pool_sessions').insert(sessionInsert).select().single()
      );

      if (!sessionRes.ok) {
        logger.error('pool_tables.session.start_insert_failed', {
          tableId,
          message: sessionRes.error.message,
        });
        return sessionRes;
      }
      if (sessionRes.data === null) {
        return err(unknownError('no_row'));
      }

      const insertedSession = sessionRes.data;

      const tableRes = await supabaseMutation(() =>
        supabase
          .from('pool_tables')
          .update({
            status: 'occupied',
            current_session_id: insertedSession.id,
          })
          .eq('id', tableId)
      );

      if (!tableRes.ok) {
        logger.error('pool_tables.session.start_table_update_failed', {
          tableId,
          message: tableRes.error.message,
        });
        return tableRes;
      }

      const mapped = mapPoolSessionRow(insertedSession);
      if (!mapped.ok) return mapped;
      return ok(mapped.data);
    },

    onMutate: async ({ tableId }) => {
      await queryClient.cancelQueries({ queryKey: poolTableKeys.all });
      const previous = queryClient.getQueryData<Result<PoolTable[]>>(poolTableKeys.all);
      usePoolTableStore.getState().updateTableStatus(tableId, 'occupied');
      queryClient.setQueryData<Result<PoolTable[]>>(poolTableKeys.all, old => {
        if (!old?.ok) return old;
        return ok(
          old.data.map(t =>
            t.id === tableId
              ? { ...t, status: 'occupied' as const, currentSessionId: t.currentSessionId }
              : t
          )
        );
      });
      return { previous } as { previous: PoolTablesSnapshot };
    },

    onSuccess: (result, variables, ctx) => {
      if (!result.ok) {
        if (result.error.code === 'NETWORK_OFFLINE') {
          // Phase 15 Plan 04: start-pool-timer creates a new pool_session row
          // (no prior version) — capture expectedVersion: 0.
          useTabStore.getState().enqueueOfflineAction({
            type: 'start-pool-timer',
            payload: variables,
            expectedVersion: 0,
          });
          // Keep the optimistic 'occupied' status; sync will confirm it.
          return;
        }
        const prev = (ctx as { previous?: PoolTablesSnapshot } | undefined)?.previous;
        if (prev !== undefined) {
          queryClient.setQueryData(poolTableKeys.all, prev);
          if (prev.ok) usePoolTableStore.getState().setTablesFromQuery(prev.data);
        }
        usePoolTableStore.getState().updateTableStatus(variables.tableId, 'available');
        return;
      }
      void queryClient.invalidateQueries({ queryKey: poolTableKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['pool-sessions'] });
      void queryClient.invalidateQueries({ queryKey: ['tabs'] });
    },

    onError: (_e, variables, ctx) => {
      const prev = (ctx as { previous?: PoolTablesSnapshot } | undefined)?.previous;
      if (prev !== undefined) {
        queryClient.setQueryData(poolTableKeys.all, prev);
        if (prev.ok) usePoolTableStore.getState().setTablesFromQuery(prev.data);
      }
      usePoolTableStore.getState().updateTableStatus(variables.tableId, 'available');
    },
  });
}

export function useMutationStopSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      tableId,
      ratePerHour,
    }: {
      sessionId: string;
      tableId: string;
      ratePerHour: number;
    }): Promise<Result<PoolSession>> => {
      const fetchRes = await supabaseQuery<Tables<'pool_sessions'>>(() =>
        supabase.from('pool_sessions').select('*').eq('id', sessionId).single()
      );

      if (!fetchRes.ok) {
        logger.error('pool_tables.session.stop_fetch_failed', { message: fetchRes.error.message });
        return fetchRes;
      }

      const session = fetchRes.data;
      const startedAt = new Date(session.started_at);
      const stoppedAt = new Date();

      // Fetch billing settings to get firstHourMode
      const billingRes = await supabaseQuery<{ value: Json }>(() =>
        supabase.from('settings').select('value').eq('key', 'billing').maybeSingle()
      );
      const billingValue = billingRes.ok
        ? (billingRes.data.value as Record<string, unknown> | null)
        : null;
      const firstHourMode: 'full' | 'prorated' =
        billingValue?.['firstHourMode'] === 'full' ? 'full' : 'prorated';

      const { billedMinutes, totalCharge } = computePoolSessionBilling({
        startedAt,
        endTime: stoppedAt,
        ratePerHour,
        firstHourMode,
      });

      // Phase 15 Group B: optimistic-concurrency UPDATE on pool_sessions.
      // Use cached session.version when available; otherwise fall back to legacy.
      const cachedVersion =
        typeof (session as { version?: number }).version === 'number'
          ? (session as { version?: number }).version
          : undefined;

      let updatedSession: Tables<'pool_sessions'>;
      if (cachedVersion !== undefined) {
        const expected = cachedVersion;
        const { data, error } = await supabase
          .from('pool_sessions')
          .update({
            stopped_at: stoppedAt.toISOString(),
            billed_minutes: billedMinutes,
            total_charge: totalCharge,
            version: expected + 1,
          })
          .eq('id', sessionId)
          .eq('version', expected)
          .select()
          .single();
        if (error?.code === 'PGRST116') {
          return err(staleVersionError(error));
        }
        if (error) {
          logger.error('pool_tables.session.stop_update_failed', { message: error.message });
          return err(unknownError(error));
        }
        updatedSession = data;
      } else {
        const sessionRes = await supabaseMutation<Tables<'pool_sessions'>>(() =>
          supabase
            .from('pool_sessions')
            .update({
              stopped_at: stoppedAt.toISOString(),
              billed_minutes: billedMinutes,
              total_charge: totalCharge,
            })
            .eq('id', sessionId)
            .select()
            .single()
        );

        if (!sessionRes.ok) {
          logger.error('pool_tables.session.stop_update_failed', {
            message: sessionRes.error.message,
          });
          return sessionRes;
        }
        if (sessionRes.data === null) {
          return err(unknownError('no_row'));
        }
        updatedSession = sessionRes.data;
      }

      const tableRes = await supabaseMutation(() =>
        supabase
          .from('pool_tables')
          .update({
            status: 'available',
            current_session_id: null,
          })
          .eq('id', tableId)
      );

      if (!tableRes.ok) {
        logger.error('pool_tables.session.stop_table_failed', { message: tableRes.error.message });
        return tableRes;
      }

      const mapped = mapPoolSessionRow(updatedSession);
      if (!mapped.ok) return mapped;
      return ok(mapped.data);
    },

    onMutate: async ({ tableId }) => {
      await queryClient.cancelQueries({ queryKey: poolTableKeys.all });
      const previous = queryClient.getQueryData<Result<PoolTable[]>>(poolTableKeys.all);
      usePoolTableStore.getState().updateTableStatus(tableId, 'available');
      queryClient.setQueryData<Result<PoolTable[]>>(poolTableKeys.all, old => {
        if (!old?.ok) return old;
        return ok(
          old.data.map(t =>
            t.id === tableId
              ? {
                  ...t,
                  status: 'available' as const,
                  currentSessionId: null,
                  currentSession: undefined,
                }
              : t
          )
        );
      });
      return { previous } as { previous: PoolTablesSnapshot };
    },

    onSuccess: (result, variables, ctx) => {
      if (!result.ok) {
        if (result.error.code === 'NETWORK_OFFLINE') {
          // Phase 15 Plan 04: capture cached pool_session.version at enqueue
          // time. Look up the session via the pool_tables list cache (each
          // table embeds its current session including version).
          {
            const tablesCache = queryClient.getQueryData<Result<PoolTable[]>>(poolTableKeys.all);
            let expectedVersion = 0;
            if (tablesCache?.ok) {
              const t = tablesCache.data.find(
                pt => pt.currentSession?.id === variables.sessionId
              );
              const v = t?.currentSession?.version;
              if (typeof v === 'number') expectedVersion = v;
            }
            useTabStore.getState().enqueueOfflineAction({
              type: 'stop-pool-timer',
              payload: variables,
              expectedVersion,
            });
          }
          // Keep the optimistic 'available' status; sync will confirm it.
          return;
        }
        // Phase 15: STALE_VERSION on pool_sessions stop UPDATE
        handleVersionError(result.error, {
          queryClient,
          queryKey: poolTableKeys.all,
          entity: 'pool_sessions',
          entityId: variables.sessionId,
          expectedVersion: 0,
          supabase,
          terminalId: TERMINAL_ID,
        });
        const prev = (ctx as { previous?: PoolTablesSnapshot } | undefined)?.previous;
        if (prev !== undefined) {
          queryClient.setQueryData(poolTableKeys.all, prev);
          if (prev.ok) usePoolTableStore.getState().setTablesFromQuery(prev.data);
        }
        usePoolTableStore.getState().updateTableStatus(variables.tableId, 'occupied');
        return;
      }
      void queryClient.invalidateQueries({ queryKey: poolTableKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['pool-sessions'] });
      void queryClient.invalidateQueries({ queryKey: ['tabs'] });
    },

    onError: (_e, variables, ctx) => {
      const prev = (ctx as { previous?: PoolTablesSnapshot } | undefined)?.previous;
      if (prev !== undefined) {
        queryClient.setQueryData(poolTableKeys.all, prev);
        if (prev.ok) usePoolTableStore.getState().setTablesFromQuery(prev.data);
      }
      usePoolTableStore.getState().updateTableStatus(variables.tableId, 'occupied');
    },
  });
}

export function usePoolSessionsByTab(tabId: string) {
  const query = useQuery({
    queryKey: ['pool-sessions', 'tab', tabId],
    enabled: Boolean(tabId),
    queryFn: async (): Promise<Result<PoolSession[]>> => {
      const res = await supabaseQuery(() =>
        supabase
          .from('pool_sessions')
          .select('*')
          .eq('tab_id', tabId)
          .order('started_at', { ascending: false })
      );

      if (!res.ok) {
        logger.error('pool_sessions.by_tab.fetch_failed', { message: res.error.message });
        return res;
      }

      const sessions: PoolSession[] = [];
      for (const row of res.data) {
        const m = mapPoolSessionRow(row);
        if (!m.ok) return m;
        sessions.push(m.data);
      }
      return ok(sessions);
    },
  });

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
    isEmpty: query.isSuccess && !!r?.ok && r.data.length === 0,
    isIdleOrLoading: query.isPending || query.isLoading,
  };
}

export function useMutationLinkPoolSessionToTab() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      tabId,
    }: {
      sessionId: string;
      tabId: string;
    }): Promise<Result<void>> => {
      const res = await supabaseMutation(() =>
        supabase
          .from('pool_sessions')
          .update({ tab_id: tabId })
          .eq('id', sessionId)
          .is('stopped_at', null)
      );
      if (!res.ok) {
        logger.error('pool_sessions.link_tab_failed', { sessionId, message: res.error.message });
      }
      return res.ok ? ok(undefined) : res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: poolTableKeys.all });
      void queryClient.invalidateQueries({ queryKey: tabKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['pool-sessions'] });
    },
  });
}

export function useMutationReleasePoolTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tableId }: { tableId: string }): Promise<Result<void>> => {
      const res = await supabaseMutation(() =>
        supabase
          .from('pool_tables')
          .update({ status: 'available' })
          .eq('id', tableId)
          .eq('status', 'reserved')
      );
      if (!res.ok) {
        logger.error('pool_tables.release_failed', { tableId, message: res.error.message });
      }
      return res.ok ? ok(undefined) : res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: poolTableKeys.all });
    },
  });
}

export function useMutationAddPoolTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      number: number;
      label: string;
      ratePerHour: number;
      tableType?: PoolTableType;
    }): Promise<Result<PoolTable>> => {
      const insert: TablesInsert<'pool_tables'> = {
        number: input.number,
        label: input.label,
        rate_per_hour: input.ratePerHour,
        status: 'available',
        table_type: input.tableType ?? 'pool',
      };
      const res = await supabaseMutation<Tables<'pool_tables'>>(() =>
        supabase.from('pool_tables').insert(insert).select().single()
      );
      if (!res.ok) {
        logger.error('pool_tables.insert_failed', { message: res.error.message });
        return res;
      }
      if (res.data === null) {
        return err(unknownError('no_row'));
      }
      const row: PoolTableRow = { ...res.data, current_session: null };
      return mapPoolTableRow(row);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: poolTableKeys.all });
    },
  });
}

export function useMutationUpdatePoolTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tableId,
      label,
      ratePerHour,
      tableType,
    }: {
      tableId: string;
      label: string;
      ratePerHour: number;
      tableType?: PoolTableType;
    }): Promise<Result<void>> => {
      const updatePayload: TablesUpdate<'pool_tables'> = {
        label,
        rate_per_hour: ratePerHour,
        ...(tableType !== undefined ? { table_type: tableType } : {}),
      };
      const res = await supabaseMutation(() =>
        supabase.from('pool_tables').update(updatePayload).eq('id', tableId)
      );
      if (!res.ok) {
        logger.error('pool_tables.update_failed', { tableId, message: res.error.message });
        return res;
      }
      return ok(undefined);
    },
    onSuccess: result => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: poolTableKeys.all });
      }
    },
  });
}

export function useMutationDeletePoolTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId }: { tableId: string }): Promise<Result<void>> => {
      const res = await supabaseMutation(() =>
        supabase
          .from('pool_tables')
          .delete()
          .eq('id', tableId)
          .eq('status', 'available')
          .is('current_session_id', null)
      );
      if (!res.ok) {
        logger.error('pool_tables.delete_failed', { tableId, message: res.error.message });
        return res;
      }
      return ok(undefined);
    },
    onSuccess: result => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: poolTableKeys.all });
      }
    },
  });
}

export function useMutationUpdateSessionStartTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      startedAt,
    }: {
      sessionId: string;
      startedAt: Date;
    }): Promise<Result<null>> => {
      return supabaseMutation<null>(async () =>
        supabase
          .from('pool_sessions')
          .update({ started_at: startedAt.toISOString() })
          .eq('id', sessionId)
      );
    },
    onSuccess: result => {
      if (result.ok) {
        void qc.invalidateQueries({ queryKey: poolTableKeys.all });
      }
    },
  });
}
