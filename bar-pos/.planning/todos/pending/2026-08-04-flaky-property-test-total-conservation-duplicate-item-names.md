---
created: 2026-08-04T00:00:00.000Z
title: Flaky "total conservation" property test on duplicate item names
area: testing
severity: minor
files:
  - src/shared/lib/groupOrderItemsForReceipt.test.ts:128-140 (total conservation property)
---

## Problem

Discovered during Phase 39 plan 39-04 while investigating why
`e2e/01-ci.spec.ts`'s `npm run test exits 0` assertion sometimes fails even
after fixing the spec's unrelated `cmd.exe`-on-Ubuntu harness bug (see
`39-04-LEDGER.md`).

The "total conservation" fast-check property in
`groupOrderItemsForReceipt.test.ts` asserts:

```ts
expect([...flat].sort((a, b) => a.name.localeCompare(b.name))).toEqual(
  [...rows].sort((a, b) => a.name.localeCompare(b.name))
);
```

`arbRow`'s `name` field is not constrained to be unique
(`fc.string({ minLength: 1, maxLength: 12 })`), so the generated input array
can contain two or more rows sharing the same `name` but different
`categoryId`/`categoryName`. `groupByCategory` deliberately reorders items
by category (that's its whole job), which changes the *relative* order of
same-named rows that belong to different categories. Because
`Array.prototype.sort` is stable, sorting `flat` (post-grouping order) and
`rows` (original order) by `name` alone preserves each array's own pre-sort
relative order among equal-name ties — but those two pre-sort orders differ
from each other whenever a duplicate name spans categories, so the two
sorted arrays are not always equal even though `groupByCategory`'s actual
conservation guarantee (every input row appears exactly once in the output,
no drops/dupes) holds.

This is a test-design bug, not a `groupByCategory` bug: the property is true
about *set* conservation but the assertion method (sort-by-name-and-compare)
is not order-insensitive when `name` has duplicates. It only reproduces on
the specific fast-check-generated cases (no fixed seed) where two rows share
a `name` across categories — appeared once in a `39-04` verification run,
did not reproduce on an isolated single-file re-run without the exact same
seed.

## Solution

TBD. Options to evaluate:
- Compare by a stable per-row identity instead of `name` (e.g. tag each
  generated row with an index before flattening, or compare multisets via a
  count-per-row-object approach) rather than sorting by a non-unique field.
- Constrain `arbRow`'s `name` arbitrary to unique values per generated array
  (`fc.uniqueArray` keyed on `name`) if duplicate names are not meaningful to
  the property being tested.
- If duplicate names ARE meaningful to conserve test realism, switch the
  equality check to a multiset comparison independent of original array
  order (e.g. sort by a stable composite key like `name+categoryId+index`,
  or count occurrences of each distinct row object).
