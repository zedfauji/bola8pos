/**
 * PaymentForm — all payment state and UI extracted from PaymentModal.
 * Can be embedded inline (PaymentPane) or wrapped in a Dialog (PaymentModal).
 */

import { AlertCircle, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ReceiptPreview } from '@features/process-payment/ui/ReceiptPreview';
import { useSettings } from '@entities/settings';
import { useStaffStore } from '@entities/staff/model/store';
import type { Tab } from '@entities/tab/model/types';
import type { ReceiptData } from '@shared/lib/edge-function-contracts';
import { groupOrderItems } from '@shared/lib/groupOrderItems';
import { logger } from '@shared/lib/logger-instance';
import {
  processCardPayment,
  processCashPayment,
  processRappiPayment,
} from '@shared/lib/payment-processor';
import { openCashDrawer, printReceipt } from '@shared/lib/pos-printer';
import type { Result } from '@shared/lib/result';
import { MoneyDisplay, MoneyInput, POSButton, ProtectedAction, ScrollArea } from '@shared/ui';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';

type PayMethod = 'cash' | 'card' | 'rappi';
type TipMode = 'preset' | 'custom';

const DEFAULT_TIP_PRESETS = [10, 15, 18, 20] as const;
const DEFAULT_ENABLED_METHODS = {
  cash: true,
  bbvaCard: true,
  rappi: true,
} as const;
const DEFAULT_TAX_RATE_PERCENT = 16;

export type PaymentProcessors = {
  processCashPayment: typeof processCashPayment;
  processCardPayment: typeof processCardPayment;
  processRappiPayment: typeof processRappiPayment;
};

const defaultProcessors: PaymentProcessors = {
  processCashPayment,
  processCardPayment,
  processRappiPayment,
};

export interface PaymentFormProps {
  tab: Tab;
  /** Current staff profile id — required to process payment */
  staffId: string;
  onPaymentSuccess: () => void;
  /** Used by PaymentModal's Dialog to close after viewing receipt */
  onClose?: () => void;
  /** Storybook / tests */
  processors?: PaymentProcessors;
}

function calculateLineTotal(
  item: Pick<Tab['items'][number], 'unitPrice' | 'modifierPriceDelta' | 'quantity'>
): number {
  return (item.unitPrice + item.modifierPriceDelta) * item.quantity;
}

