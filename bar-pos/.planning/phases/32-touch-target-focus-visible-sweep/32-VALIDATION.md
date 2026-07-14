---
phase: 32
slug: touch-target-focus-visible-sweep
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-13
updated: 2026-07-13
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Unit framework** | Vitest v4 + React Testing Library v16 |
| **Unit config file** | `bar-pos/vitest.config.ts` |
| **E2E framework** | Playwright v1.59 |
| **E2E config file** | `bar-pos/playwright.config.ts` |
| **Quick run command** | `npx vitest run src/shared/ui/button.test.tsx src/shared/ui/POSButton.test.tsx src/shared/ui/ConfirmDialog.test.tsx` |
| **Full suite command** | `npm run test` (unit) / `npx playwright test e2e/44-focus-tab-order.spec.ts` (new e2e) |
| **Estimated runtime** | unit ~30s; new e2e ~1–2 min (needs dev server + .env.local) |

---

## Sampling Rate

- **After every task commit:** the task's `<automated>` command (source-assertion grep + `npm run typecheck` + `npm run lint`, plus the relevant `vitest run` where a test file is touched)
- **After every plan wave:** `npm run test` (full unit suite)
- **Before `/gsd-verify-work`:** full unit suite green + `npx playwright test e2e/44-focus-tab-order.spec.ts` green. Full `npm run test:e2e` is optional/manual per CLAUDE.md ("run manually before releases").
- **Max feedback latency:** < 60s for the unit/lint/typecheck loop

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | FOCUS-01, FOCUS-02, TOUCH-02 | T-32-01-02 | Baseline PIN-surface ring unaffected; only new variant added | unit | `npx vitest run src/shared/ui/button.test.tsx src/shared/ui/POSButton.test.tsx` | ❌ W0 (created here) | ⬜ pending |
| 32-01-02 | 01 | 1 | (ConfirmDialog passthrough for FOCUS-02) | T-32-01-01 | No default change on 20 call sites (payment dialogs unaffected) | unit | `npx vitest run src/shared/ui/ConfirmDialog.test.tsx` | ❌ W0 (created here) | ⬜ pending |
| 32-01-03 | 01 | 1 | TOUCH-01 | T-32-01-01 | Shared-primitive ripple limited to DataTable; class-only | unit + grep | `grep -q "h-11 w-11" src/shared/ui/SearchInput.tsx && npm run test` | ✅ (SearchInput.tsx) | ⬜ pending |
| 32-02-01 | 02 | 1 | TOUCH-01, TOUCH-02 | T-32-02-01 | Handlers/testids preserved | source-assert + typecheck/lint | `! grep -nE "<Button[ >]" src/widgets/PoolTableGrid/index.tsx src/widgets/KdsBoard/index.tsx src/pages/inventory/index.tsx` | ✅ | ⬜ pending |
| 32-02-02 | 02 | 1 | TOUCH-01 | T-32-02-01 | Sort/remove handlers preserved | source-assert + typecheck/lint | `grep -q "h-11 w-11" src/widgets/TableStatusPanel/index.tsx && grep -q "min-h-\[44px\]" src/entities/inventory/ui/InventoryRow.tsx` | ✅ | ⬜ pending |
| 32-02-03 | 02 | 1 | TOUCH-03 | T-32-02-02 | N/A (static markup) | source-assert (grep gate) | `! grep -rnE "\bgap-(0\|1)\b" src/widgets/PoolTableGrid/index.tsx src/widgets/KdsBoard/index.tsx src/widgets/KitchenPrepDashboard/ui/KitchenPrepDashboard.tsx src/features/produce-prep-batch/ui/PrepBatchPreview.tsx` | ✅ | ⬜ pending |
| 32-03-01 | 03 | 2 | TOUCH-02, FOCUS-02 | T-32-03-01 | Destructive confirm copy/gating unchanged | source-assert + unit | `grep -q "min-h-\[72px\].*focus-visible:ring-4" src/features/stop-pool-timer/ui/StopSessionConfirm.tsx && npm run test` | ✅ | ⬜ pending |
| 32-03-02 | 03 | 2 | FOCUS-03 | T-32-03-02 | Read-only; PINKeypad/ManagerPinDialog unmodified | e2e | `npx playwright test e2e/44-focus-tab-order.spec.ts` | ❌ W0 (created here) | ⬜ pending |
| 32-03-03 | 03 | 2 | (docs for FOCUS-03) | — | N/A | source-assert | `grep -q "44-focus-tab-order" CLAUDE.md && grep -q "23 spec files" CLAUDE.md` | ✅ (CLAUDE.md) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/ui/button.test.tsx` — new file, FOCUS-01/FOCUS-02 (focusEmphasis variant class assertions, closes Assumption A1) — created in Task 32-01-01
- [ ] `src/shared/ui/POSButton.test.tsx` — new file, TOUCH-02 (touchSize class assertions across default/large/xl) — created in Task 32-01-01
- [ ] `src/shared/ui/ConfirmDialog.test.tsx` — new file, confirmClassName passthrough (closes Pitfall 2) — created in Task 32-01-02
- [ ] `e2e/44-focus-tab-order.spec.ts` — new file, FOCUS-03 (D-13), numbered 44 to avoid the 43-promotions collision — created in Task 32-03-02
- [x] No framework installs needed — Vitest/RTL/Playwright all already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual confirmation that the 72px destructive confirm buttons show a visibly thicker/full-opacity ring on keyboard focus | FOCUS-02 | Ring pixel width/opacity is a visual property; the unit test asserts the class string but not the rendered pixels | Focus the "Stop & finalize" and "Stop & Move" confirm buttons via keyboard on /pool-tables and /pool-tables/:id; confirm the ring is thicker than a default POSButton's |
| Existing operational E2E specs still green after the rollout | TOUCH-01/TOUCH-02 | Full E2E requires dev server; run before release per CLAUDE.md | `npx playwright test e2e/16-table-status.spec.ts e2e/28-kds.spec.ts e2e/40-kds-bar.spec.ts e2e/10-inventory.spec.ts` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (button.test, POSButton.test, ConfirmDialog.test, 44-focus-tab-order)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (unit/lint/typecheck loop)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-13
