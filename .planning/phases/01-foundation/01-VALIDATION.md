---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (unit + fast-check property) + Playwright 1.59 (E2E) + Storybook 10 |
| **Config file** | `bar-pos/vitest.config.ts`, `bar-pos/playwright.config.ts` (both exist) |
| **Quick run command** | `cd bar-pos && npm run typecheck && npm run lint && npm run test` |
| **Full suite command** | `cd bar-pos && npm run typecheck && npm run lint && npm run test && npm run test:e2e` |
| **Estimated runtime** | unit ~20s · typecheck ~15s · lint ~5s · E2E ~4–6min |

---

## Sampling Rate

- **After every task commit:** `cd bar-pos && npm run typecheck && npm run lint` (~20s)
- **After every migration commit (S1-01..S1-05, S1-11):** `cd bar-pos && npx supabase db reset` then quick unit `npx vitest run src/shared/lib/domain.test.ts src/shared/lib/category-tree.test.ts` (~40s)
- **After every plan wave:** `cd bar-pos && npm run typecheck && npm run lint && npm run test` (~45s)
- **Before `/gsd:verify-work`:** Full suite green, including `npx playwright test e2e/31-categories.spec.ts e2e/09-rbac.spec.ts e2e/27-inventory-intelligence.spec.ts` plus full existing suite (01–30) with zero regressions
- **Max feedback latency:** 45s (typecheck+lint+unit)

---

## Per-Task Verification Map

> Success criteria mapped to S1-01..S1-13 tickets and per-wave verification.
> Plan/Wave columns will be finalized by the planner; provisional mapping based on RESEARCH.md Wave recommendation.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| S1-01 | 02 | 1 | Rename `inventory_log` → `stock_movements`, enum + polymorphic cols | integration (migration) + E2E smoke | `cd bar-pos && npx supabase db reset && npx playwright test e2e/27-inventory-intelligence.spec.ts` | ✅ (spec exists; grep sites enumerated in RESEARCH §Brownfield) | ⬜ pending |
| S1-01 | 02 | 1 | All 16 non-generated `inventory_log` refs flipped atomically | grep gate | `! grep -rn "inventory_log" bar-pos/src bar-pos/supabase bar-pos/e2e` | N/A (command) | ⬜ pending |
| S1-02 | 02 | 1 | `categories.parent_id` FK + depth-3 + cycle trigger | unit + integration | `npx vitest run src/shared/lib/category-tree.test.ts` (pure fn) + `psql` trigger assertion | ❌ Wave 0 create | ⬜ pending |
| S1-02 | 05 | 4 | DB-level depth-3 trigger fires end-to-end | E2E | `npx playwright test e2e/31-categories.spec.ts -g "great-grandchild"` | ❌ Wave 0 create | ⬜ pending |
| S1-03 | 02 | 1 | `modifier_groups`, `modifier_group_items`, `product_modifier_groups` queryable | unit (Zod) + integration | `npx vitest run src/shared/lib/domain.test.ts` | ✅ (domain.test.ts exists; add cases) | ⬜ pending |
| S1-04 | 02 | 1 | `products.combo_eligible`, `products.is_combo` defaults correct | unit (Zod) + E2E toggle | `npx playwright test e2e/31-categories.spec.ts -g "combo_eligible"` | ❌ Wave 0 create | ⬜ pending |
| S1-05 | 02 | 1 | Two payments can be inserted against same tab | integration | `psql $DB -c "INSERT INTO payments (tab_id, ...) VALUES (...), (...);"` | ❌ Wave 0 create (sql test fixture) | ⬜ pending |
| S1-06 | 03 | 2 | Type regen produces clean `supabase.types.ts` | typecheck gate | `npx supabase gen types typescript --local > src/shared/lib/supabase.types.ts && npm run typecheck` | ✅ | ⬜ pending |
| S1-06 | 03 | 2 | Zod schemas (Category+parent, ModifierGroup, ModifierGroupItem, ProductModifierGroup, StockMovement, Product+combo) parse valid + reject invalid | unit | `npx vitest run src/shared/lib/domain.test.ts` | ✅ (extend existing) | ⬜ pending |
| S1-07 | 04 | 3 | `CategoryTreePicker` renders tree | RTL + Storybook | `npx vitest run src/shared/ui/CategoryTreePicker` + `npm run storybook` (smoke) | ❌ Wave 0 create | ⬜ pending |
| S1-08 | 04 | 3 | Settings → Categories tab visible to admin, hidden to non-admin | E2E | `npx playwright test e2e/31-categories.spec.ts -g "admin sees Categories tab"` + `e2e/09-rbac.spec.ts` | ✅ (rbac exists; extend) · ❌ Wave 0 create new spec | ⬜ pending |
| S1-09 | 04 | 3 | Settings → Modifier Groups admin-only | E2E | `npx playwright test e2e/31-categories.spec.ts -g "Modifier Groups tab"` | ❌ Wave 0 create | ⬜ pending |
| S1-10 | 04 | 3 | New `@entities/category` imports resolve + FSD boundaries clean | typecheck + lint gate | `npm run typecheck && npm run lint` | N/A (existing gates) | ⬜ pending |
| S1-11 | 02 | 1 | Bartender cannot write `modifier_groups` | E2E | `npx playwright test e2e/31-categories.spec.ts -g "bartender write refused"` + `e2e/09-rbac.spec.ts` | ❌ Wave 0 create (RLS case) | ⬜ pending |
| S1-12 | 04 | 3 | Property P1: random tree ≤1000 nodes — depth ≤ 3 + no cycles | property (fast-check) | `npx vitest run src/shared/lib/category-tree.test.ts -t "P1"` | ❌ Wave 0 create | ⬜ pending |
| S1-13 | 05 | 4 | Full categories E2E flow (root → child → grandchild → reject → combo toggle) | E2E | `npx playwright test e2e/31-categories.spec.ts` | ❌ Wave 0 create (renamed from 18 due to collision with existing `18-void-order.spec.ts`) | ⬜ pending |
| ROADMAP-SC7 | 06 | 5 | No regression on existing 30 E2E specs | E2E gate | `cd bar-pos && npm run test:e2e` | ✅ (suite exists) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Files/specs that must be scaffolded (empty or skeleton) before executing waves:

