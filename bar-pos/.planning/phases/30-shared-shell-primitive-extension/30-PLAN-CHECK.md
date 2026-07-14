# Phase 30 Plan Check — Shared Shell & Primitive Extension

**Verified:** 2026-07-10
**Result:** PASS

## Route Coverage (SHELL-01)

Cross-checked `src/app/router.tsx` (17 real routes, excluding the `/` → `/home` redirect) against the 5 plans:

| Group | Routes | Plan |
|---|---|---|
| Foundation (no page touched) | — | 30-01 (PageContainer/SectionHeader backTo/backLabel props + Wave-0 test) |
| Pattern B (already on PageContainer) | kds, kds-bar, kitchen-prep, pool-tables, rappi, rbac, waitlist (7) | 30-02 |
| Pattern A (first-time adoption) | audit, settings, staff, inventory, reports (5) | 30-03 |
| Special-case (full-bleed / non-default backTo) | pos, payments, pool-table-status (3) | 30-04 |
| Exempt (D-02, explicitly out of scope) | home, login (2) | — |

7 + 5 + 3 + 2 = 17. All 17 real routes accounted for exactly once; no route double-covered, none dropped.

## Requirement Coverage

- SHELL-01 → `requirements:` frontmatter present in 30-01, 30-02, 30-03, 30-04, 30-05.
- SHELL-02 → 30-05 (delete AppShell.tsx, AppNav/ folder, barrel exports; verified zero real consumers already confirmed in RESEARCH.md via grep).
- SHELL-03 → 30-05 Task 2 (routes table +3 rows, verify command `grep -c "^| \`/" CLAUDE.md` == 17).

All 3 requirement IDs from ROADMAP.md/REQUIREMENTS.md appear in at least one plan's `requirements` field. No orphaned requirement.

## Dependency Graph

- 30-01: `depends_on: []` — Wave 1
- 30-02/03/04: `depends_on: ["30-01"]` — Wave 2 (parallel, no cross-deps between them)
- 30-05: `depends_on: ["30-02","30-03","30-04"]` — Wave 3

Acyclic, correctly sequences PageContainer extension (30-01) before all consumers, and dead-code deletion (30-05) after all 15 callers are migrated off `BackToHomeButton`. Wave numbers match `depends_on` (max(deps)+1).

## "Home" Accessible-Name Contract (E2E teardown dependency)

RESEARCH.md Pitfall 1 identifies `e2e/helpers/auth.ts`'s `logout()` + `PaymentsPage.test.tsx` + `ReportsPage.test.tsx` + `15-home-navigation.spec.ts` + `17-payment-pane.spec.ts` as hard dependents on the literal text "Home" + `href="/home"`.

- 30-01 Task 2 pins `{backLabel ?? 'Home'}` as the default — locked, not left to per-task judgment.
- 30-02/03/04 all pass `backTo="/home"` with no `backLabel` override (default 'Home' applies) for the 14 pages whose original target was `/home`.
- 30-04 Task 2 (pool-table-status) is the sole deliberate exception — `backTo="/pool-tables"` + `backLabel="Pool Tables"` — explicitly flagged in RESEARCH.md Pitfall 3 as the pre-existing correct behavior, and 30-04's own acceptance criteria assert `/home` must NOT appear as this page's backTo value, guarding against copy-paste regression from the other 14.
- 30-05 Task 3 (phase gate) re-runs `PaymentsPage.test.tsx` + `ReportsPage.test.tsx` + targeted E2E specs as a final check.

Contract preserved across all migrated pages with a documented, plan-enforced exception.

## CLAUDE.md Routes Table (SHELL-03)

30-05 Task 2 explicitly lists all 17 router.tsx paths in its acceptance criteria and requires `grep -c "^| \`/" CLAUDE.md` == 17, sourcing Notes copy from route guards (not invented prose) per D-04/UI-SPEC's copywriting contract.

## Task Completeness / Scope

- All `auto` tasks have `<files>`, `<action>`, `<verify automated>`, `<done>`. 30-01's tasks are `tdd="true"` with a genuine Wave-0 RED test (Task 1) before GREEN (Task 2).
- Task/file counts per plan: 30-01 (2 tasks, 3 files), 30-02 (1 task, 7 files — mechanical identical swap, acceptable), 30-03 (2 tasks, 5 files), 30-04 (2 tasks, 3 files), 30-05 (3 tasks, 5 file operations). Within/near thresholds; no plan requires splitting.

## Nyquist / Validation

30-VALIDATION.md is present, `nyquist_compliant: true`, approved 2026-07-10. Every task has an `<automated>` verify command; Wave 0 gaps (PageContainer.test.tsx, SHELL-03 diff) are both satisfied inline in 30-01 Task 1 and 30-05 Task 2 respectively. No watch-mode flags. Feedback latency documented <120s.

## Context Compliance (D-01..D-04)

- D-01 (inline header back button, single-tap): implemented in 30-01 Task 2, consumed by 30-02/03/04.
- D-02 (home/login exempt): honored — neither page appears in any plan's `files_modified`.
- D-03 (delete AppShell/AppNav outright, no shim): 30-05 Task 1 explicit "Do NOT add any replacement/shim export."
- D-04 (routes-table-only CLAUDE.md fix): 30-05 Task 2 explicit "Do NOT modify any other CLAUDE.md section."
- Deferred ideas (pool-table-status's `TableStatusPanel` internal ArrowLeft button; documenting backTo/backLabel convention in CLAUDE.md Key Conventions) are explicitly excluded in 30-04/30-05 action text — no scope creep found.

No scope-reduction language ("v1", "static for now", "future enhancement" used to justify omission) found in any plan's task actions — the `pos`/`payments` className-override approach is a documented, fully-functional resolution (Pattern 2 in RESEARCH.md), not a deferred/reduced version of SHELL-01.

## Conclusion

**PASS.** No blockers. No warnings of consequence — plan quality substantially exceeds the typical bar (exact line-number citations, exact class values pinned in UI-SPEC, explicit non-regression checks for the two riskiest behaviors: full-bleed layout and the Home-link E2E contract). Ready for `/gsd-execute-phase 30`.
