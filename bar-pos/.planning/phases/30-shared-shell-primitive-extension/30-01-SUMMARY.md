---
phase: 30-shared-shell-primitive-extension
plan: 01
subsystem: ui
tags: [react, shared-ui, page-container, navigation, tdd]

# Dependency graph
requires: []
provides:
  - "PageContainer.backTo / PageContainer.backLabel optional props"
  - "SectionHeader.backTo / SectionHeader.backLabel optional props (inline ghost back-Link)"
  - "PageContainer.test.tsx regression suite locking the 3 back-link behavioral cases"
affects: [30-02, 30-03, 30-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "exactOptionalPropertyTypes-safe conditional-spread prop forwarding ({...(backTo && { backTo })}) extended to a second prop pair"

key-files:
  created:
    - src/shared/ui/PageContainer.test.tsx
  modified:
    - src/shared/ui/PageContainer.tsx
    - src/shared/ui/SectionHeader.tsx

key-decisions:
  - "Back-link markup absorbed BackToHomeButton's exact ChevronLeft + ghost Button asChild + Link composition, tuned to h-6 px-2 text-xs / -ml-2.5 / h-3.5 w-3.5 per 30-UI-SPEC.md so it aligns inline above the h2 title instead of living in its own standalone strip"
  - "backLabel defaults via `backLabel ?? 'Home'` inside SectionHeader — preserves the literal 'Home' accessible name that PaymentsPage.test.tsx, ReportsPage.test.tsx, and multiple E2E specs/e2e/helpers/auth.ts's logout() depend on"

requirements-completed: [SHELL-01]

# Metrics
duration: ~10min
completed: 2026-07-10
---

# Phase 30 Plan 01: Shared Shell Primitive Extension Summary

**PageContainer/SectionHeader gain optional backTo/backLabel props rendering an inline ghost back-Link (ChevronLeft + label) above the title, replacing the standalone BackToHomeButton pattern — foundation for 30-02/30-03/30-04's 15-page migration.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-10T20:07:34Z
- **Completed:** 2026-07-10T20:10:29Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `PageContainer`/`SectionHeader` extended with `backTo?`/`backLabel?` following the plan's TDD gate (RED → GREEN)
- New `PageContainer.test.tsx` locks the 3 behavioral cases (no backTo / backTo default Home / backTo+custom backLabel) that all downstream migration plans (30-02, 30-03, 30-04) depend on staying stable
- Zero behavior change for the 8 pages already on `PageContainer` without `backTo` — verified by the "no backTo" test case and full unit suite

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 — create PageContainer.test.tsx (RED)** - `84a2e26` (test)
2. **Task 2: Extend SectionHeader + PageContainer with backTo/backLabel (GREEN)** - `38347b2` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified
- `src/shared/ui/PageContainer.test.tsx` - 3 RTL cases (MemoryRouter-wrapped) covering backTo/backLabel behavior
- `src/shared/ui/PageContainer.tsx` - `backTo?: string` / `backLabel?: string` added to `PageContainerProps`, forwarded to `SectionHeader` via conditional spread
- `src/shared/ui/SectionHeader.tsx` - `backTo?`/`backLabel?` added to `SectionHeaderProps`; renders a `ghost` `Button asChild` + `Link` + `ChevronLeft` block as the first child of the existing `space-y-1` column, only when `backTo` is truthy

## Decisions Made
- Followed 30-UI-SPEC.md's pinned markup/classes exactly (`-ml-2.5 h-6 px-2 text-xs`, `h-3.5 w-3.5`) — no new visual judgment calls required
- No production behavior touched beyond the two new optional props; all 8 existing `PageContainer` callers remain unaffected since none currently pass `backTo`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `PageContainer`/`SectionHeader` contract is stable and test-locked; 30-02 (7 Pattern-B pages), 30-03 (5 Pattern-A pages), and 30-04 (3 special-case pages incl. `pos`/`payments` className override and `pool-table-status`'s `/pool-tables` backTo target) can now consume `backTo`/`backLabel` directly.
- No blockers. `BackToHomeButton.tsx` itself is untouched by this plan (its deletion + the 14-caller migration is scoped to 30-02/30-03/30-04 per the phase's wave plan) — it still exists and still works standalone; this plan only adds the new capability alongside it.

---
*Phase: 30-shared-shell-primitive-extension*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: src/shared/ui/PageContainer.test.tsx
- FOUND: src/shared/ui/PageContainer.tsx
- FOUND: src/shared/ui/SectionHeader.tsx
- FOUND: 84a2e26 (test commit, `git log --oneline` on current branch)
- FOUND: 38347b2 (feat commit, `git log --oneline` on current branch)
