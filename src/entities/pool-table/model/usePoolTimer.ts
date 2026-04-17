import { useEffect, useMemo, useState } from 'react';
import { computePoolSessionBilling } from '@shared/lib/pool-billing';

export interface UsePoolTimerOptions {
  /** Wall clock tick interval in ms (default 1000). */
  tickMs?: number;
}

/**
 * Live elapsed time and bill preview for an active pool session (15-minute blocks).
 */
export function usePoolTimer(
  startedAt: Date | null,
  ratePerHour: number | undefined,
  options?: UsePoolTimerOptions
) {
  const tickMs = options?.tickMs ?? 1000;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) {
      return undefined;
    }
    const tick = () => {
      setNowMs(Date.now());
    };
    tick();
    const id = window.setInterval(tick, tickMs);
    return () => {
      window.clearInterval(id);
    };
  }, [startedAt, tickMs]);

  return useMemo(() => {
    const now = new Date(nowMs);
    if (!startedAt) {
      return {
        now,
        totalSeconds: 0,
        elapsedMs: 0,
        elapsedMinutes: 0,
        billedMinutes: 0,
        currentCharge: 0,
        isRunning: false,
      };
    }

    const elapsedMs = Math.max(0, nowMs - startedAt.getTime());
    const totalSeconds = Math.floor(elapsedMs / 1000);

    if (ratePerHour == null || ratePerHour <= 0) {
      return {
        now,
        totalSeconds,
        elapsedMs,
        elapsedMinutes: Math.ceil(elapsedMs / (1000 * 60)),
        billedMinutes: 0,
        currentCharge: 0,
        isRunning: true,
      };
    }

    const billing = computePoolSessionBilling({
      startedAt,
      endTime: now,
      ratePerHour,
    });

    return {
      now,
      totalSeconds,
      elapsedMs: billing.elapsedMs,
      elapsedMinutes: billing.elapsedMinutes,
      billedMinutes: billing.billedMinutes,
      currentCharge: Math.round(billing.totalCharge * 100) / 100,
      isRunning: true,
    };
  }, [nowMs, startedAt, ratePerHour]);
}
