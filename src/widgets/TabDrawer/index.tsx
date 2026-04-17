/**
 * TAB DRAWER WIDGET
 *
 * Slide-in drawer showing all open tabs.
 * Selecting a tab sets the active tab on the POS.
 */

import { Receipt } from 'lucide-react';
import { OpenTabButton } from '@features/open-tab/ui/OpenTabButton';
import { useTabs } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import { TabCard } from '@entities/tab/ui/TabCard';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@shared/ui';
import { EmptyState } from '@shared/ui';
import { TabListSkeleton } from '@shared/ui/LoadingSkeletons';

export function TabDrawer() {
  const { isTabDrawerOpen, closeDrawer, selectTab, activeTabId } = useTabStore();
  const { data: tabs, isLoading, isError, error, resultError } = useTabs();
  const hasError = isError || Boolean(resultError);
  const errorMessage = resultError?.message ?? error?.message ?? 'An unknown error occurred';

  const tabCount = tabs?.length ?? 0;

  return (
    <Sheet open={isTabDrawerOpen} onOpenChange={closeDrawer}>
      <SheetContent side="right" className="flex w-[380px] max-w-[100vw] flex-col sm:max-w-[380px]">
        <SheetHeader>
          <SheetTitle {...(tabCount > 0 ? { 'aria-label': `${String(tabCount)} open tabs` } : {})}>
            Open Tabs ({tabCount})
          </SheetTitle>
          <SheetDescription className="sr-only">
            View and select from all currently active customer tabs.
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex-1 overflow-y-auto py-4">
            <TabListSkeleton count={4} />
          </div>
        )}

        {hasError && (
          <div className="py-4" role="alert">
            <EmptyState icon={Receipt} title="Error loading tabs" description={errorMessage} />
          </div>
        )}

        {!isLoading && !hasError && tabCount === 0 && (
          <div className="py-8">
            <EmptyState
              icon={Receipt}
              title="No open tabs"
              description="Open a new tab to get started"
            />
          </div>
        )}

        {!isLoading && !hasError && tabCount > 0 && (
          <div className="flex-1 space-y-2 overflow-y-auto py-4">
            {tabs?.map(tab => (
              <TabCard
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSelect={tabId => {
                  selectTab(tabId);
                  closeDrawer();
                }}
              />
            ))}
          </div>
        )}

        <div className="mt-auto border-t pt-4">
          <OpenTabButton />
        </div>
      </SheetContent>
    </Sheet>
  );
}
