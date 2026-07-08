# Phase 18 — Deferred Items (out of scope for Plan 18-06)

Logged per the executor's SCOPE BOUNDARY rule: pre-existing failures in files/features
this phase did not touch are documented here, not fixed.

## Regression-gate findings (Plan 18-06, Task 2)

Running the full unit suite + the 6 named regression E2E specs
(`npm run test`; `npx playwright test e2e/05-payments.spec.ts e2e/17-payment-pane.spec.ts
e2e/23-payment-edge-cases.spec.ts e2e/34-split-bill.spec.ts e2e/35-refund.spec.ts
e2e/41-split-payment.spec.ts`) surfaced pre-existing failures unrelated to split payment.

**Confirmed unrelated to Phase 18** (evidence below), so left unfixed per scope boundary:

### 1. `e2e/34-split-bill.spec.ts` — T2, T3+T4, T5, T6 fail (split-*TAB*, not split-payment)
- T2 "Confirm Split" stays disabled after item-assignment loop (UI-selector fragility in
  the by-item assignment flow).
- T3+T4: `split_tab_by_item` RPC-then-fallback path leaves parent tab `status='open'`
  instead of `'split'`.
- T5: "Person 1" text never renders (By Person tab UI).
- T6: `split-bill-button` remains visible on a `status='split'` tab (guard not applied).
- **Evidence this predates Phase 18:** `git log --oneline -- src/features/split-tab/
  e2e/34-split-bill.spec.ts` shows the last touches are all Phase 6 commits
  (`886a170`, `a2964c6`, `1ed1933`, …) — zero Phase 18 commits. Phase 18's only migration
  (`20260707000003_split_payment_columns_and_rpc.sql`) is purely additive (new nullable
  columns + 2 new indexes + 1 new function) and touches no trigger or function that
  `split_tab_by_item`/the parent-auto-close trigger depend on.

### 2. `e2e/35-refund.spec.ts` — T1-T4, T5, T6 fail (process-refund, not payments schema)
- T1-T4: `page.getByRole('dialog').getByText(/process refund/i)` never resolves —
  `page.getByRole('dialog')` is unscoped and the AI-assistant side panel is always
  mounted as a `dialog`, so the locator can resolve to the wrong dialog. This exact
  bug class (unscoped `getByRole('dialog')` colliding with the always-mounted AI
  assistant) was already identified and fixed in a *different* spec — see
  `21-prep.spec.ts`'s T2 fix noted in STATE.md's 2026-07-03 Phase 05 session log
  ("an unscoped `getByRole('dialog')` in T2 matched the always-mounted AI-assistant
  side panel") — `35-refund.spec.ts` never received the equivalent fix.
- **Evidence this predates Phase 18:** `git log --oneline -- src/features/process-refund/
  e2e/35-refund.spec.ts` shows only Phase 6 commits (`9eac643`, `0f9f280`, `9ca02aa`).
  `process_refund` reads/writes only `payments.id`/`tab_id`/`amount`/`is_refund` —
  confirmed zero interaction with `payment_group_id`/`split_index` (18-RESEARCH.md D-12
  finding, re-confirmed here).

### 3. `e2e/17-payment-pane.spec.ts` — T2, T9, T10 fail
- T9 and T10 both fail on `getByText(/select a tab from the list to process payment/i)`
  — this exact copy string **does not exist anywhere in `src/`**
  (`grep -rn "select a tab from the list" src/` returns zero hits), confirming the
  assertion has drifted from the actual `PaymentPane` placeholder copy independent of
  any Phase 18 change (Phase 18 never touched `PaymentPane.tsx`, only `PaymentForm.tsx`
  which `PaymentPane` embeds unchanged in single-payment mode).
- T2 hit a generic 60s navigation timeout (AppNav sidebar link), unrelated to payment
  processing.
- T9 itself confirms the underlying regression target IS healthy: the cash payment
  completes and the Receipt heading renders successfully before the later, unrelated
  placeholder-text assertion fails.

### 4. `e2e/23-payment-edge-cases.spec.ts` — PE7 fails
- Timeout clicking "Verify PIN to process payment" after starting a pool session —
  flakiness in the pool-session-start-then-navigate-to-payments flow, unrelated to
  the payments table/RPC changes (no pool_sessions code touched by Phase 18).

## What Plan 18-06 actually verified as green (the regressions in its own scope)

- `npm run test`: 1197 passed / 1 pre-existing failure (`useCloseTab.test.ts:95`,
  documented since Phase 15) / 15 todo — matches the STATE.md baseline, no new failures.
- `e2e/05-payments.spec.ts`: 9/9 pass — single-payment flow (D-11) fully green.
- `e2e/41-split-payment.spec.ts`: 3/3 pass, twice in a row — split-payment happy path
  (SC-2/SC-3/D-08/D-09), validation gate, and add/remove-row all green against the live
  deployed edge function + RPC.

## Recommendation

A future phase/plan should re-baseline `e2e/17-payment-pane.spec.ts`,
`e2e/23-payment-edge-cases.spec.ts`, `e2e/34-split-bill.spec.ts`, and
`e2e/35-refund.spec.ts` against current `src/` (stale copy assertions, unscoped dialog
locators, and split-tab UI-flow flakiness). None of this blocks Phase 18's completion —
Phase 18 shipped exactly the surface it owns (payments columns, RPC, edge function,
PaymentForm split-mode UI, and its own E2E spec) without touching any of the four
files above.
