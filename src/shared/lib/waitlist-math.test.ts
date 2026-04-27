import * as fc from 'fast-check'; // fast-check BEFORE vitest per ESLint import/order rule
import { describe, expect, it } from 'vitest';

import { computeQuotedWait, type WaitlistMathInput } from './waitlist-math';

function makeEntry(
  id: string,
  partySize: number,
  minutesAgo: number,
  status: 'waiting' | 'notified' | 'seated' | 'no_show' | 'cancelled' = 'waiting',
) {
  const createdAt = new Date(Date.now() - minutesAgo * 60 * 1000);
  return { id, partySize, status, createdAt, seatedAt: null as Date | null };
}

function makeInput(overrides: Partial<WaitlistMathInput> = {}): WaitlistMathInput {
  return {
    entries: [],
    targetEntryId: 'target',
    availableTableCount: 1,
    averageTurnMinutesByPartySize: new Map([[2, 30]]),
    ...overrides,
  };
}

describe('computeQuotedWait', () => {
  it('returns 5 (floor) when 0 parties are ahead', () => {
    const target = makeEntry('target', 2, 0);
    const result = computeQuotedWait(makeInput({ entries: [target], targetEntryId: 'target' }));
    expect(result).toBe(5);
  });

  it('returns avgTurn when 1 party ahead, 1 table', () => {
    const ahead = makeEntry('ahead', 2, 10);
    const target = makeEntry('target', 2, 0);
    const result = computeQuotedWait(
      makeInput({
        entries: [ahead, target],
        targetEntryId: 'target',
        availableTableCount: 1,
        averageTurnMinutesByPartySize: new Map([[2, 30]]),
      }),
    );
    expect(result).toBe(30);
  });

  it('returns ceil(partiesAhead / tables) * avgTurn for 2 parties, 1 table', () => {
    const ahead1 = makeEntry('a1', 2, 20);
    const ahead2 = makeEntry('a2', 2, 10);
    const target = makeEntry('target', 2, 0);
    const result = computeQuotedWait(
      makeInput({
        entries: [ahead1, ahead2, target],
        targetEntryId: 'target',
        availableTableCount: 1,
        averageTurnMinutesByPartySize: new Map([[2, 30]]),
      }),
    );
    expect(result).toBe(60);
  });

  it('divides wait by available tables (2 parties, 2 tables → 30min)', () => {
    const ahead1 = makeEntry('a1', 2, 20);
    const ahead2 = makeEntry('a2', 2, 10);
    const target = makeEntry('target', 2, 0);
    const result = computeQuotedWait(
      makeInput({
        entries: [ahead1, ahead2, target],
        targetEntryId: 'target',
        availableTableCount: 2,
        averageTurnMinutesByPartySize: new Map([[2, 30]]),
      }),
    );
    expect(result).toBe(30);
  });

  it('returns 0 when targetEntryId not found', () => {
    const result = computeQuotedWait(makeInput({ entries: [], targetEntryId: 'not-found' }));
    expect(result).toBe(0);
  });

  it('does not count smaller party sizes as ahead for larger target', () => {
    // Party of 4 should not be blocked by party of 2
    const smallAhead = makeEntry('small', 2, 10);
    const target = makeEntry('target', 4, 0);
    const result = computeQuotedWait(
      makeInput({
        entries: [smallAhead, target],
        targetEntryId: 'target',
        availableTableCount: 1,
        averageTurnMinutesByPartySize: new Map([[4, 45]]),
      }),
    );
    expect(result).toBe(5); // floor — no parties of size >= 4 ahead
  });

  it('P: result is always >= 5 (floor invariant)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 1, max: 4 }),
        (partiesAheadCount, tables) => {
          const target = makeEntry('target', 2, 0);
          const ahead = Array.from({ length: partiesAheadCount }, (_, i) =>
            makeEntry(`a${i}`, 2, (i + 1) * 5),
          );
          const result = computeQuotedWait(
            makeInput({
              entries: [...ahead, target],
              targetEntryId: 'target',
              availableTableCount: tables,
              averageTurnMinutesByPartySize: new Map([[2, 30]]),
            }),
          );
          return result >= 5;
        },
      ),
    );
  });

  it('P: result is monotonically non-decreasing as parties-ahead increases', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 8 }), (n) => {
        const target = makeEntry('target', 2, 0);
        const aheadN = Array.from({ length: n }, (_, i) => makeEntry(`a${i}`, 2, (i + 1) * 5));
        const aheadN1 = [...aheadN, makeEntry('extra', 2, (n + 1) * 5)];
        const resultN = computeQuotedWait(
          makeInput({ entries: [...aheadN, target], targetEntryId: 'target', availableTableCount: 1 }),
        );
        const resultN1 = computeQuotedWait(
          makeInput({ entries: [...aheadN1, target], targetEntryId: 'target', availableTableCount: 1 }),
        );
        return resultN1 >= resultN;
      }),
    );
  });
});
