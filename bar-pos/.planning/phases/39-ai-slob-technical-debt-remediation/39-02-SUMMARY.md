---
phase: 39-ai-slob-technical-debt-remediation
plan: 02
subsystem: testing
tags: [playwright, e2e, supabase, postgrest, triage]

# Dependency graph
requires:
  - phase: 10-ai-slob-technical-debt-checklist
    provides: 10-CHECKLIST.md's Blocking-tier E2E findings list (title + line, no per-test error output)
provides:
  - "39-02-LEDGER.md — 16/16 e2e/16-table-status.spec.ts findings classified against real Playwright error.message output, with a reusable row format for plans 39-04 through 39-07"
  - "Confirmed shared-cause hypothesis (39-RESEARCH.md Pitfall 3): 12 failures collapse to 2 symptom clusters, 1 root cause (live PostgREST schema-cache defect on public.pool_tables)"
  - "Corrected 10-CHECKLIST.md's title-only 'plausibly rediscovered' correlation between T6 and the print-popup-hang todo — this run's real error shows no match"
affects: [39-04, 39-05, 39-06, 39-07, "phase-38-e2e-test-infrastructure-seed-data-reliability"]

# Actuals (#2632)
actuals:
  tokens: 3938
  tasks: 3
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "E2E triage ledger format: `| <spec>:<line> | <test> | <error excerpt> | <root-cause group> | <classification> | <evidence> | <action> |`, greppable per spec file via `^| e2e/<spec>.spec.ts:`"
    - "Direct node/service-role reproduction (bypassing Playwright/the app entirely) to confirm whether an E2E failure's root cause is a live DB/infra defect vs. app code"

key-files:
  created:
    - .planning/phases/39-ai-slob-technical-debt-remediation/39-02-LEDGER.md
  modified: []

key-decisions:
  - "All 12 failures classified `infra` and routed to Phase 38 — root cause is a live PostgREST schema-cache defect on `public.pool_tables` on the shared remote Supabase project, reproduced independently of Playwright, not application code."
  - "T12's runtime skip reclassified `conditional` rather than taken at face value — its 'All tables occupied' message is misleading; the call site doesn't check `error`, so the same PGRST205 defect masquerades as normal seed exhaustion."
  - "T3 kept `valid-skip` after actively re-verifying against current code (not just the stale-sounding comment) — a promotions-driven HappyHourBanner exists in OrderPanel but not in TableStatusPanel, so the asserted UI genuinely still doesn't exist on this page."
  - "T6's real error contradicts 10-CHECKLIST.md's title-only correlation with the print-popup-hang todo; left that todo untouched rather than closing/updating it on a false match."
  - "Zero todos filed and zero spec edits made — a valid, evidenced outcome given no `real-regression`/`harness`/`obsolete` rows were found."

patterns-established:
  - "When a service-role/anon Supabase query needed for E2E triage returns PGRST205 for a specific table, reproduce it with a standalone `node -e` script (bypassing Playwright and the app) before classifying — this isolates DB/infra-layer defects from UI/app-layer symptoms and prevents misclassifying an infra issue as N independent app bugs."

requirements-completed: [D-03, D-04, D-06]

coverage:
  - id: D1
    description: "39-02-LEDGER.md classifies all 16 e2e/16-table-status.spec.ts findings (12 failed + 4 skipped) with real error.message evidence, not test titles"
    requirement: D-04
    verification:
      - kind: other
        ref: "grep -c '^| e2e/16-table-status.spec.ts:' .planning/phases/39-ai-slob-technical-debt-remediation/39-02-LEDGER.md → 16"
        status: pass
    human_judgment: false
  - id: D2
    description: "Root-cause attribution: all 12 failures are one infra-layer defect (pool_tables PostgREST schema-cache miss), not 12 independent app bugs — routed to Phase 38, zero real-regression todos filed"
    requirement: D-06
    verification:
      - kind: other
        ref: "39-02-LEDGER.md 'Shared-cause hypothesis: CONFIRMED' section — direct node/service-role PGRST205 reproduction, independent of Playwright/app"
        status: pass
    human_judgment: true
    rationale: "Misclassifying a real regression as infra silently drops a live bug from Phase 39's remediation scope (threat T-39-08). The evidence is strong and reproducible, but confirming the infra attribution is correct — rather than an artifact of this specific sandboxed run — benefits from a human skim of the ledger's reproduction commands before Phase 38 picks this up."

duration: ~35min
completed: 2026-08-04
status: complete
---

