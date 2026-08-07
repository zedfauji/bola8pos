import { ArrowLeftRight, Loader2, Plus, RefreshCw, SplitSquareHorizontal, User } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenTabDialog } from '@features/open-tab/ui/OpenTabDialog';
import { SplitTabSheet } from '@features/split-tab';
import { TransferTabDialog } from '@features/transfer-tab';
import { VoidOrderDialog } from '@features/void-order';
import { usePermissions, useStaffStore } from '@entities/staff';
import { useTabs, useTab } from '@entities/tab/model/queries';
import { selectTabById, useTabStore } from '@entities/tab/model/store';
import type { Order } from '@entities/tab/model/types';
import { POSButton } from '@shared/ui/POSButton';
import { ProtectedAction } from '@shared/ui/ProtectedAction';
import { Badge } from '@shared/ui/badge';
import { SubChecksSection } from './SubChecksSection';

export interface ActiveTabSelectorProps {
  /** Defaults to opening the tab drawer. */
  onSwitchTab?: () => void;
}

export function ActiveTabSelector({ onSwitchTab }: ActiveTabSelectorProps) {
  const { t } = useTranslation('wPanels');
  const activeTabId = useTabStore(s => s.activeTabId);
  const openDrawer = useTabStore(s => s.openDrawer);
  const currentStaff = useStaffStore(state => state.currentStaff);
  const [openTabDialogOpen, setOpenTabDialogOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [orderToVoid, setOrderToVoid] = useState<Order | null>(null);
  const [splitSheetOpen, setSplitSheetOpen] = useState(false);
  const { can } = usePermissions();

  const { data: tabList } = useTabs();
  const openTabCount = tabList?.length ?? 0;

  const { data: fetchedTab, isIdleOrLoading: tabLoading } = useTab(activeTabId ?? '');
  const tabFromStore = activeTabId ? selectTabById(activeTabId) : undefined;
  const currentTab = fetchedTab ?? tabFromStore;

  const handleSwitchTab = () => {
    if (onSwitchTab) {
      onSwitchTab();
    } else {
      openDrawer();
    }
  };

  return (
    <>
      <div className="border-b bg-card p-4">
        {activeTabId ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {tabLoading && !currentTab ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
                  ) : (
                    <h3 className="truncate font-semibold">
                      {currentTab?.customerName ?? t('activeTabSelector.defaultTabName')}
                    </h3>
                  )}
                  {currentTab?.tableNumber != null && (
                    <Badge variant="secondary" className="shrink-0 font-mono">
                      {t('activeTabSelector.tableLabel', { number: String(currentTab.tableNumber) })}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <POSButton
                type="button"
                variant="outline"
                touchSize="large"
                className="flex-1"
                onClick={handleSwitchTab}
              >
                <RefreshCw className="mr-1 size-4" />
                {t('activeTabSelector.switchTab')}
                {openTabCount > 1 && (
                  <Badge variant="secondary" className="ml-2">
                    {openTabCount}
                  </Badge>
                )}
              </POSButton>
              {can('transfer_tab') && (
                <POSButton
                  type="button"
                  variant="outline"
                  touchSize="large"
                  size="icon"
                  onClick={() => {
                    setTransferOpen(true);
                  }}
                  aria-label={t('activeTabSelector.transferTabAriaLabel')}
                >
                  <ArrowLeftRight className="size-4" />
                </POSButton>
              )}
              <POSButton
                type="button"
                variant="outline"
                touchSize="large"
                onClick={() => {
                  setOpenTabDialogOpen(true);
                }}
                aria-label={t('activeTabSelector.newTabAriaLabel')}
              >
                <Plus className="mr-1 size-4" />
                {t('activeTabSelector.newTabButton')}
              </POSButton>
            </div>
            {currentTab && currentTab.status === 'open' && (
              <POSButton
                data-testid="split-bill-button"
                variant="outline"
                touchSize="large"
                className="w-full"
                onClick={() => {
                  setSplitSheetOpen(true);
                }}
                disabled={currentTab.items.length === 0}
                title={
                  currentTab.items.length === 0
                    ? t('activeTabSelector.splitBillDisabledTitle')
                    : undefined
                }
                aria-label={t('activeTabSelector.splitBillAriaLabel')}
              >
                <SplitSquareHorizontal className="mr-2 size-4" />
                {t('activeTabSelector.splitBillAriaLabel')}
              </POSButton>
            )}
            {currentTab?.status === 'split' && currentTab.id && (
              <SubChecksSection parentTabId={currentTab.id} />
            )}
            {(currentTab?.orders.length ?? 0) > 0 && (
              <div className="space-y-2 border-t pt-2">
                <p className="text-xs text-muted-foreground">{t('activeTabSelector.orderHistory')}</p>
                <div className="space-y-1">
                  {[...(currentTab?.orders ?? [])]
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .map(order => (
                      <ProtectedAction
                        key={order.id}
                        action="void_order"
                        currentRole={currentStaff?.role}
                      >
                        <POSButton
                          type="button"
                          variant="destructive"
                          touchSize="large"
                          className="w-full justify-between"
                          onClick={() => {
                            setOrderToVoid(order);
                          }}
                        >
                          {t('activeTabSelector.voidOrder', {
                            time: order.createdAt.toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            }),
                          })}
                        </POSButton>
                      </ProtectedAction>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="space-y-3 rounded-lg border bg-muted/30 p-4"
            role="status"
            aria-live="polite"
          >
            <p className="text-center text-sm text-muted-foreground">
              {t('activeTabSelector.selectOrCreateTab')}
            </p>
            <div className="flex gap-3">
              <POSButton
                type="button"
                variant="outline"
                touchSize="large"
                className="flex-1"
                onClick={handleSwitchTab}
                disabled={openTabCount === 0}
              >
                <RefreshCw className="mr-1 size-4" />
                {t('activeTabSelector.switchTab')}
                {openTabCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {openTabCount}
                  </Badge>
                )}
              </POSButton>
              <POSButton
                type="button"
                touchSize="large"
                onClick={() => {
                  setOpenTabDialogOpen(true);
                }}
              >
                <Plus className="mr-1 size-4" />
                {t('activeTabSelector.newTabButton')}
              </POSButton>
            </div>
          </div>
        )}
      </div>

      <OpenTabDialog
        open={openTabDialogOpen}
        onClose={() => {
          setOpenTabDialogOpen(false);
        }}
      />
      <TransferTabDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        tab={currentTab ?? null}
      />
      {activeTabId && (
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
      )}
      {splitSheetOpen && currentTab && currentTab.items.length > 0 && (
        <SplitTabSheet
          open={splitSheetOpen}
          onClose={() => {
            setSplitSheetOpen(false);
          }}
          tab={currentTab}
          orderItems={currentTab.items}
        />
      )}
    </>
  );
}
