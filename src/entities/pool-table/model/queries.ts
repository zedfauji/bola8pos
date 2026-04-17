import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { tabKeys } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import type { PoolSession, PoolTable } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { computePoolSessionBilling } from '@shared/lib/pool-billing';
import {
  err,
  ok,
  supabaseMutation,
  supabaseQuery,
  unknownError,
  type Result,
} from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import type { Tables, TablesInsert } from '@shared/lib/supabase.types';
import { usePoolTableStore } from './store';
import { PoolTableSchema, PoolSessionSchema } from './types';

export const poolTableKeys = {
  all: ['pool-tables'] as const,
  detail: (id: string) => [...poolTableKeys.all, 'detail', id] as const,
};

type PoolTableRow = Tables<'pool_tables'> & {
  current_session: Tables<'pool_sessions'> | null;
};

function mapPoolSessionRow(row: Tables<'pool_sessions'>): Result<PoolSession> {
  try {
    return ok(
      PoolSessionSchema.omit({ table: true }).parse({
        id: row.id,
        tableId: row.table_id,
        tabId: row.tab_id,
        startedAt: new Date(row.started_at),
        stoppedAt: row.stopped_at ? new Date(row.stopped_at) : null,
        billedMinutes: row.billed_minutes,
        totalCharge: row.total_charge,
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
          current_session:pool_sessions!fk_pool_tables_current_session(*)
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
          current_session:pool_sessions!fk_pool_tables_current_session(*)
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
          useTabStore.getState().enqueueOfflineAction({
            type: 'start-pool-timer',
            payload: variables,
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
      const { billedMinutes, totalCharge } = computePoolSessionBilling({
        startedAt,
        endTime: stoppedAt,
        ratePerHour,
      });

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

      const updatedSession = sessionRes.data;

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
          useTabStore.getState().enqueueOfflineAction({
            type: 'stop-pool-timer',
            payload: variables,
          });
          // Keep the optimistic 'available' status; sync will confirm it.
          return;
        }
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
    }): Promise<Result<PoolTable>> => {
      const insert: TablesInsert<'pool_tables'> = {
        number: input.number,
        label: input.label,
        rate_per_hour: input.ratePerHour,
        status: 'available',
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
    }: {
      tableId: string;
      label: string;
      ratePerHour: number;
    }): Promise<Result<void>> => {
      const res = await supabaseMutation(() =>
        supabase
          .from('pool_tables')
          .update({
            label,
            rate_per_hour: ratePerHour,
          })
          .eq('id', tableId)
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
