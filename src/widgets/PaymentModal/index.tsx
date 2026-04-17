import { AlertCircle, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Tab } from '@entities/tab/model/types';
import type { Result } from '@shared/lib/result';
import { MoneyDisplay, MoneyInput, POSButton, ScrollArea } from '@shared/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog';

type PaymentMethod = 'cash' | 'card';
type TipMode = 'pct10' | 'pct15' | 'pct18' | 'pct20' | 'custom';

export interface PaymentModalProps {
  open: boolean;
  tab: Tab;
  onPayment: (method: PaymentMethod, tipAmount: number) => Promise<Result<void>>;
  onClose: () => void;
}

function calculateLineTotal(
  item: Pick<Tab['items'][number], 'unitPrice' | 'modifierPriceDelta' | 'quantity'>
): number {
  return (item.unitPrice + item.modifierPriceDelta) * item.quantity;
}

function getTipPercentage(tipMode: Exclude<TipMode, 'custom'>): number {
  if (tipMode === 'pct10') return 10;
  if (tipMode === 'pct15') return 15;
  if (tipMode === 'pct18') return 18;
  return 20;
}

export function PaymentModal({ open, tab, onPayment, onClose }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tipMode, setTipMode] = useState<TipMode>('pct15');
  const [customTip, setCustomTip] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const itemsSubtotal = useMemo(
    () => tab.items.reduce((sum, item) => sum + calculateLineTotal(item), 0),
    [tab.items]
  );
  const poolChargesTotal = useMemo(
    () => tab.poolCharges.reduce((sum, charge) => sum + charge.totalCharge, 0),
    [tab.poolCharges]
  );
  const baseSubtotal = itemsSubtotal + poolChargesTotal;
  const tipAmount = useMemo(() => {
    if (tipMode === 'custom') return Math.max(0, customTip);
    return baseSubtotal * (getTipPercentage(tipMode) / 100);
  }, [baseSubtotal, customTip, tipMode]);
  const runningTotal = baseSubtotal + tipAmount;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isProcessing) {
      onClose();
    }
  };

  const handleProcessPayment = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    const result = await onPayment(method, tipAmount);
    setIsProcessing(false);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-0">
        <DialogHeader className="border-b px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle>Process Payment</DialogTitle>
        </DialogHeader>

        <div className="flex h-[calc(100dvh-64px)] flex-col sm:h-auto sm:max-h-[calc(90vh-64px)]">
          <ScrollArea className="flex-1 px-4 py-4 sm:px-6">
            <div className="space-y-6">
              <section className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">{tab.customerName}</h3>
                  <p className="text-sm text-muted-foreground">{tab.items.length} item(s)</p>
                </div>
                <div className="space-y-2">
                  {tab.items.map(item => (
                    <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {item.quantity}× {item.product?.name ?? 'Menu item'}
                        </p>
                        {item.notes && <p className="text-muted-foreground">{item.notes}</p>}
                      </div>
                      <MoneyDisplay amount={calculateLineTotal(item)} size="sm" />
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Items subtotal</span>
                    <MoneyDisplay amount={itemsSubtotal} size="sm" />
                  </div>
                </div>
              </section>

              {tab.poolCharges.length > 0 && (
                <section className="space-y-2 rounded-lg border p-3">
                  <h4 className="font-medium">Pool charges</h4>
                  {tab.poolCharges.map(charge => (
                    <div
                      key={charge.sessionId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>
                        Table {charge.tableNumber} · {charge.billedMinutes} min
                      </span>
                      <MoneyDisplay amount={charge.totalCharge} size="sm" />
                    </div>
                  ))}
                </section>
              )}

              <section className="space-y-3">
                <h4 className="font-medium">Tip</h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ['pct10', '10%'],
                      ['pct15', '15%'],
                      ['pct18', '18%'],
                      ['pct20', '20%'],
                    ] as const
                  ).map(([presetMode, label]) => (
                    <POSButton
                      key={presetMode}
                      type="button"
                      variant={tipMode === presetMode ? 'default' : 'outline'}
                      touchSize="large"
                      disabled={isProcessing}
                      onClick={() => {
                        setTipMode(presetMode);
                      }}
                    >
                      {label}
                    </POSButton>
                  ))}
                </div>
                <MoneyInput
                  label="Custom tip"
                  value={tipMode === 'custom' ? customTip : 0}
                  onChange={value => {
                    setCustomTip(value);
                    setTipMode('custom');
                  }}
                  disabled={isProcessing}
                />
              </section>

              <section className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Subtotal</span>
                  <MoneyDisplay amount={baseSubtotal} size="sm" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Tip</span>
                  <MoneyDisplay amount={tipAmount} size="sm" />
                </div>
                <div className="flex items-center justify-between border-t pt-2 text-lg font-semibold">
                  <span>Running total</span>
                  <MoneyDisplay amount={runningTotal} size="lg" />
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="font-medium">Payment method</h4>
                <div className="grid grid-cols-2 gap-2">
                  <POSButton
                    type="button"
                    touchSize="xl"
                    variant={method === 'cash' ? 'default' : 'outline'}
                    disabled={isProcessing}
                    onClick={() => {
                      setMethod('cash');
                    }}
                  >
                    Cash
                  </POSButton>
                  <POSButton
                    type="button"
                    touchSize="xl"
                    variant={method === 'card' ? 'default' : 'outline'}
                    disabled={isProcessing}
                    onClick={() => {
                      setMethod('card');
                    }}
                  >
                    Card
                  </POSButton>
                </div>
              </section>

              {errorMessage && (
                <div
                  className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="space-y-2 border-t px-4 py-3 sm:px-6 sm:py-4">
            <POSButton
              type="button"
              touchSize="xl"
              disabled={isProcessing}
              className="w-full bg-[var(--pos-accent)] text-black hover:bg-[var(--pos-accent)]/90"
              onClick={() => {
                void handleProcessPayment();
              }}
            >
              {isProcessing ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing Payment...
                </span>
              ) : (
                'Process Payment'
              )}
            </POSButton>
            <POSButton
              type="button"
              touchSize="large"
              variant="outline"
              className="w-full"
              disabled={isProcessing}
              onClick={onClose}
            >
              Cancel
            </POSButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
