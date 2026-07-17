import { useSubTabs } from '@entities/tab';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';

export interface SubChecksSectionProps {
  parentTabId: string;
}

/** Lists sub-tabs when a parent tab has status `split`. */
export function SubChecksSection({ parentTabId }: SubChecksSectionProps) {
  const queryResult = useSubTabs(parentTabId);
  const subTabs = queryResult.data?.ok ? queryResult.data.data : [];

  if (subTabs.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-4">
      <p className="mb-2 text-sm font-semibold">Sub-checks</p>
      {subTabs.map(sub => {
        const lineTotal = sub.items.reduce(
          (sum, i) => sum + i.unitPrice * i.quantity,
          0,
        );
        return (
          <div
            key={sub.id}
            className="flex items-center justify-between rounded-md p-2 hover:bg-muted/40"
          >
            <span className="text-sm">{sub.splitLabel ?? `Check ${sub.id.slice(0, 4)}`}</span>
            <span
              className={`text-sm ${sub.status === 'paid' ? 'text-pos-accent' : 'text-muted-foreground'}`}
            >
              {sub.status}
            </span>
            <MoneyDisplay amount={lineTotal} size="sm" />
          </div>
        );
      })}
    </div>
  );
}
