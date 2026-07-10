---
phase: 29-ui-drift-audit
plan: 01
subsystem: ui
tags: [tooling, static-analysis, tailwind, react-router, drift-audit]

# Dependency graph
requires: []
provides:
  - "scripts/audit-ui-drift.ts — reusable Node/tsx drift scanner (raw button/input, hex/rgb color, arbitrary-spacing, route cross-check)"
  - ".planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md — file-mapped violation backlog for Phases 30-33"
affects: [30-shared-shell-primitive-extension, 31-component-token-spacing-sweep, 32-touch-target-focus-visible-sweep, 33-payment-critical-page-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Filtered fs.readdirSync(recursive) walk (excludes .test./.stories./shared/ui) as the shared file list feeding all violation-category regex scans"
    - "Route-count cross-check computed dynamically from router.tsx and CLAUDE.md at run time — no hardcoded literals, so the audit stays truthful as the repo drifts"

key-files:
  created: [scripts/audit-ui-drift.ts, .planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md]
  modified: []

key-decisions:
  - "DRIFT-AUDIT.md force-added (git add -f) despite bar-pos/.gitignore's blanket .planning/ + *.md rules — this is an explicit plan deliverable (D-03) other phases read as their backlog, not project scratch"
  - "Dirent.parentPath used directly (no entry.path fallback) — @types/node 25.6.0 declares parentPath as a required non-optional string, so the research doc's defensive fallback isn't needed under this repo's installed types"

patterns-established:
  - "scripts/*.ts convention followed: plain console.log/console.error, no logger import, Node builtin fs/path only, run via npx tsx"

requirements-completed: [AUDIT-01, AUDIT-02]

# Metrics
duration: ~15min
completed: 2026-07-10
---

# Phase 29 Plan 01: UI Drift Audit Summary

**Filtered fs-walk + regex drift scanner (scripts/audit-ui-drift.ts) producing a file-grouped DRIFT-AUDIT.md backlog: 20 raw-button / 8 raw-input / 3 hardcoded-color / 0 arbitrary-spacing files, plus a dynamically-computed route cross-check (17 real routes vs 14 CLAUDE.md rows, 3 missing: /kds, /kitchen-prep, /audit).**

## Performance

- **Duration:** ~15 min (includes `npm ci` to populate worktree node_modules, ~1 min)
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both new)

## Accomplishments
- `scripts/audit-ui-drift.ts` — standalone, dependency-free Node/tsx scanner with module-local `collectFiles`/`scanCategory`/`crossCheckRoutes`/`renderMarkdown`/`main` functions, never imported by `src/`
- Reproduced the exact verified baseline from RESEARCH.md on first run, with no hand-tuning: 20/8/3/0 category counts, 17 vs 14 route diff
- `DRIFT-AUDIT.md` committed as a file-grouped Markdown checklist (line-attributed) — the backlog Phases 30-33 scope their standardization work from

## Task Commits

Each task was committed atomically:

1. **Task 1: Write scripts/audit-ui-drift.ts** - `6227dbb` (feat)
2. **Task 2: Generate, verify, and commit DRIFT-AUDIT.md backlog** - `85365d9` (chore)

## Files Created/Modified
- `scripts/audit-ui-drift.ts` - Filtered fs walk (pages/widgets/features, excludes `.test.`/`.stories.`/`shared/ui`) + 4 category regex scans + dynamic router.tsx-vs-CLAUDE.md route cross-check + Markdown writer
- `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md` - Generated (not hand-written) violation backlog, regenerated at the end of execution to confirm `git status` reports zero diff (idempotent output)

