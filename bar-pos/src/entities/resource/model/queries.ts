import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { tabKeys } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import type { PoolSession, Resource, ResourceType } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import {
  err,
  ok,
  supabaseMutation,
  supabaseQuery,
  unknownError,
  type Result,
} from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
/* eslint-disable i18next/no-literal-string -- query-key namespace strings +
   multi-line Supabase chain args below are wire-protocol identifiers, not UI
   copy (plugin doesn't resolve excluded callees across a multi-line method
   chain — 21-08 quirk); unknownError(...) codes below are internal debug
   metadata, not the user-visible AppError.message. */
import type { Json } from '@shared/lib/supabase.types';
import type { Tables, TablesInsert, TablesUpdate } from '@shared/lib/supabase.types';
import { handleVersionError } from '@shared/lib/version-error';
import { useResourceStore } from './store';
import { ResourceSchema, PoolSessionSchema } from './types';

export const resourceKeys = {
  all: ['resources'] as const,
  detail: (id: string) => [...resourceKeys.all, 'detail', id] as const,
};

type PoolSessionRowWithPrevious = Tables<'pool_sessions'> & {
  previous_table: { number: number } | null;
};

type ResourceRow = Tables<'resources'> & {
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

function mapResourceRow(row: ResourceRow): Result<Resource> {
  try {
    const currentSession =
      row.current_session != null ? mapPoolSessionRow(row.current_session) : null;
    if (currentSession && !currentSession.ok) return currentSession;

    return ok(
      ResourceSchema.parse({
        id: row.id,
        number: row.number,
        label: row.label,
        ratePerHour: row.rate_per_hour,
        status: row.status,
        tableType: row.table_type,
        isTemp: row.is_temp,
        currentSessionId: row.current_session_id,
        currentSession: currentSession?.ok ? currentSession.data : undefined,
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

export function useResources() {
  const query = useQuery({
    queryKey: resourceKeys.all,
    queryFn: async (): Promise<Result<Resource[]>> => {
      const res = await supabaseQuery(() =>
        supabase
          .from('resources')
          .select(
            `
          *,
          current_session:pool_sessions!fk_resources_current_session(
            *,
            previous_table:resources!pool_sessions_previous_table_id_fkey(number)
          )
        `
          )
          .order('number')
      );

      if (!res.ok) {
        logger.error('resources.fetch_failed', {
          code: res.error.code,
          message: res.error.message,
        });
        return res;
      }

      const tables: Resource[] = [];
      for (const row of res.data as ResourceRow[]) {
        const m = mapResourceRow(row);
        if (!m.ok) {
          logger.error('resources.map_failed', { message: m.error.message });
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
      useResourceStore.getState().setTablesFromQuery(tables);
      const sessions = tables
        .map(t => t.currentSession)
        .filter((s): s is PoolSession => Boolean(s && s.stoppedAt == null));
      useResourceStore.getState().setSessionsFromQuery(sessions);
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

export function useResource(id: string) {
  const query = useQuery({
    queryKey: resourceKeys.detail(id),
    enabled: Boolean(id),
    queryFn: async (): Promise<Result<Resource>> => {
      const res = await supabaseQuery(() =>
        supabase
          .from('resources')
          .select(
            `
          *,
          current_session:pool_sessions!fk_resources_current_session(
            *,
            previous_table:resources!pool_sessions_previous_table_id_fkey(number)
          )
        `
          )
          .eq('id', id)
          .single()
      );

      if (!res.ok) {
        logger.error('resources.detail.fetch_failed', {
          tableId: id,
          code: res.error.code,
          message: res.error.message,
        });
        return res;
      }

      return mapResourceRow(res.data as unknown as ResourceRow);
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

type ResourcesSnapshot = Result<Resource[]> | undefined;

// Shape of the jsonb payload returned by the `stop_pool_session` RPC
// (supabase/migrations/20260710000006_stop_pool_session_rpc.sql, step 8).
type StopPoolSessionRpcResult = {
  id: string;
  stopped_at: string | null;
  billed_minutes: number | null;
  total_charge: number | null;
  version: number;
  tab_id: string | null;
  table_id: string;
};

function mapStopPoolSessionRpcPayload(data: Json | null): Result<StopPoolSessionRpcResult> {
  try {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return err(unknownError('invalid_rpc_payload'));
    }
    return ok(data as unknown as StopPoolSessionRpcResult);
  } catch (e) {
    return err(unknownError(e));
  }
}

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
        logger.error('resources.session.start_insert_failed', {
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
          .from('resources')
          .update({
            status: 'occupied',
            current_session_id: insertedSession.id,
          })
          .eq('id', tableId)
      );

      if (!tableRes.ok) {
        logger.error('resources.session.start_table_update_failed', {
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
      await queryClient.cancelQueries({ queryKey: resourceKeys.all });
      const previous = queryClient.getQueryData<Result<Resource[]>>(resourceKeys.all);
      useResourceStore.getState().updateTableStatus(tableId, 'occupied');
      queryClient.setQueryData<Result<Resource[]>>(resourceKeys.all, old => {
        if (!old?.ok) return old;
        return ok(
          old.data.map(t =>
            t.id === tableId
              ? { ...t, status: 'occupied' as const, currentSessionId: t.currentSessionId }
              : t
          )
        );
      });
      return { previous } as { previous: ResourcesSnapshot };
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
        const prev = (ctx as { previous?: ResourcesSnapshot } | undefined)?.previous;
        if (prev !== undefined) {
          queryClient.setQueryData(resourceKeys.all, prev);
          if (prev.ok) useResourceStore.getState().setTablesFromQuery(prev.data);
        }
        useResourceStore.getState().updateTableStatus(variables.tableId, 'available');
        return;
      }
      void queryClient.invalidateQueries({ queryKey: resourceKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['pool-sessions'] });
      void queryClient.invalidateQueries({ queryKey: ['tabs'] });
    },

    onError: (_e, variables, ctx) => {
      const prev = (ctx as { previous?: ResourcesSnapshot } | undefined)?.previous;
      if (prev !== undefined) {
        queryClient.setQueryData(resourceKeys.all, prev);
        if (prev.ok) useResourceStore.getState().setTablesFromQuery(prev.data);
      }
      useResourceStore.getState().updateTableStatus(variables.tableId, 'available');
    },
  });
}

export function useMutationStopSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      tableId: string;
      // No longer used for the authoritative write (Pitfall 3 — stop_pool_session
      // reads rate_per_hour server-side); kept in the input shape so
      // StopSessionConfirm's pre-confirm billing preview is unaffected.
      ratePerHour: number;
    }): Promise<Result<PoolSession>> => {
      const { sessionId, tableId } = input;
      const fetchRes = await supabaseQuery<Tables<'pool_sessions'>>(() =>
        supabase.from('pool_sessions').select('*').eq('id', sessionId).single()
      );

      if (!fetchRes.ok) {
        logger.error('resources.session.stop_fetch_failed', { message: fetchRes.error.message });
        return fetchRes;
      }

      const session = fetchRes.data;

      // Phase 15 Group A: pass p_expected_version when the cached row carries
      // a version. The server-side RPC raises P0V01 (STALE_VERSION) on
      // mismatch; supabaseQuery -> parseSupabaseError maps that automatically.
      const cachedVersion =
        typeof (session as { version?: number }).version === 'number'
          ? (session as { version?: number }).version
          : undefined;

      // total_charge/billed_minutes are now server-authoritative (Pitfall 3):
      // stop_pool_session reads rate_per_hour from resources and
      // firstHourMode from settings server-side, consumes unconsumed
      // pool_grant minutes, and compounds pool_billing discounts atomically.
      // The client no longer computes or writes the charge itself.
      const rpcRes = await supabaseQuery(() =>
        supabase.rpc('stop_pool_session', {
          p_session_id: sessionId,
          ...(cachedVersion !== undefined ? { p_expected_version: cachedVersion } : {}),
        })
      );

      if (!rpcRes.ok) {
        logger.error('resources.session.stop_rpc_failed', {
          code: rpcRes.error.code,
          message: rpcRes.error.message,
        });
        return rpcRes;
      }

      const rpcMapped = mapStopPoolSessionRpcPayload(rpcRes.data);
      if (!rpcMapped.ok) return rpcMapped;
      const rpcResult = rpcMapped.data;

      const tableRes = await supabaseMutation(() =>
        supabase
          .from('resources')
          .update({
            status: 'available',
            current_session_id: null,
          })
          .eq('id', tableId)
      );

      if (!tableRes.ok) {
        logger.error('resources.session.stop_table_failed', { message: tableRes.error.message });
        return tableRes;
      }

      const mapped = mapPoolSessionRow({
        ...session,
        stopped_at: rpcResult.stopped_at,
        billed_minutes: rpcResult.billed_minutes,
        total_charge: rpcResult.total_charge,
        version: rpcResult.version,
        tab_id: rpcResult.tab_id,
        table_id: rpcResult.table_id,
      });
      if (!mapped.ok) return mapped;
      return ok(mapped.data);
    },

    onMutate: async ({ tableId }) => {
      await queryClient.cancelQueries({ queryKey: resourceKeys.all });
      const previous = queryClient.getQueryData<Result<Resource[]>>(resourceKeys.all);
      useResourceStore.getState().updateTableStatus(tableId, 'available');
      queryClient.setQueryData<Result<Resource[]>>(resourceKeys.all, old => {
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
      return { previous } as { previous: ResourcesSnapshot };
    },

    onSuccess: (result, variables, ctx) => {
      if (!result.ok) {
        if (result.error.code === 'NETWORK_OFFLINE') {
          // Phase 15 Plan 04: capture cached pool_session.version at enqueue
          // time. Look up the session via the resources list cache (each
          // table embeds its current session including version).
          {
            const tablesCache = queryClient.getQueryData<Result<Resource[]>>(resourceKeys.all);
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
          queryKey: resourceKeys.all,
          entity: 'pool_sessions',
          entityId: variables.sessionId,
          expectedVersion: 0,
          supabase,
          terminalId: TERMINAL_ID,
        });
        const prev = (ctx as { previous?: ResourcesSnapshot } | undefined)?.previous;
        if (prev !== undefined) {
          queryClient.setQueryData(resourceKeys.all, prev);
          if (prev.ok) useResourceStore.getState().setTablesFromQuery(prev.data);
        }
        useResourceStore.getState().updateTableStatus(variables.tableId, 'occupied');
        return;
      }
      void queryClient.invalidateQueries({ queryKey: resourceKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['pool-sessions'] });
      void queryClient.invalidateQueries({ queryKey: ['tabs'] });
    },

    onError: (_e, variables, ctx) => {
      const prev = (ctx as { previous?: ResourcesSnapshot } | undefined)?.previous;
      if (prev !== undefined) {
        queryClient.setQueryData(resourceKeys.all, prev);
        if (prev.ok) useResourceStore.getState().setTablesFromQuery(prev.data);
      }
      useResourceStore.getState().updateTableStatus(variables.tableId, 'occupied');
    },
  });
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
      // pool_sessions has a bump_version_on_update trigger (Phase 15) that rejects
      // any UPDATE not explicitly advancing `version` by 1 — fetch it first.
      const versionRes = await supabaseQuery<Pick<Tables<'pool_sessions'>, 'version'>>(() =>
        supabase.from('pool_sessions').select('version').eq('id', sessionId).single()
      );
      if (!versionRes.ok) {
        logger.error('pool_sessions.link_tab_version_fetch_failed', {
          sessionId,
          message: versionRes.error.message,
        });
        return versionRes;
      }

      const res = await supabaseMutation(() =>
        supabase
          .from('pool_sessions')
          .update({ tab_id: tabId, version: versionRes.data.version + 1 })
          .eq('id', sessionId)
          .eq('version', versionRes.data.version)
          .is('stopped_at', null)
      );
      if (!res.ok) {
        logger.error('pool_sessions.link_tab_failed', { sessionId, message: res.error.message });
      }
      return res.ok ? ok(undefined) : res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: resourceKeys.all });
      void queryClient.invalidateQueries({ queryKey: tabKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['pool-sessions'] });
    },
  });
}

export function useMutationReleaseResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tableId }: { tableId: string }): Promise<Result<void>> => {
      const res = await supabaseMutation(() =>
        supabase
          .from('resources')
          .update({ status: 'available' })
          .eq('id', tableId)
          .eq('status', 'reserved')
      );
      if (!res.ok) {
        logger.error('resources.release_failed', { tableId, message: res.error.message });
      }
      return res.ok ? ok(undefined) : res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: resourceKeys.all });
    },
  });
}

