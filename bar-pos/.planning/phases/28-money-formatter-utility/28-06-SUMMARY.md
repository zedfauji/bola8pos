---
phase: 28-money-formatter-utility
plan: 06
subsystem: ui
tags: [i18n, formatting, react-i18next, money, refunds, caja, promotions, split-tab]

# Dependency graph
requires:
  - phase: 28-money-formatter-utility
    provides: "formatMoney/formatMoneyIn/formatPercent/parseMoneyInput in src/shared/lib/format.ts (Plan 01)"
provides:
  - "Refund, caja-entry, promotion, paid-tab-edit, and split-tab confirmation/summary copy rendered through formatMoney/formatPercent instead of hand-built currency strings"
  - "featOrders/featMgmt catalogs (both locales) with currency/percent characters removed from formatter-fed placeholders"
affects: [manage-promotions, process-refund, register-caja-entry, edit-paid-tab, split-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Branch-aware formatter selection: money vs. percent formatter chosen by discount-type branch, not applied uniformly"
    - "Signed-delta hints use formatMoney(value, { showSign: true }) instead of Math.abs() + hand-built template"

key-files:
  created: []
  modified:
    - src/features/process-refund/ui/RefundSheet.tsx
    - src/features/register-caja-entry/ui/RegisterCajaEntryDialog.tsx
    - src/features/manage-promotions/ui/ManagePromotionsTab.tsx
    - src/features/edit-paid-tab/ui/EditPaidTabDialog.tsx
    - src/features/split-tab/ui/SplitTabSheet.tsx
    - src/shared/lib/i18n/locales/es-MX/featOrders.json
    - src/shared/lib/i18n/locales/en-US/featOrders.json
    - src/shared/lib/i18n/locales/es-MX/featMgmt.json
    - src/shared/lib/i18n/locales/en-US/featMgmt.json

key-decisions:
  - "EditPaidTabDialog's totalDeltaHint switched from Math.abs(delta) to the signed delta via formatMoney({ showSign: true }) — both locale wordings ('changes by') read correctly with a signed value, so no catalog edit was made"
  - "summaryFixedAmount kept its literal leading '-' in the catalog (a sign, not a currency symbol) while the '$' before the placeholder was removed"
  - "Promotion percentage branch switched from raw-number interpolation to formatPercent(), removing the catalog's literal '%' suffix to avoid doubling"

patterns-established:
  - "Money-input surfaces adjacent to display copy stay untouched: parseMoneyInput never introduced into RefundSheet, RegisterCajaEntryDialog, EditPaidTabDialog, or SplitTabSheet (D-03)"

requirements-completed: [SC-2, SC-4]

coverage:
  - id: D1
    description: "RefundSheet and RegisterCajaEntryDialog confirmation toasts render amounts via formatMoney; featOrders refundProcessed/expenseRecorded/incomeRecorded no longer carry a hardcoded $"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "npx vitest run src/features/process-refund/model/refund-math.test.ts src/features/register-caja-entry/model/useRegisterCajaEntry.test.ts src/features/register-caja-entry/ui/RegisterCajaEntryDialog.test.tsx"
        status: pass
      - kind: other
        ref: "grep gate: no currency char precedes {{amount}} placeholder in either locale (node JSON assertion script)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ManagePromotionsTab routes fixed-amount/fixed-price summaries through formatMoney and the percentage summary through formatPercent, with catalogs de-symboled to avoid doubling"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "npx vitest run src/features/manage-promotions (8 tests pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "EditPaidTabDialog's total-delta hint and SplitTabSheet's even-split hint render via formatMoney instead of hand-built currency template literals, with input fields, PIN gates, and split-mode logic left untouched"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "npx vitest run src/features/edit-paid-tab src/features/split-tab (15 tests pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-02
status: complete
---

# Phase 28 Plan 06: Migrate refund/caja/promotion/paid-tab-edit/split-tab money copy Summary

**Five `features`-layer surfaces (refund, caja-entry, promotions, paid-tab-edit, split-tab) now render money and percentage copy through `formatMoney`/`formatPercent` instead of hand-built `${{amount}}` strings, with all five money input fields left untouched per D-03.**

## Performance

- **Duration:** ~12 min (13:39–13:44 local, git log first→last task commit)
- **Tasks:** 3
- **Files modified:** 9 (5 components, 4 locale catalogs)

## Accomplishments
- `RefundSheet` and `RegisterCajaEntryDialog` confirmation toasts (`refundProcessed`, `expenseRecorded`, `incomeRecorded`) now format their amount via `formatMoney` instead of manual `.toFixed(2)` + catalog-side `$`
- `ManagePromotionsTab`'s row summary correctly distinguishes discount types: `formatMoney` for fixed-amount/fixed-price, `formatPercent` for percentage — preventing a percentage value from ever rendering with a currency symbol
- `EditPaidTabDialog`'s total-delta hint now shows a signed amount (`formatMoney(totalDelta, { showSign: true })`) instead of an absolute-value hand-built template, which reads more informatively against the existing "changes by" wording in both locales
- `SplitTabSheet`'s even-split hint keeps its cents-to-units division and empty-string fallback, now wrapped in `formatMoney` instead of a hand-built `${...}` template

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate refund and caja-entry confirmation copy** - `fe6ece4` (feat)
2. **Task 2: Migrate promotion summaries, distinguishing money from percentage discounts** - `f73e555` (feat)
3. **Task 3: Migrate paid-tab-edit and split-tab hint copy** - `e46e523` (feat)

_No plan metadata commit in worktree mode — orchestrator commits shared files after merge._

## Files Created/Modified
- `src/features/process-refund/ui/RefundSheet.tsx` - refund-total toast now uses `formatMoney`
- `src/features/register-caja-entry/ui/RegisterCajaEntryDialog.tsx` - expense/income toast now uses `formatMoney`
- `src/features/manage-promotions/ui/ManagePromotionsTab.tsx` - `formatRowSummary` branches on discount type to call `formatMoney` or `formatPercent`
- `src/features/edit-paid-tab/ui/EditPaidTabDialog.tsx` - total-delta hint now uses `formatMoney({ showSign: true })`
- `src/features/split-tab/ui/SplitTabSheet.tsx` - even-split hint now uses `formatMoney`
- `src/shared/lib/i18n/locales/{es-MX,en-US}/featOrders.json` - removed `$` from `refundProcessed`, `expenseRecorded`, `incomeRecorded`
- `src/shared/lib/i18n/locales/{es-MX,en-US}/featMgmt.json` - removed `$` from `summaryFixedAmount`/`summaryFixedPrice` (kept the leading `-` sign), removed `%` from `summaryPercentage`

## Decisions Made
- Kept `summaryFixedAmount`'s literal leading `-` in the catalog as a static sign character rather than relying on `formatMoney`'s own sign logic — the task explicitly treats it as a sign, not a currency symbol, and `discountValue` for this branch is a positive magnitude
- Confirmed via read-first that `totalDeltaHint` (EditPaidTabDialog) and `evenlySplitSuccess` (SplitTabSheet) carry no currency character in either catalog — the `$` lived only in each caller's template literal — so neither catalog needed editing for those two keys
- Switched `EditPaidTabDialog`'s delta hint to a signed value (`showSign: true`) rather than the prior `Math.abs()` magnitude, since the surrounding copy already says the total "changes by" an amount; re-read both locale wordings to confirm they still read correctly with a signed amount (they do — no wording changes needed)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written for all three tasks.

### Environment setup (not a plan deviation, worktree-local only)

This worktree was created without `node_modules` or `.env.local` (both are gitignored, so `git worktree add` doesn't copy them). Symlinked both from the primary checkout (`/mnt/ai/bola8pos-kiro/bar-pos/node_modules`, `.env.local`) to match the pattern already used by sibling worktree agents (`agent-a42fa0ce011321dac`, etc.) so `npm run typecheck`/`npx vitest`/`npx eslint` could run. No project files were changed by this step.

---

**Total deviations:** 0 auto-fixed (plan-code changes). One worktree-local environment fix (symlinks, not committed, not a code change).
**Impact on plan:** None — plan executed exactly as written.

## Issues Encountered

- `npx vitest run src/features/process-refund src/features/register-caja-entry --passWithNoTests` (Task 1's exact verify command) fails on one unrelated integration test: `process-refund-rpc.integration.test.ts > after_payment_insert_check_parent_close trigger: parent auto-closes when all sub-tabs paid` (`expected 'split' to be 'paid'`). This test asserts a Postgres-trigger-driven `tabs.status` transition, not money formatting, and `git status --short` confirms only `RefundSheet.tsx` changed in that directory — the integration test file itself is untouched. It fails identically when run in isolation, both before and unrelated to this plan's edits. Root cause is most likely six sibling worktree-executor agents (plans 28-02 through 28-05, 28-07) running concurrently against the same live remote Supabase project and colliding on shared split/payment fixture data. Logged to `.planning/phases/28-money-formatter-utility/deferred-items.md` and to the cross-phase `WINDOWS.md` ledger (entry id 3, kind `deviation`) rather than fixed here, per the executor's scope-boundary rule (out of scope — not caused by this task's changes). Verified the in-scope unit tests for both components (`refund-math.test.ts`, `useRegisterCajaEntry.test.ts`, `RegisterCajaEntryDialog.test.tsx`) pass cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All five targeted features now consume the Plan 01 shared formatter for their money/percent display copy; no money input field in any of the five components was rewired (`parseMoneyInput` absent from all five, confirmed by grep gate)
- `npm run typecheck` and `npx eslint` on all five touched features are clean
- The pre-existing flaky `process-refund-rpc.integration.test.ts` failure noted above is tracked in `WINDOWS.md` for follow-up; it does not block this plan's completion

---
*Phase: 28-money-formatter-utility*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 9 modified source/catalog files and the SUMMARY.md itself confirmed present on disk. All 3 task commit hashes (`fe6ece4`, `f73e555`, `e46e523`) confirmed in `git log --oneline --all`.
