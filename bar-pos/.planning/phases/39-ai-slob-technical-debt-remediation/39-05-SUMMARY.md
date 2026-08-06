---
phase: 39-ai-slob-technical-debt-remediation
plan: 05
subsystem: testing
tags: [playwright, e2e, supabase, rbac, i18n, triage]

# Dependency graph
requires:
  - phase: 39-ai-slob-technical-debt-remediation
    plan: 02
    provides: "39-02-LEDGER.md's Track A triage method and ledger row format"
provides:
  - "39-05-LEDGER.md — all 32 e2e findings across specs 15, 18-modifier-notes-kds, 18-updater, 18-void-order, 19-caja-entries, 20-error-scenarios, 21-prep, 21-product-management, 22-sprint3-billing, 22-staff-management classified against real Playwright evidence"
  - "Confirmed 39-RESEARCH.md Assumption A2 with a real regression uncovered underneath: most stale skips were genuine selector/harness bugs, but void-order's one full happy-path test (18-void-order.spec.ts V2) un-skipped cleanly only to expose a real product bug (callVoidOrder's relative fetch URL always 404s)"
  - "Two explicit T-39-14 access-control verdicts: /settings gate holds (documented Language-tab-for-everyone design); /inventory gate does not hold (no role gate at all — new major todo)"
affects: [39-06, 39-07, "phase-38-e2e-test-infrastructure-seed-data-reliability"]

# Actuals (#2632)
actuals:
  tokens: 62000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Locale-agnostic assertions for i18n-affected UI (assert tab COUNT, not a translated label string, when the default test staff locale renders a different string than the source key name)"
    - "Reproduce a suspiciously-passing access-control test with a standalone Playwright script outside the E2E harness before trusting it — a one-shot isVisible() race can silently mask a real regression as a passing gate"

key-files:
  created:
    - .planning/phases/39-ai-slob-technical-debt-remediation/39-05-LEDGER.md
    - .planning/phases/39-ai-slob-technical-debt-remediation/deferred-items.md
    - .planning/todos/pending/2026-08-05-void-order-close-shift-generate-report-use-relative-fetch-url-always-404.md
    - .planning/todos/pending/2026-08-05-void-button-not-disabled-for-already-voided-orders.md
    - .planning/todos/pending/2026-08-05-inventory-page-has-no-role-gate-bartender-can-navigate-directly.md
    - .planning/todos/pending/2026-08-04-inventory-quantity-controls-not-rbac-disabled-for-bartender.md
    - .planning/todos/pending/2026-08-04-moneyinput-fields-not-associated-with-formfield-labels.md
    - .planning/todos/pending/2026-08-04-seednewstaffmember-password-mismatch-with-pin-login.md
    - .planning/todos/pending/2026-08-04-view-all-shifts-rbac-permission-never-enforced.md
  modified:
    - e2e/15-home-navigation.spec.ts
    - e2e/18-updater.spec.ts
    - e2e/18-void-order.spec.ts
    - e2e/19-caja-entries.spec.ts
    - e2e/20-error-scenarios.spec.ts
    - e2e/21-product-management.spec.ts
    - e2e/22-staff-management.spec.ts

key-decisions:
  - "18-void-order.spec.ts V2's vestigial pool-table-availability gate removed (dead variable, always failed under the live PGRST205 defect) — the test never actually needed a pool table; removing it surfaced the real callVoidOrder network bug underneath, filed as a critical todo rather than fixed inline."
  - "15-home-navigation.spec.ts T11 rewritten, not deleted: the original redirect-or-dialog assumption predates a documented Phase 21 design decision (Language tab open to every role); the real, correct gate (exactly 1 tab for bartender) is now asserted and verified."
  - "21-product-management.spec.ts PM8 confirmed a genuine, more severe finding than the existing recovered todo described: /inventory has no role gate at ALL (not just unguarded quantity controls) — filed a new, cross-referenced todo rather than conflating it with the existing one."
  - "22-staff-management.spec.ts SM6 was passing when first run — investigated further rather than accepted, because a passing access-control test after a recovered-diff rewrite warranted scrutiny. Found and fixed the test's own timing race (one-shot isVisible masking a real, already-documented view_all_shifts gap); left the assertion's correct/intended semantics unchanged per D-03."
  - "22-staff-management.spec.ts SM3's root-cause fix (seedNewStaffMember password mismatch) deliberately left unfixed — e2e/helpers/supabase.ts is a shared file used concurrently by sibling Track A plans in this wave; the existing recovered todo already scopes this out for the same reason."

