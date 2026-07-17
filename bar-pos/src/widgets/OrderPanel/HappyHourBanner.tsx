import { Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ActivePromotionEntry } from '@entities/promotion';
import type { PromotionAvailability } from '@shared/lib/domain';
import { isPromotionActive } from '@shared/lib/domain-helpers';

/**
 * "Active Promotions" banner — repurposed from the legacy happy-hour banner
 * (Phase 20 Plan 07). COSMETIC / READ-ONLY: this banner's active/inactive
 * determination and displayed countdown never compute or feed a charged price —
 * `evaluate_promotions_for_item` (server) is the sole authority for `unit_price`
 * (see 20-RESEARCH.md Pitfall 1). Clock skew or cache staleness here can never
 * change what the cashier is actually charged.
 */
export interface HappyHourBannerProps {
  activePromotions: ActivePromotionEntry[];
}

/**
 * Finds the end-of-window time (in minutes since midnight) for whichever window
 * currently matches, for the purpose of the live countdown. Mirrors the
 * day/time matching in `isPromotionActive`, but returns the matched window's
 * `endTime` instead of a boolean. Returns null when no matched window carries a
 * concrete end time (i.e. this promotion has no known end right now).
 */
function getMatchedWindowEndMinutes(
  windows: PromotionAvailability[],
  currentTime: Date
): number | null {
  const jsDay = currentTime.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  const hh = String(currentTime.getHours()).padStart(2, '0');
  const mm = String(currentTime.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${mm}`;

  const year = currentTime.getFullYear();
  const month = String(currentTime.getMonth() + 1).padStart(2, '0');
  const day = String(currentTime.getDate()).padStart(2, '0');
  const dateStr = `${String(year)}-${month}-${day}`;

  let minEnd: number | null = null;
  for (const window of windows) {
    if (!window.daysOfWeek.includes(isoDay)) continue;
    if (window.startTime != null && timeStr < window.startTime.slice(0, 5)) continue;
    if (window.endTime != null && timeStr > window.endTime.slice(0, 5)) continue;
    if (window.startDate != null && dateStr < window.startDate) continue;
    if (window.endDate != null && dateStr > window.endDate) continue;
    if (window.endTime == null) continue; // matched, but this window has no time bound — no countdown contribution

    const [h = 0, m = 0] = window.endTime.split(':').map(Number);
    const endMinutes = h * 60 + m;
    minEnd = minEnd === null ? endMinutes : Math.min(minEnd, endMinutes);
  }
  return minEnd;
}

export function HappyHourBanner({ activePromotions }: HappyHourBannerProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  const currentTime = new Date();
  // tick drives re-render each second so the countdown stays live
  const _tick = tick;
  void _tick;

  const activeEntries = activePromotions.filter(entry =>
    isPromotionActive(entry.promotion, entry.windows, currentTime)
  );
  if (activeEntries.length === 0) return null;

  // Bug fix (was: endMinutes defaulted to Infinity per-category with no "always
  // on" copy path): if ANY active promotion has no time window at all ("always
  // available" per is_promotion_available's own semantics), we cannot know when
  // it ends — omit the "Ends in…" suffix entirely rather than show a misleading
  // countdown.
  const hasAlwaysAvailable = activeEntries.some(entry => entry.windows.length === 0);

  let countdown: string | null = null;
  if (!hasAlwaysAvailable) {
    const endMinutesList = activeEntries.map(entry =>
      getMatchedWindowEndMinutes(entry.windows, currentTime)
    );
    const allKnown = endMinutesList.every((v): v is number => v !== null);
    if (allKnown) {
      const earliestEnd = Math.min(...endMinutesList);
      const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
      const nowSecs = currentTime.getSeconds();
      const remainingMins = Math.max(0, earliestEnd - nowMins - (nowSecs > 0 ? 1 : 0));
      const remainingH = Math.floor(remainingMins / 60);
      const remainingM = remainingMins % 60;
      countdown =
        remainingH > 0 ? `${String(remainingH)}h ${String(remainingM)}m` : `${String(remainingM)}m`;
    }
  }

  const names = activeEntries.map(entry => entry.promotion.name).join(', ');

  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-lg border border-amber-700 bg-amber-950 px-3 py-2 text-sm text-amber-200"
      role="status"
      aria-label="Promotions active"
      data-testid="active-promotions-banner"
    >
      <Zap className="size-4 shrink-0 text-amber-400" aria-hidden />
      <span className="flex-1 font-medium">Promotions Active — {names}</span>
      {countdown !== null && <span className="text-xs text-amber-400">Ends in {countdown}</span>}
    </div>
  );
}
