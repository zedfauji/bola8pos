/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useMutationAddResource } from '@entities/resource';
import { waitlistKeys } from '@entities/waitlist';
import i18n from '@shared/lib/i18n';
import { logger } from '@shared/lib/logger-instance';
import { err, ok, type Result } from '@shared/lib/result';
import { supabase } from '@shared/lib/supabase';

type SeatPartyInput = {
  entryId: string;
  entryName: string;
  tableId: string;
  tableName: string;
};

// Fixed rate fallback carried forward verbatim from PoolTablesSettingsTab's
// handleAddTable (D-06 — no separate/reduced rate tier for floating tables).
const DEFAULT_RATE_PER_HOUR = 12;

type SeatAtNewTableInput = {
  entryId: string;
  entryName: string;
  /** Visible resources, used only to derive the next number/rate (D-03/D-06) — same rule as handleAddTable. */
  tables: { number: number; ratePerHour: number }[];
};

const db = supabase as any;

export function useSeatWaitlistParty() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: SeatPartyInput): Promise<Result<void>> => {
      /* eslint-disable i18next/no-literal-string -- Supabase query-builder chain:
         table/column names + status enum value, not UI copy */
      const { error } = await db
        .from('waitlist_entries')
        .update({
          status: 'seated',
          table_id: input.tableId,
          seated_at: new Date().toISOString(),
        })
        .eq('id', input.entryId);
      /* eslint-enable i18next/no-literal-string */

      if (error) {
        logger.error('waitlist.seat.failed', { entryId: input.entryId, error });
        return err({ code: 'SUPABASE_ERROR', message: (error as { message: string }).message });
      }
      logger.info('waitlist.seat.succeeded', { entryId: input.entryId, tableId: input.tableId });
      return ok(undefined);
    },
    onSuccess: (result, input) => {
      if (!result.ok) {
        toast.error(i18n.t('featMgmt:seatWaitlistParty.errorToast'));
        return;
      }
      toast.success(
        i18n.t('featMgmt:seatWaitlistParty.successToast', {
          name: input.entryName,
          table: input.tableName,
        })
      );
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: waitlistKeys.waitingCount() });
    },
  });

  return { seatParty: mutation.mutateAsync, isPending: mutation.isPending };
}

/**
 * Composes resource creation (floating type, temp flag) with the existing
 * `seatParty` mutation above — no separate waitlist-table update of its own.
 * Numbering/rate rules are read verbatim from `PoolTablesSettingsTab`'s
 * `handleAddTable` (D-03/D-06): reserved ranges and rate tiers are explicitly
 * rejected, so a create failure surfaces as a plain error Result rather than
 * retrying with a probed number.
 */
export function useSeatAtNewTable() {
  const addResource = useMutationAddResource();
  const { seatParty } = useSeatWaitlistParty();

  const mutation = useMutation({
    mutationFn: async (input: SeatAtNewTableInput): Promise<Result<void>> => {
      const nextNumber = Math.max(0, ...input.tables.map(table => table.number)) + 1;
      const ratePerHour =
        input.tables[input.tables.length - 1]?.ratePerHour ?? DEFAULT_RATE_PER_HOUR;

      const createResult = await addResource.mutateAsync({
        number: nextNumber,
        label: `Table ${String(nextNumber)}`,
        ratePerHour,
        tableType: 'floating',
        isTemp: true,
      });

      if (!createResult.ok) {
        logger.error('waitlist.seat_at_new_table.create_failed', {
          entryId: input.entryId,
          error: createResult.error,
        });
        toast.error(i18n.t('featMgmt:seatWaitlistParty.errorToast'));
        return createResult;
      }

      const table = createResult.data;
      return seatParty({
        entryId: input.entryId,
        entryName: input.entryName,
        tableId: table.id,
        tableName: i18n.t('featMgmt:seatWaitlistParty.tableLabel', {
          number: table.number,
          label: table.label,
        }),
      });
    },
  });

  return { seatAtNewTable: mutation.mutateAsync, isPending: mutation.isPending };
}
