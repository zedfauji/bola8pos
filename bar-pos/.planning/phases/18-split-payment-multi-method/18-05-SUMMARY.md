---
phase: 18-split-payment-multi-method
plan: 05
subsystem: payments
tags: [react, tsx, vitest, rtl, split-payment, payment-form]

# Dependency graph
requires:
  - phase: 18-split-payment-multi-method
    provides: "processSplitPayment(tabId, legs, expectedTotal, discountInfo?) client wrapper + SplitPaymentLegInput type (18-01)"
provides:
  - "isSplitMode toggle + 2-4 row split-payment UI inside PaymentForm.tsx"
  - "Split-row useReducer (ADD_ROW/REMOVE_ROW/SET_METHOD/SET_AMOUNT/SET_TIP/SET_TENDERED/SET_CARD_REF)"
  - "Live remaining-balance box (Remaining to pay / Fully allocated / Over by)"
  - "Split submit path: canSubmitSplit gating + handleSplitPrimary + receiptQueue/receiptIndex sequential receipt rendering"
  - "Cash-drawer-once-per-checkout side effect for multi-cash-leg splits"
  - "describe('PaymentForm — split mode') RTL test block (6 tests) + single-method regression assertion"
affects: [18-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split-row state machine copies the RecipeEditorTab useReducer row-array pattern (nextRowId counter, ADD_ROW/REMOVE_ROW/SET_* actions)"
    - "exactOptionalPropertyTypes-safe leg construction via conditional spread ...(cond ? { field: value } : {}) instead of setting optional properties to explicit undefined"

key-files:
  created: []
  modified:
    - src/widgets/PaymentModal/ui/PaymentForm.tsx
    - src/widgets/PaymentModal/ui/PaymentForm.test.tsx
    - src/widgets/PaymentModal/PaymentModal.stories.tsx
    - src/widgets/PaymentModal/PaymentModal.test.tsx

key-decisions:
  - "Split-mode row reset lives in its own useEffect keyed on isSplitMode (not folded into the existing tab-reset effect's dependency array), to avoid resetting single-payment state on every split-mode toggle"
  - "Leg construction in handleSplitPrimary uses conditional object spread (established project idiom per STATE.md Phase 02-04 decision) rather than widening SplitPaymentLegInput's optional fields to `T | undefined`, to avoid a wider blast radius on Plan 01's payment-processor.test.ts fixtures"
  - "PaymentProcessors.processSplitPayment addition (Task 2 per plan) was pulled into Task 1's commit as a compilation prerequisite, since PaymentModal.test.tsx/.stories.tsx and PaymentForm.test.tsx's makeProcessors already needed the field to keep the full project typecheck green"

patterns-established:
  - "Split-row remove buttons only render when rows.length > 2 (floor-of-2 enforced by REMOVE_ROW reducer branch, not just UI hiding)"

requirements-completed: [SC-3, SC-4]

# Metrics
duration: ~55min
completed: 2026-07-07
---

# Phase 18 Plan 05: PaymentForm Split-Mode UI Summary

**"Split payment" toggle inside PaymentForm swaps the single method-selector for a 2-4 row useReducer-driven list with per-row method/amount/tip/tendered fields, a live "Remaining to pay" balance box, and a submit path that calls processSplitPayment then renders sequential per-leg receipts with the cash drawer opening once per checkout.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 4 (2 in plan scope + 2 pulled-forward compilation fixes)

## Accomplishments
- `isSplitMode` toggle + `SplitRow` type + `useReducer`-based row list (2-4 rows, ADD_ROW capped at 4, REMOVE_ROW floored at 2) rendering inline stacked cards per 18-UI-SPEC (method selector, Amount, Tip, cash tendered+change-due, card reference)
- Live "Remaining to pay" / "Fully allocated ✓" / "Over by $X" box recomputing from `subtotalWithTax - Σ(row.amount)` on every keystroke, with the discount/tax `useMemo` chain left byte-for-byte unchanged (verified via `git diff`)
- `canSubmitSplit` gating (2-4 rows, every row `amount > 0`, `Σ==subtotalWithTax` ±0.01, cash rows require `tendered >= amount+tip`) wired to the primary button; label becomes "Process split payment" in split mode
- `handleSplitPrimary` builds legs via conditional spread, calls `processSplitPayment(tab.id, legs, subtotalWithTax, discountInfoArg)`, queues per-leg receipts, and renders `"Receipt {i} of {n} — {method label}"` headers above the reused (unforked) `ReceiptPreview` component, advancing on Done or closing after the last leg
- Cash drawer opens once per checkout via `legs.some(l => l.method === 'cash')`; `printReceipt` still fires once per leg
- 6 new RTL tests in `describe('PaymentForm — split mode')` plus a regression assertion that toggle-OFF single-method cash payment still calls `processCashPayment` unchanged — all 20 tests in the file pass (14 pre-existing + 6 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: Split-mode state machine + toggle + row-list UI + live remaining balance** - `374bef5` (feat)
2. **Task 2: Split submit path — processSplitPayment + receipt queue + cash-drawer-once** - `274aa24` (feat)
3. **Task 3: Split-mode RTL tests + single-method regression assertions** - `2cd6b54` (test)

_Task 3 is a TDD-tagged task, but since the split-mode behavior was already built in Tasks 1-2 of this same plan, all 6 new assertions passed green on first run — no RED-phase failure was expected or observed. This is coverage-for-already-merged-code within one plan, not strict test-first development against unimplemented behavior._

## Files Created/Modified
- `src/widgets/PaymentModal/ui/PaymentForm.tsx` - split-mode state machine, row-list UI, live remaining balance, split submit path, sequential receipt rendering, cash-drawer-once
- `src/widgets/PaymentModal/ui/PaymentForm.test.tsx` - `describe('PaymentForm — split mode')` block (6 tests) + `processSplitPayment` mock in `makeProcessors`
- `src/widgets/PaymentModal/PaymentModal.stories.tsx` - added `processSplitPayment` mock to `mockProcessorsFor` (compilation fix, `PaymentProcessors` type now requires the field)
- `src/widgets/PaymentModal/PaymentModal.test.tsx` - added `processSplitPayment: vi.fn()` to all 7 `PaymentProcessors` object literals (compilation fix)

## Decisions Made
- Split-row reset (seed 2 default rows on toggle-ON / clear on toggle-OFF) lives in a dedicated `useEffect` keyed on `[isSplitMode, enabledMethods.cash, enabledMethods.bbvaCard]`, separate from the existing tab-change reset effect, so toggling split mode does not reset unrelated single-payment state (tip mode, discount, card reference, etc.)
- Leg construction in `handleSplitPrimary` uses the project's established conditional-spread idiom (`...(cond ? { field } : {})`) to satisfy `exactOptionalPropertyTypes` on `SplitPaymentLegInput`'s optional fields, rather than widening the shared type to `field: T | undefined` — the latter would have required additionally fixing Plan 01's `payment-processor.test.ts` leg fixtures, which are out of this plan's scope
- The `PaymentProcessors.processSplitPayment` field (explicitly scoped to Task 2 in the plan) was added in Task 1's commit instead, because `PaymentModal.test.tsx`/`.stories.tsx` and `PaymentForm.test.tsx`'s `makeProcessors` already required it to keep the whole-project `tsc --noEmit` green after Task 1 — deferring it to Task 2 would have left an intentionally-broken intermediate compile state across two commits

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended `PaymentProcessors` + 3 consumer files' mocks with `processSplitPayment` earlier than planned (Task 1 instead of Task 2)**
- **Found during:** Task 1 (typecheck run after adding the row-list UI)
- **Issue:** The plan scoped `PaymentProcessors.processSplitPayment` to Task 2, but `PaymentModal.stories.tsx` and `PaymentModal.test.tsx` (7 object literals) already construct `PaymentProcessors` values and would only break once the type gained a required field — meaning Task 1 alone, if it stopped short of the full processors wiring, would leave those two out-of-scope files with real compile errors after the plan's Task 1 commit
- **Fix:** Added `processSplitPayment` to the `PaymentProcessors` type + `defaultProcessors` in Task 1's commit, and added matching `processSplitPayment: vi.fn()` mocks to `PaymentModal.stories.tsx`'s `mockProcessorsFor` and all 7 inline `PaymentProcessors` literals in `PaymentModal.test.tsx`
- **Files modified:** `src/widgets/PaymentModal/ui/PaymentForm.tsx`, `src/widgets/PaymentModal/PaymentModal.stories.tsx`, `src/widgets/PaymentModal/PaymentModal.test.tsx`
- **Verification:** `npx tsc --noEmit -p tsconfig.json` clean (only the 2 documented pre-existing errors in `tab/model/queries.ts`/`agent/rag.ts` remain); `npx vitest run src/widgets/PaymentModal` → 42/42 pass
- **Committed in:** `374bef5` (Task 1 commit)

**2. [Rule 1 - Bug] `exactOptionalPropertyTypes` violation in leg construction avoided via conditional spread**
- **Found during:** Task 2 (typecheck after writing `handleSplitPrimary`)
- **Issue:** Building each leg with `tenderedAmount: row.method === 'cash' ? row.tenderedAmount : undefined` (and similarly for `referenceNumber`/`rappiOrderId`) fails `exactOptionalPropertyTypes: true` against `SplitPaymentLegInput`'s `tenderedAmount?: number` — an optional key requires the key to be *omitted* when absent, not present-with-value-`undefined` (the exact CLAUDE.md gotcha: "Never write `prop?: string` for mutation inputs... write `prop: string | undefined`" — but `SplitPaymentLegInput` is a pre-existing Plan 01 type outside this plan's `files_modified`, and widening it would have cascaded into `payment-processor.test.ts`'s leg fixtures)
- **Fix:** Rewrote leg construction using the project's established conditional-spread idiom (`...(row.method === 'cash' ? { tenderedAmount: row.tenderedAmount } : {})`), matching the documented STATE.md Phase 02-04 pattern for the same `exactOptionalPropertyTypes` class of issue — keeps `payment-processor.ts` and its existing test file untouched
- **Files modified:** `src/widgets/PaymentModal/ui/PaymentForm.tsx`
- **Verification:** `npx tsc --noEmit -p tsconfig.json` clean; `git diff src/shared/lib/payment-processor.ts` empty (zero unplanned changes to Plan 01's file)
- **Committed in:** `274aa24` (Task 2 commit)

**3. [Rule 1 - Bug] Hid the single-payment cash/card field sections while `isSplitMode` is ON**
- **Found during:** Task 1 (reviewing the render tree while building the split-row UI)
- **Issue:** The existing `method === 'cash'` / `method === 'card'` sections below the "Payment method" section render based on the single-payment `method` state, which retains its last value even when split mode is toggled ON — without a guard, these would render duplicate "Amount tendered" / "Charge amount" fields alongside the split-row list, confusing the cashier and breaking `getByLabelText('Amount tendered')` uniqueness in tests
- **Fix:** Gated both sections with `!isSplitMode &&`
- **Files modified:** `src/widgets/PaymentModal/ui/PaymentForm.tsx`
- **Verification:** RTL test `toggle ON reveals 2 rows...` confirms `payment-btn-cash` (single-mode grid) is absent while split mode is ON; `getByLabelText('Amount tendered')` resolves uniquely in the drawer-once test
- **Committed in:** `374bef5` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking-compile, 1 bug/type-safety, 1 bug/duplicate-render)
**Impact on plan:** All three fixes were necessary for the plan's own acceptance criteria (whole-project typecheck clean, `exactOptionalPropertyTypes` compliance, correct split-mode rendering) — no scope creep beyond what compilation and correctness required.

## Issues Encountered
- Fresh worktree checkout had no `node_modules/` or `.env.local` — ran `npm ci` (husky `prepare` script logged "`.git` can't be found" harmlessly, since the worktree's `bar-pos/` subdirectory has no independent `.git`) and copied `.env.local` from the main repo checkout (gitignored, never committed) so `npx vitest run` could pass its Supabase connectivity check in `global-setup.ts`. This is worktree environment setup, not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The split-payment UI is fully wired against the mocked `processSplitPayment` contract from Plan 01; no live edge-function/RPC dependency was needed for this plan's verification
- `src/widgets/PaymentModal/ui/PaymentForm.tsx` now exposes `isSplitMode`, the split-row reducer, `receiptQueue`/`receiptIndex`, and `handleSplitPrimary` — ready for Plan 06's phase-level E2E/verification pass once the live edge function (Plan 04) and RPC (Plan 02) are in place
- Full `src/widgets/PaymentModal` unit suite (PaymentForm.test.tsx + PaymentModal.test.tsx): 42/42 pass; `npx tsc --noEmit` and `npx eslint` both clean on all 4 modified files (max-warnings 0)

---
*Phase: 18-split-payment-multi-method*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: src/widgets/PaymentModal/ui/PaymentForm.tsx
- FOUND: src/widgets/PaymentModal/ui/PaymentForm.test.tsx
- FOUND: .planning/phases/18-split-payment-multi-method/18-05-SUMMARY.md
- FOUND commit: 374bef5 (Task 1)
- FOUND commit: 274aa24 (Task 2)
- FOUND commit: 2cd6b54 (Task 3)
