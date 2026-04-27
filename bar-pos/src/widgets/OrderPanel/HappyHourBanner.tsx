import { Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Category } from '@shared/lib/domain';
import { isHappyHourActive } from '@shared/lib/domain-helpers';

export interface HappyHourBannerProps {
  categories: Category[];
  now: Date;
}

export function HappyHourBanner({ categories, now }: HappyHourBannerProps) {
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

  const activeCategories = categories.filter(c => isHappyHourActive(c, currentTime));
  if (activeCategories.length === 0) return null;

  void now; // prop reserved for future clock injection in tests
  void _tick;

  // Find earliest end time in minutes
  const endMinutes = activeCategories
    .map(c => {
      if (!c.happyHourEnd) return Infinity;
      const [h = 0, m = 0] = c.happyHourEnd.split(':').map(Number);
      return h * 60 + m;
    })
    .reduce((min, v) => Math.min(min, v), Infinity);

  const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  const nowSecs = currentTime.getSeconds();
  const remainingMins = Math.max(0, endMinutes - nowMins - (nowSecs > 0 ? 1 : 0));
  const remainingH = Math.floor(remainingMins / 60);
  const remainingM = remainingMins % 60;
  const countdown =
    remainingH > 0 ? `${String(remainingH)}h ${String(remainingM)}m` : `${String(remainingM)}m`;

  const names = activeCategories.map(c => c.name).join(', ');

  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-lg border border-amber-700 bg-amber-950 px-3 py-2 text-sm text-amber-200"
      role="status"
      aria-label="Happy hour active"
      data-testid="happy-hour-banner"
    >
      <Zap className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <span className="flex-1 font-medium">Happy Hour Active — {names}</span>
      <span className="text-xs text-amber-400">Ends in {countdown}</span>
    </div>
  );
}
