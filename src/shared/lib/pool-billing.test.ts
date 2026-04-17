import { describe, expect, it } from 'vitest';
import { computePoolSessionBilling } from './pool-billing';

describe('computePoolSessionBilling', () => {
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
});
