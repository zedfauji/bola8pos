/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tabKeys } from '@entities/tab/model/queries';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, unknownError, type AppError, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const TERMINAL_ID = (import.meta.env.VITE_TERMINAL_ID as string | undefined) ?? 'POS-1';

export type TransferTabInput = {
  tabId: string;
  /** New staff to own the tab (undefined = keep current owner) */
  newStaffId: string | undefined;
  /** New table number (undefined = keep current table) */
  newTableNumber: string | undefined;
  transferredBy: string;
};

type TransferTabRpcResult = {
  ok: boolean;
  error?: { code: string; message: string };
};

export function useTransferTab() {
  const queryClient = useQueryClient();

  return useMutation<Result<void>, Error, TransferTabInput>({
    mutationFn: async ({ tabId, newStaffId, newTableNumber, transferredBy }) => {
      const parsedTable = newTableNumber != null ? parseInt(newTableNumber, 10) : null;
      const { data, error } = await db.rpc('transfer_tab', {
        p_tab_id: tabId,
        p_to_staff_id: newStaffId ?? null,
        p_to_table: Number.isNaN(parsedTable ?? NaN) ? null : parsedTable,
        p_transferred_by: transferredBy,
        p_terminal_id: TERMINAL_ID,
      });

      if (error) {
        logger.error('transfer_tab.rpc_error', { message: error.message });
        return err(unknownError(error));
      }

      const result = data as TransferTabRpcResult;
      if (!result.ok) {
        const e = result.error;
        const appErr: AppError = {
          code: (e?.code ?? 'UNKNOWN_ERROR') as AppError['code'],
          message: e?.message ?? 'Transfer failed.',
        };
        logger.warn('transfer_tab.blocked', { code: appErr.code });
        return err(appErr);
      }

      return ok(undefined);
    },

    onSuccess: async (result, { tabId }) => {
      if (!result.ok) return;
      await queryClient.invalidateQueries({ queryKey: tabKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: tabKeys.detail(tabId) });
      logger.info('tab.transferred', { tabId });
    },
  });
}
