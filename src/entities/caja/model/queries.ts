/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { CajaReport, CajaSession } from '@shared/lib/domain';
import { CajaReportSchema, CajaSessionSchema } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import {
  ok,
  err,
  supabaseQuery,
  supabaseMutation,
  unknownError,
  type AppError,
  type Result,
} from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';
import { useCajaStore } from './store';

const db = supabase as any;

export const cajaKeys = {
  all: ['caja'] as const,
  current: () => [...cajaKeys.all, 'current'] as const,
  list: () => [...cajaKeys.all, 'list'] as const,
  report: (cajaId: string) => [...cajaKeys.all, 'report', cajaId] as const,
};

function mapCajaRow(row: Record<string, unknown>): Result<CajaSession> {
  try {
    return ok(
      CajaSessionSchema.parse({
        id: row.id,
        openedAt: new Date(row.opened_at as string),
        closedAt: row.closed_at ? new Date(row.closed_at as string) : null,
        openedBy: row.opened_by,
        closedBy: row.closed_by ?? null,
        openingCash: row.opening_cash,
        closingCash: row.closing_cash ?? null,
        notes: row.notes ?? null,
        status: row.status,
        openedByName: row.opened_by_name as string | undefined,
        closedByName: row.closed_by_name as string | null | undefined,
      })
    );
  } catch (e) {
    return err(unknownError(e));
  }
}

/** Fetches the currently open caja session; syncs useCajaStore. */
export function useCurrentCaja() {
  const setCaja = useCajaStore(s => s.setCaja);

  const query = useQuery({
    queryKey: cajaKeys.current(),
    queryFn: async (): Promise<Result<CajaSession | null>> => {
      const res = await supabaseQuery(() =>
        db
          .from('caja_sessions')
          .select(
            '*, opened_by_profile:profiles!opened_by(name), closed_by_profile:profiles!closed_by(name)'
          )
          .eq('status', 'open')
          .limit(1)
          .maybeSingle()
      );

      if (!res.ok) {
        logger.error('caja.current.fetch_failed', { message: res.error.message });
        return res as Result<null>;
      }

      if (!res.data) return ok(null);

      // Flatten profile join
      const raw = res.data as Record<string, unknown>;
      const row = {
        ...raw,
        opened_by_name: (raw.opened_by_profile as { name?: string } | null)?.name,
        closed_by_name: (raw.closed_by_profile as { name?: string } | null)?.name ?? null,
      };

      return mapCajaRow(row);
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (query.data?.ok) {
      setCaja(query.data.data);
    }
  }, [query.data, setCaja]);

  const r = query.data;
  return {
    ...query,
    data: r?.ok ? r.data : undefined,
    resultError: r && !r.ok ? r.error : undefined,
  };
}

/** Fetches list of all caja sessions for the reports page date picker. */
export function useCajaList() {
  return useQuery({
    queryKey: cajaKeys.list(),
    queryFn: async (): Promise<Result<CajaSession[]>> => {
      const res = await supabaseQuery(() =>
        db
          .from('caja_sessions')
          .select(
            '*, opened_by_profile:profiles!opened_by(name), closed_by_profile:profiles!closed_by(name)'
          )
          .order('opened_at', { ascending: false })
          .limit(90)
      );

      if (!res.ok) return res;

      const sessions: CajaSession[] = [];
      for (const row of res.data as Record<string, unknown>[]) {
        const flat = {
          ...row,
          opened_by_name: (row.opened_by_profile as { name?: string } | null)?.name,
          closed_by_name: (row.closed_by_profile as { name?: string } | null)?.name ?? null,
        };
        const m = mapCajaRow(flat);
        if (!m.ok) return m;
        sessions.push(m.data);
      }
      return ok(sessions);
    },
    staleTime: 60_000,
  });
}

// ============================================================================
// OPEN CAJA
// ============================================================================

export function useMutationOpenCaja() {
  const queryClient = useQueryClient();
  const setCaja = useCajaStore(s => s.setCaja);

  return useMutation<Result<CajaSession>, Error, { openingCash: number; openedBy: string }>({
    mutationFn: async ({ openingCash, openedBy }) => {
      const res = await supabaseMutation(() =>
        db
          .from('caja_sessions')
          .insert({ opening_cash: openingCash, opened_by: openedBy })
          .select()
          .single()
      );

      if (!res.ok) {
        logger.error('caja.open.failed', { message: res.error.message });
        return res;
      }

      if (res.data == null) return err(unknownError('no_row'));

      return mapCajaRow(res.data as Record<string, unknown>);
    },

    onSuccess: result => {
      if (!result.ok) return;
      setCaja(result.data);
      void queryClient.invalidateQueries({ queryKey: cajaKeys.all });
      logger.info('caja.opened', { cajaId: result.data.id });
    },
  });
}

// ============================================================================
// CLOSE CAJA — hard block enforced in DB via close_caja_session RPC
// ============================================================================

type CloseCajaInput = {
  cajaId: string;
  closedBy: string;
  closingCash: number;
  notes: string | undefined;
};

type CloseCajaRpcResult = {
  ok: boolean;
  error?: { code: string; message: string; openTabCount?: number };
};

export function useMutationCloseCaja() {
  const queryClient = useQueryClient();
  const clearCaja = useCajaStore(s => s.clearCaja);

  return useMutation<Result<undefined>, Error, CloseCajaInput>({
    mutationFn: async ({ cajaId, closedBy, closingCash, notes }) => {
      const { data, error } = await db.rpc('close_caja_session', {
        p_caja_id: cajaId,
        p_closed_by: closedBy,
        p_closing_cash: closingCash,
        p_notes: notes ?? null,
      });

      if (error) {
        logger.error('caja.close.rpc_error', { message: error.message });
        return err(unknownError(error));
      }

      const result = data as CloseCajaRpcResult;
      if (!result.ok) {
        const e = result.error;
        const appErr: AppError = {
          code: (e?.code ?? 'UNKNOWN_ERROR') as AppError['code'],
          message: e?.message ?? 'Failed to close caja.',
        };
        logger.warn('caja.close.blocked', { code: appErr.code });
        return err(appErr);
      }

      return ok(undefined);
    },

    onSuccess: result => {
      if (!result.ok) return;
      clearCaja();
      void queryClient.invalidateQueries({ queryKey: cajaKeys.all });
      logger.info('caja.closed');
    },
  });
}

// ============================================================================
// CAJA REPORT
// ============================================================================

export function useCajaReport(cajaId: string | null) {
  return useQuery({
    queryKey: cajaId ? cajaKeys.report(cajaId) : ['caja', 'report', '__none__'],
    enabled: cajaId !== null,
    queryFn: async (): Promise<Result<CajaReport>> => {
      if (!cajaId) return err(unknownError('No caja selected.'));

      const { data, error } = await db.rpc('get_caja_report', {
        p_caja_id: cajaId,
      });

      if (error) {
        logger.error('caja.report.rpc_error', { message: error.message });
        return err(unknownError(error));
      }

      try {
        return ok(CajaReportSchema.parse(data));
      } catch (e) {
        return err(unknownError(e));
      }
    },
    staleTime: 60_000,
  });
}
