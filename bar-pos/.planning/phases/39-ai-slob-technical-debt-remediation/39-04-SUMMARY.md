---
phase: 39-ai-slob-technical-debt-remediation
plan: 04
subsystem: testing
tags: [playwright, e2e, vitest, triage, technical-debt]

# Dependency graph
requires:
  - phase: 39-02
    provides: "The D-04 real-per-test-error triage method and reusable ledger row format (39-02-LEDGER.md)"
provides:
  - "39-04-LEDGER.md: 43/43 E2E findings across specs 01-14 classified with real evidence"
  - "5 harness fixes applied and live-verified (01-ci.spec.ts shell bug, 03/07/09/10-*.spec.ts selector/copy/count drift)"
  - "1 real-regression todo filed (offline queue drops 2nd queued order on reconnect)"
affects: [39-05, 39-06, 39-07, phase-38-e2e-infra-remediation]

actuals:
  tokens: 11721
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "D-05 routing: pre-confirmed Phase-38 findings get a ledger row with no re-investigation"
    - "Harness-vs-real verdict via direct-run-vs-spawned-run exit-code comparison (01-ci.spec.ts)"

key-files:
  created:
    - .planning/phases/39-ai-slob-technical-debt-remediation/39-04-LEDGER.md
    - .planning/todos/pending/2026-08-04-offline-queue-drops-second-order-on-reconnect.md
  modified:
    - e2e/01-ci.spec.ts
    - e2e/03-tab-order.spec.ts
    - e2e/07-reports.spec.ts
    - e2e/09-rbac.spec.ts
    - e2e/10-inventory.spec.ts

key-decisions:
  - "e2e/01-ci.spec.ts's 3 failures are 100% harness-environmental (hardcoded cmd.exe shell, a Windows-only leftover from before Phase 36's Ubuntu migration), not application bugs — confirmed by comparing spawned-command exit codes against direct-run exit codes for all 3 wrapped commands"
  - "Bumped 09-rbac.spec.ts's hardcoded switch-count assertion from 96 to 104 (26 STAFF_ACTIONS x 4 roles, reflecting Phase 22/23 additions) rather than treating it as a regression"
  - "10-inventory.spec.ts's RBAC-denied assertion was checking the wrong invariant (toHaveCount(0)) against ProtectedAction's actual disabled-with-tooltip pattern — fixed to toBeDisabled()"
  - "Offline-queue double-order-loss finding filed as a todo, not fixed inline, per D-03 — root cause (stale expectedVersion snapshot vs. STALE_VERSION discard) is plausible but unconfirmed against the add_order RPC"

requirements-completed: [D-03, D-04, D-05, D-06]

coverage:
  - id: D1
    description: "All 43 E2E findings across specs 01-14 carry a written classification backed by real Playwright error output"
    requirement: D-04
    verification:
      - kind: manual_procedural
        ref: ".planning/phases/39-ai-slob-technical-debt-remediation/39-04-LEDGER.md (43 rows, each with an error.message/skip-reason excerpt)"
        status: pass
    human_judgment: false
  - id: D2
    description: "11 Phase-38-confirmed findings routed without re-triage, no code change attributable to them"
    requirement: D-05
    verification:
      - kind: other
        ref: "grep -c 'ROUTED TO PHASE 38' 39-04-LEDGER.md == 11"
        status: pass
    human_judgment: false
  - id: D3
    description: "01-ci.spec.ts's 3 failures resolved as harness-environmental with evidence, not left unexplained"
    verification:
      - kind: e2e
        ref: "Direct npm run typecheck/lint/test all exit 0, matching 10-CHECKLIST.md's clean baseline, against the spec's pre-fix spawnSync cmd.exe ENOENT"
        status: pass
    human_judgment: false
  - id: D4
    description: "5 harness-classified test-file fixes applied and live-verified passing in this worktree"
    verification:
      - kind: e2e
        ref: "npx playwright test e2e/03-tab-order.spec.ts -g 'Bartender creates a tab' (pass); e2e/09-rbac.spec.ts -g 'T-RP-01' (pass); e2e/10-inventory.spec.ts -g 'T6:' (pass); e2e/07-reports.spec.ts -g 'Cash reconciliation variance displayed|date range filter to far past' (2 pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every real product bug found is filed as a todo, not fixed inline"
    requirement: D-03
    verification:
      - kind: other
        ref: ".planning/todos/pending/2026-08-04-offline-queue-drops-second-order-on-reconnect.md; git diff --name-only -- src/ is empty for this plan"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-06
status: complete
---

# Phase 39 Plan 04: E2E Triage (specs 01-14) Summary

**43/43 E2E findings across specs 01-14 dispositioned — 11 routed to Phase 38 per D-05, the `01-ci.spec.ts` toolchain-vs-CI-spec contradiction resolved as a Windows-only `cmd.exe` harness bug, 5 test-file fixes applied and live-verified, and one real product bug (offline queue silently drops the 2nd of 2 orders queued against the same tab) filed as a todo rather than fixed inline.**

## Performance

