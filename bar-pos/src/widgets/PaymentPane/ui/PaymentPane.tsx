import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { PaymentForm } from '@widgets/PaymentModal';
import { ManagerPinDialog } from '@features/manager-pin-gate';
import { RefundSheet } from '@features/process-refund';
import type { Payment } from '@entities/payment';
import { usePayments } from '@entities/payment';
import { useRefundsByPayment } from '@entities/refund';
import { useStaffStore } from '@entities/staff/model/store';
import { tabKeys } from '@entities/tab/model/queries';
import type { Tab } from '@entities/tab/model/types';
import { POSButton } from '@shared/ui';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { TabPaymentList } from './TabPaymentList';

interface RefundButtonProps {
  payment: Payment;
  onRefund: (paymentId: string) => void;
}

function RefundButton({ payment, onRefund }: RefundButtonProps) {
  const { data: refunds } = useRefundsByPayment(payment.id);
  const refundedTotal = (refunds ?? []).reduce((sum, r) => sum + r.amount, 0);
  const isFullyRefunded = refundedTotal >= payment.amount;

  if (payment.isRefund === true || isFullyRefunded) return null;

  return (
    <POSButton
      variant="destructive"
      size="sm"
      onClick={() => {
        onRefund(payment.id);
      }}
    >
      Refund
    </POSButton>
  );
}

function PaymentHistoryList({ onRefund }: { onRefund: (paymentId: string) => void }) {
  const { data: payments, isLoading } = usePayments();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading payments…</p>
      </div>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-center text-muted-foreground">No payment records found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Recent Payments
        </h2>
      </div>
      <div className="divide-y">
        {payments.map(payment => (
          <div
            key={payment.id}
            data-testid={`payment-row-${payment.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/30"
          >
            <div className="flex flex-col gap-0.5">
              <MoneyDisplay amount={payment.amount} size="sm" />
              <span className="text-xs text-muted-foreground capitalize">
                {payment.method} · {payment.processedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <RefundButton payment={payment} onRefund={onRefund} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PaymentPane() {
  const currentStaff = useStaffStore(s => s.currentStaff);
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [refundTarget, setRefundTarget] = useState<string | null>(null);

  function handleSelectTab(tab: Tab) {
    setSelectedTab(tab);
    setPinVerified(false);
  }

  function handleClearSelection() {
    setSelectedTab(null);
    setPinVerified(false);
  }

  /**
   * Called immediately when payment succeeds — invalidates the tabs query so the
   * left-panel list refreshes, but does NOT clear the selected tab yet (receipt is
   * still visible). Selection is cleared by handlePaymentClose after receipt is dismissed.
   */
  function handlePaymentSuccess() {
    void queryClient.invalidateQueries({ queryKey: tabKeys.all });
  }

  /** Called when the user clicks Done on the receipt — clears the selected tab. */
  function handlePaymentClose() {
    setSelectedTab(null);
    setPinVerified(false);
  }

  return (
    <div className="flex size-full overflow-hidden">
      {/* Left panel — tab list */}
      <div className="flex w-80 shrink-0 flex-col border-r bg-background">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Tabs Awaiting Payment
          </h2>
        </div>
        <TabPaymentList selectedTabId={selectedTab?.id} onSelect={handleSelectTab} />
      </div>

      {/* Right panel — payment area or payment history */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedTab == null ? (
          <PaymentHistoryList onRefund={setRefundTarget} />
        ) : (
          <>
            {/* Right panel header */}
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <POSButton
                type="button"
                variant="ghost"
                onClick={handleClearSelection}
                aria-label="Back to tab list"
              >
                <ArrowLeft className="size-4" />
              </POSButton>
              <h2 className="font-semibold">{selectedTab.customerName}</h2>
            </div>

            {/* Active pool session warning — payment blocked */}
            {selectedTab.hasActivePoolSession ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="max-w-sm rounded-lg border border-amber-500/40 bg-amber-500/10 p-6 text-center">
                  <AlertTriangle
                    className="mx-auto mb-3 size-8 text-amber-500"
                    aria-hidden="true"
                  />
                  <h3 className="mb-1 font-semibold text-amber-600 dark:text-amber-400">
                    Timer Still Running
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Stop the pool timer before processing payment. Go to{' '}
                    <span className="font-medium text-foreground">Pool Tables</span> to end the
                    session first.
                  </p>
                </div>
              </div>
            ) : !pinVerified ? (
              /* PIN verification prompt */
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="flex flex-col items-center gap-4">
                  <p className="text-muted-foreground">PIN required to process payment.</p>
                  <POSButton
                    type="button"
                    touchSize="large"
                    onClick={() => {
                      setShowPinDialog(true);
                    }}
                  >
                    Verify PIN to Process Payment
                  </POSButton>
                </div>
              </div>
            ) : (
              /* Payment form */
              <div className="flex flex-1 flex-col overflow-hidden">
                <PaymentForm
                  tab={selectedTab}
                  staffId={currentStaff?.id ?? ''}
                  onPaymentSuccess={handlePaymentSuccess}
                  onClose={handlePaymentClose}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* PIN gate dialog */}
      <ManagerPinDialog
        open={showPinDialog}
        onOpenChange={open => {
          setShowPinDialog(open);
        }}
        requiredAction="close_tab"
        onSuccess={() => {
          setPinVerified(true);
          setShowPinDialog(false);
        }}
      />

      {/* Refund sheet — opened from payment history rows */}
      <RefundSheet
        open={refundTarget !== null}
        paymentId={refundTarget}
        onOpenChange={open => {
          if (!open) setRefundTarget(null);
        }}
      />
    </div>
  );
}
