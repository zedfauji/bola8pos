import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { rappiOrderKeys, useRappiOrderStore, useRappiOrdersList } from '@entities/rappi-order';
import { useStaffStore } from '@entities/staff/model/store';
import { tabKeys } from '@entities/tab/model/queries';
import type { RappiOrder } from '@shared/lib/domain';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { Button } from '@shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';

function formatReceivedAt(d: Date): string {
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function OrderCard({ order, onAccepted }: { order: RappiOrder; onAccepted: () => void }) {
  const queryClient = useQueryClient();
  const currentStaff = useStaffStore(s => s.currentStaff);
  const currentShift = useStaffStore(s => s.currentShift);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: rappiOrderKeys.list() });
    void queryClient.invalidateQueries({ queryKey: tabKeys.all });
  };

  const handleAccept = async () => {
    if (!currentStaff?.id || !currentShift?.id) {
      toast.error('Clock in with an active shift before accepting orders.');
      return;
    }
    setBusy(true);
    const r = await useRappiOrderStore
      .getState()
      .acceptOrder(order, currentStaff.id, currentShift.id);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    toast.success('Rappi order accepted — tab opened.');
    invalidate();
    onAccepted();
  };

  const handleReject = async () => {
    const reason = rejectReason.trim();
    if (reason.length < 2) {
      toast.error('Enter a short rejection reason.');
      return;
    }
    setBusy(true);
    const r = await useRappiOrderStore.getState().rejectOrder(order.id, reason);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    toast.message('Order rejected');
    setRejectOpen(false);
    setRejectReason('');
    invalidate();
  };

  const handlePreparing = async () => {
    setBusy(true);
    const r = await useRappiOrderStore.getState().markPreparing(order.id);
    setBusy(false);
    if (!r.ok) toast.error(r.error.message);
    else invalidate();
  };

  const handleReady = async () => {
    setBusy(true);
    const r = await useRappiOrderStore.getState().markReady(order.id);
    setBusy(false);
    if (!r.ok) toast.error(r.error.message);
    else invalidate();
  };

  const handleComplete = async () => {
    setBusy(true);
    const r = await useRappiOrderStore.getState().markCompleted(order);
    setBusy(false);
    if (!r.ok) toast.error(r.error.message);
    else {
      toast.success('Rappi payment recorded — tab closed.');
      invalidate();
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{order.customerName}</p>
            <p className="text-muted-foreground text-xs">{formatReceivedAt(order.receivedAt)}</p>
          </div>
          <span className="bg-muted rounded px-2 py-0.5 text-xs capitalize">
            {order.status.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="text-muted-foreground mb-3 text-sm">{order.deliveryAddress || '—'}</p>
        <ul className="mb-3 space-y-1 text-sm">
          {order.items.map((it, i) => (
            <li key={`${order.id}-it-${String(i)}`} className="flex justify-between gap-2">
              <span>
                {it.name} × {it.quantity}
              </span>
              <span className="text-muted-foreground shrink-0">
                <MoneyDisplay amount={it.unitPrice * it.quantity} />
              </span>
            </li>
          ))}
        </ul>
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <span>
            Subtotal: <MoneyDisplay amount={order.subtotal} />
          </span>
          <span className="text-muted-foreground">
            Rappi total: <MoneyDisplay amount={order.rappiTotal} />
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {order.status === 'pending_acceptance' && (
            <>
              <Button size="sm" onClick={() => void handleAccept()} disabled={busy}>
                Accept
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setRejectOpen(true);
                }}
                disabled={busy}
              >
                Reject
              </Button>
            </>
          )}
          {(order.status === 'accepted' || order.status === 'preparing') && (
            <>
              {order.status === 'accepted' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handlePreparing()}
                  disabled={busy}
                >
                  Preparing
                </Button>
              )}
              <Button size="sm" onClick={() => void handleReady()} disabled={busy}>
                Ready for Pickup
              </Button>
            </>
          )}
          {order.status === 'ready_for_pickup' && (
            <Button size="sm" onClick={() => void handleComplete()} disabled={busy}>
              Complete
            </Button>
          )}
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Rappi order</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={e => {
                setRejectReason(e.target.value);
              }}
              placeholder="Out of stock, closed, …"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void handleReject()}>
              Reject order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RappiOrdersPanel() {
  const { data: res, isLoading, isError, refetch } = useRappiOrdersList();
  const setOrdersFromServer = useRappiOrderStore(s => s.setOrdersFromServer);

  useEffect(() => {
    if (res?.ok) setOrdersFromServer(res.data);
  }, [res, setOrdersFromServer]);

  const { incoming, inProgress } = useMemo(() => {
    if (!res?.ok) return { incoming: [] as RappiOrder[], inProgress: [] as RappiOrder[] };
    const incoming = res.data.filter(o => o.status === 'pending_acceptance');
    const inProgress = res.data.filter(
      o => o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready_for_pickup'
    );
    return { incoming, inProgress };
  }, [res]);

  if (isLoading) {
    return <p className="text-muted-foreground p-6">Loading Rappi orders…</p>;
  }

  if (isError || !res?.ok) {
    return (
      <div className="p-6">
        <p className="text-destructive mb-2">Could not load Rappi orders.</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 p-6 md:grid-cols-2">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Incoming</h2>
        <div className="space-y-4">
          {incoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">No orders awaiting acceptance.</p>
          ) : (
            incoming.map(o => <OrderCard key={o.id} order={o} onAccepted={() => void refetch()} />)
          )}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">In progress</h2>
        <div className="space-y-4">
          {inProgress.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing in the kitchen queue.</p>
          ) : (
            inProgress.map(o => (
              <OrderCard key={o.id} order={o} onAccepted={() => void refetch()} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