export function PaymentForm({
  tab,
  staffId,
  onPaymentSuccess,
  onClose,
  processors = defaultProcessors,
}: PaymentFormProps) {
  const currentRole = useStaffStore(s => s.currentStaff?.role);
  const { data: settings } = useSettings();
  const tipPresets = settings?.billing.defaultTipPercentages ?? DEFAULT_TIP_PRESETS;
  const enabledMethods = settings?.billing.paymentMethods ?? DEFAULT_ENABLED_METHODS;
  const taxRatePercent = settings?.billing.taxRatePercent ?? DEFAULT_TAX_RATE_PERCENT;
  const paymentLabels = settings?.paymentLabels ?? {
    cash: 'Efectivo',
    card: 'Terminal BBVA',
    rappi: 'Rappi',
  };
  const isRappiTab = Boolean(tab.rappiOrderId);

  const [step, setStep] = useState<'pay' | 'receipt'>('pay');
  const [method, setMethod] = useState<PayMethod>('cash');
  const [tipMode, setTipMode] = useState<TipMode>('preset');
  const [selectedTipPercent, setSelectedTipPercent] = useState(15);
  const [customTip, setCustomTip] = useState(0);
  const [tenderedAmount, setTenderedAmount] = useState(0);
  const [cardReference, setCardReference] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  /* Reset state when the tab being viewed changes */
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setStep('pay');
    setErrorMessage(null);
    setReceiptData(null);
    if (isRappiTab && enabledMethods.rappi) {
      setMethod('rappi');
    } else if (enabledMethods.cash) {
      setMethod('cash');
    } else if (enabledMethods.bbvaCard) {
      setMethod('card');
    } else {
      setMethod('cash');
    }
    setTipMode('preset');
    const firstPreset = tipPresets.at(0);
    const secondPreset = tipPresets.at(1);
    const defaultTipPercent = secondPreset ?? firstPreset ?? 15;
    setSelectedTipPercent(defaultTipPercent);
    setTenderedAmount(0);
    setCardReference('');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    tab.id,
    isRappiTab,
    enabledMethods.cash,
    enabledMethods.bbvaCard,
    enabledMethods.rappi,
    tipPresets,
  ]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (method === 'cash' && !enabledMethods.cash) {
      setMethod(enabledMethods.bbvaCard ? 'card' : enabledMethods.rappi ? 'rappi' : 'cash');
      return;
    }
    if (method === 'card' && !enabledMethods.bbvaCard) {
      setMethod(enabledMethods.cash ? 'cash' : enabledMethods.rappi ? 'rappi' : 'card');
      return;
    }
    if (method === 'rappi' && !enabledMethods.rappi) {
      setMethod(enabledMethods.cash ? 'cash' : enabledMethods.bbvaCard ? 'card' : 'rappi');
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [enabledMethods.bbvaCard, enabledMethods.cash, enabledMethods.rappi, method]);

  const itemsSubtotal = useMemo(
    () => tab.items.reduce((sum, item) => sum + calculateLineTotal(item), 0),
    [tab.items]
  );
  const poolChargesTotal = useMemo(
    () => tab.poolCharges.reduce((sum, charge) => sum + charge.totalCharge, 0),
    [tab.poolCharges]
  );
  const baseSubtotal = itemsSubtotal + poolChargesTotal;
  const taxAmount = useMemo(() => {
    if (method === 'rappi') return 0;
    return Math.round(baseSubtotal * (taxRatePercent / 100) * 100) / 100;
  }, [baseSubtotal, method, taxRatePercent]);
  const subtotalWithTax = Math.round((baseSubtotal + taxAmount) * 100) / 100;
  const tipAmount = useMemo(() => {
    if (method === 'rappi') return 0;
    if (tipMode === 'custom') return Math.max(0, customTip);
    return Math.round(subtotalWithTax * (selectedTipPercent / 100) * 100) / 100;
  }, [customTip, method, selectedTipPercent, subtotalWithTax, tipMode]);
  const runningTotal = Math.round((subtotalWithTax + tipAmount) * 100) / 100;
  const changeDue = Math.max(0, Math.round((tenderedAmount - runningTotal) * 100) / 100);

  const canSubmitCash = tenderedAmount >= runningTotal && runningTotal > 0;
  const canSubmit = staffId.length > 0 && (method !== 'cash' || canSubmitCash);

  const groupedItems = useMemo(() => groupOrderItems(tab.items), [tab.items]);

  const runPayment = async (): Promise<
    Result<{ receiptData: ReceiptData }, { message: string }>
  > => {
    if (!staffId) {
      return { ok: false, error: { message: 'Not signed in.' } };
    }

    if (method === 'cash') {
      const r = await processors.processCashPayment(
        tab.id,
        baseSubtotal,
        tipAmount,
        tenderedAmount
      );
      if (!r.ok) return { ok: false, error: { message: r.error.message } };
      return { ok: true, data: { receiptData: r.data.receiptData } };
    }

    if (method === 'card') {
      const ref = cardReference.trim();
      const r = await processors.processCardPayment(
        tab.id,
        baseSubtotal,
        tipAmount,
        ref.length > 0 ? ref : undefined
      );
      if (!r.ok) return { ok: false, error: { message: r.error.message } };
      return { ok: true, data: { receiptData: r.data.receiptData } };
    }

    if (!tab.rappiOrderId) {
      return { ok: false, error: { message: 'Missing Rappi order id.' } };
    }
    const r = await processors.processRappiPayment(tab.id, baseSubtotal, tab.rappiOrderId);
    if (!r.ok) return { ok: false, error: { message: r.error.message } };
    return { ok: true, data: { receiptData: r.data.receiptData } };
  };

  const handlePrimary = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    const result = await runPayment();
    setIsProcessing(false);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      logger.warn('payment.failed', { tabId: tab.id, code: 'client' });
      return;
    }

    logger.info('payment.succeeded', { tabId: tab.id, paymentMethod: method });
    const receipt = result.data.receiptData;
    setReceiptData(receipt);
    setStep('receipt');
    onPaymentSuccess();

    void (async () => {
      const logHardwareFail = (event: string, message: string) => {
        logger.warn(event, { tabId: tab.id, message });
        toast.error(message);
      };
      try {
        if (method === 'cash') {
          const drawer = await openCashDrawer();
          if (!drawer.ok) logHardwareFail('cash_drawer.failed', drawer.error.message);
          const printed = await printReceipt(receipt);
          if (!printed.ok) logHardwareFail('printer.receipt.failed', printed.error.message);
        } else {
          const printed = await printReceipt(receipt);
          if (!printed.ok) logHardwareFail('printer.receipt.failed', printed.error.message);
        }
      } catch (e) {
        logger.warn('printer.post_payment.exception', { tabId: tab.id, raw: String(e) });
        toast.error('Print or drawer failed unexpectedly.');
      }
    })();
  };

  const primaryLabel =
    method === 'card'
      ? 'Confirm card payment'
      : method === 'rappi'
        ? 'Confirm & close tab'
        : 'Process payment';

  if (step === 'receipt' && receiptData) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6">
        <ReceiptPreview
          receipt={receiptData}
          onDone={() => {
            onClose?.();
          }}
        />
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="flex-1 px-4 py-4 sm:px-6">
        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold">{tab.customerName}</h3>
              <p className="text-sm text-muted-foreground">
                {groupedItems.length} item type{groupedItems.length !== 1 ? 's' : ''} ·{' '}
                {tab.items.reduce((s, i) => s + i.quantity, 0)} total
              </p>
            </div>
            <div className="space-y-2">
              {groupedItems.map(item => (
                <div
                  key={`${item.productId}::${item.modifierIds.join(',')}`}
                  className="flex items-start justify-between gap-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {item.quantity > 1 ? `${String(item.quantity)}× ` : ''}
                      {item.productName}
                    </p>
                  </div>
                  <MoneyDisplay amount={item.lineTotal} size="sm" />
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
                <div key={charge.sessionId} className="flex items-center justify-between text-sm">
                  <span>
                    Table {charge.tableNumber} · {charge.billedMinutes} min
                  </span>
                  <MoneyDisplay amount={charge.totalCharge} size="sm" />
                </div>
              ))}
            </section>
          )}

          {method !== 'rappi' && (
            <section className="space-y-3">
              <h4 className="font-medium">Tip</h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {tipPresets.map(percent => (
                  <POSButton
                    key={percent}
                    type="button"
                    variant={
                      tipMode === 'preset' && selectedTipPercent === percent ? 'default' : 'outline'
                    }
                    touchSize="large"
                    disabled={isProcessing}
                    onClick={() => {
                      setTipMode('preset');
                      setSelectedTipPercent(percent);
                    }}
                  >
                    {`${String(percent)}%`}
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
          )}

          {method === 'rappi' && (
            <section className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              Payment collected by Rappi. Confirm here to close this tab in the POS.
            </section>
          )}

          <section className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between text-sm">
              <span>Subtotal</span>
              <MoneyDisplay amount={baseSubtotal} size="sm" />
            </div>
            {method !== 'rappi' && (
              <div className="flex items-center justify-between text-sm">
                <span>Tax ({taxRatePercent}%)</span>
                <MoneyDisplay amount={taxAmount} size="sm" />
              </div>
            )}
            {method !== 'rappi' && (
              <div className="flex items-center justify-between text-sm">
                <span>Tip</span>
                <MoneyDisplay amount={tipAmount} size="sm" />
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-2 text-lg font-semibold">
              <span>Total</span>
              <MoneyDisplay amount={runningTotal} size="lg" />
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="font-medium">Payment method</h4>
            <div className="grid gap-2 sm:grid-cols-3">
              {enabledMethods.cash && (
                <POSButton
                  type="button"
                  touchSize="xl"
                  variant={method === 'cash' ? 'default' : 'outline'}
                  disabled={isProcessing}
                  data-testid="payment-btn-cash"
                  onClick={() => {
                    setMethod('cash');
                  }}
                >
                  {paymentLabels.cash}
                </POSButton>
              )}
              {enabledMethods.bbvaCard && (
                <POSButton
                  type="button"
                  touchSize="xl"
                  variant={method === 'card' ? 'default' : 'outline'}
                  disabled={isProcessing}
                  data-testid="payment-btn-card"
                  onClick={() => {
                    setMethod('card');
                  }}
                >
                  {paymentLabels.card}
                </POSButton>
              )}
              {isRappiTab && enabledMethods.rappi && (
                <POSButton
                  type="button"
                  touchSize="xl"
                  variant={method === 'rappi' ? 'default' : 'outline'}
                  disabled={isProcessing}
                  data-testid="payment-btn-rappi"
                  onClick={() => {
                    setMethod('rappi');
                  }}
                >
                  {paymentLabels.rappi}
                </POSButton>
              )}
            </div>
          </section>

          {method === 'cash' && (
            <section className="space-y-3">
              <MoneyInput
                label="Amount tendered"
                value={tenderedAmount}
                onChange={setTenderedAmount}
                disabled={isProcessing}
              />
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                <span>Change due</span>
                <MoneyDisplay amount={changeDue} size="sm" />
              </div>
            </section>
          )}

          {method === 'card' && (
            <section className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Process payment on BBVA Terminal</p>
              <p className="text-xs text-muted-foreground">
                Enter this total on the terminal, then confirm below when the charge is approved.
              </p>
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-4">
                <span className="text-sm font-medium">Charge amount</span>
                <MoneyDisplay amount={runningTotal} size="lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="card-ref">Reference # (optional)</Label>
                <Input
                  id="card-ref"
                  value={cardReference}
                  onChange={e => {
                    setCardReference(e.target.value);
                  }}
                  placeholder="Terminal receipt / auth code"
                  maxLength={64}
                  disabled={isProcessing}
                  autoComplete="off"
                />
              </div>
            </section>
          )}

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
        <ProtectedAction
          action="close_tab"
          currentRole={currentRole}
          disabled={isProcessing || !canSubmit}
        >
          <POSButton
            type="button"
            touchSize="xl"
            disabled={isProcessing || !canSubmit}
            className="w-full bg-[var(--pos-accent)] text-black hover:bg-[var(--pos-accent)]/90"
            onClick={() => {
              void handlePrimary();
            }}
          >
            {isProcessing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </span>
            ) : (
              primaryLabel
            )}
          </POSButton>
        </ProtectedAction>
        {onClose && (
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
        )}
      </div>
    </>
  );
}
