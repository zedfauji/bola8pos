---
phase: 39-ai-slob-technical-debt-remediation
plan: 11
subsystem: testing
tags: [knip, dead-code, shared-lib, features, e2e-helpers]

requires:
  - phase: 39-08
    provides: "post-decision knip baseline and this plan's exact working set (src/shared/ excl. domain.ts/edge-function-contracts.ts/shared/ui/**, src/features/, e2e/helpers/supabase.ts, all excl. barrels)"
provides:
  - "119 -> 35 distinct export/type findings in this plan's scope, with every retained finding's disposition recorded"
  - "18 files edited (0 deleted): 84 dead declarations removed (some fully deleted, some de-exported where still needed internally)"
  - "A newly-confirmed-dead CatalogCategoriesTab.tsx / CategoryForm.tsx pair, documented but deliberately not deleted (whole-file deletion out of this plan's scope)"
affects: []

actuals:
  tokens: 17730
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "De-export instead of delete: when a knip 'unused export' finding is still called internally within its own file (just never imported by another file), remove only the `export` keyword rather than deleting the declaration — resolves the finding without breaking the file's own internal callers."
    - "Declaration-merged type+const of the same name (type X = ...; const X = {...}) can hide one half from knip's usage tracking until the other half is de-exported — verify both halves independently after any such edit."

key-files:
  created:
    - ".planning/phases/39-ai-slob-technical-debt-remediation/39-11-LEDGER.md"
  modified:
    - "src/shared/lib/supabase-contracts.ts"
    - "src/shared/lib/test-utils.tsx"
    - "src/shared/lib/supabase.ts"
    - "src/shared/lib/mocks.ts"
    - "src/shared/lib/domain-helpers.ts"
    - "src/shared/config/constants.ts"
    - "src/shared/lib/logger.ts"
    - "src/shared/lib/logger-instance.ts"
    - "src/shared/lib/agent/tools/posTools.ts"
    - "src/shared/lib/agent/tools/menuTools.ts"
    - "src/shared/lib/uom.ts"
    - "src/shared/lib/version-error.ts"
    - "src/shared/lib/json-diff.ts"
    - "src/shared/lib/rappi-webhook-payload.ts"
    - "src/shared/lib/audit-actions.ts"
    - "src/features/upload-logo/model/useUploadLogo.ts"
    - "src/features/edit-paid-tab/model/useEditPaidTab.ts"
    - "src/features/process-refund/model/useProcessRefund.ts"
    - "src/features/physical-count/model/usePhysicalCount.ts"
    - "e2e/helpers/supabase.ts"

key-decisions:
  - "rbac.ts and result.ts (Task 1's string-keyed blind-spot files): all 15 flagged declarations retained. Zero were genuinely dead — every one is either test-only-consumed (invisible to knip's production-mode entry graph) or, in one case, transitively mis-flagged because its only real caller (close-tab/index.ts) is itself an already-adjudicated whole-file false positive."
  - "audit-actions.ts: de-exporting the dead AuditAction type alias surfaced its declaration-merged const object (export const AuditAction = {...}) as a newly-visible unused export on the very next knip run. Investigated and confirmed it too has zero real member-access usage anywhere — deleted both the type and the const; AuditActionSchema (the file's actual single source of truth) is untouched."
  - "CatalogCategoriesTab.tsx / CategoryForm.tsx: confirmed genuinely dead (e2e/21-product-management.spec.ts explicitly documents the pair as 'unused, unwired'), but this plan's must_haves prohibit whole-file deletion — CategoryForm.tsx's exports can't be safely deleted without also deleting CatalogCategoriesTab.tsx (its only importer) in the same commit. Documented in the ledger and deferred to a future plan rather than worked around."

patterns-established:
  - "De-export over delete for internally-still-used declarations — applied to roughly a third of this plan's findings (getTabOpenMinutes, SafeLogPayload/LogLevel/LogEntry, the agent-tools _execute* callbacks, VersionedEntity, DiffStatus, RappiWebhookBodySchema, LOGO_MAX_BYTES/LOGO_MAX_WIDTH, EditPaidTabPatchOp, RefundItemInput)."

requirements-completed: [D-01, D-07]

