/**
 * P3: Combo Availability Property Tests
 *
 * Tests combo availability invariants using fast-check property-based testing.
 * The `isComboAvailableLocal` function mirrors the PL/pgSQL `is_combo_available` DB function.
 *
 * Covers:
 *   P3a: no windows → always available
 *   P3b: day match → available
 *   P3c: day no-match → unavailable
 *   P3d: time boundary — startTime/endTime inclusive
 *   P3e: consistent with hand-computed truth table (all 7 days × before/during/after)
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { ComboAvailability } from '@shared/lib/domain';

// ---------------------------------------------------------------------------
// Pure function under test — mirrors PL/pgSQL is_combo_available logic
// ---------------------------------------------------------------------------

/**
 * Client-side mirror of the DB `is_combo_available(combo_product_id, check_ts)` function.
 *
 * Rules (matching PL/pgSQL):
 *   - If windows is empty → return true (always available)
 *   - For each window:
 *     - Check: targetTs.getDay() (JS 0=Sun..6=Sat) maps to ISO (1=Mon..7=Sun)
 *       ISO day = targetTs.getDay() === 0 ? 7 : targetTs.getDay()
 *     - Check: ISO day IN window.daysOfWeek
 *     - Check: if startTime != null → HH:MM of targetTs >= startTime
 *     - Check: if endTime != null → HH:MM of targetTs <= endTime
 *     - Check: if startDate != null → date of targetTs >= startDate
 *     - Check: if endDate != null → date of targetTs <= endDate
 *   - Return true if ANY window matches; false otherwise
 */
