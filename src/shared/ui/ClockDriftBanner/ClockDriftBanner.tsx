import { useServerTimeDrift } from '@shared/lib/useServerTimeDrift';

/**
 * Fixed slim warning banner shown below the OfflineBanner when the PC clock
 * drifts more than 2 minutes from the Supabase server clock.
 *
 * Uses amber/yellow to indicate a warning (not a hard error).
 * Positioned below the OfflineBanner via top-7 offset (OfflineBanner occupies ~28px).
 */
export function ClockDriftBanner() {
  const { isDrifting } = useServerTimeDrift();

  if (!isDrifting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="clock-drift-banner"
      className="fixed top-7 left-0 right-0 z-[9998] flex items-center justify-center py-1 px-3 bg-amber-500 text-xs font-medium text-white"
    >
      Clock out of sync &mdash; check your PC date/time settings
    </div>
  );
}