export function useMutationAddResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      number: number;
      label: string;
      ratePerHour: number;
      tableType?: ResourceType;
      isTemp: boolean | undefined;
    }): Promise<Result<Resource>> => {
      const insert: TablesInsert<'resources'> = {
        number: input.number,
        label: input.label,
        rate_per_hour: input.ratePerHour,
        status: 'available',
        table_type: input.tableType ?? 'pool',
        is_temp: input.isTemp ?? false,
      };
      const res = await supabaseMutation<Tables<'resources'>>(() =>
        supabase.from('resources').insert(insert).select().single()
      );
      if (!res.ok) {
        logger.error('resources.insert_failed', { message: res.error.message });
        return res;
      }
      if (res.data === null) {
        return err(unknownError('no_row'));
      }
      const row: ResourceRow = { ...res.data, current_session: null };
      return mapResourceRow(row);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: resourceKeys.all });
    },
  });
}

export function useMutationUpdateResource() {
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
      tableType?: ResourceType;
    }): Promise<Result<void>> => {
      const updatePayload: TablesUpdate<'resources'> = {
        label,
        rate_per_hour: ratePerHour,
        ...(tableType !== undefined ? { table_type: tableType } : {}),
      };
      const res = await supabaseMutation(() =>
        supabase.from('resources').update(updatePayload).eq('id', tableId)
      );
      if (!res.ok) {
        logger.error('resources.update_failed', { tableId, message: res.error.message });
        return res;
      }
      return ok(undefined);
    },
    onSuccess: result => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: resourceKeys.all });
      }
    },
  });
}

