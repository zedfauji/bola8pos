import { useMutation, useQueryClient } from '@tanstack/react-query';
import { poolTableKeys } from '@entities/pool-table/model/queries';
import { tabKeys } from '@entities/tab/model/queries';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, unknownError, type AppError, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

export type TransferPoolSessionInput = {
  /** Current pool session being moved */
  sessionId: string;
  /** The pool table the session is currently on (used to record previous_table_id) */
  currentTableId: string;
  /** Target pool table UUID */
  targetTableId: string;
  transferredBy: string;
};

type TransferPoolRpcResult = {
  ok: boolean;
  error?: { code: string; message: string };
};

/**
 * Moves an active pool session to a different pool table.
 * started_at is preserved — billing time does not reset.
 */
export function useTransferPoolSession() {
  const queryClient = useQueryClient();

  return useMutation<Result<void>, Error, TransferPoolSessionInput>({
    mutationFn: async ({ sessionId, currentTableId, targetTableId, transferredBy }) => {
      const { data, error } = await supabase.rpc('transfer_pool_session', {
        p_session_id: sessionId,
        p_to_pool_table_id: targetTableId,
        p_transferred_by: transferredBy,
      });

      if (error) {
        logger.error('transfer_pool_session.rpc_error', { message: error.message });
        return err(unknownError(error));
      }

      const result = data as TransferPoolRpcResult;
      if (!result.ok) {
        const e = result.error;
        const appErr: AppError = {
          code: (e?.code ?? 'UNKNOWN_ERROR') as AppError['code'],
          message: e?.message ?? 'Pool transfer failed.',
        };
        logger.warn('transfer_pool_session.blocked', { code: appErr.code });
        return err(appErr);
      }

      // Record which table this session came from so the status page can show transfer history.
      // pool_sessions has a bump_version_on_update trigger (Phase 15) that rejects any
      // UPDATE not explicitly advancing `version` by 1 — fetch the current version first
      // (transfer_pool_session already bumped it server-side, so re-read post-RPC).
      const { data: versionRow, error: versionFetchError } = await supabase
        .from('pool_sessions')
        .select('version')
        .eq('id', sessionId)
        .single();

      if (versionFetchError) {
        logger.warn('transfer_pool_session.stamp_previous_table_error', {
          message: versionFetchError.message,
        });
      } else {
        const { error: stampError } = await supabase
          .from('pool_sessions')
          .update({ previous_table_id: currentTableId, version: versionRow.version + 1 })
          .eq('id', sessionId)
          .eq('version', versionRow.version);

        if (stampError) {
          // Non-fatal — the transfer already succeeded; log and continue.
          logger.warn('transfer_pool_session.stamp_previous_table_error', {
            message: stampError.message,
          });
        }
      }

      return ok(undefined);
    },

    onSuccess: async result => {
      if (!result.ok) return;
      await queryClient.invalidateQueries({ queryKey: poolTableKeys.all });
      await queryClient.invalidateQueries({ queryKey: tabKeys.lists() });
      logger.info('pool_session.transferred');
    },
  });
}