requirements-completed: [D-03, D-04, D-06]

coverage:
  - id: D1
    description: "39-05-LEDGER.md classifies all 32 findings across the 10 specs in this batch with real per-test evidence (error.message or skip-reason + live re-verification), not test titles"
    requirement: D-04
    verification:
      - kind: other
        ref: "grep -cE '^\\| e2e/(15|18|19|20|21|22)-' .planning/phases/39-ai-slob-technical-debt-remediation/39-05-LEDGER.md → 32, and grep -c '^\\| e2e/18-void-order.spec.ts:' → 7"
        status: pass
    human_judgment: false
  - id: D2
    description: "Assumption A2 given an explicit confirm-with-caveat verdict, backed by the one test in this batch that actually exercises void-order's full happy path uncovering a real network-layer bug"
    requirement: D-06
    verification:
      - kind: other
        ref: "39-05-LEDGER.md 'Verdict on 39-RESEARCH.md Assumption A2' section"
        status: pass
    human_judgment: true
    rationale: "The A2 verdict and the void-order network bug both carry real product-risk weight (void is an irreversible, money-affecting action per the threat model) — a human skim of the reasoning behind 'confirmed, but' rather than a flat 'confirmed' benefits from independent judgment before Phase 38/todo-triage picks this up."
  - id: D3
    description: "Both access-control findings this batch's threat model required (T-39-14) carry an explicit, source-verified written verdict rather than a guess"
    requirement: D-06
    verification:
      - kind: other
        ref: "39-05-LEDGER.md 'Access-control findings — explicit written verdicts' section"
        status: pass
    human_judgment: true
    rationale: "Elevation-of-privilege verdicts (gate holds vs. does not hold) are exactly the class of finding where a wrong call is highest-consequence — worth a human confirming the source-code citations before treating either verdict as final."

duration: ~2h
completed: 2026-08-05
status: complete
---

# Phase 39 Plan 05: E2E Triage — Specs 15, 18-22 (32 findings) Summary

