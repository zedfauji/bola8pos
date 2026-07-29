import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useMutationStopSession } from '@entities/resource/model/queries';
import { useSettings } from '@entities/settings';
import { usePermissions } from '@entities/staff/model/usePermissions';
import type { Tab } from '@entities/tab';
import { useTabStore } from '@entities/tab/model/store';
import type { PoolSession, Resource } from '@shared/lib/domain';
import { computePoolSessionBilling } from '@shared/lib/pool-billing';
import { ConfirmDialog, MoneyDisplay, TimerDisplay } from '@shared/ui';

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

export interface StopSessionConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: Resource | null;
  session: PoolSession | null;
  /** Open tabs list (same source as grid) to resolve tab status / name. */
  openTabs: Tab[];
  /**
   * Optional override for post-stop navigation. When provided, called instead
   * of the default behaviour (navigate to /pos with the tab open).
   * Use this when StopSessionConfirm is rendered from the status page so it
   * can return to /pool-tables after stopping.
   */
  onSuccess?: () => void;
}

export function StopSessionConfirm({
  open,
  onOpenChange,
  table,
  session,
  openTabs,
  onSuccess,
}: StopSessionConfirmProps) {
  const { t } = useTranslation('featOrders');
  const navigate = useNavigate();
  const stopSession = useMutationStopSession();
  const { can } = usePermissions();
  const selectTab = useTabStore(s => s.selectTab);
  const openDrawer = useTabStore(s => s.openDrawer);
  const tabsFromStore = useTabStore(s => s.tabs);
  const { data: settings } = useSettings();
  const firstHourMode = settings?.billing.firstHourMode ?? 'prorated';

  const linkedTab = useMemo(() => {
    if (!session?.tabId) return undefined;
    return (
      openTabs.find(t => t.id === session.tabId) ?? tabsFromStore.find(t => t.id === session.tabId)
    );
  }, [session, openTabs, tabsFromStore]);

  const preview = useMemo(() => {
    if (!session || !table) return null;
    const end = new Date();
    return computePoolSessionBilling({
      startedAt: session.startedAt,
      endTime: end,
      ratePerHour: table.ratePerHour,
      firstHourMode,
    });
  }, [session, table, firstHourMode]);

  const paidTabBlock =
    Boolean(session?.tabId) && linkedTab !== undefined && linkedTab.status === 'paid';

  const underMinNote =
    preview && preview.elapsedMs < FIFTEEN_MIN_MS
      ? t('stopPoolTimer.underMinuteNote')
      : null;

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!table || !session || !preview) return;
    if (paidTabBlock) {
      toast.error(t('stopPoolTimer.paidTabBlock'));
      return;
    }
    const result = await stopSession.mutateAsync({
      sessionId: session.id,
      tableId: table.id,
      ratePerHour: table.ratePerHour,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(t('stopPoolTimer.sessionStopped'));
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    } else if (session.tabId) {
      selectTab(session.tabId);
      openDrawer();
      navigate('/pos');
    }
  };

  const totalSeconds = preview ? Math.floor(preview.elapsedMs / 1000) : 0;

  return (
    <ConfirmDialog
      open={open}
      title={t('stopPoolTimer.title')}
      description={
        table && session
          ? t('stopPoolTimer.description', { number: table.number })
          : t('stopPoolTimer.noActiveSession')
      }
      confirmLabel={t('stopPoolTimer.confirmLabel')}
      variant="destructive"
      confirmClassName="min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring"
      onConfirm={() => {
        void handleConfirm();
      }}
      onCancel={handleCancel}
      isLoading={stopSession.isPending}
      confirmDisabled={!table || !session || paidTabBlock || !can('stop_pool_timer')}
    >
      {table && session && preview ? (
        <div className="space-y-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm">{t('stopPoolTimer.elapsed')}</span>
            <TimerDisplay totalSeconds={totalSeconds} className="font-mono text-lg" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm">{t('stopPoolTimer.finalChargePreview')}</span>
            <MoneyDisplay amount={preview.totalCharge} size="lg" />
          </div>
          {session.tabId ? (
            <p className="text-sm">
              <span className="font-medium">{t('stopPoolTimer.addToTab')}</span>{' '}
              {linkedTab?.customerName ?? t('stopPoolTimer.linkedTabFallback')}
            </p>
          ) : (
            <p className="text-sm">
              <span className="font-medium">{t('stopPoolTimer.chargeSeparately')}</span> {t('stopPoolTimer.notLinkedToTab')}
            </p>
          )}
          {paidTabBlock && (
            <p className="text-destructive text-sm" role="alert">
              {t('stopPoolTimer.paidTabDisabledNote')}
            </p>
          )}
          {underMinNote && <p className="text-muted-foreground text-xs">{underMinNote}</p>}
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