## Decisions Made
- Used `entry.parentPath` directly with no `entry.path` fallback (research flagged this as Assumption A1 needing verification at execution time) — confirmed `@types/node@25.6.0`'s `Dirent.parentPath` is a required `string`, not optional, so the fallback the research suggested for robustness isn't needed for this repo's toolchain. No behavior difference; simpler code.
- Route paths for the cross-check are extracted via `<Route\s+path="([^"]+)"` and CLAUDE.md rows via `^\| \`([^\`]+)\``, then diffed with `.filter()` — this both counts and names the missing routes (`/kds`, `/kitchen-prep`, `/audit`) as required by the plan's acceptance criteria ("plus the list of routes missing from CLAUDE.md").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree had no `node_modules` — ran `npm ci`**
- **Found during:** Task 1, before first `npm run typecheck` attempt
- **Issue:** This git worktree was created without dependencies installed; `tsc`/`tsx` were unavailable.
- **Fix:** Ran `npm ci --prefer-offline --no-audit --no-fund` (existing `package-lock.json`, zero new/changed dependencies — not a package-manager-install-of-a-new-package situation excluded by Rule 3, purely restoring the locked dependency tree).
- **Files modified:** none tracked (node_modules is gitignored)
- **Verification:** `npm run typecheck` and `npx tsx scripts/audit-ui-drift.ts` both ran successfully afterward.
- **Committed in:** N/A (no file changes to commit)

**2. [Rule 3 - Blocking] `.planning/` + `*.md` gitignore rules blocked the plan's mandated committed artifact**
- **Found during:** Task 2, staging `DRIFT-AUDIT.md`
- **Issue:** `bar-pos/.gitignore` has blanket `.planning/` and `*.md` (with only a `!CLAUDE.md` exception) rules. The plan's own D-03 decision and acceptance criteria explicitly require `DRIFT-AUDIT.md` to be committed at this exact path with `git status` clean afterward — a hard requirement this plan's own Task 2 acceptance criteria states, in direct conflict with the repo-wide ignore rule.
- **Fix:** `git add -f .planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md` for this one plan-mandated deliverable file only. Did not edit `.gitignore` itself (a repo-wide ignore-pattern change is out of this plan's scope and would need Rule 4 architectural sign-off) — scoping the fix to a single explicit force-add keeps the change minimal and reversible.
- **Files modified:** `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md` (force-added, not `.gitignore`)
- **Verification:** `git status --short` is clean for this path after commit; `git ls-files | grep DRIFT-AUDIT` confirms it's tracked.
- **Committed in:** `85365d9` (Task 2 commit)

**3. [Rule 3 - Blocking] Worktree branch had no `.planning/phases/29-ui-drift-audit/` at all**
- **Found during:** Setup, before Task 1
- **Issue:** Because `.planning/` is gitignored repo-wide, `29-01-PLAN.md`/`29-CONTEXT.md`/`29-RESEARCH.md`/`29-VALIDATION.md` were never committed to the branch this worktree was created from — they exist only as untracked files in the main working copy the orchestrator planned from.
- **Fix:** Copied the four phase-29 planning docs from the main repo's disk path into the worktree's `.planning/phases/29-ui-drift-audit/` (read-only reference copies, not re-committed — they remain untracked/gitignored in the worktree exactly as in the main repo, consistent with existing project state).
- **Files modified:** none tracked
- **Verification:** Script's own `fs.writeFileSync` target path resolved correctly relative to the worktree's `bar-pos/` cwd; `DRIFT-AUDIT.md` generated in the expected location.
- **Committed in:** N/A (reference copies only, not part of the deliverable)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking, all required to execute the plan as written in a git-worktree context)
**Impact on plan:** No scope creep — no `src/` code touched, no new dependencies, no plan behavior changed. All three fixes were environment/tooling prerequisites for producing the exact artifact the plan specifies.

## Issues Encountered
None beyond the deviations documented above.

## Next Phase Readiness
- `DRIFT-AUDIT.md` is the ready-to-consume backlog for Phase 30 (Shared Shell & Primitive Extension) and Phases 31-33 — file-grouped, line-attributed, forward-slash paths.
- The CLAUDE.md routes table is confirmed stale (missing `/kds`, `/kitchen-prep`, `/audit`) — Phase 30's SHELL-03 work item has hard evidence to act on rather than an assertion.
- No blockers. This was a read-only audit; no `src/` files were modified.

---
*Phase: 29-ui-drift-audit*
*Completed: 2026-07-10*