coverage:
  - id: D1
    description: "rbac.ts and result.ts dispositioned with the double-search (identifier + quoted-string) gate; zero deletions on knip evidence alone"
    requirement: "D-07"
    verification:
      - kind: other
        ref: "test -f 39-11-LEDGER.md && grep -q 'Task 1' 39-11-LEDGER.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "Remaining shared/features/e2e-helper sweep: 84 of 119 findings resolved (deleted or de-exported), 35 deliberately retained with recorded cause, no file deleted, no features/ UI markup changed"
    requirement: "D-07"
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run test"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shared/features delta measured and attributable: 119 -> 35 distinct export/type findings, reconciled against 39-08's published working-set baseline"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "npx knip --reporter json + --production --reporter json, scoped export/type count 119->35"
        status: pass
    human_judgment: false

duration: "~34 min"
completed: "2026-08-06"
status: complete
---

# Phase 39 Plan 11: Shared + Features Dead-Declaration Sweep Summary

**Removed 84 of 119 knip-flagged dead declarations across `src/shared/`, `src/features/`, and `e2e/helpers/supabase.ts` — 18 files edited, zero files deleted, zero RBAC action strings or `AppErrorCode` union members touched, with the remaining 35 retained findings individually justified in `39-11-LEDGER.md`.**

## Performance

- **Duration:** ~34 min
- **Tasks:** 3 (Task 1 rbac.ts/result.ts disposition, Task 2 full sweep, Task 3 delta re-measurement)
- **Files modified:** 20 (19 source files + 1 ledger doc created)

## Accomplishments

- Dispositioned `rbac.ts` and `result.ts` first, per this plan's string-keyed-blind-spot ordering: all 15 flagged declarations turned out to be test-only-consumed or transitively mis-flagged via an already-adjudicated false-positive file (`close-tab/index.ts`) — zero deletions, zero RBAC/AppErrorCode risk.
- Swept the remaining 104 findings across 26 files. Fully deleted 8 files' worth of genuinely dead declarations (`supabase-contracts.ts` 18 of 19 findings — the file's superseded "typed query result shapes" scaffolding, kept only the still-live `AppError`; `test-utils.tsx`'s 14 unused RTL pass-through re-exports; `supabase.ts`'s 12 dead `*Row` type aliases, all shadowed by local per-entity declarations; `constants.ts`'s 6 dead config constants; `logger-instance.ts`'s 2 fully-orphaned logger factories; `uom.ts`'s 2 dead type aliases shadowed by `domain.ts`'s own copies; `audit-actions.ts`'s dead type+const pair; `e2e/helpers/supabase.ts`'s orphaned kitchen-prep fixture seeder plus a stray dangling doc comment it left behind).
- Discovered and applied a recurring "de-export, don't delete" fix across ~10 files where a flagged declaration is still called internally within its own file (e.g. `generateMockStaff` called by `generateMockTab`, the agent-tools `_execute*` callbacks called by `createPendingAction`) but never imported by another file — removing just the `export` keyword resolves the knip finding without breaking the file's own internal logic.
- Caught a live side effect mid-sweep: de-exporting `audit-actions.ts`'s dead `AuditAction` type surfaced its declaration-merged `export const AuditAction = {...}` object as newly unused on the next knip run. Investigated, confirmed zero real usage of the named constants anywhere (every `record_audit()` call site hardcodes the string literal directly), and deleted both halves — `AuditActionSchema` itself untouched.
- Confirmed `src/features/manage-products/ui/CatalogCategoriesTab.tsx` and its sole dependency `CategoryForm.tsx` form a genuinely dead, unwired pair (`e2e/21-product-management.spec.ts:36` documents this explicitly) — but this plan's `must_haves` prohibit whole-file deletion, and removing `CategoryForm.tsx`'s exports alone would break `CatalogCategoriesTab.tsx`'s typecheck. Documented in the ledger and deliberately deferred rather than worked around.
- Re-measured the scope's knip findings: 119 → 35 distinct export/type findings (−84), with all 35 retained findings individually justified and reconciled by category in the ledger.
- `npm run typecheck && npm run lint && npm run test` all green after every edit batch — 1391/1391 tests passing, exact match to the 39-08-SUMMARY.md baseline. One transient failure on a single full-suite run (`queries.clock.test.ts`, unrelated to any file this plan touched) confirmed pre-existing/flaky via isolated re-run (6/6 passed alone) and a clean full-suite re-run.

