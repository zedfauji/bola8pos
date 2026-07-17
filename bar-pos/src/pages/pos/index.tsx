import { useQueryClient } from '@tanstack/react-query';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LowStockAlert } from '@widgets/LowStockAlert';
import { ActiveTabSelector, CartPanel } from '@widgets/OrderPanel';
import { ProductGrid } from '@widgets/OrderPanel/ProductGrid';
import { PaymentModal } from '@widgets/PaymentModal';
import { TabDrawer } from '@widgets/TabDrawer';
import { useLookupProductByBarcode } from '@features/lookup-product-by-barcode';
import { useStaffStore } from '@entities/staff/model/store';
import { useCartStore } from '@entities/tab/model/cartStore';
import { tabKeys, useTab } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import type { Tab } from '@entities/tab/model/types';
import { useBarcodeScanner } from '@shared/lib/useBarcodeScanner';
import { usePersistedBool } from '@shared/lib/usePersistedBool';
import { PageContainer, POSButton, ProtectedAction } from '@shared/ui';

export default function POSPage() {
  const queryClient = useQueryClient();
  const activeTabId = useTabStore(s => s.activeTabId);
  const currentStaff = useStaffStore(s => s.currentStaff);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentTab, setPaymentTab] = useState<Tab | null>(null);
  const { data: tab } = useTab(activeTabId ?? '');
  const hasItems = (tab?.items.length ?? 0) > 0;
  const [orderPanelCollapsed, setOrderPanelCollapsed] = usePersistedBool(
    'pos_order_panel_collapsed',
    false
  );
  const addToCart = useCartStore(s => s.addItem);
  const { lookup } = useLookupProductByBarcode();

  useBarcodeScanner({
    onScan: code => {
      void lookup(code).then(product => {
        if (!product) {
          toast.error(`No product found for barcode ${code}`);
          return;
        }
        addToCart(product, [], undefined);
        toast.success(`Added ${product.name}`);
      });
    },
  });

  return (
    <PageContainer
      title="POS"
      backTo="/home"
      className="mx-0 flex h-screen max-w-none flex-col space-y-0 bg-background p-0"
    >
      <div className="flex min-w-0 flex-1 items-center justify-center p-4 md:p-6">
        <div className="flex size-full max-w-[1600px] overflow-hidden rounded-xl border border-border shadow-lg">
          <main className="relative flex-1 overflow-y-auto p-4">
            <POSButton
              type="button"
              variant="ghost"
              touchSize="default"
              data-testid="pos-order-panel-toggle"
              aria-label={orderPanelCollapsed ? 'Show order panel' : 'Hide order panel'}
              aria-pressed={orderPanelCollapsed}
              onClick={() => {
                setOrderPanelCollapsed(prev => !prev);
              }}
              className="absolute right-3 top-3 z-10 flex w-11 items-center justify-center rounded-md border bg-background/80 shadow-sm hover:bg-accent"
            >
              {orderPanelCollapsed ? (
                <PanelRightOpen className="size-4" />
              ) : (
                <PanelRightClose className="size-4" />
              )}
            </POSButton>
            <LowStockAlert />
            <ProductGrid />
          </main>
          {!orderPanelCollapsed && (
            <aside
              id="order-panel"
              data-testid="pos-order-panel"
              className="flex w-[400px] min-w-0 flex-col border-l bg-background"
            >
              <ActiveTabSelector />
              <CartPanel />
              {activeTabId && hasItems && (
                <div className="border-t p-3">
                  <ProtectedAction action="close_tab" currentRole={currentStaff?.role}>
                    <POSButton
                      touchSize="large"
                      variant="default"
                      className="w-full"
                      onClick={() => {
                        setPaymentTab(tab ?? null);
                        setPaymentOpen(true);
                      }}
                      aria-label={`Close tab and process payment for ${tab?.customerName ?? 'customer'}`}
                    >
                      Close Tab / Pay
                    </POSButton>
                  </ProtectedAction>
                </div>
              )}
            </aside>
          )}
          <TabDrawer />
        </div>
      </div>
      {paymentOpen && paymentTab && (
        <PaymentModal
          open={paymentOpen}
          tab={paymentTab}
          staffId={currentStaff?.id ?? ''}
          onClose={() => {
            setPaymentOpen(false);
            setPaymentTab(null);
          }}
          onPaymentSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: tabKeys.detail(paymentTab.id) });
            void queryClient.invalidateQueries({ queryKey: tabKeys.lists() });
          }}
        />
      )}
    </PageContainer>
  );
}
