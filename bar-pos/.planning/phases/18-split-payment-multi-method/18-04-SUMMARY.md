---
phase: 18-split-payment-multi-method
plan: 04
subsystem: payments
tags: [deno, edge-function, supabase-functions-deploy, integration-test, split-payment]

# Dependency graph
requires:
  - phase: 18-split-payment-multi-method
    plan: 02
    provides: process_split_payment_atomic RPC + split-payment-rpc.integration.test.ts scaffold
  - phase: 18-split-payment-multi-method
    plan: 03
    provides: migration 20260707000003 pushed live (payment_group_id/split_index columns + RPC callable on remote)
provides:
  - "supabase/functions/process-split-payment/index.ts deployed to remote (SC-2)"
  - "Live-green split-payment-rpc.integration.test.ts (SC-1 + SC-2 confirmed against pushed schema)"
affects: [18-split-payment-multi-method (Plans 05/06), payment-processor, edge-functions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New edge function as a structural mirror of an existing one (copy-then-adapt), guaranteeing zero regression risk on the untouched original (D-11)"
    - "Receipt assembly computed once per tab (items/pool query), then fanned out per payment_group_id leg row ordered by split_index (D-09)"

key-files:
  created:
    - supabase/functions/process-split-payment/index.ts
  modified: []

key-decisions:
  - "Included discount_scope/discount_type/discount_value/discount_amount in the per-leg payments SELECT and mapped them into ReceiptData (optional fields) — the RPC stores discount data only on split_index=0, and ReceiptDataSchema already has these as optional fields, so surfacing them costs nothing and keeps split receipts consistent with the single-payment receipt shape"
  - "Deploy required `npx supabase link --project-ref shsrhxleopmovzpzqmex` first — this fresh worktree checkout of supabase/.temp/ had no project-ref link state (gitignored, not carried over from the main checkout); linking is idempotent local CLI state, not a plan deviation"

patterns-established:
  - "process-split-payment: JWT-verify (ES256 /auth/v1/user, verbatim from process-payment) -> admin.rpc('process_split_payment_atomic') -> one ReceiptData per leg via payments.payment_group_id fan-out"

requirements-completed: [SC-2]

# Metrics
duration: ~25min
completed: 2026-07-08
---

# Phase 18 Plan 04: process-split-payment Edge Function + Live Integration Green Summary

**New `process-split-payment` Deno edge function — a verbatim-structure mirror of `process-payment/index.ts` — deployed to remote Supabase; the Plan 02 integration test suite now runs green end-to-end against the live pushed schema (5/5 tests pass, columns + atomic RPC + sum-guard + idempotency all confirmed).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-08T15:42:00Z
- **Tasks:** 2
- **Files modified:** 1 (new)

## Accomplishments

- `supabase/functions/process-split-payment/index.ts` — new Deno edge function copied structurally from `process-payment/index.ts`: same import pins (`esm.sh/@supabase/supabase-js@2.49.1`, `deno.land/x/zod@v3.23.8`), same `corsHeaders`/`jsonResponse`/`statusForCode`/OPTIONS-POST guards, and the same ES256 `/auth/v1/user` JWT verification workaround (verbatim, not `admin.auth.getUser()`).
  - `BodySchema` replaces the flat single-payment fields with `legs: legSchema[]` (1-4 entries, D-02) + `expectedTotal` + a top-level `superRefine` sum guard (client-side defense-in-depth for D-05; the RPC re-validates authoritatively).
  - `statusForCode` extended so `SPLIT_TOTAL_MISMATCH`/`TOO_MANY_LEGS`/`EMPTY_LEG` return 409, grouped with the existing validation codes.
  - Calls `admin.rpc('process_split_payment_atomic', {...})` with all 9 params (`p_tab_id`, `p_staff_id`, `p_legs`, `p_expected_total`, `p_idempotency_key`, 4 discount params).
  - Receipt assembly: items (orders/order_items/products, skipping voided) and pool_sessions queried once per tab (shared across every leg), then all `payments` rows for the returned `paymentGroupId` fetched ordered by `split_index`. One `ReceiptData` built per row — `subtotal`/`tipAmount`/`total`/`tenderedAmount`/`changeAmount`/`terminalReference`/`receiptNumber` differ per leg, `items`/`barName`/`barAddress`/`cashierName`/`customerName` are identical across legs.
  - `process-payment/index.ts` is byte-for-byte untouched (`git diff` empty — D-11 verified).
- Deployed to remote via `npx supabase link --project-ref shsrhxleopmovzpzqmex` then `npx supabase functions deploy process-split-payment` — CLI reported `Deployed Functions on project shsrhxleopmovzpzqmex: process-split-payment`.
- Ran `npx vitest run src/entities/payment/model/split-payment-rpc.integration.test.ts` against the live pushed schema: **5/5 tests passed** (up from all-skip in Plan 02's scaffold run) — SC-1 column-existence test, SC-2 happy-path (2-leg cash+card, tab flips to `paid`, shared `payment_group_id`, `split_index` 0/1), sum-mismatch rejection (atomic rollback, 0 rows inserted), too-many-legs rejection (5 legs -> `TOO_MANY_LEGS`), idempotent replay (same `idempotencyKey` resubmission returns the same group, exactly 2 payment rows total — no double-charge).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write process-split-payment edge function (mirror process-payment)** - `f205663` (feat)
2. **Task 2: Deploy edge function + run split-RPC integration test green** - no commit (infra-only: `npx supabase functions deploy` + `npx vitest run` against live remote; no tracked files were modified — `.env.local` and `supabase/.temp/` are both gitignored)

## Files Created/Modified

- `supabase/functions/process-split-payment/index.ts` — new edge function (375 lines), deployed to remote project `shsrhxleopmovzpzqmex`.

## Decisions Made

- Included the 4 discount columns (`discount_scope`/`discount_type`/`discount_value`/`discount_amount`) in the per-leg `payments` SELECT and mapped them into each leg's `ReceiptData` (all optional fields on the existing `ReceiptDataSchema`) — the RPC stores discount data only on `split_index=0` per the migration's design (avoids double-counting in `SUM(discount_amount)` reports), and surfacing it in the receipt keeps split-payment receipts feature-complete with the single-payment receipt shape at zero extra cost.
- This worktree's `supabase/.temp/` had no project-ref link state (gitignored, fresh checkout) — ran `npx supabase link --project-ref shsrhxleopmovzpzqmex` before deploying. This is idempotent local CLI state, not a plan deviation or a schema/infra change.

## Deviations from Plan

None - plan executed exactly as written. The edge function mirrors `process-payment/index.ts` per the plan's explicit per-section adaptation instructions, and the RPC parameter names/shapes/error codes were cross-checked directly against the live migration file (`supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql`) and the already-authored client-side contract (`src/shared/lib/edge-function-contracts.ts` — `ProcessSplitPaymentRequestSchema`/`SplitPaymentLegRequestSchema`/`callProcessSplitPayment`), confirming exact field-name parity (`tabId`/`legs`/`expectedTotal`/`idempotencyKey`/`discountScope`/`discountType`/`discountValue`/`discountAmount`) with zero adjustment needed.

## Issues Encountered

- Fresh worktree checkout had no `node_modules/` (`npm ci`, ~50s), no `.env.local` (copied from the main repo checkout at `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\.env.local` — gitignored, never committed, same precedent documented in 18-05-SUMMARY.md), and no `supabase/.temp/` link state (`npx supabase link --project-ref shsrhxleopmovzpzqmex`, no `SUPABASE_ACCESS_TOKEN` needed — the Supabase CLI was already authenticated at the user/machine level). All three are one-time worktree environment setup, not plan deviations or code changes.
- `npx supabase functions deploy` printed `WARNING: Docker is not running` — non-blocking; Supabase Edge Function deploys upload the Deno source directly and do not require a local Docker daemon (Docker is only needed for `supabase start`/local dev stack, consistent with 18-RESEARCH.md's noted Docker-unavailable environment).

## User Setup Required

None - no external service configuration required. The edge function is live on the already-configured remote project; the integration test ran against the already-provisioned `.env.local` credentials (service-role key, Supabase URL) copied from the main checkout.

## Next Phase Readiness

- `process-split-payment` is live on remote and behaviorally verified (SC-1 + SC-2 both green against the real database) — Plan 05 (client-side UI wiring, presumably) and Plan 06 (E2E, which the plan's Task 2 action text explicitly notes hits this real deployed function) are both unblocked.
- No blockers for downstream plans.

---
*Phase: 18-split-payment-multi-method*
*Completed: 2026-07-08*

## Self-Check: PASSED

- FOUND: `supabase/functions/process-split-payment/index.ts`
- FOUND commit: `f205663` (Task 1) — verified via `git cat-file -e f205663` (direct object lookup; `git log --oneline --all` errors out repo-wide due to an unrelated broken ref `refs/heads/worktree-agent-a2b390553ea68f417` from a different, stale worktree branch — not related to this plan's work)
- FOUND: live deploy confirmed via CLI output `Deployed Functions on project shsrhxleopmovzpzqmex: process-split-payment`
- FOUND: integration test run confirmed via `npx vitest run src/entities/payment/model/split-payment-rpc.integration.test.ts` — `Test Files 1 passed (1)`, `Tests 5 passed (5)`