## Task Commits

Each task was committed atomically (Task 1 produced no code diff — see Decisions Made):

1. **Task 1 + Task 2: Disposition string-keyed files, sweep the remaining shared/features/e2e-helper findings** — `6577758` (feat)
2. **Task 3: Record the ledger and re-measure the delta** — `53b32f1` (docs)

## Files Created/Modified

- `.planning/phases/39-ai-slob-technical-debt-remediation/39-11-LEDGER.md` — one disposition row per finding, with search command(s), hit count(s), and outcome; the full before/after delta
- `src/shared/lib/supabase-contracts.ts` — removed 18 dead declarations, kept the live `AppError` type
- `src/shared/lib/test-utils.tsx` — removed unused RTL re-export block and `render` alias
- `src/shared/lib/supabase.ts` — removed 12 dead `*Row` type aliases
- `src/shared/lib/mocks.ts` — deleted 5 fully-dead `generateMock*` factories, de-exported 4 still-internal ones
- `src/shared/lib/domain-helpers.ts` — de-exported `getTabOpenMinutes` (used internally by `getTabDurationTier`/`formatTimeOpen`, both live)
- `src/shared/config/constants.ts` — removed 6 dead constants, kept `TERMINAL_ID`
- `src/shared/lib/logger.ts` — de-exported `SafeLogPayload`/`LogLevel`/`LogEntry`, kept test-consumed `sanitizePayload`/`redactString`
- `src/shared/lib/logger-instance.ts` — removed 2 fully-dead logger factories
- `src/shared/lib/agent/tools/posTools.ts`, `menuTools.ts` — de-exported internal `_execute*` callbacks
- `src/shared/lib/uom.ts` — removed 2 dead type aliases
- `src/shared/lib/version-error.ts`, `json-diff.ts`, `rappi-webhook-payload.ts` — de-exported internally-used-only declarations
- `src/shared/lib/audit-actions.ts` — removed dead `AuditAction` type + declaration-merged const object
- `src/features/upload-logo/model/useUploadLogo.ts`, `edit-paid-tab/model/useEditPaidTab.ts`, `process-refund/model/useProcessRefund.ts` — de-exported internally-used-only declarations
- `src/features/physical-count/model/usePhysicalCount.ts` — deleted fully-dead `PhysicalCountEntry` type
- `e2e/helpers/supabase.ts` — removed orphaned kitchen-prep fixture seeder and a stray dangling doc comment

## Decisions Made

- Task 1 produced zero code changes: after full double-search investigation, every one of `rbac.ts`'s and `result.ts`'s 15 flagged declarations proved to be legitimately used (test-only or transitively via an already-adjudicated false positive), so both files were committed as part of Task 2's single sweep commit rather than getting their own empty commit.
- Where a flagged declaration is still called internally within its own file but never imported elsewhere, removed only the `export` keyword instead of deleting the code — the correct minimal fix that resolves the knip finding without risking a broken internal caller. Applied this to roughly a third of the resolved findings; documented per-file in the ledger.
- `CatalogCategoriesTab.tsx`/`CategoryForm.tsx`: confirmed dead but deliberately not deleted — this plan's `must_haves` explicitly prohibit whole-file deletion, and removing `CategoryForm.tsx`'s exports alone would break `CatalogCategoriesTab.tsx`'s typecheck. The safe fix requires deleting both files together in one commit, which is out of this plan's scope; deferred to a future plan.
- `audit-actions.ts`'s dead `AuditAction` type and its declaration-merged const object were both removed together in one edit, once the const's own dead status was independently confirmed (see Issues Encountered) — treating them as one unit avoided a half-finished, still-broken disposition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — corrected a stale worked-example assumption] `domain-helpers.ts`'s `getTabOpenMinutes` needed de-export, not deletion**

