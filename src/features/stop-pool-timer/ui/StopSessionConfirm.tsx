import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useMutationStopSession } from '@entities/pool-table/model/queries';
import { usePermissions } from '@entities/staff/model/usePermissions';
import type { Tab } from '@entities/tab';
import { useTabStore } from '@entities/tab/model/store';
import type { PoolSession, PoolTable } from '@shared/lib/domain';
import { computePoolSessionBilling } from '@shared/lib/pool-billing';
import { ConfirmDialog, MoneyDisplay, TimerDisplay } from '@shared/ui';

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

export interface StopSessionConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: PoolTable | null;
  session: PoolSession | null;
  /** Open tabs list (same source as grid) to resolve tab status / name. */
  openTabs: Tab[];
}

export function StopSessionConfirm({
  open,
  onOpenChange,
  table,
  session,
  openTabs,
}: StopSessionConfirmProps) {
  const navigate = useNavigate();
  const stopSession = useMutationStopSession();
  const { can } = usePermissions();
  const selectTab = useTabStore(s => s.selectTab);
  const openDrawer = useTabStore(s => s.openDrawer);
  const tabsFromStore = useTabStore(s => s.tabs);

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
    });
  }, [session, table]);

  const paidTabBlock =
    Boolean(session?.tabId) && linkedTab !== undefined && linkedTab.status === 'paid';

  const underMinNote =
    preview && preview.elapsedMs < FIFTEEN_MIN_MS
      ? 'Sessions under 15 minutes are billed at the 15-minute minimum.'
      : null;

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!table || !session || !preview) return;
    if (paidTabBlock) {
      toast.error('Cannot stop a session on a tab that is already paid.');
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
    toast.success('Pool session stopped.');
    onOpenChange(false);
    if (session.tabId) {
      selectTab(session.tabId);
      openDrawer();
      navigate('/pos');
    }
  };

  const totalSeconds = preview ? Math.floor(preview.elapsedMs / 1000) : 0;

  return (
    <ConfirmDialog
      open={open}
      title="Stop pool session?"
      description={
        table && session
          ? `Table ${String(table.number)} — charges use 15-minute blocks.`
          : 'No active session selected.'
      }
      confirmLabel="Stop & finalize"
      variant="destructive"
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
            <span className="text-muted-foreground text-sm">Elapsed</span>
            <TimerDisplay totalSeconds={totalSeconds} className="font-mono text-lg" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm">Final charge (preview)</span>
            <MoneyDisplay amount={preview.totalCharge} size="lg" />
          </div>
          {session.tabId ? (
            <p className="text-sm">
              <span className="font-medium">Add to tab:</span>{' '}
              {linkedTab?.customerName ?? 'Linked tab'}
            </p>
          ) : (
            <p className="text-sm">
              <span className="font-medium">Charge separately</span> — this session is not linked to
              a tab.
            </p>
          )}
          {paidTabBlock && (
            <p className="text-destructive text-sm" role="alert">
              This session is on a tab that is already paid. Stop is disabled.
            </p>
          )}
          {underMinNote && <p className="text-muted-foreground text-xs">{underMinNote}</p>}
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
