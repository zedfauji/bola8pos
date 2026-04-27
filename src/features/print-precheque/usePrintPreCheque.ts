import { useMutation } from '@tanstack/react-query';
import { useSettings } from '@entities/settings';
import { useStaffStore } from '@entities/staff/model/store';
import type { Tab, PoolSession, PoolTable } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { computePoolSessionBilling } from '@shared/lib/pool-billing';
import { printRawText } from '@shared/lib/pos-printer';
import { buildPreChequeText } from '@shared/lib/receipt-format';
import { ok, err, type Result } from '@shared/lib/result';

export type PrintPreChequeInput = {
  tab: Tab;
  session: PoolSession;
  table: PoolTable;
};

/**
 * Mutation hook that builds a pre-cheque receipt text from the current tab,
 * pool session, and table, then sends it to the thermal printer.
 *
 * happyHourActive is always false for now.
 * TODO: compute happyHourActive once an isHappyHourActive(categories, now) helper exists at the tab level.
 */
export function usePrintPreCheque() {
  const { data: settings } = useSettings();
  const currentStaff = useStaffStore(s => s.currentStaff);

  return useMutation({
    mutationFn: async ({ tab, session, table }: PrintPreChequeInput): Promise<Result<void>> => {
      const barName = settings?.general.barName ?? 'Bar';
      const cashierName = currentStaff?.name ?? tab.staff?.name ?? 'Staff';

      // When kdsEnabled, food items are handled by the kitchen display and excluded from the pre-cheque.
      const kdsEnabled = settings?.receipt.kdsEnabled ?? false;

      // Flatten non-voided order items into pre-cheque line items
      const items = tab.orders
        .filter(o => o.status !== 'voided')
        .flatMap(o =>
          o.items
            .filter(item => !kdsEnabled || item.product?.category?.isFood !== true)
            .map(item => ({
              name: item.product?.name ?? 'Item',
              quantity: item.quantity,
              lineTotal: item.lineTotal ?? item.quantity * item.unitPrice,
              orderedAt: o.createdAt,
              modifierNames: item.modifiers.map(m => m.name),
              notes: item.notes,
            }))
        );

      // Compute pool charge: use stored billedMinutes if session is stopped,
      // otherwise compute a live preview using current time.
      let poolCharge: {
        tableLabel: string;
        billedMinutes: number;
        ratePerHour: number;
        amount: number;
      } | null = null;

      if (session.billedMinutes !== null && session.totalCharge !== null) {
        // Session already stopped — use recorded values
        poolCharge = {
          tableLabel: table.label,
          billedMinutes: session.billedMinutes,
          ratePerHour: table.ratePerHour,
          amount: session.totalCharge,
        };
      } else if (session.stoppedAt === null) {
        // Session still running — compute live preview
        const billing = computePoolSessionBilling({
          startedAt: session.startedAt,
          endTime: new Date(),
          ratePerHour: table.ratePerHour,
        });
        poolCharge = {
          tableLabel: table.label,
          billedMinutes: billing.billedMinutes,
          ratePerHour: table.ratePerHour,
          amount: billing.totalCharge,
        };
      }

      // Compute subtotal: sum of item line totals + pool charge amount
      const itemsTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const poolTotal = poolCharge?.amount ?? 0;
      const subtotal = Math.round((itemsTotal + poolTotal) * 100) / 100;

      const text = buildPreChequeText({
        barName,
        tableLabel: table.label,
        customerName: tab.customerName,
        cashierName,
        // TODO: compute happyHourActive once an isHappyHourActive helper is wired to tab categories
        happyHourActive: false,
        items,
        poolCharge,
        subtotal,
        generatedAt: new Date(),
      });

      logger.info('precheque.print.start', { tabId: tab.id, tableId: table.id });

      const result = await printRawText(text, { autoCut: settings?.receipt.autoCut });

      if (!result.ok) {
        logger.warn('precheque.print.failed', { tabId: tab.id, error: result.error.message });
        return err(result.error);
      }

      logger.info('precheque.print.success', { tabId: tab.id });
      return ok(undefined);
    },
  });
}
