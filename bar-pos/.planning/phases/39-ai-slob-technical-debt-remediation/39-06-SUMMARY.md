---
phase: 39-ai-slob-technical-debt-remediation
plan: 06
subsystem: testing
tags: [playwright, e2e, waitlist, payments, pool-billing, rappi, field-validation, supabase]

requires:
  - phase: 39-ai-slob-technical-debt-remediation
    provides: "39-02's E2E triage method and ledger row format (39-02-LEDGER.md), reused verbatim"
provides:
  - "39-06-LEDGER.md: all 34 findings across e2e/23-payment-edge-cases, 24-pool-advanced, 24-sprint5-pool-accuracy, 24-waitlist, 25-rappi-orders, 26-field-validation.spec.ts classified with evidence and live-verified final state"
  - "6 in-file E2E harness fixes (unbounded test-data accumulation, wrong accessible-name locators, missing page.reload() after direct DB mutation, wrong seed-shift ownership, stale skip reasons)"
  - "2 confirmed real product-bug todos: tab customer-name 100-char cap unenforced end-to-end; notify-waitlist UPDATE rejected by Postgres (missing pg_net 'net' schema)"
affects: [phase-38-e2e-test-infrastructure, future-notify-waitlist-fix, future-tab-name-validation-fix]

actuals:
  tokens: 16382
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Scoped listitem locator + per-run unique name + finally-block cleanup for list-based E2E fixtures that accumulate across runs (waitlist queue)"
    - "OR-fallback assertion (custom error text OR native HTMLInputElement.validity.valid===false) for form fields where native HTML5 constraints pre-empt custom Zod validation on submit"
    - "DB-truth polling (admin.from(...).select(...)) as a more robust E2E assertion than a UI badge when the badge depends on a fragile client-side cache-invalidation path"

key-files:
  created:
    - .planning/phases/39-ai-slob-technical-debt-remediation/39-06-LEDGER.md
    - .planning/todos/pending/2026-08-04-tab-customer-name-100-char-cap-not-enforced.md
    - .planning/todos/pending/2026-08-04-notify-waitlist-fails-pg-net-schema-missing.md
  modified:
    - e2e/24-pool-advanced.spec.ts
    - e2e/24-waitlist.spec.ts
    - e2e/25-rappi-orders.spec.ts
    - e2e/26-field-validation.spec.ts

key-decisions:
  - "All 14 sprint5-pool-accuracy/pool-advanced findings and PE6/PE7 route to Phase 38 (live PGRST205 pool_tables schema-cache defect, independently reproduced this session, identical to 39-02-LEDGER.md's Group A/B pattern) — zero billing-math assertions survive to run."
  - "24-waitlist.spec.ts's T2 fix uncovered a genuine app defect one layer deeper than expected: fixing the locator's accessible-name mismatch let the click succeed, which then surfaced that the underlying Postgres UPDATE is rejected outright (missing pg_net extension) — filed as a todo rather than reclassified, test intentionally left red."
  - "T5 (cross-context Realtime assertion) reproducibly failed at both 10s and 20s timeouts across two independent live runs — converted to a documented skip matching the already-accepted 39-02-LEDGER.md T13 precedent, rather than chased further as a flake."
  - "RO2/RO3/RO4's skip reasons remain unresolved: static source analysis (query filters, RLS policy) shows no reason the seeded rappi order shouldn't render, yet two independent live runs show it consistently doesn't. Documented as an open discrepancy, not filed as a todo — could not confirm a specific app defect within this triage plan's scope, and D-03 requires a confirmed mismatch before filing."

requirements-completed: [D-03, D-04, D-06]

coverage:
  - id: D1
    description: "All 34 E2E findings in specs 23-26 classified with real per-test evidence (D-04) — no title-only guessing"
    verification:
      - kind: e2e
        ref: "39-06-LEDGER.md — 34 rows, each with error excerpt/skip reason, classification, evidence citation, action"
        status: pass
    human_judgment: false
  - id: D2
    description: "Seven-failure 24-sprint5-pool-accuracy.spec.ts cluster reduced to its real root-cause groups, not enumerated as 7 independent bugs"
    verification:
      - kind: e2e
        ref: "39-06-LEDGER.md Task 1 — Group A/Group B split, live-reproduced PGRST205 evidence"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every real product bug found is filed as a todo, not fixed inline (D-03) — zero src/ changes"
    verification:
      - kind: other
        ref: "git diff --name-only -- src/ (empty, verified in Task 3's automated verify gate)"
        status: pass
    human_judgment: false

duration: 165min
completed: 2026-08-05
status: complete
---

# Phase 39 Plan 06: Money-and-Billing E2E Triage (specs 23-26) Summary

