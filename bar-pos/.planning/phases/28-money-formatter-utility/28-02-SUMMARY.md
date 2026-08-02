---
phase: 28-money-formatter-utility
plan: 02
subsystem: ui
tags: [i18n, formatMoneyIn, Intl.NumberFormat, receipts, pdf, react-pdf]

# Dependency graph
requires:
  - phase: 28-money-formatter-utility (plan 01)
    provides: "src/shared/lib/format.ts (formatMoney, formatMoneyIn, formatPercent, parseMoneyInput)"
provides:
  - "receipt-format.ts and exporters/pdf.tsx routed through formatMoneyIn(locale, ...) instead of the live-locale formatMoney"
  - "ResourceIllustration.tsx migrated to @shared/lib/format, doubled currency symbol bug fixed"
  - "domain-helpers.ts's superseded formatMoney deleted — exactly one formatMoney definition remains in the codebase"
affects: [28-03, 28-04, 28-05, 28-06, 28-07, 28-08, 28-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Locale-parameterized consumers (receipts/PDFs) call formatMoneyIn(locale, amount) with their own already-threaded locale argument, never the live-session formatMoney()"
    - "pdf.tsx's local fmt(locale, n) helper delegates to formatMoneyIn instead of hand-building a $-prefixed string"

key-files:
  created: []
  modified:
    - src/shared/lib/receipt-format.ts
    - src/shared/lib/receipt-format.test.ts
    - src/shared/lib/exporters/pdf.tsx
    - src/entities/resource/ui/ResourceIllustration.tsx
    - src/shared/lib/domain-helpers.ts
    - src/shared/lib/domain-helpers.test.ts
    - src/shared/lib/format.test.ts

key-decisions:
  - "Ported the single missing case (0.01, single-cent) from domain-helpers.test.ts into format.test.ts before deleting the old describe block, per task 3's instruction — the zero/negative/half-cent-rounding cases were already covered by plan 01"
  - "Did not reintroduce the old ungrouped four-digit or fixed-point half-cent expectations from domain-helpers.test.ts — the shared formatter's digit-grouping and half-expand rounding are the intentional, already-pinned replacement behavior"

requirements-completed: [SC-2, SC-4]

coverage:
  - id: D1
    description: "receipt-format.ts (buildThermalReceiptText, buildPreChequeText) formats every money line, including the pool-rate label, through formatMoneyIn(locale, ...) using the function's own locale argument, not the live i18n session"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/shared/lib/receipt-format.test.ts#28-02: building with en-US while the live i18n language is es-MX still yields the en-US symbol (no MX$ prefix)"
        status: pass
      - kind: unit
        ref: "src/shared/lib/receipt-format.test.ts#28-02: pool-rate line renders the rate through formatMoneyIn (two-decimal, locale-symbol) instead of a hand-built currency string"
        status: pass
    human_judgment: false
  - id: D2
    description: "exporters/pdf.tsx's local fmt() helper takes an explicit locale and delegates to formatMoneyIn at all 20 call sites across every PDF document type"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/shared/lib/exporters/pdf.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "ResourceIllustration.tsx imports formatMoney from @shared/lib/format and no longer renders a doubled currency symbol on the live-charge overlay"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/entities/resource (3 test files, 16 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "domain-helpers.ts's superseded formatMoney is deleted with no re-export shim; npm run typecheck confirms zero surviving importers repo-wide"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "npm run typecheck"
        status: pass
      - kind: unit
        ref: "src/shared/lib/domain-helpers.test.ts, src/shared/lib/format.test.ts"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-08-02
status: complete
---

# Phase 28 Plan 02: Money Formatter Utility - Migrate Receipt/PDF/Entity Consumers Summary

**Migrated `receipt-format.ts`, `exporters/pdf.tsx`, and `ResourceIllustration.tsx` off the live-locale `formatMoney` onto `formatMoneyIn(locale, ...)`, fixed a pre-existing doubled-currency-symbol bug, then deleted `domain-helpers.ts`'s superseded `formatMoney` so `npm run typecheck` proves no importer survives.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-02 (approx., not captured at session start)
- **Completed:** 2026-08-02T19:43:38Z
- **Tasks:** 3
- **Files modified:** 7 (6 planned + 1 unplanned test addition to `format.test.ts`, required by task 3's own instructions)

## Accomplishments
- `receipt-format.ts`'s `buildThermalReceiptText` and `buildPreChequeText` now format every money line — including the previously hand-built pool-rate label (`$${rate}/h` → `formatMoneyIn(locale, rate)}/h`) — through `formatMoneyIn(locale, ...)`, using the function's own `locale` argument instead of the live i18n session. Proven by a new regression test that builds with `'en-US'` while the live language is `'es-MX'` and asserts the `en-US` symbol survives.
- `exporters/pdf.tsx`'s local `fmt(n)` helper became `fmt(locale, n)`, delegating to `formatMoneyIn`; all 20 call sites across every PDF document type (Caja report, product sales, hourly sales, void/refund, category revenue, staff metrics/tips, combo mix, recipe variance, waitlist metrics, refunds register) now pass the same `locale` already threaded to `pdfT(locale)`.
- `ResourceIllustration.tsx` migrated its import to `@shared/lib/format` and — while touching that line — fixed a pre-existing doubled-currency-symbol bug on the live-charge overlay (`${formatMoney(...)}` was rendering a literal `$` in front of the formatter's own already-prefixed `MX$`/`$` output).
- `domain-helpers.ts`'s `formatMoney` (and its JSDoc) deleted outright, no re-export shim. `npm run typecheck` passes clean, proving zero surviving importers repo-wide. `formatMoney` now exists in exactly one place: `src/shared/lib/format.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Route receipt and PDF money through the locale-parameterized formatter** - `b93ddc9` (feat)
2. **Task 2: Migrate ResourceIllustration and fix its doubled currency symbol** - `b88810b` (fix)
3. **Import-order lint fix on receipt-format.ts (post-task-1 lint pass)** - `fd84863` (style)
4. **Task 3: Delete the superseded helper and relocate its tests** - `aa7715d` (refactor)

**Plan metadata:** commit pending (see final commit step)

## Files Created/Modified
- `src/shared/lib/receipt-format.ts` - Import swap to `formatMoneyIn`, every money call now passes `locale`, pool-rate label routed through the formatter
- `src/shared/lib/receipt-format.test.ts` - Added cross-locale regression assertion and pool-rate formatter assertion (29 tests, up from 27)
- `src/shared/lib/exporters/pdf.tsx` - `fmt()` now takes `locale` and delegates to `formatMoneyIn`; 20 call sites updated
- `src/entities/resource/ui/ResourceIllustration.tsx` - Import swap to `@shared/lib/format`; removed the duplicated literal `$` before the live-charge overlay's `formatMoney()` call
- `src/shared/lib/domain-helpers.ts` - Deleted `formatMoney` export and its JSDoc (lines 140-164 in the pre-edit file)
- `src/shared/lib/domain-helpers.test.ts` - Removed `formatMoney` from the import list and deleted its describe block
- `src/shared/lib/format.test.ts` - Added the one case (`0.01`, single-cent) from the deleted `domain-helpers.test.ts` describe block not already covered by plan 01

## Decisions Made
- Ported only the single-cent (`0.01`) case into `format.test.ts` — zero, negative, and half-cent-rounding cases were already pinned there by plan 01. Deliberately did not reintroduce the old ungrouped four-digit expectation or the old fixed-point half-cent expectation; those are the intentional, already-documented behavior changes plan 01 shipped.
- Kept the import-order lint fix on `receipt-format.ts` as its own small commit (`fd84863`) rather than amending task 1's commit, per the "always create new commits" rule — it surfaced only after `eslint --fix` ran post-commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `node_modules`/`.env.local` in fresh worktree**
- **Found during:** Pre-task setup
- **Issue:** This worktree checkout had neither `node_modules` nor `.env.local` (both gitignored, fresh worktree), blocking `npx vitest`/`npm run typecheck`/`npm run lint`.
- **Fix:** Symlinked both from the main repo checkout (`/mnt/ai/bola8pos-kiro/bar-pos/node_modules`, `/mnt/ai/bola8pos-kiro/bar-pos/.env.local`). No project files changed by this step. Same pattern plan 01 used in its own worktree.
- **Files modified:** None (symlinks only, outside git tracking)

**2. [Rule 1 - Bug] Import-order lint violation on receipt-format.ts**
- **Found during:** Post-task-1 lint pass
- **Issue:** `import/order` flagged the new `formatMoneyIn` import as out of order relative to the type-only `ReceiptData` import.
- **Fix:** `eslint --fix` reordered the imports (type import before value import, alphabetical).
- **Files modified:** `src/shared/lib/receipt-format.ts`
- **Verification:** `npx eslint` clean afterward
- **Committed in:** `fd84863`

---

**Total deviations:** 2 auto-fixed (1 blocking environment setup, 1 lint bug). No scope creep — both were necessary to complete the plan as written.

## Issues Encountered
- `npx vitest run src/shared/lib` surfaced 1 failure in `groupOrderItemsForReceipt.test.ts` (a fast-check property test comparing category-sort output — the "locale-unaware category sort" issue already documented in PROJECT.md from a prior code review). Re-ran twice in isolation; passed cleanly both times. Confirmed via `git diff --stat` against this plan's base commit that no file in this plan's diff touches `groupOrderItemsForReceipt.ts` or its dependency chain. Out of scope per the SCOPE BOUNDARY rule — pre-existing flakiness, not caused by this plan.
- `npm run test` (full suite) surfaced 1 failure in `src/entities/staff/model/queries.clock.test.ts` (`useMutationClockOut` optimistic-update assertion). Reproduced consistently in isolation (not flaky), but confirmed via `git diff --stat` that this plan's commits never touch that file, its source module, or any money-formatting import in that chain. Pre-existing, unrelated to money formatting — out of scope per SCOPE BOUNDARY rule. Not fixed; not logged as a plan deviation since it predates this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `formatMoney`/`formatMoneyIn` from `@shared/lib/format` are now the sole money-formatting path for receipts, pre-cheques, all PDF report types, and `ResourceIllustration`'s pool-timer overlay.
- `domain-helpers.ts` no longer exports `formatMoney` — any future plan that greps for `formatMoney` importers will find exactly one source: `src/shared/lib/format.ts`.
- Plan 08's human-verify checkpoint should visually confirm one exported PDF and the pre-cheque pool-rate line render correctly with the `MX$`/`$` prefix and no column-alignment regression on the 32-column thermal receipt (T-28-05, accepted risk in this plan's threat model).
- Two pre-existing, unrelated test issues noted above (`groupOrderItemsForReceipt.test.ts` flakiness, `queries.clock.test.ts` failure) remain open — not this plan's scope to fix.

---
*Phase: 28-money-formatter-utility*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: src/shared/lib/receipt-format.ts (formatMoneyIn present)
- FOUND: src/shared/lib/exporters/pdf.tsx (formatMoneyIn present)
- FOUND: src/entities/resource/ui/ResourceIllustration.tsx (single currency symbol)
- FOUND: src/shared/lib/domain-helpers.ts (formatMoney deleted, 0 exports remain)
- FOUND commit: b93ddc9
- FOUND commit: b88810b
- FOUND commit: fd84863
- FOUND commit: aa7715d