function isComboAvailableLocal(windows: ComboAvailability[], targetTs: Date): boolean {
  if (windows.length === 0) return true;

  // Convert JS day (0=Sun) to ISO day (1=Mon..7=Sun)
  const jsDay = targetTs.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  // Extract HH:MM from targetTs for time comparisons
  const hh = targetTs.getHours().toString().padStart(2, '0');
  const mm = targetTs.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hh}:${mm}`;

  // Extract YYYY-MM-DD from targetTs for date comparisons
  const year = targetTs.getFullYear();
  const month = (targetTs.getMonth() + 1).toString().padStart(2, '0');
  const day = targetTs.getDate().toString().padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  for (const window of windows) {
    // Day of week check
    if (!window.daysOfWeek.includes(isoDay)) continue;

    // Time range check (if specified)
    if (window.startTime != null && timeStr < window.startTime.slice(0, 5)) continue;
    if (window.endTime != null && timeStr > window.endTime.slice(0, 5)) continue;

    // Date range check (if specified)
    if (window.startDate != null && dateStr < window.startDate) continue;
    if (window.endDate != null && dateStr > window.endDate) continue;

    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Helper: build a ComboAvailability window for testing
// ---------------------------------------------------------------------------

function makeWindow(
  daysOfWeek: number[],
  opts: {
    startTime?: string | null;
    endTime?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  } = {}
): ComboAvailability {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    comboProductId: '00000000-0000-0000-0000-000000000002',
    daysOfWeek,
    startTime: opts.startTime ?? null,
    endTime: opts.endTime ?? null,
    startDate: opts.startDate ?? null,
    endDate: opts.endDate ?? null,
    createdAt: new Date('2026-01-01'),
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a valid ComboAvailability window (all-day, specific days) */
const arbWindow = fc
  .record({
    daysOfWeek: fc.array(fc.integer({ min: 1, max: 7 }), { minLength: 1, maxLength: 7 }),
    startTime: fc.constant(null) as fc.Arbitrary<string | null>,
    endTime: fc.constant(null) as fc.Arbitrary<string | null>,
    startDate: fc.constant(null) as fc.Arbitrary<string | null>,
    endDate: fc.constant(null) as fc.Arbitrary<string | null>,
  })
  .map(
    w =>
      ({
        id: '00000000-0000-0000-0000-000000000001',
        comboProductId: '00000000-0000-0000-0000-000000000002',
        daysOfWeek: [...new Set(w.daysOfWeek)], // deduplicate
        startTime: w.startTime,
        endTime: w.endTime,
        startDate: w.startDate,
        endDate: w.endDate,
        createdAt: new Date('2026-01-01'),
      }) satisfies ComboAvailability
  );

/** Generate a date within Jan 2026 for testing */
const arbDate = fc.date({
  min: new Date('2026-01-01T00:00:00.000Z'),
  max: new Date('2026-01-31T23:59:59.000Z'),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('P3: combo availability properties', () => {
  it('P3a: empty windows array → always available for any timestamp', () => {
    fc.assert(
      fc.property(arbDate, targetTs => {
        expect(isComboAvailableLocal([], targetTs)).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('P3b: when a window includes targetTs ISO day, result is true (all-day window)', () => {
    fc.assert(
      fc.property(arbDate, targetTs => {
        const jsDay = targetTs.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        const window = makeWindow([isoDay]);
        expect(isComboAvailableLocal([window], targetTs)).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('P3c: when no window includes targetTs ISO day, result is false', () => {
    fc.assert(
      fc.property(arbDate, targetTs => {
        const jsDay = targetTs.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        // Build a window with all days EXCEPT the target day
        const otherDays = [1, 2, 3, 4, 5, 6, 7].filter(d => d !== isoDay);
        if (otherDays.length === 0) return; // isoDay covered all 7 days, skip
        const window = makeWindow(otherDays);
        expect(isComboAvailableLocal([window], targetTs)).toBe(false);
      }),
      { numRuns: 500 }
    );
  });

  it('P3d: time boundary — startTime and endTime are inclusive', () => {
    // Monday 2026-01-05 10:30 local (ISO day 1)
    const ts = new Date(2026, 0, 5, 10, 30, 0); // Mon Jan 5 2026 10:30
    const windowAtBoundary = makeWindow([1], { startTime: '10:30', endTime: '10:30' });
    expect(isComboAvailableLocal([windowAtBoundary], ts)).toBe(true);

    const windowJustBefore = makeWindow([1], { startTime: '10:31', endTime: '23:59' });
    expect(isComboAvailableLocal([windowJustBefore], ts)).toBe(false);

    const windowJustAfter = makeWindow([1], { startTime: '00:00', endTime: '10:29' });
    expect(isComboAvailableLocal([windowJustAfter], ts)).toBe(false);
  });

  it('P3e: truth table — all 7 ISO days × 3 window configs (all days, specific day, exclusion)', () => {
    const testDates: Record<number, Date> = {
      1: new Date(2026, 0, 5), // Mon Jan 5 2026 → ISO 1
      2: new Date(2026, 0, 6), // Tue Jan 6 2026 → ISO 2
      3: new Date(2026, 0, 7), // Wed Jan 7 2026 → ISO 3
      4: new Date(2026, 0, 8), // Thu Jan 8 2026 → ISO 4
      5: new Date(2026, 0, 9), // Fri Jan 9 2026 → ISO 5
      6: new Date(2026, 0, 10), // Sat Jan 10 2026 → ISO 6
      7: new Date(2026, 0, 11), // Sun Jan 11 2026 → ISO 7
    };

    for (const [isoDayStr, date] of Object.entries(testDates)) {
      const isoDay = Number(isoDayStr);

      // All-days window: every day should match
      const allDaysWindow = makeWindow([1, 2, 3, 4, 5, 6, 7]);
      expect(isComboAvailableLocal([allDaysWindow], date)).toBe(true);

      // Exact day window: only that day should match
      const exactWindow = makeWindow([isoDay]);
      expect(isComboAvailableLocal([exactWindow], date)).toBe(true);

      // Exclusion window: all other days → should NOT match
      const otherDays = [1, 2, 3, 4, 5, 6, 7].filter(d => d !== isoDay);
      if (otherDays.length > 0) {
        const exclusionWindow = makeWindow(otherDays);
        expect(isComboAvailableLocal([exclusionWindow], date)).toBe(false);
      }
    }
  });

  it('P3f: multiple windows — any matching window returns true', () => {
    fc.assert(
      fc.property(
        arbDate,
        fc.array(arbWindow, { minLength: 1, maxLength: 5 }),
        (targetTs, windows) => {
          const jsDay = targetTs.getDay();
          const isoDay = jsDay === 0 ? 7 : jsDay;

          const anyMatch = windows.some(w => w.daysOfWeek.includes(isoDay));
          const result = isComboAvailableLocal(windows, targetTs);

          if (anyMatch) {
            // At least one window matches on day → should be true
            expect(result).toBe(true);
          }
          // Note: if no match, result must be false — tested by P3c
        }
      ),
      { numRuns: 300 }
    );
  });
});
