# Deferred Items — Phase 33 (payment-critical-page-sweep-isolated)

## Plan 33-02

- **Pre-existing typecheck errors (out of scope, not caused by this plan):**
  - `src/entities/tab/model/queries.ts(780,11)`: `Type 'number | null' is not assignable to type 'number | undefined'.`
  - `src/shared/lib/agent/rag.ts(60,7)`: `Type 'number[]' is not assignable to type 'string'.`
  - Both predate this plan (documented repeatedly across prior phases, e.g. Phase 32-01's `deferred-items.md`). Neither file is in this plan's `files_modified` list (`src/widgets/OrderPanel/CartPanel.tsx` only). Not fixed — out of scope per SCOPE BOUNDARY (fix only issues directly caused by the current task's changes).

## Plan 33-03

- **Pre-existing typecheck errors (out of scope, not caused by this plan):** same two errors as 33-02 above (`src/entities/tab/model/queries.ts(780,11)`, `src/shared/lib/agent/rag.ts(60,7)`). Not in this plan's `files_modified` list (`src/widgets/PaymentModal/ui/PaymentForm.tsx` only). Not fixed — out of scope.
- **`e2e/42-tip-distribution.spec.ts` T1 fails even in isolation with `--retries=0`** — test times out (150000ms) stalled on Settings → Tip Split tab, "Save Tip Split" button disabled with Floor 50 / Bar 30 / Kitchen 20 (sums to 100, should be enabled). The stall happens in `TipDistributionSettingsTab.tsx`, a file never touched by this plan (this plan only modifies `PaymentForm.tsx`'s Process Payment/Remove-payment-N/Reset-to-computed elements). Confirmed pre-existing/unrelated — not a regression from this plan's className/prop-only diff. Out of scope per SCOPE BOUNDARY; flagged here for a future phase or bug-fix task to investigate the Save Tip Split enablement logic.
- **`e2e/41-split-payment.spec.ts` T2 and `e2e/05-payments.spec.ts` T8 failed once when run in the same batch as `42-tip-distribution.spec.ts`, but passed cleanly when re-run individually in isolation** — consistent with test-data/backend-state collisions against the shared live Supabase instance when specs run back-to-back in one process, not a regression. Both pass in isolation with `--retries=0`.

## Plan 33-05

- **Pre-existing typecheck errors (out of scope, not caused by this plan):** same two errors as 33-02/33-03 above (`src/entities/tab/model/queries.ts(780,11)`, `src/shared/lib/agent/rag.ts(60,7)`). Neither file is in this plan's `files_modified` list (`src/features/process-refund/ui/RefundSheet.tsx` only). Not fixed — out of scope.
- **`e2e/09-rbac.spec.ts` — 5 of 23 tests fail even run in isolation (`--retries=0`, no batching with other specs):** T7 (admin deletes a tab), T9 (manager can void an order), T10 (bartender caja PIN visibility), T-RP-01 (permission matrix switch count expected 88, received 96 — matrix has grown as more RBAC actions were added over time), T-RP-02 (strict-mode locator violation: `getByRole('switch', { name: 'Kitchen can view_kds' })` now ambiguously matches both `view_kds` and `view_kds_bar` labels). None of these tests exercise `RefundSheet.tsx`, `POSButton`, or the process-refund feature — `T-RP-05` (`process_refund is blocked for bartender at DB level`), the one rbac test that does touch the refund button via `getByRole('button', { name: /refund/i })`, passed. Confirmed pre-existing/unrelated to this plan's className/prop-only diff — out of scope per SCOPE BOUNDARY. Flagged here for a future phase to fix the permission-matrix test's stale switch count and the ambiguous accessible-name locator.
- `e2e/35-refund.spec.ts` — full pass, 0 failures.
