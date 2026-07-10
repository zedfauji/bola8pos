---
phase: 20
slug: promotions-engine
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-09
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library; fast-check v4 for property tests; Playwright v1.59 for E2E |
| **Config file** | `vitest.config.ts` / `playwright.config.ts` |
| **Quick run command** | `npx vitest run <changed-file>.test.ts` |
| **Full suite command** | `npm run test` (unit); `npm run test:e2e` (E2E, manual gate per CLAUDE.md) |
| **Estimated runtime** | ~30s (unit) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed-file>.test.ts`
- **After every plan wave:** Run `npm run test` + `npm run typecheck` + `npm run lint`
- **Before `/gsd-verify-work`:** Full unit suite + live Supabase integration tests green + new `e2e/43-promotions.spec.ts` green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 0 | SC-1 | T-20-01 | `promotions`/`promotion_availability` schema CHECK constraints (discount_type/target_type), `is_promotion_available()` day/time matching | unit + integration | `npx vitest run src/shared/lib/domain.test.ts` + new live-Supabase integration test (mirrors `20260709000002` scaffold) | ❌ W0 | ⬜ pending |
| 20-02-01 | 02 | 0 | SC-2 | T-20-02 | `applied_promotions` audit rows correct, immutable/append-only RLS (no client write policies) | integration | new `applied-promotions-rls.test.ts` (mirrors Phase 14 audit_logs RLS denial tests) | ❌ W0 | ⬜ pending |
| 20-03-01 | 03 | 0 | SC-3 | T-20-01 / T-20-03 | Sequential-compounding math, priority ordering, deterministic tiebreak, availability-window gating; server becomes sole authority for `unit_price` | unit + property + live integration | new fast-check property test **P11** (compounding order-independence within priority groups) + live RPC integration test asserting final `unit_price` via `create_order_with_items` | ❌ W0 | ⬜ pending |
| 20-04-01 | 04 | 0 | SC-4 | T-20-04 | Form validation (Zod bounds), RLS-gated CRUD, list rendering | unit (RTL) | new `ManagePromotionsTab.test.tsx` / `PromotionBuilderForm.test.tsx` | ❌ W0 | ⬜ pending |
| 20-06-01 | 06 | 4 | D-07 (migration) | T-20-01 | Every existing HH category/product converts to an equivalent `fixed_price` promotion producing an identical price | integration | one-off script/test comparing `resolveProductPrice()` output against `evaluate_promotions` output for all pre-migration HH rows (exercised by 20-09's parity gate) | ❌ W0 | ⬜ pending |

*IDs above reflect final plan numbering (11 plans, waves 1–8) as assigned by the planner; this table's Req/Threat/Behavior columns are authoritative and must be preserved if renumbered again.*

---

## Wave 0 Requirements

- [ ] `src/entities/promotion/model/queries.test.ts` — new entity hook stubs
- [ ] `supabase/migrations/*_promotions_schema.sql` integration test scaffold — mirrors `20260709000002_close_caja_session_tip_distribution.sql`'s companion test file
- [ ] Property test file for sequential-compounding math (`P11`) — fast-check already installed, no new framework needed
- [ ] `e2e/43-promotions.spec.ts` — new spec file, next available number after `42-tip-distribution.spec.ts`
- [ ] `applied-promotions-rls.test.ts` — RLS denial tests mirroring Phase 14's audit_logs pattern

*Existing infrastructure (Vitest, fast-check, Playwright, RTL) covers all phase requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npm run test:e2e` full suite | SC-1..4 | E2E is a manual gate per CLAUDE.md (run before release, not per-commit) | `npx playwright test e2e/43-promotions.spec.ts` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-09 (per gsd-plan-checker verification — 1 blocker/2 warnings were documentation-only and resolved without replanning; all 7 core plan dimensions passed)
