/**
 * ORDER PANEL WIDGET
 *
 * Right-side panel on POS page showing active tab's items + totals.
 * Displays tab contents, allows voiding, and opens payment modal.
 */

import { useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Receipt, ArrowLeftRight, SplitSquareHorizontal } from 'lucide-react';
import { useState } from 'react';
import { PaymentModal } from '@widgets/PaymentModal';
import { OpenTabButton } from '@features/open-tab/ui/OpenTabButton';
import { SplitTabSheet } from '@features/split-tab';
import { TransferTabDialog } from '@features/transfer-tab';
import { VoidOrderDialog } from '@features/void-order';
import { usePermissions } from '@entities/staff';
import { useStaffStore } from '@entities/staff/model/store';
import { tabKeys, useTab } from '@entities/tab/model/queries';
import { useSubTabs } from '@entities/tab';
import { useTabStore } from '@entities/tab/model/store';
import type { Order, OrderItem } from '@entities/tab/model/types';
import { EmptyState } from '@shared/ui/EmptyState';
import { LoadingSpinner } from '@shared/ui/LoadingSpinner';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { POSButton } from '@shared/ui/POSButton';
import { ProtectedAction } from '@shared/ui/ProtectedAction';
import { ScrollArea } from '@shared/ui/ScrollArea';
import { CartSummary } from './CartSummary';
import { OrderItemCard } from './OrderItemCard';

const TAX_RATE = 0.0825;

function calculateSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => {
    const lineTotal = (item.unitPrice + item.modifierPriceDelta) * item.quantity;
    return sum + lineTotal;
  }, 0);
}

interface SubChecksSectionProps {
  parentTabId: string;
}

function SubChecksSection({ parentTabId }: SubChecksSectionProps) {
  // useSubTabs returns a TanStack Query result: { data: Result<Tab[]> | undefined, isLoading, isError }
  // where Result<Tab[]> is { ok: true, data: Tab[] } | { ok: false, error: AppError }.
  // Access pattern: unwrap via result.data?.ok check.
  const queryResult = useSubTabs(parentTabId);
  const subTabs = queryResult.data?.ok ? queryResult.data.data : [];

  if (subTabs.length === 0) return null;

  return (
    <div className="border-t pt-4 mt-4 px-4">
      <p className="text-sm font-semibold mb-2">Sub-checks</p>
      {subTabs.map(sub => {
        const total = sub.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        return (
          <div
            key={sub.id}
            className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/40"
          >
            <span className="text-sm">{sub.splitLabel ?? `Check ${sub.id.slice(0, 4)}`}</span>
            <span
              className={`text-sm ${sub.status === 'paid' ? 'text-pos-accent' : 'text-muted-foreground'}`}
            >
              {sub.status}
            </span>
            <MoneyDisplay amount={total} size="sm" />
          </div>
        );
      })}
    </div>
  );
}

