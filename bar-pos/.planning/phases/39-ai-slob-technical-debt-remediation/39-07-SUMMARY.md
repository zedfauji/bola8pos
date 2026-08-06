---
phase: 39-ai-slob-technical-debt-remediation
plan: 07
subsystem: testing
tags: [playwright, e2e, triage, i18n, supabase, rls, promotions, recipes, inventory]

requires:
  - phase: 39-ai-slob-technical-debt-remediation
    provides: plan 39-02's D-04 triage method and ledger row format, reused verbatim here
provides:
  - Classified disposition (infra/harness/obsolete/flaky/real-regression/valid-skip/conditional) for all 22 remaining E2E findings across specs 27, 30, 31, 36, 37, 38, 43, 44
  - 5 spec files with harness-side fixes landing 15 previously-red tests as green, with zero src/ changes
  - 3 real product regressions discovered and filed as todos, each backed by live console/DB evidence
affects: [39-08 (or whichever plan closes out Phase 39), Phase 38 (E2E infra — inherits 4 new infra-routed findings)]

actuals:
  tokens: 16800
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Scope a Playwright role=dialog locator by a stable non-i18n attribute (aria-modal) instead of by aria-label, when a permanently-mounted sibling element (AgentPanel) also claims the same ARIA role"
    - "Verify server-applied pricing/discount behavior via a direct DB query on the mutation's own table, not via UI text — when the UI never renders the value being asserted"

key-files:
  created:
    - .planning/phases/39-ai-slob-technical-debt-remediation/39-07-LEDGER.md
    - .planning/todos/pending/2026-08-04-promotion-creation-fails-db-check-constraint.md
    - .planning/todos/pending/2026-08-04-inventory-column-headers-render-raw-i18n-keys.md
    - .planning/todos/pending/2026-08-04-recipe-save-fails-on-conflict-constraint-mismatch.md
  modified:
    - e2e/30-help-manual.spec.ts
    - e2e/31-categories.spec.ts
    - e2e/36-recipes.spec.ts
    - e2e/38-audit-logs.spec.ts
    - e2e/43-promotions.spec.ts

key-decisions:
  - "31-categories.spec.ts T8 rewritten (not deleted) to assert Phase 21's actual per-tab RBAC contract (bartender sees only the Language tab) instead of the stale full-page-redirect assertion it replaced — the access-control property it protects still holds, just via a different, documented mechanism"
  - "31-categories.spec.ts T6 removed with written justification: combo_eligible was only ever added to products, never to categories — the test asserted a schema shape that never existed, not a regression"
  - "37-analytics-reports.spec.ts T2 classified flaky and left unmodified — two consecutive fresh live runs both passed, so the original stale-JSON failure was not reproducible"
  - "43-promotions.spec.ts T2's price assertion rewritten to query order_items directly instead of searching page text, because the 'Order history' panel it originally searched never renders per-item prices at all (not a regression — it never did)"

patterns-established:
  - "Multi-layer findings: fixing one root cause can expose a second, independent bug one step further into the same test flow (31-categories T3/T4's expand-ordering bugs, 36-recipes' recipe-save constraint bug). Each layer got its own evidence and its own disposition rather than being folded into the first cause found."

requirements-completed: [D-03, D-04, D-06]

coverage:
  - id: D1
    description: "All 22 E2E findings across specs 27-44 carry a written classification backed by real Playwright error output or the literal skip-reason string"
    requirement: D-04
    verification:
      - kind: e2e
        ref: "39-07-LEDGER.md — 22 ledger rows, each citing live playwright run output or a direct DB query"
        status: pass
    human_judgment: false
  - id: D2
    description: "31-categories.spec.ts's 6 failures + 1 skip reduced to explicit root-cause groups with a stated group count"
    requirement: D-06
    verification:
      - kind: e2e
        ref: "39-07-LEDGER.md Group 1 writeup + Root-cause group summary section"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real product bugs discovered while triaging are filed as todos, not fixed inline"
    requirement: D-03
    verification:
      - kind: other
        ref: ".planning/todos/pending/2026-08-04-{promotion-creation,inventory-column-headers,recipe-save}-*.md — 3 todos filed, zero src/ files touched (git diff --name-only -- src/ is empty)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both 44-focus-tab-order.spec.ts findings carry an explicit contract-holds-or-not verdict"
    verification:
      - kind: e2e
        ref: "39-07-LEDGER.md rows for 44-focus-tab-order.spec.ts:81 (A) and :144 (B)"
        status: pass
    human_judgment: false

duration: 3h10m
completed: 2026-08-05
status: complete
---

# Phase 39 Plan 07: E2E Triage Tail Batch (specs 27-44) Summary

**Classified all 22 remaining E2E findings across 8 spec files, fixed 5 files' worth of test-side harness bugs (15 tests turned green), and discovered + filed 3 previously-unknown real product regressions (promotion creation, inventory column i18n, recipe saving) — all confirmed with live browser console captures and direct DB queries, none fixed inline per D-03.**

## Performance

- **Duration:** ~3h 10m
- **Tasks:** 3 (triage 31-categories + 44-focus-tab-order; triage remaining 6 specs; apply harness fixes + file todos)
- **Files modified:** 9 (1 ledger, 5 spec files, 3 new todo files)

## Accomplishments