export function useMutationDeleteResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId }: { tableId: string }): Promise<Result<void>> => {
      const res = await supabaseMutation(() =>
        supabase
          .from('resources')
          .delete()
          .eq('id', tableId)
          .eq('status', 'available')
          .is('current_session_id', null)
      );
      if (!res.ok) {
        logger.error('resources.delete_failed', { tableId, message: res.error.message });
        return res;
      }
      return ok(undefined);
    },
    onSuccess: result => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: resourceKeys.all });
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
      // pool_sessions has a bump_version_on_update trigger (Phase 15) that
      // rejects any UPDATE not explicitly advancing `version` by 1 — fetch
      // the current version first, same pattern as useMutationStopSession.
      const versionRes = await supabaseQuery<Pick<Tables<'pool_sessions'>, 'version'>>(() =>
        supabase.from('pool_sessions').select('version').eq('id', sessionId).single()
      );
      if (!versionRes.ok) return versionRes;

      return supabaseMutation<null>(async () =>
        supabase
          .from('pool_sessions')
          .update({
            started_at: startedAt.toISOString(),
            version: versionRes.data.version + 1,
          })
          .eq('id', sessionId)
          .eq('version', versionRes.data.version)
      );
    },
    onSuccess: result => {
      if (result.ok) {
        void qc.invalidateQueries({ queryKey: resourceKeys.all });
      }
    },
  });
}
