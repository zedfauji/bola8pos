import { AlertCircle, CreditCard } from 'lucide-react';
import { useTabs } from '@entities/tab/model/queries';
import type { Tab } from '@entities/tab/model/types';
import { EmptyState, ScrollArea, TabListSkeleton } from '@shared/ui';
import { TabPaymentCard } from './TabPaymentCard';

export interface TabPaymentListProps {
  selectedTabId: string | undefined;
  onSelect: (tab: Tab) => void;
}

function sortTabs(tabs: Tab[]): Tab[] {
  return [...tabs].sort((a, b) => {
    const aHasPool = a.activePoolTableNumber != null;
    const bHasPool = b.activePoolTableNumber != null;

    if (aHasPool && !bHasPool) return -1;
    if (!aHasPool && bHasPool) return 1;

    if (aHasPool && bHasPool) {
      const aNum = a.activePoolTableNumber ?? 0;
      const bNum = b.activePoolTableNumber ?? 0;
      return aNum - bNum;
    }

    return a.openedAt.getTime() - b.openedAt.getTime();
  });
}

export function TabPaymentList({ selectedTabId, onSelect }: TabPaymentListProps) {
  const { data: tabs, isIdleOrLoading, resultError } = useTabs();

  const openTabs = sortTabs((tabs ?? []).filter(t => t.status === 'open'));

  if (isIdleOrLoading) {
    return (
      <div className="p-3">
        <TabListSkeleton count={4} />
      </div>
    );
  }

  if (resultError) {
    return (
      <div className="p-3">
        <EmptyState
          icon={AlertCircle}
          title="Could not load tabs"
          description={resultError.message}
        />
      </div>
    );
  }

  if (openTabs.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={CreditCard}
          title="No tabs waiting for payment"
          description="All open tabs will appear here."
        />
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-hidden"
      aria-label="tabs waiting for payment"
      data-testid="tabs-waiting-for-payment"
    >
      <ScrollArea className="h-full">
        <div className="space-y-2 p-3">
          {openTabs.map(tab => (
            <TabPaymentCard
              key={tab.id}
              tab={tab}
              selected={tab.id === selectedTabId}
              onClick={() => {
                onSelect(tab);
              }}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
