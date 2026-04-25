---
phase: 8
slug: polish-reports-e2e-hardening
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-25
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library v16 + Playwright v1.59 |
| **Config file** | `bar-pos/vite.config.ts` (vitest section), `bar-pos/playwright.config.ts` |
| **Quick run command** | `cd bar-pos && npm run test` |
| **Full suite command** | `cd bar-pos && npm run test && npm run test:e2e` |
| **Estimated runtime** | ~60s unit, ~5min E2E |

---

## Sampling Rate

- **After every task commit:** Run `cd bar-pos && npm run typecheck && npm run lint && npm run test`
- **After every plan wave:** Run `cd bar-pos && npm run test:e2e`
- **Before `/gsd-verify-work`:** Full suite (01–37) must be green
- **Max feedback latency:** 90 seconds (unit), 5 minutes (E2E)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 08-W0-01 | 08-01 | 0 | S6-01 | N/A | unit stub | `npx vitest run src/entities/tab/model/queries-reports.test.ts` | ❌ W0 | ⬜ pending |
| 08-W0-02 | 08-03 | 0 | S6-03 | N/A | unit stub | `npx vitest run src/widgets/ComboMixReport/` | ❌ W0 | ⬜ pending |
| 08-W0-03 | 08-03 | 0 | S6-04 | N/A | unit stub | `npx vitest run src/widgets/RecipeVarianceReport/` | ❌ W0 | ⬜ pending |
| 08-W0-04 | 08-03 | 0 | S6-05 | N/A | unit stub | `npx vitest run src/widgets/WaitlistAnalyticsReport/` | ❌ W0 | ⬜ pending |
| 08-W0-05 | 08-03 | 0 | S6-06 | N/A | unit stub | `npx vitest run src/widgets/RefundsRegister/` | ❌ W0 | ⬜ pending |
| 08-01-01 | 08-01 | 1 | S6-01 | Views aggregate without data leakage across tenants | integration | `npx vitest run src/entities/tab/model/queries-reports.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 08-01 | 1 | S6-02 | Index created IF NOT EXISTS (idempotent) | manual EXPLAIN | `supabase db psql -c "EXPLAIN ANALYZE SELECT * FROM stock_movements WHERE ingredient_id IS NOT NULL ORDER BY ts DESC LIMIT 50"` | ✅ (migration) | ⬜ pending |
| 08-02-01 | 08-02 | 2 | S6-01 | Zod schemas parse view rows without throwing | unit | `cd bar-pos && npm run test` | ✅ (domain.ts) | ⬜ pending |
| 08-03-01 | 08-03 | 3 | S6-01 | Query hook returns Result<T[]> ok path | integration | `npx vitest run src/entities/tab/model/queries-reports.test.ts` | ❌ W0 | ⬜ pending |
| 08-03-02 | 08-03 | 3 | S6-01 | Date range > 365 days throws ValidationError | unit | `cd bar-pos && npm run test` | ❌ W0 | ⬜ pending |
| 08-04-01 | 08-03 | 4 | S6-03 | ComboMixReport renders table rows with data | unit (RTL) | `npx vitest run src/widgets/ComboMixReport/` | ❌ W0 | ⬜ pending |
| 08-04-02 | 08-03 | 4 | S6-04 | RecipeVarianceReport highlights variance > ±10% with amber row | unit (RTL) | `npx vitest run src/widgets/RecipeVarianceReport/` | ❌ W0 | ⬜ pending |
| 08-04-03 | 08-03 | 4 | S6-06 | RefundsRegister totals row = sum of items | unit (pure math) | `npx vitest run src/widgets/RefundsRegister/` | ❌ W0 | ⬜ pending |
| 08-05-01 | 08-05 | 5 | S6-07 | ReportsPage has 5 new tabs visible | E2E | `npx playwright test e2e/37-analytics-reports.spec.ts` | ❌ W0 | ⬜ pending |
| 08-05-02 | 08-05 | 5 | S6-08 | Export buttons trigger Tauri save dialog + success toast | E2E | `npx playwright test e2e/37-analytics-reports.spec.ts` | ❌ W0 | ⬜ pending |
| 08-06-01 | 08-06 | 6 | S6-12 | Touch targets: size="lg" or POSButton on waitlist action buttons | unit (grep) | `grep -r 'size="lg"\|POSButton' bar-pos/src/features/seat-waitlist-party bar-pos/src/features/add-waitlist-entry` | ❌ W0 | ⬜ pending |
| 08-06-02 | 08-06 | 6 | S6-12 | Focus trap: autoFocus or trap comment in SeatWaitlistPartySheet | unit (grep) | `grep -n "autoFocus\|Focus is trapped" bar-pos/src/features/seat-waitlist-party/ui/SeatWaitlistPartySheet.tsx` | ❌ W0 | ⬜ pending |
| 08-06-03 | 08-06 | 6 | S6-12 | Toast copy: feature-specific error messages in mutation hooks | unit (grep) | `grep -rn "Could not\|cannot\|failed" bar-pos/src/features/mark-waitlist-entry-cancelled/model/useMarkCancelled.ts bar-pos/src/features/mark-waitlist-no-show/model/useMarkNoShow.ts` | ❌ W0 | ⬜ pending |
| 08-07-01 | 08-05 | 6 | S6-10 | Full 37-analytics-reports.spec.ts passes | E2E | `npx playwright test e2e/37-analytics-reports.spec.ts` | ❌ W0 | ⬜ pending |
| 08-07-02 | 08-05 | 6 | S6-11 | Specs 18–24 pass without flakes | E2E | `cd bar-pos && npm run test:e2e` | ✅ (existing) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `bar-pos/src/entities/tab/model/queries-reports.test.ts` — integration test stubs for 5 new hooks (skipIf no DB creds)
- [ ] `bar-pos/src/widgets/ComboMixReport/ComboMixReport.test.tsx` — RTL unit test stub (created in plan 08-03)
- [ ] `bar-pos/src/widgets/RecipeVarianceReport/RecipeVarianceReport.test.tsx` — RTL unit test stub (created in plan 08-03)
- [ ] `bar-pos/src/widgets/WaitlistAnalyticsReport/WaitlistAnalyticsReport.test.tsx` — RTL unit test stub (created in plan 08-03)
- [ ] `bar-pos/src/widgets/RefundsRegister/RefundsRegister.test.tsx` — RTL unit test stub (created in plan 08-03)
- [ ] `bar-pos/scripts/seed-reports.ts` — seeds 7 days of combo sales + refunds + waitlist entries for E2E

*Existing test infrastructure (Vitest + Playwright) fully covers framework needs — no new installs required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Index scan used for stock_movements ingredient query | S6-02 | EXPLAIN ANALYZE requires DB CLI | `supabase db psql -c "EXPLAIN ANALYZE SELECT * FROM stock_movements WHERE ingredient_id IS NOT NULL ORDER BY ts DESC LIMIT 50"` — verify "Index Scan" in output |
| `supabase db push` applies migrations without error | S6-01, S6-02 | Interactive prompt; requires user confirmation | Run `cd bar-pos && supabase db push` and confirm prompt |
| Obsidian vault feature backlog updated | S6-14 | External vault (not in repo) | Open ObsidianVault/Bola8 POS/Feature Backlog & Roadmap.md; mark S3c (Phase 5), S4 (Phase 6), S5 (Phase 7), and S6 (Phase 8) as done. Confirm all four entries show completed state before typing "phase-complete" resume signal in 08-05 Task 3. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [x] Feedback latency < 90s (unit)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