# Phase 39 Plan 02: E2E Triage Tracer (e2e/16-table-status.spec.ts) Summary

**Triaged all 16 findings in the suite's largest single-file E2E cluster against real Playwright error output and traced all 12 failures to one live PostgREST schema-cache defect on `public.pool_tables`, not 12 independent app regressions — establishing the Track A triage method and ledger format for the remaining 131 findings.**

## Performance

- **Duration:** ~35 min (dominated by a live `npx playwright test` run: ~20 min for 16 tests × up to 2 attempts each at `slowMo: 400`)
- **Completed:** 2026-08-04T16:22Z
- **Tasks:** 3 (executed as one continuous investigation — see Deviations)
- **Files modified:** 1 created (`39-02-LEDGER.md`); 0 under `src/`; 0 `e2e/` spec edits

## Accomplishments

- Ran `e2e/16-table-status.spec.ts` live (not from a stale digest) after provisioning a missing `node_modules`/`.env.local` in this fresh worktree, and read every failing test's real `error.message`/stack from the Playwright `list` reporter's end-of-run failure summary.
- Confirmed 39-RESEARCH.md's Pitfall 3 shared-cause hypothesis with hard evidence: the 12 failures reduce to exactly 2 symptom signatures (`getByRole('button', {name: 'Start Session'})` timeout; explicit `seedOccupiedTableDirect` `PGRST205` throw), both traced to one cause — reproduced the `PGRST205: Could not find the table 'public.pool_tables' in the schema cache` error directly against the live remote Supabase project via a standalone node script, independent of Playwright and the app, confirming it as a live infra defect isolated to that one table (`tabs`/`pool_sessions` queried fine at the same moment).
- Classified all 12 failures `infra`, routed to Phase 38 (matches D-05's precedent for the same failure category on `04-pool-timer.spec.ts`) — zero code changes, zero todos filed.
- Classified all 4 skips: T3 `valid-skip` (actively re-verified against current code — a promotions-based `HappyHourBanner` now exists but only on `OrderPanel`, not `TableStatusPanel`), T12 `conditional` (its "occupied" skip message is a red herring — same `PGRST205` root cause, just unchecked at that call site), T13/T14 `valid-skip` (documented Playwright multi-context/offline constraints still hold).
- Caught and corrected a title-only false correlation from 10-CHECKLIST.md: T6's real failure this run never reached the print button at all, so it does not confirm the existing print-popup-hang todo — left that todo untouched rather than closing it on a coincidental title match.
- Produced the reusable ledger row format (`| <spec>:<line> | <test> | <error excerpt> | <group> | <classification> | <evidence> | <action> |`, greppable via `^| e2e/<spec>.spec.ts:`) for plans 39-04 through 39-07 to copy.

## Task Commits

All three tasks converged on one artifact (`39-02-LEDGER.md`) from one continuous investigation and one Playwright run, so they were committed together — see Deviations for why.

1. **Tasks 1+2+3 (combined): triage 16 findings, classify skips, apply harness fixes/file todos/re-run**  — `bcc940f` (docs)

**Plan metadata:** commit is pending as part of this SUMMARY's own commit (worktree mode — STATE.md/ROADMAP.md updates deferred to the orchestrator).

## Files Created/Modified

- `.planning/phases/39-ai-slob-technical-debt-remediation/39-02-LEDGER.md` - 16-row classification ledger with shared-cause investigation, direct-DB reproduction evidence, and the reusable row format

## Decisions Made

- All 12 failures classified `infra`/routed to Phase 38 rather than filed as 12 separate real-regression todos — one confirmed shared cause, not 12 independent app bugs.
- T12 reclassified `conditional` (not taken at face value as "genuinely occupied") after tracing its skip condition back to the same unchecked-`error` code path.
- T3 kept `valid-skip` only after confirming via grep that no promotions-based indicator exists specifically on `TableStatusPanel` (a sibling component, `HappyHourBanner`, does exist elsewhere — this could have looked like a stale skip without that check).
- Left the print-popup-hang todo unmodified — this run's real error doesn't confirm it, and D-03 doesn't ask this plan to resolve an unrelated todo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Provisioned missing `node_modules` and `.env.local` in this worktree**
- **Found during:** Task 1 (before running the spec)
- **Issue:** This freshly-created worktree had no `node_modules` (0 entries) and no `bar-pos/.env.local` — both are gitignored and don't carry over from the main checkout. Without them, `npx playwright test` cannot run at all, and every test auto-skips via `requireIntegrationEnv()`, which would make D-04's "real per-test error output" requirement impossible to satisfy.
- **Fix:** Symlinked `node_modules` to the main checkout's `node_modules` (same machine/architecture, read-only usage) and copied `.env.local` from the main checkout (the project's own existing dev/E2E credentials, not new secrets). Both remain excluded from `git status` by the pre-existing `.gitignore` (`node_modules`, `*.local`) — verified clean before and after.
- **Files modified:** None tracked by git (gitignored setup artifacts only).
- **Verification:** `git status --short` clean of both before commit; spec ran successfully to completion afterward.
- **Committed in:** N/A (not a git-tracked change)

