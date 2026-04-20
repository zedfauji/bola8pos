import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { PaymentForm } from '@widgets/PaymentModal';
import { ManagerPinDialog } from '@features/manager-pin-gate';
import { useStaffStore } from '@entities/staff/model/store';
import type { Tab } from '@entities/tab/model/types';
import { POSButton } from '@shared/ui';
import { TabPaymentList } from './TabPaymentList';

export function PaymentPane() {
  const currentStaff = useStaffStore(s => s.currentStaff);

  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);

  function handleSelectTab(tab: Tab) {
    setSelectedTab(tab);
    setPinVerified(false);
  }

  function handleClearSelection() {
    setSelectedTab(null);
    setPinVerified(false);
  }

  function handlePaymentSuccess() {
    setSelectedTab(null);
    setPinVerified(false);
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel — tab list */}
      <div className="flex w-80 shrink-0 flex-col border-r bg-background">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Tabs Awaiting Payment
          </h2>
        </div>
        <TabPaymentList selectedTabId={selectedTab?.id} onSelect={handleSelectTab} />
      </div>

      {/* Right panel — payment area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedTab == null ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-center text-muted-foreground">
              Select a tab from the list to process payment.
            </p>
          </div>
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
                <ArrowLeft className="h-4 w-4" />
              </POSButton>
              <h2 className="font-semibold">{selectedTab.customerName}</h2>
            </div>

            {/* Active pool session warning — payment blocked */}
            {selectedTab.hasActivePoolSession ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="max-w-sm rounded-lg border border-amber-500/40 bg-amber-500/10 p-6 text-center">
                  <AlertTriangle
                    className="mx-auto mb-3 h-8 w-8 text-amber-500"
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
    </div>
  );
}