- [ ] `src/shared/lib/category-tree.ts` + `src/shared/lib/category-tree.test.ts` — pure tree functions (descendants, ancestors, depth, cycle-check) for unit + P1 property test (S1-02, S1-12)
- [ ] `src/shared/ui/CategoryTreePicker/{index.tsx,CategoryTreePicker.stories.tsx,CategoryTreePicker.test.tsx}` — scaffold (S1-07)
- [ ] `src/entities/category/model/{types.ts,store.ts,queries.ts,index.ts}` (new folder) (S1-10)
- [ ] `src/features/manage-categories/{ui/,hooks/,index.ts}` (S1-08)
- [ ] `src/features/manage-modifier-groups/{ui/,hooks/,index.ts}` (S1-09)
- [ ] `e2e/31-categories.spec.ts` — skeleton with `test.describe.skip` blocks (S1-13; renamed from 18 due to existing `e2e/18-void-order.spec.ts`)
- [ ] Extend `src/shared/lib/domain.test.ts` with new schema cases (S1-03, S1-04, S1-06)
- [ ] Update `e2e/27-inventory-intelligence.spec.ts` fixture data references from `inventory_log` → `stock_movements` after S1-01 lands (Wave 1 task, not Wave 0)

*Framework install:* Not required — all frameworks present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Staging DB migration runs clean | PRD DoD | Staging is an external Supabase project | `supabase link --project-ref <staging>` then `supabase db push` — confirm zero errors, run smoke E2E against staging |
| Tauri dev build — Settings → Categories + Modifier Groups render | PRD DoD | WebView2 desktop shell behavior differs from browser | `cd bar-pos && npm run tauri dev` → log in as admin PIN 0000 → Settings → click Categories tab + Modifier Groups tab → create root category "Beers" → confirm no console errors |
| No reference to `inventory_log` remains | PRD DoD | Grep is the authority; also exercised by full-suite gate | `grep -rn "inventory_log" bar-pos/src bar-pos/supabase bar-pos/e2e` returns zero hits |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependency declared
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ MISSING references above
- [ ] No watch-mode flags used in verify commands
- [ ] Feedback latency < 45s for per-commit sampling
- [ ] `nyquist_compliant: true` set in frontmatter after planner finalizes plan/wave assignments

**Approval:** pending
