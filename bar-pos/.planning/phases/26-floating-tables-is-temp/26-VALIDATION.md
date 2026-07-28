---
phase: 26
slug: floating-tables-is-temp
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (unit), Playwright 1.59 (E2E) |
| **Config file** | `bar-pos/vitest.config.ts` (unit), `bar-pos/playwright.config.ts` (E2E) |
| **Quick run command** | `npx vitest run src/entities/resource/model/queries.test.ts` (post-rename path; pre-rename file is `src/entities/pool-table/model/queries.test.ts`) |
| **Full suite command** | `npm run test` (unit), `npm run test:e2e` (E2E — requires display + Chrome per CLAUDE.md) |
| **Estimated runtime** | Unmeasured by research (no baseline run performed) — establish with `npm run test` before Wave 1 |

---

## Sampling Rate

- **After every task commit:** Run targeted `npx vitest run <touched file>.test.ts`
- **After every plan wave:** Run `npm run typecheck && npm run lint && npm run test`
- **Before `/gsd-verify-work`:** Full suite green + manual `npx supabase db push` + regenerated `supabase.types.ts` diff reviewed in the same commit
- **Max feedback latency:** Unmeasured — targeted vitest runs are expected to be single-digit seconds; full-suite latency not established

---

## Per-Task Verification Map

Task IDs don't exist yet (plans not yet created — VALIDATION.md is seeded pre-planning). No `REQUIREMENTS.md` exists for this milestone; mapping is against the 4 ROADMAP.md Success Criteria instead, per research. The planner/executor should attach concrete task IDs to these rows once PLAN.md files exist.

| Success Criterion | Behavior | Test Type | Automated Command | File Exists? | Status |
|--------------------|----------|-----------|--------------------|--------------|--------|
| SC-1: `resources` generalization, no breakage to existing `pool_tables` consumers | All 18 renamed call sites still compile + existing pool-table E2E flows pass | unit + E2E | `npx vitest run src/entities/resource/`, `npx playwright test e2e/04-pool-timer.spec.ts` | ✅ (renamed from `queries.test.ts`) / existing E2E already covers pool timer start/stop | ⬜ pending |
| SC-2: auto-deactivate trigger retires floating tables | A floating table's `is_deleted` flips to `TRUE` immediately after its session's `stopped_at` is set | integration (SQL) | New: `supabase/migrations/*_deactivate_floating_resource_trigger.sql` — no existing SQL test harness in this repo (`supabase/tests/` absent) | ❌ Wave 0 gap | ⬜ pending |
| SC-3: waitlist auto-create flow | Empty-state "Seat at a new temporary table" action creates a resource + seats the party | E2E | New: extend/add `e2e/*waitlist*.spec.ts` — no existing waitlist E2E spec confirmed in CLAUDE.md's 26-spec list | ❌ Wave 0 gap | ⬜ pending |
| SC-4: existing pool-table timer/billing unaffected | `computePoolSessionBilling` output unchanged for `table_type` != `'floating'` | unit | `npx vitest run src/entities/pool-table/model/usePoolTimer.test.ts` (pre-existing, should pass unmodified) | ✅ already exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] SQL-level verification for the auto-deactivate trigger (SC-2) — no `supabase/tests/` directory exists in this repo; document a manual verification script/steps (start a floating-table session, stop it, assert `is_deleted=TRUE`) inside the relevant plan's own verification section instead of a pgTAP harness.
- [ ] Confirm whether any existing E2E spec (CLAUDE.md's "E2E Test Suite" list) exercises `/waitlist` seating — none of the enumerated names obviously match; if truly absent, add a new `e2e/49-floating-tables.spec.ts` (or next-available number) to cover SC-3.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Auto-deactivate trigger fires on session stop | SC-2 | No SQL/pgTAP test harness exists in this repo (`supabase/tests/` absent) | Start a floating-table pool session, stop it, then query `resources` (or `pool_tables`) and assert `is_deleted = TRUE` for that row |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < N/A (unmeasured, see Test Infrastructure)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
