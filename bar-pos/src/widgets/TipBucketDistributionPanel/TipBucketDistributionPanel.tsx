import { PieChart } from 'lucide-react';
import { useState } from 'react';
import { useCajaList, useTipDistributionEntry } from '@entities/caja';
import type { CajaSession } from '@shared/lib/domain';
import { EmptyState } from '@shared/ui/EmptyState';
import { LoadingSpinner } from '@shared/ui/LoadingSpinner';
import { MoneyDisplay } from '@shared/ui/MoneyDisplay';
import { SectionHeader } from '@shared/ui/SectionHeader';

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TipBucketDistributionPanel() {
  const { data: listResult, isLoading: listLoading } = useCajaList();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessions = listResult?.ok ? listResult.data : [];
  const effectiveId = selectedId ?? sessions[0]?.id ?? null;

  const { data: entryResult, isLoading: entryLoading } = useTipDistributionEntry(effectiveId);
  const entry = entryResult?.ok ? entryResult.data : null;

  const buckets = entry
    ? [
        { key: 'floor', label: 'Floor', pct: entry.floorPct, amount: entry.floorAmount },
        { key: 'bar', label: 'Bar', pct: entry.barPct, amount: entry.barAmount },
        { key: 'kitchen', label: 'Kitchen', pct: entry.kitchenPct, amount: entry.kitchenAmount },
      ]
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        title="Tip Split"
        description="Floor / Bar / Kitchen allocation for a closed caja session."
      />

      {listLoading && <LoadingSpinner />}

      {!listLoading && (
        <div className="flex items-center gap-3">
          <label htmlFor="tip-split-caja-selector" className="text-sm font-medium">
            Select session
          </label>
          <select
            id="tip-split-caja-selector"
            value={effectiveId ?? ''}
            onChange={e => {
              setSelectedId(e.target.value || null);
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {sessions.map((s: CajaSession) => (
              <option key={s.id} value={s.id}>
                {formatDate(s.openedAt)} {s.status === 'open' ? '(open)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {entryLoading && <LoadingSpinner />}

      {!entryLoading && !entry && (
        <EmptyState
          icon={PieChart}
          title="No tip split recorded for this session."
          description="A tip split is computed when a caja session is closed."
        />
      )}

      {entry && (
        <div className="space-y-6">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total Tips</p>
            <MoneyDisplay amount={entry.totalTips} size="lg" className="mt-1 font-bold" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {buckets.map(bucket => (
              <div key={bucket.key} className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  {bucket.label} ({bucket.pct}%)
                </p>
                <MoneyDisplay amount={bucket.amount} size="lg" className="mt-1 font-bold" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
