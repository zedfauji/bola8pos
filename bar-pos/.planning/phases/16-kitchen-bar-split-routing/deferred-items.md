# Phase 16 — Deferred Items (out of scope for 16-07)

Discovered during 16-07 Task 1/2 execution. Not fixed because they fall outside this
plan's `<files>` scope and outside its explicit verification gate (`! grep -rn "is_food" src/`
only checks `src/`, not `e2e/`).

## 1. `e2e/18-modifier-notes-kds.spec.ts` references the dropped `is_food` column

- `setupKdsSeedProduct()` (line 75) and `teardownKdsSeedProduct()` (line 98) still do
  `admin.from('categories').update({ is_food: true/false })...` — this column was dropped
  by the `20260706000001_categories_routing.sql` migration (16-02).
- **Not currently a live bug**: the only test that calls these helpers is `T3`, which is
  already `test.skip(true, ...)` (blocked on a separate `order_item_modifiers` table gap,
  documented in the file's own header comment) — so these helpers never execute today.
- If T3 is ever unblocked/re-enabled, these two helpers must be updated to
  `.update({ routing: 'KITCHEN' / 'BAR' })` (or whatever prior routing value should be
  restored in teardown) before re-enabling.

## 2. `e2e/31-categories.spec.ts` T6 inserts `is_food: false` directly

- Line 334: `admin.from('categories').insert({ ..., combo_eligible: false, is_food: false })`.
- This will fail against the live DB post-16-02 (unknown column error), which would flip
  `expect(insertErr).toBeNull()` to fail. This spec is not part of 16-07's Task 3 checkpoint
  (only `40-kds-bar.spec.ts` and `28-kds.spec.ts` are run there), so it was not caught by
  this plan's live-E2E gate.
- Fix: drop the `is_food: false` field from the insert payload (or replace with
  `routing: 'NONE'` if a specific routing value is required for the test's assertions).

Neither item blocks 16-07's success criteria (KBR-01..04). Recommended: address in a small
follow-up cleanup pass, or fold into whichever future plan next touches these two spec files.
