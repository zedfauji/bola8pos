import { ChefHatBadge } from '@shared/ui';

export type PrepOnHandCardProps = {
  name: string;
  uom: string;
  qtyOnHand: number;
  reorderPoint: number | null;
};

export function PrepOnHandCard({ name, uom, qtyOnHand, reorderPoint }: PrepOnHandCardProps) {
  const isLow = reorderPoint !== null && qtyOnHand <= reorderPoint;
  const isEmpty = qtyOnHand === 0;
  const stockPct =
    reorderPoint !== null && reorderPoint > 0 ? Math.min((qtyOnHand / reorderPoint) * 100, 100) : 100;

  const cardClass =
    `rounded-lg border p-4 flex flex-col gap-2 min-h-[80px] ` +
    (isEmpty
      ? 'border-pos-danger bg-pos-danger/5'
      : isLow
        ? 'border-pos-danger'
        : 'border-border');

  const qtyClass =
    `text-2xl font-semibold font-mono ` +
    (isEmpty ? 'text-pos-danger font-semibold' : isLow ? 'text-pos-danger' : 'text-pos-accent');

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{name}</span>
        <ChefHatBadge />
      </div>
      <div className={qtyClass}>
        {qtyOnHand.toFixed(2)} {uom}
      </div>
      {reorderPoint !== null ? (
        <div className="h-1 rounded-full bg-muted overflow-hidden" aria-label="Stock level">
          <div
            role="progressbar"
            aria-valuenow={Math.round(stockPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            className={`h-full rounded-full transition-all ${isLow ? 'bg-pos-danger' : 'bg-pos-accent'}`}
            style={{ width: `${String(stockPct)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