- **Duration:** ~55 min (continuation of a prior session that lost its transcript; recovered work reviewed and completed here)
- **Started:** 2026-08-06T12:59:00Z
- **Completed:** 2026-08-06T13:54:00Z
- **Tasks:** 3/3
- **Files modified:** 6 (5 spec files + 1 ledger; 1 todo file created)

## Session continuity note

This plan's prior execution attempt lost its session (transcript corruption after an environment
disconnect, not a real failure) but had already produced two real commits (`ce8690a`, `925000c`,
still reachable in this repo's object database on the now-orphaned
`worktree-agent-aa5eb964e20d15d57` branch) plus an uncommitted diff and two staging files. This
session cherry-picked both commits, applied the recovered diff, copied in the recovered todo
file, and critically re-verified every recovered claim before trusting it — re-running
`typecheck`/`lint`/`test` and live-spot-checking all 5 fixed E2E tests in this fresh worktree
rather than taking the recovered ledger's "Live re-run: passed" notes on faith. All checks
reproduced clean. Task 3 (harness fixes to `07-reports.spec.ts`, `09-rbac.spec.ts`,
`10-inventory.spec.ts`, `03-tab-order.spec.ts`, and filing the offline-queue todo) had not yet
been committed by the prior session and was completed and committed in this session.

## Accomplishments

- **Task 1** — Routed the 11 Phase-38-confirmed findings (`02-caja.spec.ts:61`,
  `04-pool-timer.spec.ts:38,50,65,81,97`, `07-reports.spec.ts:621,647,729,752,774`) with zero
  re-investigation, per D-05. Resolved `e2e/01-ci.spec.ts`'s 3 failures: its `run()` helper
  hardcoded `shell: process.env.ComSpec ?? 'cmd.exe'`, a Windows-only leftover pre-dating Phase
  36's Ubuntu migration; on this Ubuntu host every spawned command died with
  `spawnSync cmd.exe ENOENT` before the wrapped `npm run typecheck`/`lint`/`test` ever ran. Fixed
  by removing the override and letting Node's `execSync` use its correct per-platform default.
  Direct runs of all three commands exit 0, matching 10-CHECKLIST.md's clean audit baseline —
  confirming the contradiction was 100% harness-environmental, not a code regression.