- Wrote `39-07-LEDGER.md`: 22 rows, each backed by real per-test error output (live `npx playwright test` runs against the remote Supabase project, or direct DB queries), not title-only digest matching (D-04).
- Confirmed and fixed the `31-categories.spec.ts` T2-T5 chain's real root cause: a permanently-mounted `AgentPanel` component (`role="dialog"`, `aria-modal="false"`) collides with a bare `page.getByRole('dialog')` locator once the real Radix category dialog closes. One locator-scoping fix resolved 4 findings.
- Discovered and fixed two additional collapsed-tree "expand before assert" ordering bugs in T3/T4 that were masked by the AgentPanel collision until it was fixed — the category tree collapses newly-created children by default and two tests checked visibility before expanding.
- Investigated and correctly distinguished two access-control findings that looked identical to a regression from the title alone: `38-audit-logs.spec.ts`'s bartender-redirect gate is confirmed still enforced (a duplicate-rendered toast broke only the assertion, not the gate); `31-categories.spec.ts`'s bartender-Settings test was asserting a route-level redirect that Phase 21 deliberately replaced with per-tab RBAC gating for self-service language switching — rewritten to assert the current, correct contract.
- Root-caused and classified `27-inventory-intelligence.spec.ts`'s 3 findings and `44-focus-tab-order.spec.ts`'s finding A to the same seed-data gap already routed to Phase 38 by 39-02-LEDGER.md (93 of 95 products have no `inventory` row in the shared remote test DB).
- Discovered 3 real, currently-live product regressions while triaging, each confirmed via live browser console error capture (not assumed from a title): promotion creation always fails a DB check constraint; inventory column headers render raw i18n keys because a widget passes the wrong translation namespace into a shared column-builder; recipe saving always fails an `ON CONFLICT` mismatch left behind by a later migration that changed the target constraint to a partial index. All three filed as todos per D-03 — zero `src/` files touched.
- Confirmed via live DOM evidence that `44-focus-tab-order.spec.ts` finding B's underlying Tab-order/focus contract (Phase 32, FOCUS-03) is fully intact — the failure is the i18n bug above, not an accessibility regression — satisfying the plan's explicit requirement for a contract-holds verdict.

## Task Commits

1. **Task 1 & 2: Triage 22 findings into a classified ledger** - `a84bdf3` (docs)
2. **Task 3: Apply harness fixes, file 3 real-regression todos, verify final spec state** - `ef78a0d` (fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two collapsed-tree "expand before assert" ordering bugs in 31-categories.spec.ts T3/T4**
- **Found during:** Task 3, after fixing the AgentPanel dialog-locator collision let T3/T4 run further than before
- **Issue:** T3 and T4 checked `getByText('Regular')`/`getByText('Corona')` for visibility *before* clicking the tree's "Expand" button, even though the category tree collapses newly-created children by default (T5, building the identical tree shape, already handled this correctly)
- **Fix:** Reordered both tests to expand before asserting, matching T5's existing pattern
- **Files modified:** e2e/31-categories.spec.ts
- **Commit:** ef78a0d

**2. [Rule 1 - Bug] Stale "select the tab" step in 36-recipes.spec.ts's INVENTORY_NEGATIVE test**
- **Found during:** Task 3, after fixing the toast/heading locator ambiguity let this test run further
- **Issue:** The test tried to click a button to "select" a just-opened tab, but a newly-opened tab is already the active tab (no such button exists) — the step always timed out
- **Fix:** Removed the redundant step
- **Files modified:** e2e/36-recipes.spec.ts
- **Commit:** ef78a0d

### Not Auto-fixed (Rule 4 exception — real product bugs, D-03)

Three real, currently-live product regressions were discovered while triaging and fixing harness
issues. Per D-03, none were fixed inline — all three are filed as todos with live evidence:

- `.planning/todos/pending/2026-08-04-promotion-creation-fails-db-check-constraint.md` — every
  "+ Add promotion" click fails a DB check constraint; promotion creation is completely broken.
- `.planning/todos/pending/2026-08-04-inventory-column-headers-render-raw-i18n-keys.md` — every
  inventory table column header renders its raw i18n key instead of a translated label.
- `.planning/todos/pending/2026-08-04-recipe-save-fails-on-conflict-constraint-mismatch.md` —
  saving a product-owned recipe always fails; a later migration replaced the plain unique
  constraint the save mutation's `ON CONFLICT` clause depends on with a partial index.

## Known Stubs

None — this plan touched only test files and planning docs; no application UI/data stubs were
introduced or left behind.

## Environment Setup Note (methodology transparency)

This worktree started with no `node_modules`, no `.env.local`, and no `.audit-tmp/e2e-per-spec/`
(all gitignored, worktree-local artifacts, consistent with the gap already documented in
39-02-LEDGER.md/39-03-SUMMARY.md). Provisioned: `node_modules` symlinked to the main checkout's
`node_modules`; `.env.local` copied from the main checkout; the 8 relevant per-spec JSON files
copied from the main checkout's `.audit-tmp/e2e-per-spec/` as a read-only input. The dev server
(`npm run dev`) was started fresh in this worktree on port 1420 after an earlier one exited
between commands. None of this is a scope violation — zero `src/` changes resulted from setup,
and every copied/symlinked path is already excluded by `.gitignore`.

## Self-Check: PASSED

- `.planning/phases/39-ai-slob-technical-debt-remediation/39-07-LEDGER.md` — FOUND
- `.planning/todos/pending/2026-08-04-promotion-creation-fails-db-check-constraint.md` — FOUND
- `.planning/todos/pending/2026-08-04-inventory-column-headers-render-raw-i18n-keys.md` — FOUND
- `.planning/todos/pending/2026-08-04-recipe-save-fails-on-conflict-constraint-mismatch.md` — FOUND
- Commit `a84bdf3` — FOUND in `git log --oneline`
- Commit `ef78a0d` — FOUND in `git log --oneline`
