/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { useQuery } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AddWaitlistEntryForm } from '@features/add-waitlist-entry/ui/AddWaitlistEntryForm';
import { useMarkCancelled } from '@features/mark-waitlist-entry-cancelled/model/useMarkCancelled';
import { useMarkNoShow } from '@features/mark-waitlist-no-show/model/useMarkNoShow';
import { NotifyButton } from '@features/notify-waitlist/ui/NotifyButton';
import { SeatPartySheet } from '@features/seat-waitlist-party/ui/SeatPartySheet';
import {
  useWaitlistEntries,
  useWaitlistLastNotificationsMap,
  WaitlistEntryCard,
} from '@entities/waitlist';
import { supabase } from '@shared/lib/supabase';
import { computeQuotedWait } from '@shared/lib/waitlist-math';
import { CardSkeleton, EmptyState, POSButton } from '@shared/ui';

// ────────────────────────────────────────────────────────────────────────────
// Pool tables inline query (no @entities/pool-table entity yet)
// ────────────────────────────────────────────────────────────────────────────
const db = supabase as any;

type PoolTableStatus = { id: string; label: string; number: number; status: string };

function usePoolTablesCount() {
  return useQuery({
    queryKey: ['pool_tables'],
    queryFn: async (): Promise<PoolTableStatus[]> => {
      const { data, error } = await db
        .from('pool_tables')
        .select('id, label, number, status')
        .order('number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PoolTableStatus[];
    },
    staleTime: 30 * 1000,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function WaitlistQueue() {
  const [addOpen, setAddOpen] = useState(false);
  const [seatEntryId, setSeatEntryId] = useState<string | null>(null);
  const { data: entries = [], isLoading } = useWaitlistEntries();
  const { data: tables = [] } = usePoolTablesCount();
  const { markNoShow } = useMarkNoShow();
  const { markCancelled } = useMarkCancelled();

  // Fetch last notification per visible entry — drives notification status row in each card
  const entryIds = entries.map((e) => e.id);
  const { data: notificationsMap = {} } = useWaitlistLastNotificationsMap(entryIds);

  const availableTableCount = tables.filter((t) => t.status === 'available').length;

  // Placeholder average turn time map (real avg would come from useWaitlistAvgTurnBySize)
  const avgTurnMap = useMemo(() => new Map<number, number>([[2, 30], [4, 45]]), []);

  function getQuotedWait(entryId: string): number {
    return computeQuotedWait({
      entries: entries.map((e) => ({
        id: e.id,
        partySize: e.partySize,
        status: e.status,
        createdAt: e.createdAt,
        seatedAt: e.seatedAt,
      })),
      targetEntryId: entryId,
      availableTableCount,
      averageTurnMinutesByPartySize: avgTurnMap,
    });
  }

  const seatEntry = seatEntryId ? entries.find((e) => e.id === seatEntryId) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-5" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Queue</h2>
        </div>
        <POSButton
          type="button"
          touchSize="large"
          aria-label="Add to waitlist"
          onClick={() => {
            setAddOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          Add to waitlist
        </POSButton>
      </div>

      {/* Entry list */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <CardSkeleton height={80} />
          <CardSkeleton height={80} />
          <CardSkeleton height={80} />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No one waiting"
          description="Add a walk-in party using the 'Add to waitlist' button."
        />
      ) : (
        <div className="flex flex-col gap-3" role="list">
          {entries.map((entry) => (
            <div key={entry.id} role="listitem">
              <WaitlistEntryCard
                entry={entry}
                quotedWait={getQuotedWait(entry.id)}
                lastNotification={notificationsMap[entry.id] ?? null}
                notifySlot={
                  <NotifyButton
                    entryId={entry.id}
                    entryName={entry.name}
                    hasPhone={!!entry.phoneE164}
                  />
                }
                onSeat={(id) => {
                  setSeatEntryId(id);
                }}
                onNoShow={(id) => {
                  void markNoShow({ entryId: id, entryName: entry.name });
                }}
                onCancel={(id) => {
                  void markCancelled({ entryId: id, entryName: entry.name });
                }}
                isSeating={false}
              />
            </div>
          ))}
        </div>
      )}

      {/* Sheets */}
      <AddWaitlistEntryForm
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
        }}
      />
      {seatEntry && (
        <SeatPartySheet
          open={seatEntryId !== null}
          onClose={() => {
            setSeatEntryId(null);
          }}
          entryId={seatEntry.id}
          entryName={seatEntry.name}
          partySize={seatEntry.partySize}
        />
      )}
    </div>
  );
}
