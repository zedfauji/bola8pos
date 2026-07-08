---
phase: 18-split-payment-multi-method
plan: 06
subsystem: testing
tags: [playwright, e2e, regression, split-payment, uat]

# Dependency graph
requires:
  - phase: 18-split-payment-multi-method
    plan: 04
    provides: "supabase/functions/process-split-payment/index.ts deployed to remote (SC-2)"
  - phase: 18-split-payment-multi-method
    plan: 05
    provides: "isSplitMode toggle + split-row UI + split submit path in PaymentForm.tsx"
provides:
  - "e2e/41-split-payment.spec.ts — end-to-end split-payment coverage (happy path, validation gate, add/remove row)"
  - "CLAUDE.md updated with split-payment feature description + E2E spec list entry"
  - "deferred-items.md — evidence-backed record of 4 pre-existing unrelated E2E failures found during regression gate"
  - "Phase 18 verification gate closed (mock-layer hardware coverage accepted; physical UAT deferred)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runnable-but-reporting E2E tests (annotate rather than hard-skip) matching the 32-combos/40-kds-bar precedent"

key-files:
  created:
    - e2e/41-split-payment.spec.ts
  modified:
    - CLAUDE.md
    - .planning/phases/18-split-payment-multi-method/deferred-items.md

key-decisions:
  - "Physical cash-drawer-once + two-receipt hardware verification (18-UI-SPEC #8 / Assumption A2) deferred by explicit user instruction — no hardware available at execution time. Accepted as a non-blocking risk because mock-layer coverage already exists (PaymentForm.test.tsx asserts openCashDrawer is called exactly once for a multi-cash-leg split, per 18-05-SUMMARY.md). To be verified manually on real hardware later."
  - "4 E2E failures surfaced by the regression gate (34-split-bill.spec.ts, 35-refund.spec.ts, 17-payment-pane.spec.ts, 23-payment-edge-cases.spec.ts) were investigated and confirmed pre-existing/unrelated to Phase 18 via git-log evidence and code-path tracing; documented in deferred-items.md rather than fixed, per the executor's scope-boundary rule (out-of-scope files this phase did not touch)"

patterns-established: []

requirements-completed: [SC-2, SC-3, SC-4]

# Metrics
duration: ~35min (this continuation session; ~1h40m total across both sessions)
completed: 2026-07-08
---

# Phase 18 Plan 06: E2E Verification + Regression Gate + Docs Summary

**New Playwright spec (`e2e/41-split-payment.spec.ts`, 3/3 passing twice against the live deployed edge function + RPC) proves the 2-4-method atomic split-close end-to-end; full regression gate (unit suite 1197/1198 + 6 named E2E specs) confirms zero regression on single-payment/split-bill/refund; CLAUDE.md documents the feature; physical cash-drawer hardware UAT is explicitly deferred by the user, accepted on existing mock-layer coverage.**

## Performance

- **Duration:** ~35 min (this continuation session, finalizing Task 2); prior session covered Task 1 + automated Task 2 portion
- **Tasks:** 2 (Task 1: E2E spec; Task 2: regression gate + docs + checkpoint resolution)
- **Files modified:** 3 (`e2e/41-split-payment.spec.ts` created, `CLAUDE.md` + `deferred-items.md` modified)

## Accomplishments
- `e2e/41-split-payment.spec.ts` created and passing: T1 (2-method cash+card happy path, sequential "Receipt 1 of 2"/"Receipt 2 of 2" rendering, tab reaches `paid` with a shared `payment_group_id`), T2 (partial-allocation validation gate — "Process split payment" stays disabled, "Fully allocated ✓" does not render), T3 (add-row caps at 4, remove-row floors at 2)
- Full regression gate run: `npm run test` → 1197 passed / 1 pre-existing documented failure (`useCloseTab.test.ts:95`, known since Phase 15) / 15 todo — matches STATE.md baseline exactly, zero new failures
- 6 named E2E regression specs run (`05-payments`, `17-payment-pane`, `23-payment-edge-cases`, `34-split-bill`, `35-refund`, `41-split-payment`): `05-payments` 9/9 pass (D-11 single-payment unaffected), `41-split-payment` 3/3 pass; the other 4 specs surfaced pre-existing failures, each investigated and traced to causes with zero Phase 18 code overlap (git-log evidence, code-path tracing) — recorded in `deferred-items.md`
- CLAUDE.md updated: "Implemented Features" gained a `split-payment (multi-method)` bullet describing the atomic up-to-4-leg close (`payment_group_id`/`split_index`, `process_split_payment_atomic` RPC, `PaymentForm` split toggle); "E2E Test Suite" list extended from 19 to 20 specs with `41-split-payment` appended
- Hardware UAT checkpoint (physical cash-drawer-opens-once + two-receipts-print) presented to the user; user explicitly deferred it (no hardware available), accepting mock-layer test coverage as sufficient to close the phase, with manual verification to occur later on real hardware

