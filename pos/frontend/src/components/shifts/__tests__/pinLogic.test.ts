import { describe, it, expect } from 'vitest';
import { needsPinForPayout } from '../pinLogic';

describe('needsPinForPayout', () => {
  it('returns true when globally required regardless of amount', () => {
    expect(needsPinForPayout({ amount: 0, threshold: 50, globallyRequired: true })).toBe(true);
    expect(needsPinForPayout({ amount: 100, threshold: 50, globallyRequired: true })).toBe(true);
  });

  it('returns false when below threshold and not globally required', () => {
    expect(needsPinForPayout({ amount: 10, threshold: 50, globallyRequired: false })).toBe(false);
  });

  it('returns true when at threshold and not globally required', () => {
    expect(needsPinForPayout({ amount: 50, threshold: 50, globallyRequired: false })).toBe(true);
  });

  it('returns true when above threshold and not globally required', () => {
    expect(needsPinForPayout({ amount: 60, threshold: 50, globallyRequired: false })).toBe(true);
  });
});