**Resolved all 32 Blocking-tier E2E findings across 10 spec files against real Playwright evidence, uncovering one critical product bug (void-order's network call always 404s) and one major access-control gap (/inventory has no role gate at all) — both filed as todos, not fixed inline — while fixing 20 stale-selector harness bugs and confirming 10 findings as genuinely still-valid skips or Phase-38-tied infra.**

## Performance

- **Duration:** ~2h (dominated by ~10 live `npx playwright test` runs across the batch, plus source-code investigation for the two access-control verdicts and the SM6 masking-race discovery)
- **Completed:** 2026-08-05
- **Tasks:** 3 (Task 1: void-order cluster; Task 2: remaining 25 findings triage; Task 3: harness fixes + todos + final verify — executed as one continuous investigation per finding, committed in 3 logical groups)
- **Files modified:** 7 spec files; 0 under `src/`

## Accomplishments

- Applied and critically re-verified a recovered prior attempt's in-progress diff (6 spec files) and 4 already-written todos against live runs in this worktree, rather than trusting either at face value.
- Settled 39-RESEARCH.md's Assumption A2 with real evidence: confirmed the core mechanism (most stale skips were selector/navigation/timing harness bugs, not missing features) but also confirmed it does NOT explain everything — `18-void-order.spec.ts` V2, the one test that drives void-order's actual happy path, un-skipped past its harness bug only to reveal a genuine, critical network-layer bug (`callVoidOrder` fetches a relative URL and 404s in every non-proxied environment; confirmed the edge function itself is live and reachable at the correct absolute URL).
- Delivered two explicit, source-verified written verdicts for the threat model's T-39-14 access-control findings: `/settings` (bartender) — gate holds, by design (Language tab open to every role, Phase 21 decision); `/inventory` (bartender) — gate does NOT hold at all (no route or page-level role check exists), a broader finding than the pre-existing quantity-control-only todo described.
- Caught a test that was silently masking a real regression: `22-staff-management.spec.ts` SM6 passed on first run despite a genuine, already-documented `view_all_shifts` enforcement gap — traced the false-pass to a one-shot `isVisible()` race against the current staff member's own role label (which resolves instantly, unrelated to the actual staff table's async load), fixed the race, and confirmed the test now correctly and reliably fails.
- Fixed 20 harness bugs across 7 spec files (stale selectors, wrong dialog roles, strict-mode collisions, native-HTML5-validation assumptions, cookie-vs-localStorage session clearing, Settings > Products navigation applied consistently across 4 sibling product-management tests).
- Filed 3 new todos (1 critical, 1 major, 1 minor) for confirmed real product bugs; left them unfixed per D-03/this plan's explicit prohibition.
- Zero `src/` files modified; `npm run typecheck && npm run lint` pass clean.

## Task Commits

1. **Task 1: resolve void-order stale-skip cluster (7 findings)** — `02197e6` (test)
2. **Tasks 2+3: triage and fix remaining 25 findings across 9 specs** — `6c6b486` (test)
3. **Task 3: final ledger + verify-gate results** — `8b9a204` (docs)

**Plan metadata:** SUMMARY commit is pending as part of this file's own commit (worktree mode — STATE.md/ROADMAP.md updates deferred to the orchestrator).

## Files Created/Modified

- `.planning/phases/39-ai-slob-technical-debt-remediation/39-05-LEDGER.md` - 32-row classification ledger, A2 verdict, both T-39-14 written verdicts, final per-spec run stats
- `.planning/phases/39-ai-slob-technical-debt-remediation/deferred-items.md` - 1 out-of-scope, pre-existing unit-test flake logged (not fixed)
- `.planning/todos/pending/2026-08-05-void-order-close-shift-generate-report-use-relative-fetch-url-always-404.md` - new, critical
- `.planning/todos/pending/2026-08-05-void-button-not-disabled-for-already-voided-orders.md` - new, minor
- `.planning/todos/pending/2026-08-05-inventory-page-has-no-role-gate-bartender-can-navigate-directly.md` - new, major
- 4 todos carried forward from the recovered prior attempt, reviewed and re-verified (not re-filed): inventory quantity RBAC, MoneyInput label association, seedNewStaffMember password mismatch, view_all_shifts never enforced
- `e2e/15-home-navigation.spec.ts`, `e2e/18-updater.spec.ts`, `e2e/18-void-order.spec.ts`, `e2e/19-caja-entries.spec.ts`, `e2e/20-error-scenarios.spec.ts`, `e2e/21-product-management.spec.ts`, `e2e/22-staff-management.spec.ts` - harness fixes, all test-side

## Decisions Made