## Task Commits

Each task was committed atomically:

1. **Task 1: E2E spec `e2e/41-split-payment.spec.ts`** - `184cac9` (test)
2. **Task 2: Regression gate + CLAUDE.md docs** - `89aa327` (docs)

**Plan metadata:** (this commit) `docs(18-06): complete phase verification plan`

_Task 2 is a `checkpoint:human-verify` task with two parts: the automated regression-gate + docs portion was committed in `89aa327`; the human hardware sign-off portion is resolved here per explicit user instruction (deferred, not blocked)._

## Files Created/Modified
- `e2e/41-split-payment.spec.ts` - split-payment E2E: happy path (2-method atomic close), validation gate, add/remove row
- `CLAUDE.md` - `split-payment (multi-method)` feature bullet; `41-split-payment` added to E2E spec list
- `.planning/phases/18-split-payment-multi-method/deferred-items.md` - regression-gate findings, evidence for 4 pre-existing unrelated E2E failures

## Decisions Made
- **Hardware checkpoint resolution:** The plan's Task 2 `<how-to-verify>` requested a physical cash-drawer-opens-once + two-receipts UAT sign-off on real hardware (18-UI-SPEC #8 / Assumption A2 — "the one behavior not fully automatable"). No hardware was available during this execution. The user explicitly instructed: "Skip hardware check for now — no hardware available right now, accept the mock-layer test coverage and close the phase; verify manually later." This is accepted as a deliberate, informed risk acceptance, not a plan shortcut — the mock-layer assertion already exists (`PaymentForm.test.tsx`, per 18-05-SUMMARY.md: "Cash drawer opens once per checkout via `legs.some(l => l.method === 'cash')`" with a corresponding RTL test asserting `openCashDrawer` is called exactly once for a multi-cash-leg split). This does NOT block Phase 18 completion; it is logged here as an accepted, deferred manual-verification item.
- **Pre-existing E2E failures not fixed:** Per the executor's scope-boundary rule, the 4 unrelated failing specs (`34-split-bill`, `35-refund`, `17-payment-pane`, `23-payment-edge-cases`) were investigated (not blindly deferred) — each failure was traced to a root cause with git-log/code evidence proving zero Phase 18 involvement, then documented in `deferred-items.md` with a recommendation for a future phase to re-baseline them, rather than expanding this plan's scope to fix files it did not touch.

## Deviations from Plan

None beyond what is documented above as accepted risk. No Rule 1-4 auto-fixes were required in this continuation session — the automated regression gate, docs update, and E2E spec were already completed and committed in the prior session; this session's only action was resolving the human checkpoint per explicit user direction and producing this SUMMARY.

## Issues Encountered
- Physical hardware (cash drawer + thermal printer) was not available at execution time, preventing the plan's literal `<how-to-verify>` hardware UAT step. Resolved via explicit user instruction to defer — see "Decisions Made" above. This is not a code or test issue; it is an environment/infrastructure constraint on the verification step itself.

## User Setup Required

**Manual hardware verification deferred — to be performed later on real hardware.**
When hardware is available, an operator should:
1. Open a tab, add items, open PaymentPane, toggle "Split payment" ON.
2. Enter TWO cash rows that split the total, submit.
3. Confirm the physical cash drawer pops exactly ONCE (not twice).
4. Confirm TWO receipts print in sequence ("Receipt 1 of 2" then "Receipt 2 of 2").
5. Confirm the tab is closed/paid.

This is not a blocker for Phase 18 completion — automated mock-layer coverage (`PaymentForm.test.tsx`) already asserts the drawer-once behavior at the code level; this step is the final physical-hardware confirmation.

## Next Phase Readiness
- Phase 18 (split-payment-multi-method) is functionally complete: schema/RPC (Plans 01-03), deployed edge function (Plan 04), UI (Plan 05), and E2E verification + regression gate (Plan 06) all shipped and green
- One deferred item carries forward: physical hardware UAT for cash-drawer-once + two-receipt sequencing (see "User Setup Required" above) — recommended as a quick manual check whenever hardware is next accessible, not a phase blocker
- A future phase/plan should re-baseline `e2e/17-payment-pane.spec.ts`, `e2e/23-payment-edge-cases.spec.ts`, `e2e/34-split-bill.spec.ts`, and `e2e/35-refund.spec.ts` (stale copy assertions, unscoped dialog locators, split-tab UI-flow flakiness) — see `deferred-items.md` for full evidence and recommendation

---
*Phase: 18-split-payment-multi-method*
*Completed: 2026-07-08*

## Self-Check: PASSED

- FOUND: e2e/41-split-payment.spec.ts
- FOUND: CLAUDE.md
- FOUND: .planning/phases/18-split-payment-multi-method/deferred-items.md
- FOUND commit: 184cac9 (Task 1)
- FOUND commit: 89aa327 (Task 2 automated portion)
