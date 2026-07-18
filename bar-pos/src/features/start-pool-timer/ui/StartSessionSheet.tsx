import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useMutationStartSession } from '@entities/pool-table/model/queries';
import { useSettings } from '@entities/settings';
import { useStaffStore } from '@entities/staff/model/store';
import type { Tab } from '@entities/tab';
import { useMutationOpenTab } from '@entities/tab/model/queries';
import { buildStartTicketText } from '@shared/lib/buildStartTicketText';
import type { PoolTable } from '@shared/lib/domain';
import { logger } from '@shared/lib/logger-instance';
import { printRawText } from '@shared/lib/pos-printer';
import {
  MoneyDisplay,
  POSButton,
  ProtectedAction,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@shared/ui';
import { Label } from '@shared/ui/label';

const NEW_TAB = '__new_tab__';

export interface StartSessionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: PoolTable | null;
  openTabs: Tab[];
}

export function StartSessionSheet({ open, onOpenChange, table, openTabs }: StartSessionSheetProps) {
  const { t } = useTranslation('featOrders');
  const startSession = useMutationStartSession();
  const currentRole = useStaffStore(s => s.currentStaff?.role);
  const openTab = useMutationOpenTab();
  const currentStaff = useStaffStore(s => s.currentStaff);
  const currentShift = useStaffStore(s => s.currentShift);
  const settings = useSettings();
  const [tabChoice, setTabChoice] = useState<string>(NEW_TAB);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTabChoice(NEW_TAB);
    }
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!table) return;
    if (table.status !== 'available') {
      toast.error(t('startPoolTimer.tableUnavailable'));
      return;
    }

    let resolvedTabId: string | null;

    if (tabChoice === NEW_TAB) {
      if (!currentStaff || !currentShift) {
        toast.error(t('startPoolTimer.noActiveStaffOrShift'));
        return;
      }
      const tabName = `Pool ${table.label.trim() || t('startPoolTimer.tableFallbackName', { number: table.number })}`;
      const createResult = await openTab.mutateAsync({
        customerName: tabName,
        tableNumber: null,
        staffId: currentStaff.id,
        shiftId: currentShift.id,
        status: 'open',
        notes: null,
        items: [],
      });
      if (!createResult.ok) {
        toast.error(createResult.error.message);
        return;
      }
      resolvedTabId = createResult.data.id;
    } else {
      resolvedTabId = tabChoice;
    }

    const result = await startSession.mutateAsync({ tableId: table.id, tabId: resolvedTabId });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(t('startPoolTimer.sessionStarted'));

    if (settings.data?.receipt.printOnStart) {
      const text = buildStartTicketText({
        barName: settings.data.general.barName,
        tableLabel: table.label,
        startedAt: result.data.startedAt,
        ratePerHour: table.ratePerHour,
        paperWidthChars: settings.data.receipt.paperWidthChars,
      });
      void printRawText(text, { autoCut: settings.data.receipt.autoCut }).catch((e: unknown) => {
        logger.warn('start_ticket.print.failed', { error: String(e) });
      });
    }

    handleOpenChange(false);
  };

  const isBusy = openTab.isPending || startSession.isPending;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
        <SheetHeader>
          <SheetTitle>{t('startPoolTimer.title')}</SheetTitle>
          <SheetDescription>
            {table
              ? `Table ${String(table.number)} · ${table.label}`
              : t('startPoolTimer.selectTableHint')}
          </SheetDescription>
        </SheetHeader>

        {table && (
          <div className="space-y-6 py-4">
            <div>
              <p className="text-muted-foreground mb-1 text-sm">{t('startPoolTimer.ratePerHour')}</p>
              <MoneyDisplay amount={table.ratePerHour} size="xl" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pool-start-tab">{t('startPoolTimer.linkToOpenTab')}</Label>
              <select
                id="pool-start-tab"
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                value={tabChoice}
                onChange={e => {
                  setTabChoice(e.target.value);
                }}
              >
                <option value={NEW_TAB}>{t('startPoolTimer.newTabAutoCreate')}</option>
                {openTabs.map(tab => (
                  <option key={tab.id} value={tab.id}>
                    {tab.customerName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <ProtectedAction
            action="start_pool_timer"
            currentRole={currentRole}
            disabled={!table || isBusy}
          >
            <POSButton
              type="button"
              touchSize="large"
              className="w-full"
              disabled={!table || isBusy}
              onClick={() => {
                void handleConfirm();
              }}
            >
              {isBusy ? t('startPoolTimer.starting') : t('startPoolTimer.startSession')}
            </POSButton>
          </ProtectedAction>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