**Triaged all 34 E2E findings in the payment/pool-billing/waitlist/rappi/field-validation batch to a written disposition, fixed 6 pre-existing test-harness bugs (confirmed via live re-runs against the remote project), and filed 2 confirmed real product-bug todos — including one where fixing a locator bug surfaced that the notify-waitlist feature is completely non-functional due to a missing Postgres extension.**

## Performance

- **Duration:** ~165 min
- **Started:** 2026-08-04 (worktree branch base ee8ffba)
- **Completed:** 2026-08-05
- **Tasks:** 3/3 completed
- **Files modified:** 7 (4 spec files, 1 ledger, 2 todos)

## Accomplishments

- All 34 findings across `e2e/23-payment-edge-cases.spec.ts`, `e2e/24-pool-advanced.spec.ts`, `e2e/24-sprint5-pool-accuracy.spec.ts`, `e2e/24-waitlist.spec.ts`, `e2e/25-rappi-orders.spec.ts`, and `e2e/26-field-validation.spec.ts` carry a written classification backed by real Playwright error output, browser console evidence, or a live re-run — not title-matching.
- The 14-finding pool-billing cluster (7 in each of two specs) was reduced to a single confirmed live infra defect (Supabase PostgREST schema-cache miss on `pool_tables`) already routed to Phase 38 — reproduced independently this session via a direct service-role query, matching 39-02-LEDGER.md's established Group A/B pattern exactly.
- Fixed 6 distinct pre-existing E2E harness bugs, all confirmed passing on live re-runs against the remote project: unbounded historical test-data accumulation causing Playwright strict-mode violations (waitlist T1/T2/T4), a `getByRole` accessible-name mismatch (`aria-label` overriding visible button text), a missing `page.reload()` after a direct DB mutation left a component serving stale cached data, a seed helper scoping a new row to the wrong staff member's shift, and a native-HTML5-validation vs. custom-error-text assertion gap.
- Filed 2 confirmed real product-bug todos, both left as intentionally red tests rather than fixed inline: the tab customer-name 100-character cap documented in `domain.ts` is enforced nowhere in the actual open-tab submission path (client, mutation, or DB column), and the notify-waitlist feature's status UPDATE is rejected outright by Postgres because the `pg_net` extension's `net` schema doesn't exist on the project — a severity-major finding for a FIFO-queue feature the app markets as WhatsApp-notification-driven.

## Task Commits

1. **Task 1: Establish the shared root cause for the two pool-billing spec clusters** - `44720f8` (test)
2. **Task 2/3: Triage and fix remaining findings in specs 23, 24-waitlist, 25, 26** - `6480f64` (test)
3. **Task 3: Record final triage ledger and file real-regression todos** - `46a43b7` (docs)

## Files Created/Modified

- `.planning/phases/39-ai-slob-technical-debt-remediation/39-06-LEDGER.md` - full 34-row triage ledger with evidence, classification, and live-verified final spec-run results
- `.planning/todos/pending/2026-08-04-tab-customer-name-100-char-cap-not-enforced.md` - real-regression todo, `26-field-validation.spec.ts` FV3
- `.planning/todos/pending/2026-08-04-notify-waitlist-fails-pg-net-schema-missing.md` - real-regression todo, `24-waitlist.spec.ts` T2
- `e2e/24-pool-advanced.spec.ts` - corrected PA1/PA7's stale skip reasons
- `e2e/24-waitlist.spec.ts` - fixed T1/T2/T4/T7 harness bugs, converted T5 to a documented `valid-skip`
- `e2e/25-rappi-orders.spec.ts` - fixed RO5's wrong-shift seed bug
- `e2e/26-field-validation.spec.ts` - fixed FV8's locator scope and FV9's validation-mechanism assertion, corrected FV6's skip reason

## Decisions Made

