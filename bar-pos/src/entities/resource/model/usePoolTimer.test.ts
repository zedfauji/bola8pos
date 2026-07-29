import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePoolTimer } from './usePoolTimer';

describe('usePoolTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns zeros when no startedAt', () => {
    const now = new Date('2026-04-17T12:00:00.000Z');
    vi.setSystemTime(now);

    const { result } = renderHook(() => usePoolTimer(null, 10, 'prorated'));

    expect(result.current.totalSeconds).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.currentCharge).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.totalSeconds).toBe(0);
  });

  it('tracks elapsed from startedAt against system clock', () => {
    const now = new Date('2026-04-17T12:00:00.000Z');
    vi.setSystemTime(now);
    const startedAt = new Date(now.getTime() - 120_000);

    const { result } = renderHook(() => usePoolTimer(startedAt, 10, 'prorated'));

    expect(result.current.totalSeconds).toBe(120);
    expect(result.current.isRunning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.totalSeconds).toBe(121);
  });

  it('bills 1 minute as $2.50 at $10/hr (15-min minimum)', () => {
    const now = new Date('2026-04-17T12:00:00.000Z');
    vi.setSystemTime(now);
    const startedAt = new Date(now.getTime() - 60_000);

    const { result } = renderHook(() => usePoolTimer(startedAt, 10, 'prorated'));

    expect(result.current.currentCharge).toBe(2.5);
  });

  it('bills 16 minutes as $5.00 at $10/hr (rounds up to 30 min)', () => {
    const now = new Date('2026-04-17T12:00:00.000Z');
    vi.setSystemTime(now);
    const startedAt = new Date(now.getTime() - 16 * 60_000);

    const { result } = renderHook(() => usePoolTimer(startedAt, 10, 'prorated'));

    expect(result.current.currentCharge).toBe(5.0);
  });

  it('bills exactly 60 minutes as $10.00 at $10/hr', () => {
    const now = new Date('2026-04-17T12:00:00.000Z');
    vi.setSystemTime(now);
    const startedAt = new Date(now.getTime() - 60 * 60_000);

    const { result } = renderHook(() => usePoolTimer(startedAt, 10, 'prorated'));

    expect(result.current.currentCharge).toBe(10.0);
  });

  it('clears interval on unmount', () => {
    const now = new Date('2026-04-17T12:00:00.000Z');
    vi.setSystemTime(now);
    const startedAt = new Date(now.getTime() - 30_000);

    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

    const { unmount } = renderHook(() => usePoolTimer(startedAt, 10, 'prorated'));

    expect(clearIntervalSpy).not.toHaveBeenCalled();

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('full mode: charges 60 min minimum for a 30-min session', () => {
    const baseTime = new Date('2026-04-17T12:00:00.000Z');
    vi.setSystemTime(new Date(baseTime.getTime() + 30 * 60 * 1000));
    const startedAt = baseTime;

    const { result } = renderHook(() => usePoolTimer(startedAt, 60, 'full'));

    expect(result.current.billedMinutes).toBe(60);
    expect(result.current.currentCharge).toBe(60);
  });

  it('prorated mode: charges 15-min blocks for a 7-min session', () => {
    const baseTime = new Date('2026-04-17T12:00:00.000Z');
    vi.setSystemTime(new Date(baseTime.getTime() + 7 * 60 * 1000));
    const startedAt = baseTime;

    const { result } = renderHook(() => usePoolTimer(startedAt, 60, 'prorated'));

    expect(result.current.billedMinutes).toBe(15);
    expect(result.current.currentCharge).toBeCloseTo(15, 1);
  });
});
