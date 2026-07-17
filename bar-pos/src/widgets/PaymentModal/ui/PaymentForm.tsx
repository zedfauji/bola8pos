/**
 * PaymentForm — all payment state and UI extracted from PaymentModal.
 * Can be embedded inline (PaymentPane) or wrapped in a Dialog (PaymentModal).
 */

import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { toast } from 'sonner';
import { ReceiptPreview } from '@features/process-payment/ui/ReceiptPreview';
import { useSettings } from '@entities/settings';
import { useStaffStore } from '@entities/staff/model/store';
import type { Tab } from '@entities/tab/model/types';
import type { DiscountScope, DiscountType } from '@shared/lib/domain';
import { getDiscountBase, calculateDiscountAmount } from '@shared/lib/domain-helpers';
import type { ReceiptData } from '@shared/lib/edge-function-contracts';
import { groupOrderItems } from '@shared/lib/groupOrderItems';
import { logger } from '@shared/lib/logger-instance';
import {
  processCardPayment,
  processCashPayment,
  processRappiPayment,
  processSplitPayment,
  type SplitPaymentLegInput,
} from '@shared/lib/payment-processor';
import { openCashDrawer, printReceipt } from '@shared/lib/pos-printer';
import type { Result } from '@shared/lib/result';
import { MoneyDisplay, MoneyInput, POSButton, ProtectedAction, ScrollArea, Switch } from '@shared/ui';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';

type PayMethod = 'cash' | 'card' | 'rappi';
type TipMode = 'preset' | 'custom';

type SplitRow = {
  id: string;
  method: PayMethod;
  amount: number;
  tip: number;
  tenderedAmount: number;
  cardReference: string;
};

type SplitRowAction =
  | { type: 'RESET_ROWS'; rows: SplitRow[] }
  | { type: 'ADD_ROW'; defaultMethod: PayMethod }
  | { type: 'REMOVE_ROW'; rowId: string }
  | { type: 'SET_METHOD'; rowId: string; method: PayMethod }
  | { type: 'SET_AMOUNT'; rowId: string; value: number }
  | { type: 'SET_TIP'; rowId: string; value: number }
  | { type: 'SET_TENDERED'; rowId: string; value: number }
  | { type: 'SET_CARD_REF'; rowId: string; value: string };

let splitRowCounter = 0;
function nextSplitRowId(): string {
  splitRowCounter += 1;
  return `split-row-${String(splitRowCounter)}`;
}

function makeDefaultSplitRow(method: PayMethod): SplitRow {
  return {
    id: nextSplitRowId(),
    method,
    amount: 0,
    tip: 0,
    tenderedAmount: 0,
    cardReference: '',
  };
}

function splitRowsReducer(state: SplitRow[], action: SplitRowAction): SplitRow[] {
  switch (action.type) {
    case 'RESET_ROWS':
      return action.rows;
    case 'ADD_ROW':
      if (state.length >= 4) return state;
      return [...state, makeDefaultSplitRow(action.defaultMethod)];
    case 'REMOVE_ROW':
      if (state.length <= 2) return state;
      return state.filter(r => r.id !== action.rowId);
    case 'SET_METHOD':
      return state.map(r => (r.id === action.rowId ? { ...r, method: action.method } : r));
    case 'SET_AMOUNT':
      return state.map(r => (r.id === action.rowId ? { ...r, amount: action.value } : r));
    case 'SET_TIP':
      return state.map(r => (r.id === action.rowId ? { ...r, tip: action.value } : r));
    case 'SET_TENDERED':
      return state.map(r => (r.id === action.rowId ? { ...r, tenderedAmount: action.value } : r));
    case 'SET_CARD_REF':
      return state.map(r => (r.id === action.rowId ? { ...r, cardReference: action.value } : r));
    default:
      return state;
  }
}

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
  processSplitPayment: typeof processSplitPayment;
};

