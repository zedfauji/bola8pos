import { useBumpKdsItem } from '@features/bump-kds-item';
import { useKdsItems, useKdsRealtimeBridge } from '@entities/kds';
import type { KdsOrderItem } from '@entities/kds';
import { Button } from '@shared/ui/button';

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
          <p className="truncate text-lg font-bold">{item.productName}</p>
          <p className="text-sm opacity-80">Qty: {item.quantity}</p>
          {item.notes && (
            <p className="mt-1 text-sm italic opacity-70">&ldquo;{item.notes}&rdquo;</p>
          )}
        </div>
        <span className="shrink-0 text-xs opacity-60">{formatAge(item.createdAt)}</span>
      </div>

      {item.kdsStatus !== 'done' && (
        <Button
          size="sm"
          variant={item.kdsStatus === 'pending' ? 'secondary' : 'default'}
          disabled={isBumping}
          onClick={handleClick}
          className="w-full"
        >
          {item.kdsStatus === 'pending' ? 'Start' : 'Done'}
        </Button>
      )}
    </div>
  );
}

export function KdsBoard() {
  useKdsRealtimeBridge();
  const { data: result, isLoading, isError, refetch } = useKdsItems();
  const bump = useBumpKdsItem();

  const handleBump = (id: string, next: 'in_progress' | 'done') => {
    bump.mutate({ itemId: id, nextStatus: next });
  };

  const bumpingItemId = bump.isPending ? bump.variables.itemId : null;

  if (isLoading) {
    return <p className="text-muted-foreground p-6">Loading kitchen queue...</p>;
  }

  if (isError || !result?.ok) {
    return (
      <div className="p-6">
        <p className="text-destructive mb-2">Could not load kitchen queue.</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const items = result.data;
  const pending = items.filter(i => i.kdsStatus === 'pending');
  const inProgress = items.filter(i => i.kdsStatus === 'in_progress');

  if (items.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No active food orders
      </div>
    );
  }

  return (
    <div className="grid gap-6 p-6 md:grid-cols-2">
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
            pending.map(item => (
              <KdsCard
                key={item.id}
                item={item}
                onBump={handleBump}
                isBumping={bumpingItemId === item.id}
              />
            ))
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
            inProgress.map(item => (
              <KdsCard
                key={item.id}
                item={item}
                onBump={handleBump}
                isBumping={bumpingItemId === item.id}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
