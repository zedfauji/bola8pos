import * as fc from 'fast-check'; // fast-check BEFORE vitest per ESLint import/order rule
import { describe, it } from 'vitest';

// Wave 0 stub — full test cases added in Plan 07-07
void fc; // suppress unused-import lint warning until Plan 07-07 adds property tests

describe('computeQuotedWait', () => {
  it.todo('returns 5 (floor) when 0 parties are ahead');
  it.todo('returns avgTurn when 1 party ahead, 1 table');
  it.todo('returns ceil(partiesAhead / tables) * avgTurn for 2 parties, 1 table');
  it.todo('divides wait by available tables (2 parties, 2 tables → 30min)');
  it.todo('returns 0 when targetEntryId not found');
  it.todo('does not count smaller party sizes as ahead for larger target');
  it.todo('P: result is always >= 5 (floor invariant)');
  it.todo('P: result is monotonically non-decreasing as parties-ahead increases');
});