export function OrderPanel() {
  const queryClient = useQueryClient();
  const { activeTabId, openDrawer } = useTabStore();
  const currentStaff = useStaffStore(state => state.currentStaff);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [orderToVoid, setOrderToVoid] = useState<Order | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [splitSheetOpen, setSplitSheetOpen] = useState(false);
  const { can } = usePermissions();
  const { data: tab, isLoading } = useTab(activeTabId ?? '');

  // No tab selected — show prompt to open or select
  if (!activeTabId) {
    return (
      <div className="flex h-full flex-col">
        <div className="p-4 border-b">
          <p className="text-sm font-medium text-muted-foreground mb-3">No tab selected</p>
          <div className="flex gap-2">
            <POSButton
              variant="outline"
              className="flex-1"
              onClick={openDrawer}
              aria-label="Select existing tab"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Select Tab
            </POSButton>
            <OpenTabButton />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 bg-muted/20">
          <EmptyState
            icon={Receipt}
            title="No tab selected"
            description="Select or open a tab to begin"
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div role="region" aria-label="Order panel">
        <LoadingSpinner />
      </div>
    );
  }

  const items = tab?.items ?? [];
  const subtotal = calculateSubtotal(items);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  const sortedOrders = [...(tab?.orders ?? [])].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  return (
    <div className="flex flex-col h-full" role="region" aria-label="Order panel">
      {/* Tab Switcher Header */}
      <div className="p-4 border-b space-y-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-semibold truncate">{tab?.customerName ?? 'Tab'}</p>
            <p className="text-xs text-muted-foreground">
              {tab?.tableNumber != null ? `Table ${String(tab.tableNumber)}` : 'No table'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <POSButton
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={openDrawer}
            aria-label="Switch tab"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Switch Tab
          </POSButton>
          {can('transfer_tab') && (
            <POSButton
              variant="outline"
              size="sm"
              onClick={() => {
                setTransferOpen(true);
              }}
              aria-label="Transfer tab"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </POSButton>
          )}
          <POSButton variant="outline" size="sm" onClick={openDrawer} aria-label="Open new tab">
            <Plus className="h-4 w-4" />
          </POSButton>
        </div>
        {/* Split bill button — visible only when tab is open */}
        {tab?.status === 'open' && (
          <POSButton
            variant="outline"
            size="sm"
            onClick={() => {
              setSplitSheetOpen(true);
            }}
            disabled={items.length === 0}
            title={items.length === 0 ? 'Add items before splitting' : undefined}
            aria-label={`Split tab ${tab.customerName}`}
          >
            <SplitSquareHorizontal className="h-4 w-4 mr-2" />
            Split bill
          </POSButton>
        )}
      </div>

      {/* Order Items */}
      <ScrollArea className="flex-1 p-4">
        {items.length === 0 ? (
          <EmptyState icon={Receipt} title="No items" description="Add items to this tab" />
        ) : (
          <ul className="space-y-2" aria-label={`${String(items.length)} items in order`}>
            {items.map(item => (
              <li key={item.id}>
                <OrderItemCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      {/* Sub-checks section — shown when tab has been split */}
      {tab?.status === 'split' && tab.id && (
        <SubChecksSection parentTabId={tab.id} />
      )}

      {/* Summary */}
      {items.length > 0 && (
        <div className="p-4 border-t">
          <CartSummary subtotal={subtotal} tax={tax} total={total} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 p-4 border-t" role="group" aria-label="Tab actions">
        <ProtectedAction action="void_order" currentRole={currentStaff?.role}>
          <POSButton
            touchSize="large"
            variant="destructive"
            onClick={() => {
              const mostRecentOrder = sortedOrders[0] ?? null;
              setOrderToVoid(mostRecentOrder);
            }}
            disabled={sortedOrders.length === 0}
            aria-label="Void most recent order on this tab"
          >
            Void
          </POSButton>
        </ProtectedAction>
        <ProtectedAction action="close_tab" currentRole={currentStaff?.role}>
          <POSButton
            touchSize="large"
            variant="default"
            className="flex-1"
            onClick={() => {
              setPaymentOpen(true);
            }}
            disabled={items.length === 0}
            aria-label={`Close tab and process payment for ${tab?.customerName ?? 'customer'}`}
          >
            Close Tab / Pay
          </POSButton>
        </ProtectedAction>
      </div>

      {sortedOrders.length > 0 && (
        <div className="space-y-2 border-t px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Order history</p>
          <div className="space-y-2">
            {sortedOrders.map(order => (
              <ProtectedAction key={order.id} action="void_order" currentRole={currentStaff?.role}>
                <POSButton
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => {
                    setOrderToVoid(order);
                  }}
                >
                  <span>
                    Void{' '}
                    {order.createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </POSButton>
              </ProtectedAction>
            ))}
          </div>
        </div>
      )}

      {tab && (
        <PaymentModal
          open={paymentOpen}
          tab={tab}
          staffId={currentStaff?.id ?? ''}
          onClose={() => {
            setPaymentOpen(false);
          }}
          onPaymentSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: tabKeys.detail(tab.id) });
            void queryClient.invalidateQueries({ queryKey: tabKeys.lists() });
          }}
        />
      )}

      <VoidOrderDialog
        open={orderToVoid !== null}
        tabId={activeTabId}
        order={orderToVoid}
        onOpenChange={open => {
          if (!open) {
            setOrderToVoid(null);
          }
        }}
      />

      <TransferTabDialog open={transferOpen} onOpenChange={setTransferOpen} tab={tab ?? null} />

      {/* SplitTabSheet — opened when Split bill button is clicked */}
      {splitSheetOpen && tab && (
        <SplitTabSheet
          open={splitSheetOpen}
          onClose={() => {
            setSplitSheetOpen(false);
          }}
          tab={tab}
          orderItems={items}
        />
      )}
    </div>
  );
}