**2. [Rule 3 - Blocking] Corrected the `PLAYWRIGHT_JSON_OUTPUT_FILE` regeneration command from 39-RESEARCH.md's Code Examples**
- **Found during:** Task 1, first spec-run attempt
- **Issue:** Running `PLAYWRIGHT_JSON_OUTPUT_FILE=.audit-tmp/e2e-per-spec/16-table-status.json npx playwright test e2e/16-table-status.spec.ts --reporter=json` (as documented in 39-RESEARCH.md) produced no JSON file. The `--reporter=json` CLI flag replaces `playwright.config.ts`'s configured reporter array (`blob`, `list`, `json`) entirely rather than adding to it, so the env var had nothing to redirect.
- **Fix:** Used `--reporter=list` instead, which prints the full per-test `error.message` and stack trace in its end-of-run failure summary — sufficient for D-04's evidence requirement without needing the JSON file. Documented this correction in the ledger's "Reusable ledger row format" section so plans 39-04–39-07 don't repeat the failed attempt.
- **Files modified:** None (command-only correction, no file change; noted as a methodology correction inside `39-02-LEDGER.md`).
- **Verification:** Re-ran with `--reporter=list`; captured all 12 real error messages successfully.
- **Committed in:** `bcc940f` (documented in the ledger)

### Task-boundary deviation (not a Rule 1-4 fix, a structural note)

**Tasks 1, 2, and 3 were executed as one continuous pass instead of three separate commits.** All three tasks converge on the same single artifact (`39-02-LEDGER.md`) and depend on the same one Playwright run: Task 1's failure investigation and Task 2's skip investigation happened from the same `list`-reporter output in the same run, and Task 3's "apply harness fixes / file todos / re-run" step had nothing to do — every row classified `infra` or `valid-skip`/`conditional`, so there were no harness edits, no todos, and no need for a second spec run (Task 1's run already produced the "final stats" Task 3 asks for). Splitting into three commits would have meant committing the same file three times with no meaningful intermediate state. One commit (`bcc940f`) captures the complete, coherent result of all three tasks.

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking, tooling/environment only) + 1 structural note (task-commit granularity)
**Impact on plan:** No scope creep. Both fixes were necessary preconditions for D-04's "real error output" requirement; the task-granularity note reflects the tasks' actual shared-artifact/shared-run dependency, not a shortcut around any task's deliverable.

## Issues Encountered

- The Playwright run took ~20 minutes wall-clock for only 16 tests (many with a failing retry) due to `slowMo: 400` and 15-30s timeouts per failing locator — this is expected given the spec's non-`FAST_E2E` defaults, not itself a finding.
- The live remote Supabase project's `pool_tables` table dropped out of PostgREST's schema cache partway through the run and had not recovered by the time this plan finished (~15+ minutes later, confirmed via a final standalone re-check) — flagged prominently in the ledger for Phase 38, since it may still be affecting other spec files' pool-table-dependent tests if run again before it clears.

## User Setup Required

None - no external service configuration required. (The `.env.local` used already existed in the project; nothing new was provisioned externally.)

## Next Phase Readiness

- The ledger row format and the "reproduce root cause independent of Playwright before classifying" pattern are ready for plans 39-04 through 39-07 to reuse directly.
- **Phase 38 should be made aware before its own work starts:** the `public.pool_tables` PostgREST schema-cache defect observed here may still be live and could affect `04-pool-timer.spec.ts` and any other pool-table-dependent spec if re-run soon after this plan.
- No blockers for the next Track A plan — this plan's scope (one spec file) is fully closed with zero open action items inside `e2e/16-table-status.spec.ts` itself.

---
*Phase: 39-ai-slob-technical-debt-remediation*
*Completed: 2026-08-04*

## Self-Check: PASSED

- FOUND: `.planning/phases/39-ai-slob-technical-debt-remediation/39-02-LEDGER.md`
- FOUND: commit `bcc940f` in `git log --oneline --all`
</content>
