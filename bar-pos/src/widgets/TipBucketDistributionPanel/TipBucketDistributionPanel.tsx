import { PieChart } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('wAdmin');
  const { data: listResult, isLoading: listLoading } = useCajaList();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessions = listResult?.ok ? listResult.data : [];
  const effectiveId = selectedId ?? sessions[0]?.id ?? null;

  const { data: entryResult, isLoading: entryLoading } = useTipDistributionEntry(effectiveId);
  const entry = entryResult?.ok ? entryResult.data : null;

  const buckets = entry
    ? [
        {
          key: 'floor',
          label: t('tipBucketDistributionPanel.bucketFloor'),
          pct: entry.floorPct,
          amount: entry.floorAmount,
        },
        {
          key: 'bar',
          label: t('tipBucketDistributionPanel.bucketBar'),
          pct: entry.barPct,
          amount: entry.barAmount,
        },
        {
          key: 'kitchen',
          label: t('tipBucketDistributionPanel.bucketKitchen'),
          pct: entry.kitchenPct,
          amount: entry.kitchenAmount,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        title={t('tipBucketDistributionPanel.title')}
        description={t('tipBucketDistributionPanel.description')}
      />

      {listLoading && <LoadingSpinner />}

      {!listLoading && (
        <div className="flex items-center gap-3">
          <label htmlFor="tip-split-caja-selector" className="text-sm font-medium">
            {t('tipBucketDistributionPanel.selectSession')}
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
                {formatDate(s.openedAt)}{' '}
                {s.status === 'open' ? t('tipBucketDistributionPanel.openSuffix') : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {entryLoading && <LoadingSpinner />}

      {!entryLoading && !entry && (
        <EmptyState
          icon={PieChart}
          title={t('tipBucketDistributionPanel.emptyTitle')}
          description={t('tipBucketDistributionPanel.emptyDescription')}
        />
      )}

      {entry && (
        <div className="space-y-6">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              {t('tipBucketDistributionPanel.totalTips')}
            </p>
            <MoneyDisplay amount={entry.totalTips} size="lg" className="mt-1 font-bold" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {buckets.map(bucket => (
              <div key={bucket.key} className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  {t('tipBucketDistributionPanel.bucketLine', {
                    label: bucket.label,
                    pct: bucket.pct,
                  })}
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
