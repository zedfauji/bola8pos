---
plan_id: 07
phase: 1
wave: 5
source_prd: .planning/feature-expansion-2026q2/sprints/S1-foundation.md
tickets: [DoD, ROADMAP-SC7]
depends_on: [02, 03, 04, 05, 06]
status: ready
---

# Plan 07 — Regression gate, staging, Tauri manual smoke

## Goal (backward from phase)

Close the **Definition of Done** in `S1-foundation.md`: no regressions in the **full automated suite**, migrations apply to **staging**, and **Tauri** manual check for Settings UIs. This plan is **not** a code commit unless fixes are required — it is the **quality gate** before phase sign-off.

---

## Automated gates (run in order)

| Gate | Command |
|------|---------|
| Typecheck | `cd bar-pos && npm run typecheck` |
| Lint (zero warnings) | `npm run lint` |
| Unit + property | `npm run test` |
| E2E full | `npm run test:e2e` (or `npx playwright test` per project script) |
| PRD grep | `grep -rn "inventory_log" bar-pos/src bar-pos/supabase bar-pos/e2e` → **0** results |

**Targeted re-runs** (from `01-VALIDATION.md`):

- `e2e/27-inventory-intelligence.spec.ts` — post–stock_movements
- `e2e/31-categories.spec.ts` — S1-13
- `e2e/09-rbac.spec.ts` — RLS/roles

---

## Staging (manual, operator)

1. `supabase link` to staging project (org procedure).
2. `supabase db push` (or approved migration path) — **zero errors**.
3. Optional: run a **smoke** Playwright run against staging URL if the project supports `PLAYWRIGHT_BASE_URL`.

Record outcome in `VERIFICATION.md` when using `/gsd:verify-work`.

---

## Tauri (manual, PRD DoD)

```bash
cd bar-pos && npm run tauri dev
```

- Log in as **admin** (e.g. PIN in project test docs).
- **Settings → Categories** — create "Beers", no console errors.
- **Settings → Modifier Groups** — open editor, no console errors.
- **Do not** validate POS main flow change (N/A; PRD out-of-scope) beyond ensuring **no new crashes** on tab screens.

---

## Sign-off checklist (mirror PRD)

- [ ] All migrations clean local + staging
- [ ] `supabase.types.ts` committed from Plan 03
- [ ] `domain.ts` Zod complete; types inferred
- [ ] `typecheck`, `lint`, `test`, `test:e2e` green
- [ ] P1 in `category-tree.test.ts` green
- [ ] `31-categories` spec green
- [ ] `inventory_log` grep zero
- [ ] Tauri settings smoke done
- [ ] RLS: bartender cannot write `modifier_groups` (E2E or manual)
- [ ] Conventional **atomic** commits per ticket on branch (retrospective)

---

## Plan-check: trace to PRD

| PRD | Covered |
|-----|---------|
| **Definition of Done** § all bullets | Yes — this plan is the enforcement surface |

**Phase 1 complete** when this checklist is done and `01-VALIDATION.md` / Nyquist sign-off is updated for compliance.