- **Task 2** — Classified the remaining 29 findings across specs 03, 04, 06, 07, 09, 10, 11, 13,
  and 14, grouped by shared error signature per spec file: 5 harness (test-side drift — fixed), 9
  infra (shared pool-table-availability/inventory-seed-data causes — routed to Phase 38), 4
  conditional (genuinely-still-unimplemented UI features, confirmed against current `src/` and
  CLAUDE.md's Implemented Features), 1 valid-skip (missing second-bartender test credentials), 1
  real-regression (offline queue), and 9 valid-skip (platform-gated/manual/documented Playwright
  limitations).
- **Task 3** — Applied and live-verified all 5 harness fixes; filed the offline-queue
  real-regression as a todo (D-03, no inline fix); recorded the finding in the cross-phase
  `.planning/WINDOWS.md` defect ledger.

## Task Commits

Task 1 and 2 commits were produced by the prior (recovered) session and cherry-picked verbatim
onto this worktree's branch; Task 3 was completed and committed in this session.

1. **Task 1: Route Phase 38 findings + resolve 01-ci contradiction** - `586dc87` (feat)
2. **Task 2: Triage remaining 29 findings across specs 03-14** - `6791d1d` (docs)
3. **Task 3: Apply harness fixes, file todo, record final spec state** - `5c38c08` (fix)

## Files Created/Modified

- `.planning/phases/39-ai-slob-technical-debt-remediation/39-04-LEDGER.md` - 43-row classification ledger (11 routed, 3 harness on `01-ci.spec.ts`, 29 across the remaining 9 specs)
- `e2e/01-ci.spec.ts` - Removed hardcoded Windows-only `cmd.exe` shell override
- `e2e/03-tab-order.spec.ts` - Scoped `getByRole('dialog')` to the drawer's accessible name to exclude the always-mounted AgentPanel
- `e2e/07-reports.spec.ts` - Disambiguated the new "Recipe Variance" tab label (`exact: true`) and updated the Phase-21 i18n empty-state copy match
- `e2e/09-rbac.spec.ts` - Updated permission-matrix switch-count assertion from 96 to 104 (26 STAFF_ACTIONS x 4 roles)
- `e2e/10-inventory.spec.ts` - Changed RBAC-denied assertion from `toHaveCount(0)` to `toBeDisabled()` to match `ProtectedAction`'s actual pattern
- `.planning/todos/pending/2026-08-04-offline-queue-drops-second-order-on-reconnect.md` - Real product bug: offline queue drops the 2nd of 2 orders queued against the same tab on reconnect

## Decisions Made

- `01-ci.spec.ts`'s contradiction with 10-CHECKLIST.md's clean toolchain results was settled as harness-environmental, not real, based on direct-vs-spawned exit-code comparison — this raised (and this plan's own findings partially confirmed) the prior that other Track A specs' failures may also be environmental rather than product bugs.
- 5 `infra`-classified findings across `04-pool-timer.spec.ts:189`, `06-transfer.spec.ts:60,155`, and `07-reports.spec.ts:878` were folded into the same pool-table-availability/schema-cache group Phase 38 already owns, rather than filed as new independent findings, since their error signatures were identical to already-routed rows.
- 10-inventory.spec.ts's 4-failure cluster (lines 16, 36, 52, 94) was confirmed to share one root cause (missing `Budweiser` inventory row on the shared remote test DB) rather than written as 4 independent findings.
- The offline-queue finding's root cause (stale `expectedVersion` snapshot per queued action vs. `STALE_VERSION` discard on replay) is plausible but explicitly left unconfirmed against the `add_order` RPC — confirming and fixing it is out of this triage-only plan's scope per D-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Provisioned `node_modules` and `.env.local` for this fresh worktree**
- **Found during:** Environment setup, before Task 1
- **Issue:** Fresh git worktrees don't carry gitignored/untracked directories from the main checkout (documented gap from 39-01-LEDGER.md/39-03-SUMMARY.md) — `npm run typecheck`/`lint`/`test`/E2E were all unrunnable without them.
- **Fix:** Symlinked `node_modules` to the main checkout's copy and copied `.env.local` from the main checkout (same machine/user/project credentials); both remain gitignored, verified via `git status` before and after.
- **Files modified:** None tracked (both gitignored).
- **Verification:** `npm run typecheck && npm run lint && npm run test` all run and pass.

**2. [Rule 3 - Blocking] Local, uncommitted `playwright.config.ts` headless override**
- **Found during:** Environment setup, before Task 1
- **Issue:** `playwright.config.ts`'s `headless: false` (x3) launches a real visible Chrome window on this machine's actual desktop session, which would disrupt the user during a background worktree run.
- **Fix:** Changed all three `headless: false` occurrences to `headless: true` locally. Deliberately left uncommitted (not in this plan's `files_modified`, not staged in any commit — verified via `git status` before each commit).
- **Files modified:** `playwright.config.ts` (local only, not committed).
- **Verification:** All 5 live E2E spot-checks (see below) ran and passed with the headless override in place.

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking environment setup, no code/behavior change to `src/` or committed test files).
**Impact on plan:** Both are local-environment accommodations required to execute the plan at all; neither touches committed scope.

## Issues Encountered

- A prior execution attempt of this plan lost its session mid-way (transcript corruption after an
  environment disconnect). Recovered its two real commits via `git cherry-pick` (both applied
  cleanly, confirmed against the intended base) and its one uncommitted diff via `git apply`
  (also applied cleanly). Every recovered claim was independently re-verified in this session
  before being trusted, per the dispatch instructions — re-ran `typecheck`/`lint`/`test` and
  live-spot-checked all 5 fixed E2E tests rather than taking the recovered ledger's prior "Live
  re-run: passed" notes on faith.
- `npm run test` was intermittently flaky on `src/entities/staff/model/queries.clock.test.ts`
  across two consecutive full-suite runs (4 failed, then 1 failed) with `waitFor`/mutation-result
  timeouts, but passed cleanly in isolation (`npx vitest run` on that file alone: 6/6) and passed
  cleanly on a third full-suite run (151/151 files, 1391/1391 non-todo tests — matching
  10-CHECKLIST.md's documented clean baseline exactly). This is a pre-existing, out-of-scope test
  file (not touched by this plan, last modified in Phase 21) exhibiting resource-contention-style
  flakiness under full-parallel-suite execution — consistent in shape with the unrelated flaky
  property test already documented in this ledger's Task 1 section
  (`2026-08-04-flaky-property-test-total-conservation-duplicate-item-names.md`). Not filed as a
  new todo since it is not this plan's `files_modified` scope and the clean third run confirms it
  is transient, not a deterministic regression; noted here for visibility.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 43 findings in specs 01-14 are fully dispositioned; nothing left unexplained.
- The `01-ci.spec.ts` harness-environmental verdict is available for the sibling Track A plans
  (39-05, 39-06, 39-07) to weigh when triaging their own spec batches.
- The offline-queue todo (`2026-08-04-offline-queue-drops-second-order-on-reconnect.md`) needs a
  future plan to confirm the `add_order` RPC's `tabs.version` interaction and fix the discard
  path — directly touches this project's stated core value (order correctness under flaky
  connectivity).
- No blockers for merging this wave.

---
*Phase: 39-ai-slob-technical-debt-remediation*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: `.planning/phases/39-ai-slob-technical-debt-remediation/39-04-SUMMARY.md`
- FOUND: `.planning/phases/39-ai-slob-technical-debt-remediation/39-04-LEDGER.md`
- FOUND: `.planning/todos/pending/2026-08-04-offline-queue-drops-second-order-on-reconnect.md`
- FOUND commits: `586dc87`, `6791d1d`, `5c38c08`, `fb94301` (all present in `git log --oneline -5`)
