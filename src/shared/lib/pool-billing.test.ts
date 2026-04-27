import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computePoolSessionBilling } from './pool-billing';

describe('computePoolSessionBilling', () => {
  // --- Existing prorated tests ---
  it('bills sub-1-minute wall time as 15 minutes', () => {
    const startedAt = new Date('2026-01-01T10:00:00.000Z');
    const endTime = new Date('2026-01-01T10:00:30.000Z');
    const r = computePoolSessionBilling({ startedAt, endTime, ratePerHour: 10 });
    expect(r.elapsedMinutes).toBe(1);
    expect(r.billedMinutes).toBe(15);
    expect(r.totalCharge).toBe((15 / 60) * 10);
  });

  it('bills 14 minutes wall as 15 billed minutes', () => {
    const startedAt = new Date('2026-01-01T10:00:00.000Z');
    const endTime = new Date('2026-01-01T10:14:00.000Z');
    const r = computePoolSessionBilling({ startedAt, endTime, ratePerHour: 10 });
    expect(r.elapsedMinutes).toBe(14);
    expect(r.billedMinutes).toBe(15);
    expect(r.totalCharge).toBe(2.5);
  });

  it('bills exactly 15 minutes as one block', () => {
    const startedAt = new Date('2026-01-01T10:00:00.000Z');
    const endTime = new Date('2026-01-01T10:15:00.000Z');
    const r = computePoolSessionBilling({ startedAt, endTime, ratePerHour: 10 });
    expect(r.elapsedMinutes).toBe(15);
    expect(r.billedMinutes).toBe(15);
    expect(r.totalCharge).toBe(2.5);
  });

  it('bills 16 minutes as 30-minute block', () => {
    const startedAt = new Date('2026-01-01T10:00:00.000Z');
    const endTime = new Date('2026-01-01T10:16:00.000Z');
    const r = computePoolSessionBilling({ startedAt, endTime, ratePerHour: 10 });
    expect(r.elapsedMinutes).toBe(16);
    expect(r.billedMinutes).toBe(30);
    expect(r.totalCharge).toBe(5.0);
  });

  it('scales charge with hourly rate', () => {
    const startedAt = new Date('2026-01-01T10:00:00.000Z');
    const endTime = new Date('2026-01-01T10:01:00.000Z');
    const r = computePoolSessionBilling({ startedAt, endTime, ratePerHour: 20 });
    expect(r.billedMinutes).toBe(15);
    expect(r.totalCharge).toBe(5.0);
  });

  // --- New prorated mode tests ---
  it('rounds up to 15-minute blocks in prorated mode', () => {
    const start = new Date('2024-01-01T10:00:00Z');
    const end = new Date('2024-01-01T10:16:00Z'); // 16 min → 30 billed
    const result = computePoolSessionBilling({ startedAt: start, endTime: end, ratePerHour: 60 });
    expect(result.billedMinutes).toBe(30);
    expect(result.totalCharge).toBe(30);
  });

  it('charges 15 min minimum in prorated mode (5 min session)', () => {
    const start = new Date('2024-01-01T10:00:00Z');
    const end = new Date('2024-01-01T10:05:00Z');
    const result = computePoolSessionBilling({
      startedAt: start,
      endTime: end,
      ratePerHour: 60,
      firstHourMode: 'prorated',
    });
    expect(result.billedMinutes).toBe(15);
    expect(result.totalCharge).toBe(15);
  });

  // --- Full mode tests ---
  it('charges full hour when elapsed < 60 min in full mode', () => {
    const start = new Date('2024-01-01T10:00:00Z');
    const end = new Date('2024-01-01T10:30:00Z'); // 30 min
    const result = computePoolSessionBilling({
      startedAt: start,
      endTime: end,
      ratePerHour: 60,
      firstHourMode: 'full',
    });
    expect(result.billedMinutes).toBe(60);
    expect(result.totalCharge).toBe(60);
  });

  it('uses 15-min blocks when elapsed >= 60 min in full mode', () => {
    const start = new Date('2024-01-01T10:00:00Z');
    const end = new Date('2024-01-01T11:16:00Z'); // 76 min → 90 billed
    const result = computePoolSessionBilling({
      startedAt: start,
      endTime: end,
      ratePerHour: 60,
      firstHourMode: 'full',
    });
    expect(result.billedMinutes).toBe(90);
    expect(result.totalCharge).toBe(90);
  });

  it('exactly 60 min: both modes charge the same', () => {
    const start = new Date('2024-01-01T10:00:00Z');
    const end = new Date('2024-01-01T11:00:00Z');
    const prorated = computePoolSessionBilling({
      startedAt: start,
      endTime: end,
      ratePerHour: 60,
      firstHourMode: 'prorated',
    });
    const full = computePoolSessionBilling({
      startedAt: start,
      endTime: end,
      ratePerHour: 60,
      firstHourMode: 'full',
    });
    expect(prorated.totalCharge).toBe(full.totalCharge);
  });

  it('full mode at boundary: 59 min charges 60 min', () => {
    const start = new Date(0);
    const end = new Date(59 * 60 * 1000);
    const result = computePoolSessionBilling({
      startedAt: start,
      endTime: end,
      ratePerHour: 60,
      firstHourMode: 'full',
    });
    expect(result.billedMinutes).toBe(60);
  });

  // --- Property-based tests ---
  it('carom rate produces proportionally different charges (fast-check)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 120 }), // elapsed minutes
        fc.float({ min: 10, max: 200, noNaN: true }), // pool rate
        fc.float({ min: 10, max: 200, noNaN: true }), // carom rate
        (elapsedMin, poolRate, caromRate) => {
          const start = new Date(0);
          const end = new Date(elapsedMin * 60 * 1000);
          const poolResult = computePoolSessionBilling({
            startedAt: start,
            endTime: end,
            ratePerHour: poolRate,
          });
          const caromResult = computePoolSessionBilling({
            startedAt: start,
            endTime: end,
            ratePerHour: caromRate,
          });
          // Same elapsed → same billedMinutes
          expect(caromResult.billedMinutes).toBe(poolResult.billedMinutes);
          // Charge proportional to rate
          if (poolRate > 0) {
            expect(caromResult.totalCharge / caromRate).toBeCloseTo(
              poolResult.totalCharge / poolRate,
              5
            );
          }
        }
      )
    );
  });

  it('totalCharge = (billedMinutes / 60) * ratePerHour (fast-check)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 480 }),
        fc.float({ min: 1, max: 500, noNaN: true }),
        (elapsedMin, rate) => {
          const start = new Date(0);
          const end = new Date(elapsedMin * 60 * 1000);
          const result = computePoolSessionBilling({
            startedAt: start,
            endTime: end,
            ratePerHour: rate,
          });
          expect(result.totalCharge).toBeCloseTo((result.billedMinutes / 60) * rate, 5);
        }
      )
    );
  });

  it('totalCharge invariant: always equals (billedMinutes / 60) * ratePerHour for both modes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 180 }),
        fc.float({ min: Math.fround(10), max: Math.fround(200), noNaN: true }),
        fc.constantFrom('full' as const, 'prorated' as const),
        (elapsedMin, rate, mode) => {
          const start = new Date(0);
          const end = new Date(elapsedMin * 60 * 1000);
          const r = computePoolSessionBilling({
            startedAt: start,
            endTime: end,
            ratePerHour: rate,
            firstHourMode: mode,
          });
          expect(r.totalCharge).toBeCloseTo((r.billedMinutes / 60) * rate, 5);
        }
      )
    );
  });

  // --- prepaidMinutes tests ---
  it('prepaidMinutes=0 is backward compatible with no-prepaid behavior', () => {
    const start = new Date(0);
    const end = new Date(90 * 60 * 1000); // 90 minutes
    const withZero = computePoolSessionBilling({
      startedAt: start,
      endTime: end,
      ratePerHour: 100,
      prepaidMinutes: 0,
    });
    const withoutPrepaid = computePoolSessionBilling({
      startedAt: start,
      endTime: end,
      ratePerHour: 100,
    });
    expect(withZero.totalCharge).toBe(withoutPrepaid.totalCharge);
    expect(withZero.billedMinutes).toBe(withoutPrepaid.billedMinutes);
    expect(withZero.elapsedMinutes).toBe(withoutPrepaid.elapsedMinutes);
  });

  it('prepaidMinutes=60 with 90 elapsed at rate 100/hr: billedMinutes=30, totalCharge=50', () => {
    const start = new Date(0);
    const end = new Date(90 * 60 * 1000); // 90 minutes elapsed
    const result = computePoolSessionBilling({
      startedAt: start,
      endTime: end,
      ratePerHour: 100,
      prepaidMinutes: 60,
    });
    expect(result.elapsedMinutes).toBe(90);
    expect(result.billedMinutes).toBe(30);
    expect(result.totalCharge).toBeCloseTo(50, 5);
  });

  it('prepaidMinutes >= elapsed: totalCharge is 0 (no negative charges)', () => {
    const start = new Date(0);
    const end = new Date(90 * 60 * 1000); // 90 minutes elapsed
    const result = computePoolSessionBilling({
      startedAt: start,
      endTime: end,
      ratePerHour: 100,
      prepaidMinutes: 120, // more than elapsed
    });
    expect(result.totalCharge).toBe(0);
    expect(result.billedMinutes).toBe(0);
    expect(result.elapsedMinutes).toBe(90); // actual elapsed still reported
  });

  it('prepaidMinutes=60 with firstHourMode=full and 45 elapsed: full hour applies, chargeable=0', () => {
    const start = new Date(0);
    const end = new Date(45 * 60 * 1000); // 45 minutes elapsed
    const result = computePoolSessionBilling({
      startedAt: start,
      endTime: end,
      ratePerHour: 100,
      firstHourMode: 'full',
      prepaidMinutes: 60,
    });
    // full mode bills 60 for <60min sessions, then subtract 60 prepaid → 0
    expect(result.totalCharge).toBe(0);
    expect(result.billedMinutes).toBe(0);
  });

  it('prepaidMinutes: property test — totalCharge never negative (fast-check)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 480 }),
        fc.integer({ min: 0, max: 600 }),
        fc.float({ min: 1, max: 500, noNaN: true }),
        (elapsedMin, prepaid, rate) => {
          const start = new Date(0);
          const end = new Date(elapsedMin * 60 * 1000);
          const result = computePoolSessionBilling({
            startedAt: start,
            endTime: end,
            ratePerHour: rate,
            prepaidMinutes: prepaid,
          });
          expect(result.totalCharge).toBeGreaterThanOrEqual(0);
          expect(result.billedMinutes).toBeGreaterThanOrEqual(0);
          expect(result.elapsedMinutes).toBe(elapsedMin);
        }
      )
    );
  });
});
