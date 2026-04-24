---
phase: 2
slug: combos
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-23
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library v16; Playwright v1.59 for E2E |
| **Config file** | `bar-pos/vitest.config.ts` / `bar-pos/playwright.config.ts` |
| **Quick run command** | `cd bar-pos && npm run test` |
| **Full suite command** | `cd bar-pos && npm run typecheck && npm run lint && npm run test && npm run test:e2e` |
| **Estimated runtime** | ~90 seconds (unit) / ~5 minutes (full with E2E) |

---

## Sampling Rate

- **After every task commit:** Run `cd bar-pos && npm run typecheck && npm run test`
- **After every plan wave:** Run `cd bar-pos && npm run typecheck && npm run lint && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | S2-01 | — | AppErrorCode union updated | unit | `cd bar-pos && npx vitest run src/shared/lib/result.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | S2-01 | T-2-01 | combo_slots migration idempotent | unit | `cd bar-pos && npm run typecheck` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | S2-02 | T-2-02 | add_combo_to_tab RPC enforces slot min/max | unit | `cd bar-pos && npm run test` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | S2-04 | — | ComboBuilderSheet renders slot choices | unit | `cd bar-pos && npx vitest run src/features/add-combo-to-tab` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 2 | S2-05 | — | Pool minutes consumed before billing | unit | `cd bar-pos && npx vitest run src/entities/pool-session` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 3 | S2-07 | — | Admin ComboBuilderForm saves correctly | unit | `cd bar-pos && npm run test` | ❌ W0 | ⬜ pending |
| 2-05-01 | 05 | 4 | S2-10 | — | E2E combo flow passes | e2e | `cd bar-pos && npx playwright test e2e/32-combos.spec.ts` | ❌ W0 | ⬜ pending |
| 2-06-01 | 06 | 5 | S2-11 | — | Full regression passes | e2e | `cd bar-pos && npm run test:e2e` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `bar-pos/src/features/add-combo-to-tab/` — stub directory + index.ts
- [ ] `bar-pos/src/features/manage-combos/` — stub directory + index.ts
- [ ] `bar-pos/src/entities/combo/` — stub directory + model/types.ts
- [ ] `bar-pos/src/shared/ui/Collapsible/` — add via `npx shadcn@latest add collapsible`
- [ ] `AppErrorCode` extended with `COMBO_UNAVAILABLE | SLOT_MIN_MAX_VIOLATION | INVALID_CHILD | NESTED_COMBO_FORBIDDEN`

*Existing Vitest + Playwright infrastructure covers all phase requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pool free-hour billing cutoff on live Supabase | S2-05 | Requires real-time DB + timer clock | Start a pool session, add a combo with 1hr pool, verify billing shows 0 until 60min |
| Combo availability day-gate in POS | S2-03 | Requires day-of-week seed data | Set a combo to Wednesday-only, verify it's greyed/hidden on other days in POS |
| Nested combo guard on admin form | S2-01 | PL/pgSQL trigger + UI error path | Try to add a combo product as a slot option; verify NESTED_COMBO_FORBIDDEN error toast |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
