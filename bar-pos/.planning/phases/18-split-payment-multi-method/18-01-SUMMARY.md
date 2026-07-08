---
phase: 18-split-payment-multi-method
plan: 01
subsystem: payments
tags: [zod, split-payment, edge-function, typescript, tdd]

# Dependency graph
requires: []
provides:
  - "SplitPaymentLegSchema + SplitPaymentLeg type in domain.ts"
  - "PaymentSchema.paymentGroupId + PaymentSchema.splitIndex fields"
  - "ProcessSplitPaymentRequestSchema/SuccessSchema/EnvelopeSchema in edge-function-contracts.ts"
  - "callProcessSplitPayment + mapProcessSplitPaymentEdgeError client caller"
  - "process-split-payment registered in EDGE_FUNCTIONS registry"
  - "processSplitPayment(tabId, legs, expectedTotal, discountInfo?) wrapper in payment-processor.ts"
affects: [18-02-split-payment-rpc, 18-04-split-payment-edge-function, 18-05-payment-form-split-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split-payment client contract mirrors single-payment contract idiom exactly (superRefine per-method rules, envelope safeParse, mapXEdgeError switch)"
    - "Single caller-supplied idempotencyKey per split submission; RPC (later plan) derives per-leg -leg{i} storage keys"

key-files:
  created: []
  modified:
    - src/shared/lib/domain.ts
    - src/shared/lib/edge-function-contracts.ts
    - src/shared/lib/payment-processor.ts
    - src/shared/lib/payment-processor.test.ts

key-decisions:
  - "Split-specific edge error codes (SPLIT_TOTAL_MISMATCH, TOO_MANY_LEGS, EMPTY_LEG) fold into the existing VALIDATION_ERROR AppErrorCode rather than adding new codes to result.ts, per 18-RESEARCH.md Open Question #2 recommendation"
  - "SplitPaymentLegRequestSchema defined locally in edge-function-contracts.ts (not reusing domain.ts's SplitPaymentLegSchema) — contracts own their wire shape, matching the existing ProcessPaymentRequestSchema precedent"

patterns-established:
  - "Split-payment wrapper follows the exact 4-line body shape of processCashPayment/processCardPayment/processRappiPayment: generate key, call edge function, early-return on !ok, wrap ok(...) on success"

requirements-completed: [SC-2, SC-4]

duration: ~35min
completed: 2026-07-07
---

# Phase 18 Plan 01: Split-Payment Client Contract Layer Summary

**TypeScript client contract for split payments — Zod schemas (SplitPaymentLegSchema, ProcessSplitPaymentRequest/Success/Envelope), a typed `callProcessSplitPayment` edge-function caller, and a `processSplitPayment(tabId, legs, expectedTotal, discountInfo?)` wrapper with 4 new passing unit tests, with zero changes to the existing single-method payment code.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `PaymentSchema` extended with `paymentGroupId` + `splitIndex` (both `.nullable().optional()`, matching the `refundId` idiom); new `SplitPaymentLegSchema`/`SplitPaymentLeg` type models one split row
- `edge-function-contracts.ts` gained a full PROCESS SPLIT PAYMENT section: `SplitPaymentLegRequestSchema` (per-method superRefine), `ProcessSplitPaymentRequestSchema` (1-4 legs, client-side total-match superRefine), `ProcessSplitPaymentSuccessSchema`/`EnvelopeSchema`, `mapProcessSplitPaymentEdgeError`, `callProcessSplitPayment` — registered as `'process-split-payment'` in `EDGE_FUNCTIONS`
- `processSplitPayment` wrapper added to `payment-processor.ts` following the exact idiom of the three existing single-method wrappers, driven by a full TDD RED→GREEN cycle (4 new tests, all passing; 9 pre-existing tests unaffected)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add split-payment fields to PaymentSchema + SplitPaymentLegSchema in domain.ts** - `0727a89` (feat)
2. **Task 2: Add split request/success/envelope schemas + callProcessSplitPayment to edge-function-contracts.ts** - `b544026` (feat)
3. **Task 3: Add processSplitPayment wrapper + unit tests** - `f8de648` (test, RED) → `dc6812a` (feat, GREEN)

_Task 3 is a TDD task: no refactor commit needed — the GREEN implementation required no cleanup._

## Files Created/Modified
- `src/shared/lib/domain.ts` - `PaymentSchema.paymentGroupId`/`splitIndex` + `SplitPaymentLegSchema`/`SplitPaymentLeg`
- `src/shared/lib/edge-function-contracts.ts` - PROCESS SPLIT PAYMENT section (4 schemas, error mapper, caller, registry entry)
- `src/shared/lib/payment-processor.ts` - `processSplitPayment` + `SplitPaymentLegInput`/`SplitPaymentResult` types
- `src/shared/lib/payment-processor.test.ts` - new `describe('processSplitPayment')` block (4 tests)

## Decisions Made
- Split-specific edge error codes fold into `VALIDATION_ERROR` (no new `AppErrorCode` entries) — confirmed via `git diff src/shared/lib/result.ts` staying empty across all 3 commits
- `SplitPaymentLegRequestSchema` is defined locally in `edge-function-contracts.ts` rather than importing `SplitPaymentLegSchema` from `domain.ts`, consistent with how `ProcessPaymentRequestSchema` already duplicates rather than reuses `PaymentSchema`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The worktree's `node_modules/` and `.env.local` were absent (fresh worktree checkout). Ran `npm ci` to install dependencies and copied `.env.local` from the main repo checkout (gitignored, never committed) so `npx vitest run` could pass its `global-setup.ts` Supabase connectivity check. This is worktree environment setup, not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The client contract (`processSplitPayment`, `callProcessSplitPayment`, `ProcessSplitPaymentRequestSchema`/`SuccessSchema`/`EnvelopeSchema`) is locked and ready for Plan 04 (edge function) to implement against, and Plan 02 (RPC) to satisfy the `paymentGroupId`/`paymentIds`/`receipts` response shape
- `PaymentSchema.paymentGroupId`/`splitIndex` are ready for Plan 02/03's DB migration columns (`payments.payment_group_id`, `payments.split_index`)
- Full unit suite run (via `npm run test`) shows 1191 passed / 1 pre-existing failure (`useCloseTab.test.ts:95`, documented since Phase 15, unrelated to this plan) / 15 todo — no regressions
- `npm run lint` exits 0

---
*Phase: 18-split-payment-multi-method*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: src/shared/lib/domain.ts
- FOUND: src/shared/lib/edge-function-contracts.ts
- FOUND: src/shared/lib/payment-processor.ts
- FOUND: src/shared/lib/payment-processor.test.ts
- FOUND: .planning/phases/18-split-payment-multi-method/18-01-SUMMARY.md
- FOUND commit: 0727a89 (Task 1)
- FOUND commit: b544026 (Task 2)
- FOUND commit: f8de648 (Task 3 RED)
- FOUND commit: dc6812a (Task 3 GREEN)
- FOUND commit: 67e5ac8 (docs: plan metadata)