const defaultProcessors: PaymentProcessors = {
  processCashPayment,
  processCardPayment,
  processRappiPayment,
  processSplitPayment,
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
  const [cardChargeOverride, setCardChargeOverride] = useState<number | null>(null);
  const [discountScope, setDiscountScope] = useState<DiscountScope>('all');
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitRows, dispatchSplitRows] = useReducer(splitRowsReducer, []);
  const [receiptQueue, setReceiptQueue] = useState<ReceiptData[]>([]);
  const [receiptIndex, setReceiptIndex] = useState(0);

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
    setCardChargeOverride(null);
    setDiscountScope('all');
    setDiscountType('percent');
    setDiscountValue(0);
    setIsSplitMode(false);
    setReceiptQueue([]);
    setReceiptIndex(0);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    tab.id,
    isRappiTab,
    enabledMethods.cash,
    enabledMethods.bbvaCard,
    enabledMethods.rappi,
    tipPresets,
  ]);

  /* Split-mode rows: seed 2 default rows on toggle-ON, clear on toggle-OFF */
  useEffect(() => {
    if (isSplitMode) {
      const defaultMethod: PayMethod = enabledMethods.cash
        ? 'cash'
        : enabledMethods.bbvaCard
          ? 'card'
          : 'rappi';
      dispatchSplitRows({
        type: 'RESET_ROWS',
        rows: [makeDefaultSplitRow(defaultMethod), makeDefaultSplitRow(defaultMethod)],
      });
    } else {
      dispatchSplitRows({ type: 'RESET_ROWS', rows: [] });
    }
  }, [isSplitMode, enabledMethods.cash, enabledMethods.bbvaCard]);

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
  const discountBase = useMemo(
    () => getDiscountBase(itemsSubtotal, poolChargesTotal, discountScope),
    [itemsSubtotal, poolChargesTotal, discountScope]
  );
  const discountAmount = useMemo(
    () => calculateDiscountAmount(discountBase, discountType, discountValue),
    [discountBase, discountType, discountValue]
  );
  const afterDiscount = Math.round((baseSubtotal - discountAmount) * 100) / 100;
  const taxAmount = useMemo(() => {
    if (method === 'rappi') return 0;
    return Math.round(afterDiscount * (taxRatePercent / 100) * 100) / 100;
  }, [afterDiscount, method, taxRatePercent]);
  const subtotalWithTax = Math.round((afterDiscount + taxAmount) * 100) / 100;
  const tipAmount = useMemo(() => {
    if (method === 'rappi') return 0;
    if (tipMode === 'custom') return Math.max(0, customTip);
    return Math.round(subtotalWithTax * (selectedTipPercent / 100) * 100) / 100;
  }, [customTip, method, selectedTipPercent, subtotalWithTax, tipMode]);
  const runningTotal = Math.round((subtotalWithTax + tipAmount) * 100) / 100;
  const changeDue = Math.max(0, Math.round((tenderedAmount - runningTotal) * 100) / 100);
  const effectiveCardAmount = cardChargeOverride ?? runningTotal;

  const canSubmitCash = tenderedAmount >= runningTotal && runningTotal > 0;
  const canSubmitCard = effectiveCardAmount > 0;
  const canSubmit =
    staffId.length > 0 &&
    (method !== 'cash' || canSubmitCash) &&
    (method !== 'card' || canSubmitCard);

  const splitRowsSum = useMemo(
    () => Math.round(splitRows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
    [splitRows]
  );
  const splitRemaining = Math.round((subtotalWithTax - splitRowsSum) * 100) / 100;

  const perRowMethodValid = (row: SplitRow): boolean => {
    if (row.method === 'cash') {
      return row.tenderedAmount >= Math.round((row.amount + row.tip) * 100) / 100;
    }
    return true;
  };

  const canSubmitSplit =
    staffId.length > 0 &&
    isSplitMode &&
    splitRows.length >= 2 &&
    splitRows.length <= 4 &&
    splitRows.every(r => r.amount > 0) &&
    Math.abs(splitRowsSum - subtotalWithTax) <= 0.01 &&
    splitRows.every(perRowMethodValid);

  const groupedItems = useMemo(() => groupOrderItems(tab.items), [tab.items]);

  const runPayment = async (): Promise<
    Result<{ receiptData: ReceiptData }, { message: string }>
  > => {
    if (!staffId) {
      return { ok: false, error: { message: 'Not signed in.' } };
    }

    const discountInfoArg =
      discountAmount > 0
        ? { scope: discountScope, type: discountType, value: discountValue, amount: discountAmount }
        : undefined;

    if (method === 'cash') {
      const r = await processors.processCashPayment(
        tab.id,
        afterDiscount,
        tipAmount,
        tenderedAmount,
        discountInfoArg
      );
      if (!r.ok) return { ok: false, error: { message: r.error.message } };
      return { ok: true, data: { receiptData: r.data.receiptData } };
    }

    if (method === 'card') {
      const ref = cardReference.trim();
      const chargeAmount = cardChargeOverride ?? afterDiscount;
      const chargeTip = cardChargeOverride !== null ? 0 : tipAmount;
      const r = await processors.processCardPayment(
        tab.id,
        chargeAmount,
        chargeTip,
        ref.length > 0 ? ref : undefined,
        discountInfoArg
      );
      if (!r.ok) return { ok: false, error: { message: r.error.message } };
      return { ok: true, data: { receiptData: r.data.receiptData } };
    }

    if (!tab.rappiOrderId) {
      return { ok: false, error: { message: 'Missing Rappi order id.' } };
    }
    const r = await processors.processRappiPayment(
      tab.id,
      afterDiscount,
      tab.rappiOrderId,
      discountInfoArg
    );
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

  const handleSplitPrimary = async () => {
    setErrorMessage(null);
    setIsProcessing(true);

    const discountInfoArg =
      discountAmount > 0
        ? { scope: discountScope, type: discountType, value: discountValue, amount: discountAmount }
        : undefined;

    const legs: SplitPaymentLegInput[] = splitRows.map(row => ({
      method: row.method,
      amount: row.amount,
      tipAmount: row.method === 'rappi' ? 0 : row.tip,
      ...(row.method === 'cash' ? { tenderedAmount: row.tenderedAmount } : {}),
      ...(row.method === 'card' && row.cardReference.trim().length > 0
        ? { referenceNumber: row.cardReference.trim() }
        : {}),
      ...(row.method === 'rappi' && tab.rappiOrderId ? { rappiOrderId: tab.rappiOrderId } : {}),
    }));

    const result = await processors.processSplitPayment(
      tab.id,
      legs,
      subtotalWithTax,
      discountInfoArg
    );
    setIsProcessing(false);

    if (!result.ok) {
      setErrorMessage('Split payment failed — please review each row and try again.');
      logger.warn('payment.split_failed', { tabId: tab.id, code: 'client' });
      return;
    }

    logger.info('payment.split_succeeded', { tabId: tab.id, legCount: legs.length });
    setReceiptQueue(result.data.receipts);
    setReceiptIndex(0);
    setStep('receipt');
    onPaymentSuccess();

    void (async () => {
      const logHardwareFail = (event: string, message: string) => {
        logger.warn(event, { tabId: tab.id, message });
        toast.error(message);
      };
      try {
        if (legs.some(l => l.method === 'cash')) {
          const drawer = await openCashDrawer();
          if (!drawer.ok) logHardwareFail('cash_drawer.failed', drawer.error.message);
        }
        for (const receipt of result.data.receipts) {
          const printed = await printReceipt(receipt);
          if (!printed.ok) logHardwareFail('printer.receipt.failed', printed.error.message);
        }
      } catch (e) {
        logger.warn('printer.post_payment.exception', { tabId: tab.id, raw: String(e) });
        toast.error('Print or drawer failed unexpectedly.');
      }
    })();
  };

  const primaryLabel = isSplitMode
    ? 'Process split payment'
    : method === 'card'
      ? 'Confirm card payment'
      : method === 'rappi'
        ? 'Confirm & close tab'
        : 'Process payment';

  const activeSplitReceipt =
    isSplitMode && receiptQueue.length > 0 ? (receiptQueue[receiptIndex] ?? null) : null;

  if (step === 'receipt' && activeSplitReceipt) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden p-4 sm:px-6">
        <p className="mb-2 text-sm font-semibold">
          {`Receipt ${String(receiptIndex + 1)} of ${String(receiptQueue.length)} — ${paymentLabels[activeSplitReceipt.paymentMethod]}`}
        </p>
        <ReceiptPreview
          receipt={activeSplitReceipt}
          onDone={() => {
            if (receiptIndex + 1 < receiptQueue.length) {
              setReceiptIndex(receiptIndex + 1);
            } else {
              onClose?.();
            }
          }}
        />
      </div>
    );
  }

  if (step === 'receipt' && receiptData) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden p-4 sm:px-6">
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
      <ScrollArea className="flex-1 p-4 sm:px-6">
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

          {method !== 'rappi' && (
            <section className="space-y-3" data-testid="discount-section">
              <h4 className="font-medium">Discount</h4>
              <div className="space-y-2">
                <div className="flex gap-2">
                  {(['all', 'pool_only', 'consumptions_only'] as const).map(scope => (
                    <POSButton
                      key={scope}
                      type="button"
                      touchSize="large"
                      variant={discountScope === scope ? 'default' : 'outline'}
                      disabled={isProcessing}
                      data-testid={`discount-scope-${scope}`}
                      onClick={() => {
                        setDiscountScope(scope);
                      }}
                      className="flex-1 text-xs"
                    >
                      {scope === 'all'
                        ? 'All Items'
                        : scope === 'pool_only'
                          ? 'Pool Only'
                          : 'Consumptions'}
                    </POSButton>
                  ))}
                </div>
                <div className="flex gap-2">
                  {(['percent', 'fixed'] as const).map(type => (
                    <POSButton
                      key={type}
                      type="button"
                      touchSize="large"
                      variant={discountType === type ? 'default' : 'outline'}
                      disabled={isProcessing}
                      data-testid={`discount-type-${type}`}
                      onClick={() => {
                        setDiscountType(type);
                      }}
                      className="flex-1"
                    >
                      {type === 'percent' ? '% Percent' : '$ Fixed'}
                    </POSButton>
                  ))}
                </div>
                <MoneyInput
                  label={discountType === 'percent' ? 'Discount %' : 'Discount amount'}
                  value={discountValue}
                  onChange={setDiscountValue}
                  disabled={isProcessing}
                  data-testid="discount-value-input"
                />
                {discountAmount > 0 && (
                  <p className="text-sm text-green-400" data-testid="discount-applied-label">
                    ✓ Discount applied: -{discountAmount.toFixed(2)}
                  </p>
                )}
              </div>
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
            {discountAmount > 0 && (
              <>
                <div
                  className="flex items-center justify-between text-sm text-green-400"
                  data-testid="discount-row"
                >
                  <span>
                    Discount ({discountType === 'percent' ? `${String(discountValue)}%` : 'fixed'})
                  </span>
                  <span>
                    -<MoneyDisplay amount={discountAmount} size="sm" />
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>After discount</span>
                  <MoneyDisplay amount={afterDiscount} size="sm" />
                </div>
              </>
            )}
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

            <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <Label htmlFor="split-mode-toggle" className="text-sm font-semibold">
                  Split payment
                </Label>
                <p className="text-xs text-muted-foreground">
                  Divide this total across up to 4 payment methods
                </p>
              </div>
              <Switch
                id="split-mode-toggle"
                checked={isSplitMode}
                disabled={isProcessing}
                onCheckedChange={setIsSplitMode}
              />
            </div>

            {isSplitMode ? (
              <div className="space-y-3">
                {splitRows.map((row, index) => (
                  <div key={row.id} className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{`Payment ${String(index + 1)}`}</span>
                      {splitRows.length > 2 && (
                        <POSButton
                          type="button"
                          variant="ghost"
                          touchSize="xl"
                          focusEmphasis="high"
                          aria-label={`Remove payment ${String(index + 1)}`}
                          disabled={isProcessing}
                          className="px-2 text-destructive"
                          onClick={() => {
                            dispatchSplitRows({ type: 'REMOVE_ROW', rowId: row.id });
                          }}
                        >
                          <Trash2 className="size-4" />
                        </POSButton>
                      )}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      {enabledMethods.cash && (
                        <POSButton
                          type="button"
                          touchSize="large"
                          variant={row.method === 'cash' ? 'default' : 'outline'}
                          disabled={isProcessing}
                          onClick={() => {
                            dispatchSplitRows({ type: 'SET_METHOD', rowId: row.id, method: 'cash' });
                          }}
                        >
                          {paymentLabels.cash}
                        </POSButton>
                      )}
                      {enabledMethods.bbvaCard && (
                        <POSButton
                          type="button"
                          touchSize="large"
                          variant={row.method === 'card' ? 'default' : 'outline'}
                          disabled={isProcessing}
                          onClick={() => {
                            dispatchSplitRows({ type: 'SET_METHOD', rowId: row.id, method: 'card' });
                          }}
                        >
                          {paymentLabels.card}
                        </POSButton>
                      )}
                      {isRappiTab && enabledMethods.rappi && (
                        <POSButton
                          type="button"
                          touchSize="large"
                          variant={row.method === 'rappi' ? 'default' : 'outline'}
                          disabled={isProcessing}
                          onClick={() => {
                            dispatchSplitRows({ type: 'SET_METHOD', rowId: row.id, method: 'rappi' });
                          }}
                        >
                          {paymentLabels.rappi}
                        </POSButton>
                      )}
                    </div>

                    <MoneyInput
                      label="Amount"
                      value={row.amount}
                      onChange={value => {
                        dispatchSplitRows({ type: 'SET_AMOUNT', rowId: row.id, value });
                      }}
                      disabled={isProcessing}
                    />

                    {row.method !== 'rappi' && (
                      <MoneyInput
                        label="Tip"
                        value={row.tip}
                        onChange={value => {
                          dispatchSplitRows({ type: 'SET_TIP', rowId: row.id, value });
                        }}
                        disabled={isProcessing}
                      />
                    )}

                    {row.method === 'cash' && (
                      <>
                        <MoneyInput
                          label="Amount tendered"
                          value={row.tenderedAmount}
                          onChange={value => {
                            dispatchSplitRows({ type: 'SET_TENDERED', rowId: row.id, value });
                          }}
                          disabled={isProcessing}
                        />
                        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                          <span>Change due</span>
                          <MoneyDisplay
                            amount={Math.max(
                              0,
                              Math.round((row.tenderedAmount - (row.amount + row.tip)) * 100) / 100
                            )}
                            size="sm"
                          />
                        </div>
                      </>
                    )}

                    {row.method === 'card' && (
                      <div className="space-y-2">
                        <Label htmlFor={`split-card-ref-${row.id}`}>Reference # (optional)</Label>
                        <Input
                          id={`split-card-ref-${row.id}`}
                          value={row.cardReference}
                          onChange={e => {
                            dispatchSplitRows({
                              type: 'SET_CARD_REF',
                              rowId: row.id,
                              value: e.target.value,
                            });
                          }}
                          placeholder="Terminal receipt / auth code"
                          maxLength={64}
                          disabled={isProcessing}
                          autoComplete="off"
                        />
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {`Charges: $${(row.amount + row.tip).toFixed(2)}`}
                    </p>
                  </div>
                ))}

                <POSButton
                  type="button"
                  variant="outline"
                  disabled={isProcessing || splitRows.length >= 4}
                  onClick={() => {
                    const defaultMethod: PayMethod = enabledMethods.cash
                      ? 'cash'
                      : enabledMethods.bbvaCard
                        ? 'card'
                        : 'rappi';
                    dispatchSplitRows({ type: 'ADD_ROW', defaultMethod });
                  }}
                >
                  + Add payment method
                </POSButton>

                <div
                  className={`rounded-lg border p-3 ${
                    splitRemaining === 0 ? 'border-[var(--pos-accent)]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>
                      {splitRemaining > 0
                        ? 'Remaining to pay'
                        : splitRemaining === 0
                          ? 'Fully allocated ✓'
                          : `Over by $${Math.abs(splitRemaining).toFixed(2)}`}
                    </span>
                    {splitRemaining >= 0 && <MoneyDisplay amount={splitRemaining} size="sm" />}
                  </div>
                </div>
              </div>
            ) : (
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
            )}
          </section>

          {!isSplitMode && method === 'cash' && (
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

          {!isSplitMode && method === 'card' && (
            <section className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Process payment on BBVA Terminal</p>
              <MoneyInput
                label="Charge amount"
                value={effectiveCardAmount}
                onChange={setCardChargeOverride}
                disabled={isProcessing}
              />
              {cardChargeOverride !== null && (
                <POSButton
                  type="button"
                  variant="ghost"
                  touchSize="default"
                  data-testid="card-override-reset"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => {
                    setCardChargeOverride(null);
                  }}
                >
                  Reset to computed (${runningTotal.toFixed(2)})
                </POSButton>
              )}
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
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="space-y-2 border-t px-4 py-3 sm:px-6 sm:py-4">
        <ProtectedAction
          action="close_tab"
          currentRole={currentRole}
          disabled={isProcessing || (isSplitMode ? !canSubmitSplit : !canSubmit)}
        >
          <POSButton
            type="button"
            touchSize="xl"
            focusEmphasis="high"
            disabled={isProcessing || (isSplitMode ? !canSubmitSplit : !canSubmit)}
            className="w-full bg-[var(--pos-accent)] text-black hover:opacity-90"
            onClick={() => {
              if (isSplitMode) {
                void handleSplitPrimary();
              } else {
                void handlePrimary();
              }
            }}
          >
            {isProcessing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
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
