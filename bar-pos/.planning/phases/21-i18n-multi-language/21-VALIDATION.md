---
phase: 21
slug: i18n-multi-language
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-17
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 (unit) + React Testing Library 16.3.2, Playwright 1.59.1 (E2E) |
| **Config file** | `vitest.config.ts` / `playwright.config.ts` (both pre-existing, no new config needed) |
| **Quick run command** | `npx vitest run <touched test file>` |
| **Full suite command** | `npm run test` (unit), `npm run test:e2e` / `npm run test:e2e:visual` (E2E, manual pre-release) |
| **Estimated runtime** | ~2 min (unit), ~10-15 min (E2E visual baseline) |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched test file>` + `npm run typecheck` + `npm run lint` on touched files
- **After every plan wave:** `npm run test` (full unit suite) + `npm run lint` (whole repo — this IS the SC-3/SC-4 enforcement gate)
- **Before `/gsd-verify-work`:** `npm run test:e2e:visual` (Phase 34's baseline, re-run not re-recorded) + new `e2e/4X-i18n-locale-switch.spec.ts` green
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-0X-0X | TBD | 0 | SC-1 | — | `i18next.init()` resolves with both `es-MX`/`en-US` resources loaded; `t()` returns translated string for a known key in each locale | unit | `npx vitest run src/app/i18n/index.test.ts` | ❌ Wave 0 | ⬜ pending |
| 21-0X-0X | TBD | 1 | SC-2 | T-21-01 | `mapStaffRow` maps `row.locale` → `Staff.locale`; `StaffSchema.parse()` defaults missing/null locale to `'es-MX'` | unit | `npx vitest run src/entities/staff/model/queries.test.ts` | ✅ (extend existing file) | ⬜ pending |
| 21-0X-0X | TBD | 1 | SC-2 | — | `i18n.changeLanguage()` fires with the correct locale on staff-store login hydrate | unit | `npx vitest run src/entities/staff/model/store.test.ts` | ✅ (extend existing file if present — confirm during planning) | ⬜ pending |
| 21-0X-0X | TBD | 2 | SC-3 | — | `no-literal-string`-style ESLint rule fires on a deliberately-introduced hardcoded string fixture, does NOT fire on a `t()`-wrapped string | unit (ESLint RuleTester) | `npm run lint` (max-warnings 0 — the CI gate itself IS the test) | N/A — CI gate is the test | ⬜ pending |
| 21-0X-0X | TBD | 3+ | SC-4 | — | Full `npm run lint` passes with zero i18n literal-string violations after big-bang migration (D-04) | integration (whole-repo) | `npm run lint` | N/A — CI gate is the test | ⬜ pending |
| 21-0X-0X | TBD | 3+ | SC-4 | — | Existing `e2e/visual/45-visual-baseline.spec.ts` (Phase 34) re-run post-migration shows no diffs for `es-MX` (default) locale | E2E (existing suite) | `npm run test:e2e:visual` | ✅ (Phase 34 baseline exists — regression gate, do not rebaseline unless a deliberate visual change is confirmed) | ⬜ pending |
| 21-0X-0X | TBD | 3+ | SC-4 | — | At least one E2E spec exercises `en-US` end-to-end (switch locale → observe translated string on a real page) | E2E | new `e2e/4X-i18n-locale-switch.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 21-0X-0X | TBD | 1 | V4 (RBAC) | T-21-02 | Admin-sets-another-staff-member's-locale write path is gated behind `manage_staff` RBAC action server-side, not client-UI-only | unit/integration | `npx vitest run` on the mutation hook + RPC guard test | ❌ Wave 0/1 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are placeholders (`21-0X-0X`) — the planner fills in concrete plan/task IDs once PLAN.md files exist; this table's requirement/behavior/command mapping is authoritative and must be carried into the plans' `must_haves`.*

---

## Wave 0 Requirements

- [ ] `src/app/i18n/index.test.ts` — stubs covering SC-1 (i18next init resolves, both locales load)
- [ ] `e2e/4X-i18n-locale-switch.spec.ts` — stub covering SC-4 (en-US end-to-end smoke)
- [ ] RBAC guard test stub for admin-sets-another-staff-locale write path (V4)
- [ ] Framework install: none — Vitest/Playwright/RTL already fully configured in this repo

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Printed receipt (Tauri/Rust) renders in the acting staff member's locale | SC-4 / D-06 | Physical/virtual printer output not exercised by Vitest/Playwright; Rust-side `printer.rs` has no existing automated test harness | Log in as an `en-US` staff member, close a tab, confirm the printed receipt lines are English; repeat for `es-MX` |
| Generated PDF reports follow the acting staff member's locale | SC-4 / D-06 | Report PDF builders produce binary output, not asserted by unit tests today | Export a report as an `en-US` staff member vs an `es-MX` staff member, visually diff header/labels |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (i18n init test, locale-switch E2E, RBAC guard test)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
