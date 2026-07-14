import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useBumpKdsItem } from '@features/bump-kds-item';
import { useKdsItems, useKdsRealtimeBridge } from '@entities/kds';
import type { KdsOrderItem } from '@entities/kds';
import { ComboBadge } from '@shared/ui/ComboBadge';
import { POSButton } from '@shared/ui/POSButton';
import { RoutingBadge } from '@shared/ui/RoutingBadge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/ui/collapsible';

function formatAge(createdAt: Date): string {
  const diffMs = Date.now() - createdAt.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 min';
  return `${String(diffMin)} min`;
}

type KdsCardProps = {
  item: KdsOrderItem;
  onBump: (id: string, next: 'in_progress' | 'done') => void;
  isBumping: boolean;
};

function KdsCard({ item, onBump, isBumping }: KdsCardProps) {
  const statusColor =
    item.kdsStatus === 'pending'
      ? 'border-yellow-500 bg-yellow-950 text-yellow-100'
      : item.kdsStatus === 'in_progress'
        ? 'border-blue-500 bg-blue-950 text-blue-100'
        : 'border-green-500 bg-green-950 text-green-100';

  const handleClick = () => {
    onBump(item.id, item.kdsStatus === 'pending' ? 'in_progress' : 'done');
  };

  return (
    <div
      data-testid="kds-card"
      data-kds-status={item.kdsStatus}
      className={`flex flex-col gap-3 rounded-lg border-2 p-4 shadow-sm ${statusColor}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {item.tabCustomerName && (
            <p className="truncate text-sm font-semibold opacity-80">{item.tabCustomerName}</p>
          )}
          <div className="flex items-center gap-2">
            <p className="truncate text-lg font-bold">{item.productName}</p>
            <RoutingBadge routing={item.routing} />
          </div>
          <p className="text-sm opacity-80">Qty: {item.quantity}</p>
          {item.modifierNames.length > 0 && (
            <p data-testid="kds-item-modifiers" className="mt-1 text-sm opacity-80">
              {item.modifierNames.join(' / ')}
            </p>
          )}
          {item.notes && (
            <p className="mt-1 text-sm italic opacity-70">&ldquo;{item.notes}&rdquo;</p>
          )}
        </div>
        <span className="shrink-0 text-xs opacity-60">{formatAge(item.createdAt)}</span>
      </div>

      {item.kdsStatus !== 'done' && (
        <POSButton
          touchSize="large"
          variant={item.kdsStatus === 'pending' ? 'secondary' : 'default'}
          disabled={isBumping}
          onClick={handleClick}
          className="w-full"
        >
          {item.kdsStatus === 'pending' ? 'Start' : 'Done'}
        </POSButton>
      )}
    </div>
  );
}

function ComboKdsCard({
  item,
  comboChildren,
  onBump,
  isBumping,
}: {
  item: KdsOrderItem;
  comboChildren: KdsOrderItem[];
  onBump: (id: string, next: 'in_progress' | 'done') => void;
  isBumping: boolean;
}) {
  const [open, setOpen] = useState(false);

  const statusColor =
    item.kdsStatus === 'pending'
      ? 'border-yellow-500 bg-yellow-950 text-yellow-100'
      : item.kdsStatus === 'in_progress'
        ? 'border-blue-500 bg-blue-950 text-blue-100'
        : 'border-green-500 bg-green-950 text-green-100';

  return (
    <div
      data-testid="kds-combo-card"
      className={`flex flex-col gap-3 rounded-lg border-2 p-4 shadow-sm ${statusColor}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {item.tabCustomerName && (
            <p className="truncate text-sm font-semibold opacity-80">{item.tabCustomerName}</p>
          )}
          <div className="flex items-center gap-2">
            <p className="truncate text-lg font-bold">{item.productName}</p>
            <RoutingBadge routing={item.routing} />
            <ComboBadge />
          </div>
          <p className="text-sm opacity-80">Qty: {item.quantity}</p>
        </div>
        <span className="shrink-0 text-xs opacity-60">{formatAge(item.createdAt)}</span>
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-sm opacity-70 hover:opacity-100">
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
          <span aria-label={open ? 'Collapse combo items' : 'Expand combo items'}>
            {comboChildren.length} items
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-1 pl-6">
            {comboChildren.map(child => (
              <p key={child.id} className="text-sm opacity-80">
                {child.productName} × {child.quantity}
              </p>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {item.kdsStatus !== 'done' && (
        <POSButton
          touchSize="large"
          variant={item.kdsStatus === 'pending' ? 'secondary' : 'default'}
          disabled={isBumping}
          onClick={() => {
            onBump(item.id, item.kdsStatus === 'pending' ? 'in_progress' : 'done');
          }}
          className="w-full"
        >
          {item.kdsStatus === 'pending' ? 'Start' : 'Done'}
        </POSButton>
      )}
    </div>
  );
}

export function KdsBoard({ routing }: { routing: 'KITCHEN' | 'BAR' }) {
  useKdsRealtimeBridge();
  const { data: result, isLoading, isError, refetch } = useKdsItems(routing);
  const bump = useBumpKdsItem();
  const stationLabel = routing === 'KITCHEN' ? 'kitchen' : 'bar';

  const handleBump = (id: string, next: 'in_progress' | 'done') => {
    bump.mutate({ itemId: id, nextStatus: next });
  };

  const bumpingItemId = bump.isPending ? bump.variables.itemId : null;

  if (isLoading) {
    return <p className="text-muted-foreground p-6">Loading {stationLabel} queue...</p>;
  }

  if (isError || !result?.ok) {
    return (
      <div className="p-6">
        <p className="text-destructive mb-2">Could not load {stationLabel} queue.</p>
        <POSButton touchSize="default" variant="outline" onClick={() => void refetch()}>
          Retry
        </POSButton>
      </div>
    );
  }

  const items = result.data;

  // Separate top-level items from combo children
  const topLevelItems = items.filter(i => !i.parentOrderItemId);
  const childrenByParent = items.reduce<Record<string, KdsOrderItem[]>>((acc, item) => {
    const parent = item.parentOrderItemId;
    if (parent) {
      const existing = acc[parent];
      if (existing) {
        existing.push(item);
      } else {
        acc[parent] = [item];
      }
    }
    return acc;
  }, {});

  const pending = topLevelItems.filter(i => i.kdsStatus === 'pending');
  const inProgress = topLevelItems.filter(i => i.kdsStatus === 'in_progress');

  if (topLevelItems.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No active {stationLabel} orders
      </div>
    );
  }

  function renderItem(item: KdsOrderItem) {
    const children = childrenByParent[item.id] ?? [];
    if (children.length > 0) {
      return (
        <ComboKdsCard
          key={item.id}
          item={item}
          comboChildren={children}
          onBump={handleBump}
          isBumping={bumpingItemId === item.id}
        />
      );
    }
    return (
      <KdsCard
        key={item.id}
        item={item}
        onBump={handleBump}
        isBumping={bumpingItemId === item.id}
      />
    );
  }

  return (
    <div data-testid="kds-board" className="grid gap-6 p-6 md:grid-cols-2">
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Pending
          {pending.length > 0 && (
            <span className="ml-2 rounded-full bg-yellow-500 px-2 py-0.5 text-xs text-black">
              {pending.length}
            </span>
          )}
        </h2>
        <div className="space-y-4">
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pending items.</p>
          ) : (
            pending.map(item => renderItem(item))
          )}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          In Progress
          {inProgress.length > 0 && (
            <span className="ml-2 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
              {inProgress.length}
            </span>
          )}
        </h2>
        <div className="space-y-4">
          {inProgress.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing in progress.</p>
          ) : (
            inProgress.map(item => renderItem(item))
          )}
        </div>
      </section>
    </div>
  );
}
