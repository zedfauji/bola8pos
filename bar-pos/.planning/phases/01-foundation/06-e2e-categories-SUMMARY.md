---
phase: 01-foundation
plan: 06
subsystem: e2e
tags: [e2e, playwright, categories, rbac, rls, combo-eligible]
dependency_graph:
  requires: [05-ui-features-PLAN.md]
  provides: [e2e/31-categories.spec.ts]
  affects: [07-regression-gate-PLAN.md]
tech_stack:
  added: []
  patterns: [playwright-spec, service-role-db-helper, rls-test-pattern]
key_files:
  created:
    - bar-pos/e2e/31-categories.spec.ts
  modified: []
decisions:
  - combo_eligible tested via DB service-role client (no UI toggle in ProductForm yet — field exists in domain.ts and DB only)
  - RLS test for bartender modifier_groups write uses E2E_BARTENDER_EMAIL/PASSWORD env vars (skippable)
  - 4th-level depth gate verified by asserting absence of "Add subcategory under Corona" button (canAddChild=false at depth 2)
  - Teardown uses service-role cleanupTestCategories to avoid RLS interference during cleanup
metrics:
  duration: "50min"
  completed_date: "2026-04-23"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 1 Plan 06: E2E Categories Summary

**One-liner:** Playwright spec for Settings category tree CRUD (3-level Beers→Regular→Corona), depth gate UI guard, combo_eligible DB flag, and bartender RLS block on modifier_groups.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| S1-13 | `e2e/31-categories.spec.ts` — 8 test cases | 8eabde7 |

## Test Cases

| # | Case | Approach | Assert |
|---|------|----------|--------|
| T1 | Admin sees Settings with Categories and Modifier Groups tabs | UI | `getByRole('tab', { name: 'Categories' })` visible |
| T2 | Create root "Beers" | UI | "Beers" visible in tree after dialog save |
| T3 | Create child "Regular" under Beers | UI | "Regular" visible; "Add subcategory under Beers" button used |
| T4 | Create grandchild "Corona" under Regular | UI | "Corona" visible; tree expand handled |
| T5 | 4th level blocked in UI | UI | `getByRole('button', { name: /add subcategory under Corona/i })` has count 0 |
| T6 | combo_eligible DB column writable/readable | DB (service-role) | Insert with `combo_eligible: false`, toggle to `true`, re-query confirms `true` |
| T7 | Bartender cannot write modifier_groups (RLS) | DB (anon key + bartender JWT) | Insert refused; test skippable if E2E_BARTENDER_EMAIL/PASSWORD not set |
| T8 | Bartender redirected from /settings | UI | URL matches `/home` after goto('/settings') |

## Verification

```bash
cd bar-pos
npm run typecheck   # PASS — zero errors
npm run lint        # PASS — zero warnings
npx playwright test e2e/31-categories.spec.ts  # requires .env.local E2E credentials
```

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

**combo_eligible UI toggle:** The `ProductForm` does not yet expose a `combo_eligible` toggle in the UI (the field exists in `domain.ts` as `z.boolean().optional().default(true)` and in the DB migration). The plan spec says "re-query DB (helper in `e2e/helpers/supabase.ts`) or refresh UI" — we use the DB helper path (T6). When the UI toggle is added in a future sprint, T6 should be updated to exercise it.

**RLS test (T7):** Requires `E2E_BARTENDER_EMAIL` and `E2E_BARTENDER_PASSWORD` env vars (Supabase Auth credentials for the bartender user). These are separate from the PIN-based `E2E_BARTENDER_PIN`. If not set, T7 is skipped with an informative message. This is consistent with the skip-not-fail pattern used throughout the E2E suite.

## Self-Check: PASSED

- [x] `bar-pos/e2e/31-categories.spec.ts` — confirmed created and committed (8eabde7)
- [x] `npm run typecheck` — clean
- [x] `npm run lint` — zero warnings
- [x] Commit `8eabde7` exists in `bar-pos` nested repo
