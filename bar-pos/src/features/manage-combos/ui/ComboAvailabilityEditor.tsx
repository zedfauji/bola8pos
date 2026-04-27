/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * ComboAvailabilityEditor
 *
 * Manages day-of-week + time window availability for a combo product.
 * Uses `const db = supabase as any` pre-regen cast — combo_availability table not yet
 * fully typed in supabase.types.ts.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { useComboAvailabilityWindows, comboKeys } from '@entities/combo';
import type { ComboAvailability } from '@entities/combo';
import { supabase } from '@shared/lib/supabase';
import { Button } from '@shared/ui/button';

// Pre-regen cast — remove once supabase.types.ts is regenerated after combo migrations
const db = supabase as any;

const DAY_LABELS: { iso: number; label: string }[] = [
  { iso: 1, label: 'Mon' },
  { iso: 2, label: 'Tue' },
  { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' },
  { iso: 6, label: 'Sat' },
  { iso: 7, label: 'Sun' },
];

interface WindowDraft {
  id: string | null; // null = new, not yet saved
  daysOfWeek: number[];
  startTime: string; // HH:MM or empty
  endTime: string; // HH:MM or empty
}

function newDraft(): WindowDraft {
  return { id: null, daysOfWeek: [], startTime: '', endTime: '' };
}

function availabilityToWindowDraft(w: ComboAvailability): WindowDraft {
  return {
    id: w.id,
    daysOfWeek: w.daysOfWeek,
    startTime: w.startTime ?? '',
    endTime: w.endTime ?? '',
  };
}

interface Props {
  comboId: string;
}

// Sub-component for a single window row — uses useId for accessible labels
function WindowRow({
  draft,
  idx,
  onToggleDay,
  onSetStartTime,
  onSetEndTime,
  onRemove,
}: {
  draft: WindowDraft;
  idx: number;
  onToggleDay: (idx: number, iso: number) => void;
  onSetStartTime: (idx: number, value: string) => void;
  onSetEndTime: (idx: number, value: string) => void;
  onRemove: (idx: number) => void;
}) {
  const startId = useId();
  const endId = useId();

  const hasTimeError =
    draft.daysOfWeek.length > 0 &&
    draft.startTime.length > 0 &&
    draft.endTime.length > 0 &&
    draft.endTime <= draft.startTime;

  return (
    <div className="rounded-md border p-3 space-y-3">
      {/* Day toggles */}
      <div className="flex flex-wrap gap-1">
        {DAY_LABELS.map(({ iso, label }) => {
          const selected = draft.daysOfWeek.includes(iso);
          return (
            <button
              key={iso}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onToggleDay(idx, iso);
              }}
              className={`rounded px-2 py-1 text-xs font-medium border transition-colors ${
                selected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-input hover:bg-accent'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Time inputs — only shown when at least 1 day selected */}
      {draft.daysOfWeek.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor={startId} className="text-xs text-muted-foreground">
            From
          </label>
          <input
            id={startId}
            type="time"
            value={draft.startTime}
            onChange={e => {
              onSetStartTime(idx, e.target.value);
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <label htmlFor={endId} className="text-xs text-muted-foreground">
            To
          </label>
          <input
            id={endId}
            type="time"
            value={draft.endTime}
            onChange={e => {
              onSetEndTime(idx, e.target.value);
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {hasTimeError && (
            <p className="text-sm text-destructive">End time must be after start time</p>
          )}
        </div>
      )}

      {/* Remove window */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Remove window"
          onClick={() => {
            onRemove(idx);
          }}
        >
          <Trash2 className="size-4" />
          Remove
        </Button>
      </div>
    </div>
  );
}

export function ComboAvailabilityEditor({ comboId }: Props) {
  const { data: windows, isLoading } = useComboAvailabilityWindows(comboId);
  const qc = useQueryClient();

  const [drafts, setDrafts] = useState<WindowDraft[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize drafts from fetched data (once)
  if (!initialized && windows !== undefined) {
    setInitialized(true);
    setDrafts(windows.map(availabilityToWindowDraft));
  }

  const saveMutation = useMutation({
    mutationFn: async (windowDrafts: WindowDraft[]) => {
      // Delete all existing windows for this combo then re-insert
      const { error: delErr } = await db
        .from('combo_availability')
        .delete()
        .eq('combo_product_id', comboId);
      if (delErr) throw delErr;

      if (windowDrafts.length > 0) {
        const rows = windowDrafts.map(w => ({
          combo_product_id: comboId,
          days_of_week: w.daysOfWeek,
          start_time: w.startTime.length > 0 ? w.startTime : null,
          end_time: w.endTime.length > 0 ? w.endTime : null,
        }));
        const { error: insErr } = await db.from('combo_availability').insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: comboKeys.availability(comboId) });
      toast.success('Availability saved');
      setInitialized(false); // re-sync drafts on next data fetch
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Failed to save availability';
      toast.error(msg);
    },
  });

  function toggleDay(draftIdx: number, iso: number) {
    setDrafts(prev =>
      prev.map((d, i) => {
        if (i !== draftIdx) return d;
        const has = d.daysOfWeek.includes(iso);
        const next = has
          ? d.daysOfWeek.filter(x => x !== iso)
          : [...d.daysOfWeek, iso].sort((a, b) => a - b);
        return { ...d, daysOfWeek: next };
      })
    );
  }

  function setStartTime(draftIdx: number, value: string) {
    setDrafts(prev => prev.map((d, i) => (i === draftIdx ? { ...d, startTime: value } : d)));
  }

  function setEndTime(draftIdx: number, value: string) {
    setDrafts(prev => prev.map((d, i) => (i === draftIdx ? { ...d, endTime: value } : d)));
  }

  function removeWindow(draftIdx: number) {
    setDrafts(prev => prev.filter((_, i) => i !== draftIdx));
  }

  function addWindow() {
    setDrafts(prev => [...prev, newDraft()]);
  }

  function handleSave() {
    saveMutation.mutate(drafts);
  }

  if (isLoading && !initialized) {
    return <p className="text-sm text-muted-foreground">Loading availability…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">Availability Windows</p>

      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No windows = always available</p>
      ) : (
        <div className="space-y-3">
          {drafts.map((draft, idx) => (
            <WindowRow
              key={idx}
              draft={draft}
              idx={idx}
              onToggleDay={toggleDay}
              onSetStartTime={setStartTime}
              onSetEndTime={setEndTime}
              onRemove={removeWindow}
            />
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground">No windows = always available</p>

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addWindow}>
          + Add window
        </Button>
        <Button type="button" size="sm" disabled={saveMutation.isPending} onClick={handleSave}>
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