- See `key-decisions` in frontmatter above (5 decisions with reasoning).
- `18-modifier-notes-kds.spec.ts` T3/T4 and `21-prep.spec.ts` T3 and `20-error-scenarios.spec.ts` ER8 and `22-staff-management.spec.ts` SM2 kept `valid-skip` only after actively re-verifying their stated constraints against current code/DB state (not the comment text alone) — `order_item_modifiers` table confirmed still absent via direct query; "add staff" UI confirmed absent via grep; RLS-at-DB-level and integration-test-coverage rationales are static architectural choices unrelated to any feature shipping.
- `20-error-scenarios.spec.ts` ER1 and `22-sprint3-billing.spec.ts` (both findings) reproduced the identical `pool_tables` PGRST205 schema-cache defect 39-02-LEDGER.md already confirmed — routed to Phase 38 rather than re-investigated as new infra.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Provisioned missing `node_modules`, `.env.local`, and `.audit-tmp` in this fresh worktree**
- **Found during:** Task setup, before any spec could run
- **Issue:** Same gitignored-artifact gap 39-02/39-03 already documented for fresh worktrees.
- **Fix:** Symlinked `node_modules` and `.audit-tmp` to the main checkout; copied `.env.local`. All excluded from git via pre-existing `.gitignore` rules — verified clean before and after each commit.
- **Files modified:** None tracked by git.
- **Committed in:** N/A

**2. [Rule 3 - Blocking] Locally overrode `playwright.config.ts` to headless for this run only**
- **Found during:** Task setup (explicit orchestrator instruction for this parallel-worktree run)
- **Issue:** The repo's default `headless: false`/`channel: 'chrome'` config pops a visible browser on the user's real desktop session.
- **Fix:** Changed all three `headless: false` occurrences to `true` locally; never staged or committed (confirmed clean before every commit in this plan).
- **Files modified:** `playwright.config.ts` (uncommitted, local only)
- **Committed in:** N/A (deliberately not committed)

### Rule 1/2 fixes applied during triage (test-side only, no src/ changes)

**3. [Rule 1 - Bug] `18-void-order.spec.ts` V2's vestigial pool-table gate removed**
- **Found during:** Task 1, re-running the void-order spec after the recovered diff's `seedTabWithOrder` fix
- **Issue:** A dead `pool_tables`-availability check (fetched row never read again) always failed under the live PGRST205 defect, masking a scenario this test never actually depended on.
- **Fix:** Removed the gate; documented why in an inline comment.
- **Files modified:** `e2e/18-void-order.spec.ts`
- **Commit:** `02197e6`

**4. [Rule 1 - Bug] `18-void-order.spec.ts` V4's dead-code-crash reordered**
- **Found during:** Task 1
- **Issue:** An unconditional `test.skip(...)` at the end of the test body made all preceding setup unreachable dead code, but a `getInventoryQty('Budweiser')` call before it threw first (pre-existing seed-data gap, unrelated to void), converting an intended no-op skip into a crash.
- **Fix:** Moved the skip to the top; removed the now-fully-dead setup.
- **Files modified:** `e2e/18-void-order.spec.ts`
- **Commit:** `02197e6`

**5. [Rule 1 - Bug] `21-product-management.spec.ts` PM6's stale `/inventory` navigation fixed**
- **Found during:** Task 2, after the recovered diff fixed PM2/PM3/PM5's identical navigation bug but not PM6's
- **Issue:** PM6 still pointed at `/inventory` (stock view, no product-editing affordances) instead of Settings > Products; its skip reason ("prior seed may have failed") was misleading — the real blocker was the wrong page.
- **Fix:** Applied the same self-seed + `navigateToProductsSettingsTab` pattern as PM5. This let the test correctly reach its own pre-existing, accurate skip guard (happy-hour price field confirmed genuinely removed from `ProductForm.tsx` per a Phase-D-01 architecture note).
- **Files modified:** `e2e/21-product-management.spec.ts`
- **Commit:** `6c6b486`

**6. [Rule 1 - Bug] `22-staff-management.spec.ts` SM6's masking race fixed**
- **Found during:** Task 2, investigating a suspiciously-passing access-control-adjacent test
- **Issue:** A one-shot `isVisible({timeout: 5_000})` check on the manager's name raced the staff table's real async data load, silently returning `false` (falsely reporting "gate holds") because the test's earlier, broader `getByText(/bartender|manager|admin/i)` assertion resolved almost instantly against unrelated top-nav text, not the table.
- **Fix:** Replaced with `waitFor({state: 'visible'})` (polls). Reproduced the real gap independently via a standalone Playwright script outside the E2E harness before applying the fix, to confirm the fix wasn't itself introducing a false failure.
- **Files modified:** `e2e/22-staff-management.spec.ts`
- **Commit:** `6c6b486`

