import { AlertCircle, ArrowLeft, Clock, DollarSign, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AssignPoolSessionSheet } from '@features/assign-pool-session-to-tab';
import { EditStartTimeDialog } from '@features/edit-session-start-time';
import { ManagerPinDialog } from '@features/manager-pin-gate/ui/ManagerPinDialog';
import { usePrintPreCheque } from '@features/print-precheque/usePrintPreCheque';
import { RemoveTabItemDialog } from '@features/remove-tab-item/ui/RemoveTabItemDialog';
import { StopAndMoveDialog } from '@features/stop-and-move-table/ui/StopAndMoveDialog';
import { StopSessionConfirm } from '@features/stop-pool-timer/ui/StopSessionConfirm';
import { TransferPoolDialog } from '@features/transfer-tab/ui/TransferPoolDialog';
import { usePoolTable } from '@entities/pool-table/model/queries';
import { usePoolTimer } from '@entities/pool-table/model/usePoolTimer';
import { useSettings } from '@entities/settings';
import { useTab, useTabs } from '@entities/tab';
import { useTabStore } from '@entities/tab/model/store';
import type { OrderItem } from '@shared/lib/domain';
import {
  ConfirmDialog,
  EmptyState,
  MoneyDisplay,
  POSButton,
  PoolTableGridSkeleton,
} from '@shared/ui';
import { Badge } from '@shared/ui/badge';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function formatOrderTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TableStatusPanel({ tableId }: { tableId: string }) {
  const navigate = useNavigate();

  // ── Server state ──────────────────────────────────────────────────────────
  const {
    data: table,
    isIdleOrLoading,
    isError,
    refetch,
    resultError,
    error,
  } = usePoolTable(tableId);

  const session = table?.currentSession ?? null;

  const { data: tab } = useTab(session?.tabId ?? '');

  // openTabs needed by StopSessionConfirm
  const { data: openTabs } = useTabs();

  const { data: settings } = useSettings();
  const firstHourMode = settings?.billing.firstHourMode ?? 'prorated';

  // ── Live timer ────────────────────────────────────────────────────────────
  const timer = usePoolTimer(session?.startedAt ?? null, table?.ratePerHour, firstHourMode);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const printPreCheque = usePrintPreCheque();

  // ── Local dialog state ────────────────────────────────────────────────────
  const [showStop, setShowStop] = useState(false);
  const [showStopMove, setShowStopMove] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedItemForRemoval, setSelectedItemForRemoval] = useState<OrderItem | null>(null);
  const [showPinForRemoval, setShowPinForRemoval] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showPinForEditStart, setShowPinForEditStart] = useState(false);
  const [editStartOpen, setEditStartOpen] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeOrders = useMemo(() => (tab?.orders ?? []).filter(o => o.status !== 'voided'), [tab]);

  const itemsTotal = useMemo(
    () =>
      activeOrders
        .flatMap(o => o.items)
        .reduce((sum, item) => sum + (item.lineTotal ?? item.quantity * item.unitPrice), 0),
    [activeOrders]
  );

  const poolTotal = timer.currentCharge;
  const subtotal = itemsTotal + poolTotal;

  const errMsg =
    resultError?.message ?? (error instanceof Error ? error.message : 'Failed to load table.');

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleAddItems() {
    if (!session?.tabId) return;
    useTabStore.getState().selectTab(session.tabId);
    useTabStore.getState().openDrawer();
    navigate('/pos');
  }

  function handleCloseAndPay() {
    setShowCloseConfirm(false);
    if (session?.tabId) {
      useTabStore.getState().selectTab(session.tabId);
      useTabStore.getState().openDrawer();
    }
    navigate('/pos');
  }

  async function handlePrintPreCheque() {
    if (!tab || !session || !table) {
      toast.error('Cannot print — session or tab data not ready.');
      return;
    }
    const result = await printPreCheque.mutateAsync({ tab, session, table });
    if (!result.ok) {
      toast.error(result.error.message);
    } else {
      toast.success('Pre-cheque sent to printer.');
    }
  }

  // ── Loading / error guards ────────────────────────────────────────────────
  if (isIdleOrLoading) {
    return (
      <div className="p-6">
        <PoolTableGridSkeleton
          count={3}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        />
      </div>
    );
  }

  if (isError || !table) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertCircle}
          title="Could not load table"
          description={errMsg}
          action={{
            label: 'Retry',
            onClick: () => {
              void refetch();
            },
          }}
        />
      </div>
    );
  }

  if (table.status !== 'occupied' || !session) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertCircle}
          title="No active session"
          description="This table has no running pool session."
          action={{
            label: 'Back to Pool Tables',
            onClick: () => {
              navigate('/pool-tables');
            },
          }}
        />
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Live session card */}
      <div className="rounded-xl border border-primary bg-primary/5 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-primary" />
            <span
              data-testid="elapsed-minutes"
              className="font-mono text-3xl font-bold text-primary"
            >
              {formatElapsed(timer.totalSeconds)}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DollarSign className="text-muted-foreground size-4" />
            <MoneyDisplay amount={timer.currentCharge} size="lg" />
          </div>
        </div>

        {tab?.customerName && (
          <p className="text-muted-foreground mb-2 text-sm font-medium">{tab.customerName}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {session.previousTableId && (
            <Badge variant="outline" className="text-xs">
              Moved from Table {session.previousTableNumber ?? '?'}
            </Badge>
          )}
        </div>
      </div>

      {/* Items ordered */}
      {tab && activeOrders.length > 0 && (
        <div className="rounded-xl border p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Items Ordered</h3>
          <div className="flex flex-col gap-4">
            {activeOrders.map((order, idx) => (
              <div key={order.id}>
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Order #{idx + 1} — {formatOrderTime(order.createdAt)}
                </p>
                <div className="flex flex-col gap-1">
                  {order.items.map(item => {
                    const lineTotal = item.lineTotal ?? item.quantity * item.unitPrice;
                    return (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                          {item.quantity}× {item.product?.name ?? 'Item'}
                        </span>
                        <MoneyDisplay amount={lineTotal} size="sm" />
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive ml-1 rounded p-1 transition-colors"
                          title="Remove item"
                          onClick={() => {
                            setSelectedItemForRemoval(item);
                            setShowPinForRemoval(true);
                          }}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Pool charge + subtotal */}
          <div className="mt-4 border-t pt-3">
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-muted-foreground">{table.label} — pool charge (live)</span>
              <MoneyDisplay amount={poolTotal} size="sm" />
            </div>
            <div className="flex items-center justify-between py-1 text-sm font-semibold">
              <span>Subtotal</span>
              <MoneyDisplay amount={subtotal} size="sm" />
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="rounded-xl border p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <POSButton
            type="button"
            variant="secondary"
            touchSize="large"
            className="min-h-[56px]"
            onClick={handleAddItems}
          >
            Add More Items
          </POSButton>

          <POSButton
            type="button"
            variant="destructive"
            touchSize="large"
            className="min-h-[56px]"
            onClick={() => {
              setShowStop(true);
            }}
          >
            Stop Timer
          </POSButton>

          {!session.tabId && (
            <POSButton
              type="button"
              variant="secondary"
              touchSize="large"
              className="min-h-[56px]"
              onClick={() => {
                setShowAssign(true);
              }}
            >
              Assign to Tab
            </POSButton>
          )}

          <POSButton
            type="button"
            variant="outline"
            touchSize="large"
            className="min-h-[56px]"
            onClick={() => {
              setShowTransfer(true);
            }}
          >
            Move Table
          </POSButton>

          <POSButton
            type="button"
            variant="outline"
            touchSize="large"
            className="min-h-[56px]"
            disabled={printPreCheque.isPending || !tab}
            onClick={() => {
              void handlePrintPreCheque();
            }}
          >
            {printPreCheque.isPending ? 'Printing…' : 'Print Pre-cheque'}
          </POSButton>

          <POSButton
            type="button"
            variant="default"
            touchSize="large"
            className="min-h-[56px]"
            onClick={() => {
              setShowCloseConfirm(true);
            }}
          >
            Close &amp; Pay
          </POSButton>

          <POSButton
            type="button"
            variant="destructive"
            touchSize="large"
            className="col-span-2 min-h-[56px]"
            onClick={() => {
              setShowStopMove(true);
            }}
          >
            Stop &amp; Move to Table
          </POSButton>

          {!session.stoppedAt && (
            <POSButton
              type="button"
              variant="outline"
              touchSize="large"
              className="col-span-2 min-h-[56px]"
              onClick={() => {
                setShowPinForEditStart(true);
              }}
            >
              Edit Start Time
            </POSButton>
          )}
        </div>
      </div>

      {/* Back button */}
      <div>
        <POSButton
          type="button"
          variant="ghost"
          touchSize="default"
          onClick={() => {
            navigate('/pool-tables');
          }}
        >
          <ArrowLeft className="mr-2 size-4" />
          Back to Pool Tables
        </POSButton>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Stop timer */}
      <StopSessionConfirm
        open={showStop}
        onOpenChange={setShowStop}
        table={table}
        session={session}
        openTabs={openTabs ?? []}
        onSuccess={() => {
          navigate('/pool-tables');
        }}
      />

      {/* Stop and move to regular table */}
      {showStopMove && (
        <StopAndMoveDialog
          open={showStopMove}
          session={session}
          table={table}
          tabId={session.tabId ?? ''}
          onClose={() => {
            setShowStopMove(false);
          }}
          onSuccess={() => {
            navigate('/pool-tables');
          }}
        />
      )}

      {/* Transfer pool table (pool → pool) */}
      <TransferPoolDialog open={showTransfer} onOpenChange={setShowTransfer} session={session} />

      {/* Assign session to tab */}
      <AssignPoolSessionSheet
        open={showAssign}
        onOpenChange={setShowAssign}
        sessionId={session.id}
        tableLabel={table.label}
        openTabs={openTabs ?? []}
      />

      {/* PIN gate for item removal — Step 1 */}
      <ManagerPinDialog
        open={showPinForRemoval}
        onOpenChange={open => {
          if (!open) {
            setShowPinForRemoval(false);
            setSelectedItemForRemoval(null);
          }
        }}
        requiredAction="void_order"
        onSuccess={() => {
          setShowPinForRemoval(false);
          setShowRemoveConfirm(true);
        }}
      />

      {/* Item removal confirm — Step 2 */}
      <RemoveTabItemDialog
        open={showRemoveConfirm}
        item={selectedItemForRemoval}
        tabId={tab?.id ?? ''}
        orderId={selectedItemForRemoval?.orderId ?? ''}
        onClose={() => {
          setShowRemoveConfirm(false);
          setSelectedItemForRemoval(null);
        }}
      />

      {/* Close & Pay confirm */}
      <ConfirmDialog
        open={showCloseConfirm}
        title="Close tab & proceed to payment?"
        description="This will take you to the POS to finalize payment for this tab."
        confirmLabel="Close & Pay"
        onConfirm={handleCloseAndPay}
        onCancel={() => {
          setShowCloseConfirm(false);
        }}
      />

      {/* PIN gate for edit start time — Step 1 */}
      <ManagerPinDialog
        open={showPinForEditStart}
        onOpenChange={open => {
          if (!open) {
            setShowPinForEditStart(false);
          }
        }}
        requiredAction="void_order"
        onSuccess={() => {
          setShowPinForEditStart(false);
          setEditStartOpen(true);
        }}
      />

      {/* Edit start time dialog — Step 2 */}
      <EditStartTimeDialog open={editStartOpen} onOpenChange={setEditStartOpen} session={session} />
    </div>
  );
}
