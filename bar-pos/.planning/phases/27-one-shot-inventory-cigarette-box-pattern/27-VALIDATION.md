---
phase: 27
slug: one-shot-inventory-cigarette-box-pattern
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-29
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 (unit + integration projects) + Playwright v1.59 (E2E, manual/pre-release only) |
| **Config file** | `vitest.config.ts` (projects: `unit`, `storybook`); integration glob `src/**/*.integration.test.ts` |
| **Quick run command** | `npx vitest run --project unit --reporter=dot src/entities/open-unit` |
| **Full suite command** | `npm run test` + `npm run test:integration` (requires `VITE_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`) |
| **Estimated runtime** | ~30-60s unit, integration suite requires a reachable Supabase instance |

---

## Sampling Rate

- **After every task commit:** `npx vitest run --project unit --reporter=dot` (fast subset touching changed files)
- **After every plan wave:** `npm run test` + `npm run test:integration` (flag as environment dependency if a live Supabase instance isn't reachable in the execution environment)
- **Before `/gsd-verify-work`:** Full suite green (`npm run test`, `npm run test:integration`, `npm run typecheck`, `npm run lint`)
- **Max feedback latency:** ~60 seconds (unit); integration suite is slower and gated at wave/phase boundaries, not per-task

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01-xx | TBD | 0 | SC-1 | V4/V5 | `open_units` row created with correct product/remaining/opened-by/opened-at on manual open | integration | `npx vitest run --reporter=dot "src/**/open-unit*.integration.test.ts"` | ❌ W0 | ⬜ pending |
| 27-01-xx | TBD | 0 | SC-1 | Tampering | Partial unique index rejects a second concurrent open for an already-active product (D-07/D-08) | integration | same file | ❌ W0 | ⬜ pending |
| 27-01-xx | TBD | 0 | SC-2 | Tampering | Two simultaneous sales racing to decrement the last remaining piece — exactly one succeeds, no double-decrement, no lost update | integration | same file | ❌ W0 | ⬜ pending |
| 27-01-xx | TBD | 0 | SC-2 | — | Exhaustion mid-transaction auto-opens a fresh unit (box stock available); lifecycle events recorded in order | integration | same file | ❌ W0 | ⬜ pending |
| 27-01-xx | TBD | 0 | SC-2 | — | Exhaustion with zero box stock raises `INVENTORY_NEGATIVE`-equivalent; `p_allow_negative=true` bypasses it | integration | same file | ❌ W0 | ⬜ pending |
| 27-01-xx | TBD | 0 | SC-3 | V4 | Admin Open-Units tab renders open units; bartender can open a new unit; manager-only actions hidden/disabled for bartender | component/unit (RTL) | `npx vitest run --project unit src/widgets/InventoryPagePanel.test.tsx` (or new open-units-tab test file) | ❌ W0 | ⬜ pending |
| 27-01-xx | TBD | 0 | SC-4 | Repudiation | `record_audit()` called with correct `open_unit.*` action strings for open/deplete/exhaust/void/correct | integration | same RPC integration file — query `audit_logs` after each RPC call | ❌ W0 | ⬜ pending |
| 27-01-xx | TBD | 0 | SC-4 | — | `audit-actions.test.ts` CI gate passes with the 5 new enum entries | unit | `npx vitest run --project unit src/shared/lib/__tests__/audit-actions.test.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are TBD — the planner assigns real plan/wave/task IDs; this table's rows are the required coverage set, not final IDs.*

---

## Wave 0 Requirements

- [ ] `src/entities/open-unit/model/*.integration.test.ts` (or similarly-named RPC test file) — stubs for SC-1/SC-2/SC-4 concurrency, atomicity, auto-transition, and audit assertions; reuse the `describe.skipIf(skip)` + service-role/anon-client skeleton from `src/entities/tab/model/depletion.integration.test.ts`
- [ ] Admin Open-Units tab component test file — stubs for SC-3's RBAC-gated UI behavior (D-11 vs D-12)
- [ ] Verify at plan time whether `src/shared/lib/__tests__/audit-actions.test.ts` needs edits beyond the enum itself (it may grep migrations generically)
- [ ] Framework install: none — Vitest/Playwright/RTL already fully configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Full E2E flow: open a box in the admin tab, sell loose pieces at POS through exhaustion, verify auto-transition and receipt correctness | SC-1/SC-2/SC-3 | `npm run test:e2e` is manual/pre-release per CLAUDE.md, not phase-gating; requires a real Tauri/webkit2gtk session | Run `npx playwright test` against the relevant new spec (if authored) with a real dev server and Supabase instance |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (2 new test files + 1 enum extension)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (unit tier)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
