---
plan_id: 06
phase: 1
wave: 4
source_prd: .planning/feature-expansion-2026q2/sprints/S1-foundation.md
tickets: [S1-13]
depends_on: [05-ui-features-PLAN.md]
status: ready
---

# Plan 06 — E2E: Settings categories + depth gate + combo flag

## Goal (backward from phase)

**Automated proof** of the PRD UAT: admin opens **Settings → Categories**, builds **Beers → Regular → Corona**, **fails** at a fourth level (UI +**optional** assert on API 4xx), toggles **combo_eligible** on a product and **confirms state** (DB or UI). **Bartender** cannot write modifier groups (RLS) — use existing RBAC patterns from `e2e/09-rbac.spec.ts`.

---

## File name note (PRD vs repo)

- PRD `S1-foundation.md` names `e2e/18-categories.spec.ts`, but **`e2e/18-void-order.spec.ts` already exists** — use **`e2e/31-categories.spec.ts`** (see `01-VALIDATION.md`).

---

## Task S1-13 — Playwright spec

| Case | Assert |
|------|--------|
| Login as admin | Settings shows Categories (and Modifier Groups) tabs |
| Create root "Beers" | Visible in tree |
| Child "Regular" | Under Beers |
| Grandchild "Corona" | Under Regular |
| Great-grandchild | **Blocked** in UI; if API exposed, expect **4xx** |
| `combo_eligible` toggle | Save → re-query DB (helper in `e2e/helpers/supabase.ts`) or refresh UI |
| RLS (S1-11) | As bartender, attempt write to modifier group → **refused** |

| Verify | Command |
|--------|-----------|
| Single spec | `cd bar-pos && npx playwright test e2e/31-categories.spec.ts` |
| RBAC cross-smoke | `npx playwright test e2e/09-rbac.spec.ts` (if settings roles touched) |

**Conventional commit:** `test(e2e): add settings category tree and combo flag flows [S1-13]`

---

## Plan-check: trace to PRD

| PRD ticket | Covered |
|------------|---------|
| S1-13 | Yes |

**Unlocks:** Plan 07 (regression gate).