**7. [Rule 1 - Bug] `15-home-navigation.spec.ts` T11 rewritten to match the real, intended gate**
- **Found during:** Task 2, investigating the first of two required T-39-14 access-control findings
- **Issue:** The original assertion (redirect to `/home` OR a blocking alertdialog) tested a model that predates a documented Phase 21 i18n decision — `/settings` is intentionally reachable by every role so the Language tab is self-service.
- **Fix:** Rewrote to assert the actual, correct gate: exactly 1 visible tab for bartender (locale-agnostic count check, since the default test staff locale renders "Idioma" not "Language").
- **Files modified:** `e2e/15-home-navigation.spec.ts`
- **Commit:** `6c6b486`

### Real regressions filed as todos, not fixed inline (D-03)

**8. [Rule 4-equivalent — filed, not fixed] `callVoidOrder` uses a relative fetch URL — always 404s**
- **Found during:** Task 1, V2's post-harness-fix run
- **Todo:** `.planning/todos/pending/2026-08-05-void-order-close-shift-generate-report-use-relative-fetch-url-always-404.md` (critical)

**9. [Rule 4-equivalent — filed, not fixed] Void button not disabled for an already-voided order**
- **Found during:** Task 1, V7
- **Todo:** `.planning/todos/pending/2026-08-05-void-button-not-disabled-for-already-voided-orders.md` (minor)

**10. [Rule 4-equivalent — filed, not fixed] `/inventory` has no role gate at all**
- **Found during:** Task 2, PM8
- **Todo:** `.planning/todos/pending/2026-08-05-inventory-page-has-no-role-gate-bartender-can-navigate-directly.md` (major)

---

**Total deviations:** 2 auto-fixed (Rule 3, tooling/environment only) + 5 Rule-1 test-side bug fixes + 3 real regressions filed as todos per D-03
**Impact on plan:** No scope creep — every fix stayed inside a spec file; every real product bug was filed, not fixed; zero `src/` changes throughout.

## Known Stubs

None — this plan produces no new UI/components, only test-side fixes and planning-doc artifacts.

## Issues Encountered

- A prior attempt at this plan was interrupted mid-way; its recovered diff and todos were applied and independently re-verified (not trusted at face value) per the parallel-execution instructions — one gap found (PM6's navigation wasn't part of the recovered diff and needed the same fix applied separately).
- `npm run test` (full unit suite) showed 1 order-dependent flaky failure in `src/entities/staff/model/queries.clock.test.ts`, unrelated to this plan (zero `src/` changes) and not reproducible in isolation — logged to `deferred-items.md`, not fixed (out of scope).
- A background consolidated 10-spec Playwright run was started for a final cross-check but was redundant with the already-complete per-spec evidence gathered individually; killed to avoid delaying completion rather than waited on.

## User Setup Required

None — no external service configuration required. `.env.local` used already existed in the project (copied from the main checkout, same credentials).

## Next Phase Readiness

- All 32 findings in this batch are fully dispositioned (fixed, routed to Phase 38, filed as a todo, or justified as a valid-skip) — no unexplained red test remains unmapped in the ledger.
- Plans 39-06/39-07 (sibling Track A plans in this wave) can reuse the same locale-agnostic-assertion and standalone-reproduction-before-trusting-a-passing-access-control-test patterns established here.
- Phase 38 should pick up: the `pool_tables` PGRST205 schema-cache defect (3 findings in this batch, same root cause as 39-02) is still live as of this session.
- 3 new todos + 4 carried-forward todos are ready for future prioritization/fix work outside this triage-only phase.

---
*Phase: 39-ai-slob-technical-debt-remediation*
*Completed: 2026-08-05*
