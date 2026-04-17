import { Loader2, Plus, RefreshCw, User } from 'lucide-react';
import { useState } from 'react';
import { OpenTabDialog } from '@features/open-tab/ui/OpenTabDialog';
import { VoidOrderDialog } from '@features/void-order';
import { useStaffStore } from '@entities/staff/model/store';
import { useTabs, useTab } from '@entities/tab/model/queries';
import { selectTabById, useTabStore } from '@entities/tab/model/store';
import type { Order } from '@entities/tab/model/types';
import { ProtectedAction } from '@shared/ui/ProtectedAction';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';

export interface ActiveTabSelectorProps {
  /** Defaults to opening the tab drawer. */
  onSwitchTab?: () => void;
}

export function ActiveTabSelector({ onSwitchTab }: ActiveTabSelectorProps) {
  const activeTabId = useTabStore(s => s.activeTabId);
  const openDrawer = useTabStore(s => s.openDrawer);
  const currentStaff = useStaffStore(state => state.currentStaff);
  const [openTabDialogOpen, setOpenTabDialogOpen] = useState(false);
  const [orderToVoid, setOrderToVoid] = useState<Order | null>(null);

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
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {tabLoading && !currentTab ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                  ) : (
                    <h3 className="truncate font-semibold">{currentTab?.customerName ?? 'Tab'}</h3>
                  )}
                  {currentTab?.tableNumber != null && (
                    <Badge variant="secondary" className="shrink-0 font-mono">
                      Table {String(currentTab.tableNumber)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleSwitchTab}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                Switch Tab
                {openTabCount > 1 && (
                  <Badge variant="secondary" className="ml-2">
                    {openTabCount}
                  </Badge>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpenTabDialogOpen(true);
                }}
                aria-label="New tab"
              >
                <Plus className="mr-1 h-4 w-4" />
                New Tab +
              </Button>
            </div>
            {(currentTab?.orders.length ?? 0) > 0 && (
              <div className="space-y-2 border-t pt-2">
                <p className="text-xs text-muted-foreground">Order history</p>
                <div className="space-y-1">
                  {[...(currentTab?.orders ?? [])]
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .map(order => (
                      <ProtectedAction
                        key={order.id}
                        action="void_order"
                        currentRole={currentStaff?.role}
                      >
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="w-full justify-between"
                          onClick={() => {
                            setOrderToVoid(order);
                          }}
                        >
                          Void{' '}
                          {order.createdAt.toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </Button>
                      </ProtectedAction>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="space-y-3 rounded-lg border-2 border-dashed border-primary/40 p-4 ring-2 ring-primary/20 animate-pulse"
            role="status"
            aria-live="polite"
          >
            <p className="text-center text-sm text-muted-foreground">Select or create a tab</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleSwitchTab}
                disabled={openTabCount === 0}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                Switch Tab
                {openTabCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {openTabCount}
                  </Badge>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setOpenTabDialogOpen(true);
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                New Tab +
              </Button>
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
    </>
  );
}