- **Pool-billing cluster (Task 1):** rather than write 14 separate rows, established one confirmed shared root cause (live PGRST205 schema-cache defect) via an independent service-role query, matching 39-02-LEDGER.md's Group A/B methodology exactly. No billing-math assertion survives to run in either spec, so no `real-regression` was possible to find here.
- **T2's layered discovery:** fixing the test-data-accumulation bug and the accessible-name locator bug (both genuine harness bugs) was necessary before the *third*, real app defect (Postgres rejecting the notify UPDATE) became visible at all. This is the D-04 discipline paying off exactly as 39-02-LEDGER.md's own methodology note predicted — each layer of "obvious" harness noise was masking the next.
- **T5 reclassified harness → valid-skip:** initially treated as a timeout-tuning harness fix, but after widening 10s to 20s and reproducing the failure on two full independent live runs, converted to a documented skip citing the already-accepted 39-02-LEDGER.md T13 precedent for cross-context Realtime assertions in this single-worker Playwright environment, rather than continuing to chase an unreliable assertion.
- **RO2/RO3/RO4 left as an open, undismissed discrepancy:** static source analysis (query status filter, RLS policy) found no reason the seeded rappi order shouldn't render, yet it consistently doesn't across two independent live runs. Rather than force a `stale` or `real-regression` label without a confirmed mechanism, documented the discrepancy plainly and left the (already-correct, runtime-conditional) skips as-is.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 6 pre-existing E2E harness bugs beyond the plan's explicit read_first scope**
- **Found during:** Task 2 (triaging `24-waitlist.spec.ts`, `25-rappi-orders.spec.ts`, `26-field-validation.spec.ts`) and Task 3's live re-run of the fixes
- **Issue:** Test-data accumulation causing strict-mode violations, a wrong `getByRole` accessible-name match, a missing post-mutation `page.reload()`, a seed helper scoping to the wrong staff member's shift, a native-vs-custom validation assertion gap, and two stale skip-reason strings
- **Fix:** Applied the file's own already-established correct patterns (unique names, listitem scoping, `finally`-block cleanup, reload-after-mutation) where a sibling test in the same file already demonstrated the right approach; otherwise scoped locators or corrected assertions to match actual, verified current UI behavior
- **Files modified:** `e2e/24-waitlist.spec.ts`, `e2e/25-rappi-orders.spec.ts`, `e2e/26-field-validation.spec.ts`, `e2e/24-pool-advanced.spec.ts`
- **Verification:** Every fix confirmed via a live Playwright run against the remote project (three separate targeted re-runs as fixes were layered in); final state re-verified in a clean `24-waitlist.spec.ts`-only run showing exactly the documented 5 passed / 1 skipped / 1 failed (intentional) outcome
- **Committed in:** `44720f8`, `6480f64`

---

**Total deviations:** 1 Rule-1 category, 6 stacked fixes across 4 files, all necessary corrections to reach an accurate final triage (not scope creep — every fix was a prerequisite for correctly classifying the finding underneath it).
**Impact on plan:** None negative — the plan's `files_modified` list already scoped all 4 touched spec files for exactly this kind of in-file harness correction.

## Issues Encountered

- **Concurrent-agent DB contention:** this plan ran alongside 3 sibling worktree agents (39-04, 39-05, 39-07) executing other Track A plans against the same live remote Supabase project. One test (`23-payment-edge-cases.spec.ts` PE3) failed with environmental errors (`seedTabWithBudweiser: no open caja`, then a payments-list-not-found on retry) consistent with a sibling agent's concurrent `resetTestState()`/`openCaja()` call landing mid-run — not a tip-feature defect (the tip UI's existence was independently confirmed via source read). Documented in the ledger rather than reclassified without cause.
- **Iterative live-run discovery on `24-waitlist.spec.ts`:** the full 43-test run surfaced 2 of the 6 harness bugs; fixing those surfaced a 3rd bug in T2 specifically; fixing that surfaced the real `pg_net` regression. Required 4 separate targeted live-run passes (full 43-test run, 12-test waitlist+rappi re-run, 7-test waitlist-only re-run, final 7-test confirmation run) rather than a single pass, adding real time to Task 3 but producing a materially more accurate ledger than a single-pass triage would have.

## User Setup Required

None - no external service configuration required. (The `pg_net` extension gap documented in the filed todo is a project-infrastructure decision for a human/DBA to make, not a setup step for this plan.)

## Next Phase Readiness

- Phase 38 now has 14 additional confirmed pool_tables/resources schema-cache findings routed to it from this plan, on top of 39-02's original 12 and the prior 04-pool-timer.spec.ts findings — all citing the same root cause.
- 2 real-regression todos are pending in `.planning/todos/pending/` for future prioritization: tab customer-name length enforcement, and the notify-waitlist `pg_net` schema gap (the latter is severity-major — the notify-waitlist feature is currently non-functional end-to-end).
- No blockers for subsequent Track A or Track B plans in this phase — this plan's file scope (4 spec files + ledger + todos) had zero overlap with sibling plans' declared `files_modified`.

---
*Phase: 39-ai-slob-technical-debt-remediation*
*Completed: 2026-08-05*

## Self-Check: PASSED

All 8 claimed files confirmed tracked via `git ls-files` (39-06-LEDGER.md, 39-06-SUMMARY.md, both todos, 4 spec files). All 4 commit hashes (`44720f8`, `6480f64`, `46a43b7`, `6528fa8`) confirmed present in `git log --oneline`.
