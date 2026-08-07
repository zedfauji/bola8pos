import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PaymentForm } from '@widgets/PaymentModal';
import { EditPaidTabDialog } from '@features/edit-paid-tab';
import { ManagerPinDialog } from '@features/manager-pin-gate';
import { RefundSheet } from '@features/process-refund';
import { ReopenTabDialog } from '@features/reopen-tab';
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
  const { t } = useTranslation('wPanels');
  const { data: refunds } = useRefundsByPayment(payment.id);
  const refundedTotal = (refunds ?? []).reduce((sum, r) => sum + r.amount, 0);
  const isFullyRefunded = refundedTotal >= payment.amount;

  if (payment.isRefund === true || payment.status === 'reopened_void' || isFullyRefunded) return null;

  return (
    <POSButton
      variant="destructive"
      size="sm"
      onClick={() => {
        onRefund(payment.id);
      }}
    >
      {t('paymentPane.refund')}
    </POSButton>
  );
}

interface EditTicketButtonProps {
  payment: Payment;
  onEdit: (tabId: string) => void;
}

function EditTicketButton({ payment, onEdit }: EditTicketButtonProps) {
  const { t } = useTranslation('wPanels');

  if (payment.isRefund === true || payment.status === 'reopened_void') return null;

  return (
    <POSButton
      variant="outline"
      size="sm"
      onClick={() => {
        onEdit(payment.tabId);
      }}
    >
      {t('paymentPane.editTicket')}
    </POSButton>
  );
}

interface ReopenTabButtonProps {
  payment: Payment;
  onReopen: (tabId: string) => void;
}

function ReopenTabButton({ payment, onReopen }: ReopenTabButtonProps) {
  const { t } = useTranslation('wPanels');

  if (payment.isRefund === true) return null;
  if (payment.status === 'reopened_void') return null;

  return (
    <POSButton
      variant="outline"
      size="sm"
      onClick={() => {
        onReopen(payment.tabId);
      }}
    >
      {t('paymentPane.reopenTab')}
    </POSButton>
  );
}

function PaymentHistoryList({
  onRefund,
  onEdit,
  onReopen,
}: {
  onRefund: (paymentId: string) => void;
  onEdit: (tabId: string) => void;
  onReopen: (tabId: string) => void;
}) {
  const { t } = useTranslation('wPanels');
  const { data: payments, isLoading } = usePayments();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">{t('paymentPane.loadingPayments')}</p>
      </div>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-center text-muted-foreground">{t('paymentPane.noPaymentRecords')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('paymentPane.recentPayments')}
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
                {t('paymentPane.methodDateSeparator', {
                  method: payment.method,
                  date: payment.processedAt.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  }),
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <EditTicketButton payment={payment} onEdit={onEdit} />
              <ReopenTabButton payment={payment} onReopen={onReopen} />
              <RefundButton payment={payment} onRefund={onRefund} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PaymentPane() {
  const { t } = useTranslation('wPanels');
  const currentStaff = useStaffStore(s => s.currentStaff);
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [refundTarget, setRefundTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [reopenTarget, setReopenTarget] = useState<string | null>(null);

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
            {t('paymentPane.tabsAwaitingPayment')}
          </h2>
        </div>
        <TabPaymentList selectedTabId={selectedTab?.id} onSelect={handleSelectTab} />
      </div>

      {/* Right panel — payment area or payment history */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedTab == null ? (
          <PaymentHistoryList
            onRefund={setRefundTarget}
            onEdit={setEditTarget}
            onReopen={setReopenTarget}
          />
        ) : (
          <>
            {/* Right panel header */}
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <POSButton
                type="button"
                variant="ghost"
                onClick={handleClearSelection}
                aria-label={t('paymentPane.backToTabListAriaLabel')}
              >
                <ArrowLeft className="size-4" />
              </POSButton>
              <h2 className="font-semibold">{selectedTab.customerName}</h2>
            </div>

            {/* Active pool session warning — payment blocked */}
            {selectedTab.hasActivePoolSession ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="max-w-sm rounded-lg border border-pos-warning/40 bg-pos-warning/10 p-6 text-center">
                  <AlertTriangle
                    className="mx-auto mb-3 size-8 text-pos-warning"
                    aria-hidden="true"
                  />
                  <h3 className="mb-1 font-semibold text-pos-warning">
                    {t('paymentPane.timerStillRunningTitle')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('paymentPane.stopTimerBeforePayment')}{' '}
                    <span className="font-medium text-foreground">
                      {t('paymentPane.poolTablesLinkLabel')}
                    </span>{' '}
                    {t('paymentPane.toEndSessionFirst')}
                  </p>
                </div>
              </div>
            ) : !pinVerified ? (
              /* PIN verification prompt */
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="flex flex-col items-center gap-4">
                  <p className="text-muted-foreground">{t('paymentPane.pinRequired')}</p>
                  <POSButton
                    type="button"
                    touchSize="large"
                    onClick={() => {
                      setShowPinDialog(true);
                    }}
                  >
                    {t('paymentPane.verifyPinToProcessPayment')}
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

      {/* Edit paid ticket dialog — opened from payment history rows */}
      <EditPaidTabDialog
        open={editTarget !== null}
        tabId={editTarget}
        onOpenChange={open => {
          if (!open) setEditTarget(null);
        }}
      />

      {/* Reopen tab dialog — opened from payment history rows */}
      <ReopenTabDialog
        open={reopenTarget !== null}
        tabId={reopenTarget}
        onOpenChange={open => {
          if (!open) setReopenTarget(null);
        }}
      />
    </div>
  );
}
