---
phase: 22
slug: edit-paid-ticket-history
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 (unit/integration) + Playwright ^1.59.1 (E2E) |
| **Config file** | `bar-pos/vitest.config.ts` (unit), `bar-pos/playwright.config.ts` (E2E) — both pre-existing, no Wave 0 setup needed |
| **Quick run command** | `npx vitest run src/features/edit-paid-tab` (once created) |
| **Full suite command** | `npm run test` (unit), `npm run test:e2e` (E2E) |
| **Estimated runtime** | ~60s (unit), ~5-10min (E2E full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>`
- **After every plan wave:** Run `npm run typecheck && npm run lint && npm run test`
- **Before `/gsd-verify-work`:** Full suite green (`npm run test` + `npx playwright test e2e/47-edit-paid-tab.spec.ts`)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-XX | TBD | 0 | SC-1 | T-22-01 | `edit_paid_tab` RPC enforces whitelist + PIN/reason + version guard | integration (live Supabase) | `npx vitest run src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts` | ❌ W0 | ⬜ pending |
| 22-01-XX | TBD | 0 | SC-2 | T-22-01 | `audit_logs` row written with before/after diff on every edit | integration (same file as SC-1) | `npx vitest run src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts` | ❌ W0 | ⬜ pending |
| 22-02-XX | TBD | 1+ | SC-3 | T-22-02 | `EditPaidTabDialog` PIN gate → edit → reason → confirm flow | E2E | `npx playwright test e2e/47-edit-paid-tab.spec.ts` | ❌ W0 | ⬜ pending |
| 22-03-XX | TBD | 1+ | SC-4 | — | `/edit-history` lists edits, diff viewer opens per row | E2E | `npx playwright test e2e/47-edit-paid-tab.spec.ts` (same spec, extra block) or new `48-edit-history.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Task IDs finalized once the planner assigns actual plan/task numbers.*

---

## Wave 0 Requirements

- [ ] `src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts` — covers SC-1, SC-2. Mirror `process-refund-rpc.integration.test.ts`'s live-Supabase pattern: happy path, `STALE_VERSION`, `AUTH_FORBIDDEN`, whitelist-violation rejection.
- [ ] `e2e/47-edit-paid-tab.spec.ts` — covers SC-3, SC-4 (or split SC-4 into `e2e/48-edit-history.spec.ts`)
- Framework install: none — Vitest/Playwright already fully configured

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification per the test map above.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