- **Found during:** Task 2
- **Issue:** 39-PATTERNS.md's own worked example for this exact function describes "the fix is deleting just that function" — but `getTabOpenMinutes` is called internally by `getTabDurationTier` and `formatTimeOpen`, both of which are genuinely production-consumed (`TabCard.tsx`, `TabDetail.tsx`, `TimerDisplay.tsx`). The pattern doc's description predates a since-added internal caller.
- **Fix:** De-exported (removed the `export` keyword) instead of deleting, preserving the two live callers.
- **Files affected:** `src/shared/lib/domain-helpers.ts`
- **Verification:** `npm run typecheck` clean; `TabCard.test.tsx`, `TabDetail.tsx`'s consumers unaffected.
- **Committed in:** `6577758`

**2. [Rule 1 — investigated and fixed a side effect of a prior fix] `audit-actions.ts`'s declaration-merged const surfaced as newly dead**

- **Found during:** Task 2
- **Issue:** De-exporting the dead `AuditAction` type alias (the mechanical fix for the one flagged finding) caused its declaration-merged `export const AuditAction = {...}` object — previously invisible to knip due to the merge — to appear as its own newly-unused export on the very next run.
- **Fix:** Searched for `AuditAction.`-style member-access usage across `src/` and `supabase/`; confirmed zero real hits (every `record_audit()` call site hardcodes the string literal). Deleted both the type alias and the const object together; `AuditActionSchema`, the file's actual single source of truth, was left untouched.
- **Files affected:** `src/shared/lib/audit-actions.ts`
- **Verification:** `npm run typecheck && npm run lint && npm run test` all pass; re-ran knip to confirm no further cascade.
- **Committed in:** `6577758`

**3. [Rule 1 — removed a dangling doc comment left behind by a deletion] `e2e/helpers/supabase.ts`'s stray JSDoc comment**

- **Found during:** Task 2
- **Issue:** A JSDoc comment ("Delete a staff member from profiles and Supabase Auth by name.") was stranded directly above the dead `seedE2ePrepKitchenFixture` block being removed — it actually documents `deleteTestStaff`, defined ~120 lines further down with no doc comment of its own. Left in place, it would have become an even more confusing orphaned comment floating above unrelated code after the deletion.
- **Fix:** Removed the stray comment along with the dead code block it was mistakenly attached to.
- **Files affected:** `e2e/helpers/supabase.ts`
- **Verification:** `deleteTestStaff` remains fully functional and correctly named/exported; no doc-comment regression introduced (it had none before either — out of scope to add one).
- **Committed in:** `6577758`

---

**Total deviations:** 3 auto-fixed (all Rule 1 — correctness fixes discovered while executing the plan's own instructions, not scope changes). **Impact on plan:** All three were necessary to reach a correct, self-consistent disposition for the findings the plan named; none introduced new scope beyond what Task 2 already required.

## Issues Encountered

None beyond the three auto-fixed deviations above. `npm run typecheck && npm run lint && npm run test` passed cleanly after every edit batch, with one transient full-suite test failure (`queries.clock.test.ts`) confirmed pre-existing/flaky and unrelated to this plan's changes (passed in isolation, and on a clean full-suite re-run).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `39-11-LEDGER.md` records the exact 35 retained findings with cause, so a future audit pass can start from a settled baseline rather than re-litigating already-decided dispositions.
- `CatalogCategoriesTab.tsx`/`CategoryForm.tsx` are a confirmed-dead pair ready for deletion together in a future plan that has whole-file deletion in scope — no further investigation needed, just execution.
- No blockers for downstream work. This plan runs in wave 4 alongside 39-09 (domain.ts/edge-function-contracts.ts) and 39-10 (entities/) in separate worktrees — this plan touched none of their files (confirmed by the `src/shared/lib/domain.ts`/`edge-function-contracts.ts` exclusions and the barrel-file exclusions honoring 39-08's ownership split).

## Self-Check

- FOUND: `.planning/phases/39-ai-slob-technical-debt-remediation/39-11-LEDGER.md`
- FOUND: `.planning/phases/39-ai-slob-technical-debt-remediation/39-11-SUMMARY.md`
- FOUND: commit `6577758` (Task 1 + Task 2 code changes)
- FOUND: commit `53b32f1` (Task 3 ledger + delta)
- CONFIRMED: `git diff --diff-filter=D --name-only 9f0ade1 HEAD` — empty, zero files deleted (matches must_haves)

## Self-Check: PASSED

---
*Phase: 39-ai-slob-technical-debt-remediation*
*Completed: 2026-08-06*
