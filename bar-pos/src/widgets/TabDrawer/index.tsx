/**
 * TAB DRAWER WIDGET
 *
 * Slide-in drawer showing all open tabs.
 * Selecting a tab sets the active tab on the POS.
 */

import { Receipt } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCloseTab } from '@features/close-tab';
import { OpenTabButton } from '@features/open-tab/ui/OpenTabButton';
import { useTabs } from '@entities/tab/model/queries';
import { useTabStore } from '@entities/tab/model/store';
import { TabCard } from '@entities/tab/ui/TabCard';
import { TabDetail } from '@entities/tab/ui/TabDetail';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@shared/ui';
import { EmptyState } from '@shared/ui';
import { TabListSkeleton } from '@shared/ui/LoadingSkeletons';

export function TabDrawer() {
  const { t } = useTranslation('wPanels');
  const { isTabDrawerOpen, closeDrawer, selectTab, activeTabId } = useTabStore();
  const { data: tabs, isLoading, isError, error, resultError, isDisabled } = useTabs();
  const hasError = isError || Boolean(resultError);
  const errorMessage = resultError?.message ?? error?.message ?? t('tabDrawer.unknownError');
  const { closeTab } = useCloseTab();
  const [detailTabId, setDetailTabId] = useState<string | null>(null);

  const tabCount = tabs?.length ?? 0;

  return (
    <Sheet open={isTabDrawerOpen} onOpenChange={closeDrawer}>
      <SheetContent side="right" className="flex w-[380px] max-w-[100vw] flex-col sm:max-w-[380px]">
        <SheetHeader>
          <SheetTitle {...(tabCount > 0 ? { 'aria-label': `${String(tabCount)} open tabs` } : {})}>
            {t('tabDrawer.openTabsCount', { count: tabCount })}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('tabDrawer.viewAndSelectDescription')}
          </SheetDescription>
        </SheetHeader>

        {isDisabled && (
          <div className="py-8">
            <EmptyState
              icon={Receipt}
              title={t('tabDrawer.noActiveShift')}
              description={t('tabDrawer.noActiveShiftDescription')}
            />
          </div>
        )}

        {!isDisabled && isLoading && (
          <div className="flex-1 overflow-y-auto py-4">
            <TabListSkeleton count={4} />
          </div>
        )}

        {!isDisabled && hasError && (
          <div className="py-4" role="alert">
            <EmptyState
              icon={Receipt}
              title={t('tabDrawer.errorLoadingTabs')}
              description={errorMessage}
            />
          </div>
        )}

        {!isDisabled && !isLoading && !hasError && tabCount === 0 && (
          <div className="py-8">
            <EmptyState
              icon={Receipt}
              title={t('tabDrawer.noOpenTabs')}
              description={t('tabDrawer.openNewTabToStart')}
            />
          </div>
        )}

        {!isDisabled && !isLoading && !hasError && tabCount > 0 && (
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
                onViewDetails={setDetailTabId}
              />
            ))}
          </div>
        )}

        <div className="mt-auto border-t pt-4">
          <OpenTabButton />
        </div>
      </SheetContent>

      <Sheet
        open={detailTabId !== null}
        onOpenChange={open => {
          if (!open) setDetailTabId(null);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-[380px] max-w-[100vw] flex-col overflow-y-auto sm:max-w-[380px]"
        >
          <SheetHeader>
            <SheetTitle>{t('tabDrawer.tabDetailsTitle')}</SheetTitle>
            <SheetDescription className="sr-only">
              {t('tabDrawer.tabDetailsDescription')}
            </SheetDescription>
          </SheetHeader>
          {detailTabId && (
            <TabDetail
              tabId={detailTabId}
              onAddItems={() => {
                selectTab(detailTabId);
                closeDrawer();
                setDetailTabId(null);
              }}
              onCloseTab={() => {
                void closeTab(detailTabId).then(result => {
                  if (result.ok) {
                    setDetailTabId(null);
                  }
                });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </Sheet>
  );
}
