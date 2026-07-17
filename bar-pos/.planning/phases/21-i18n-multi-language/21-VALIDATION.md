---
phase: 21
slug: i18n-multi-language
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-17
updated: 2026-07-17
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
| 21-01-03 | 21-01 | 1 | SC-1 | — | `i18next.init()` resolves with both `es-MX`/`en-US` resources loaded; `t()` returns translated string for a known key in each locale | unit | `npx vitest run src/shared/lib/i18n/index.test.ts` | ❌ created Wave 1 (21-01) | ⬜ pending |
| 21-02-02 | 21-02 | 2 | SC-2 | T-21-01 | `mapStaffRow` maps `row.locale` → `Staff.locale`; `StaffSchema.parse()` defaults missing/null locale to `'es-MX'` | unit | `npx vitest run src/entities/staff/model/queries.test.ts` | ✅ (extend existing file) | ⬜ pending |
| 21-02-03 | 21-02 | 2 | SC-2 | — | `i18n.changeLanguage()` fires with the correct locale on staff-store login + rehydrate | unit | `npx vitest run src/entities/staff/model/queries.test.ts` | ✅ (extend; store.test.ts if store has no test file) | ⬜ pending |
| 21-12-03 | 21-12 | 5 | SC-3 | — | `i18next/no-literal-string` ESLint rule fires on a deliberately-introduced hardcoded string fixture, does NOT fire on a `t()`-wrapped string | unit (rule smoke) | `npm run lint` (max-warnings 0 — the CI gate itself IS the test; 21-12 Task 3 runs the fail-then-pass smoke) | N/A — CI gate is the test | ⬜ pending |
| 21-12-02 | 21-12 | 5 | SC-4 | — | Full `npm run lint` passes with zero i18n literal-string violations after big-bang migration (D-04) | integration (whole-repo) | `npm run lint` | N/A — CI gate is the test | ⬜ pending |
| 21-13-02 | 21-13 | 6 | SC-4 | — | Existing `e2e/visual/45-visual-baseline.spec.ts` (Phase 34) re-run post-migration shows no diffs for `es-MX` (default) locale | E2E (existing suite) | `npm run test:e2e:visual` | ✅ (Phase 34 baseline exists — regression gate, do not rebaseline unless a deliberate visual change is confirmed) | ⬜ pending |
| 21-13-01 | 21-13 | 6 | SC-4 | — | At least one E2E spec exercises `en-US` end-to-end (switch locale → observe translated string on a real page) | E2E | `npx playwright test e2e/46-i18n-locale-switch.spec.ts` | ❌ created Wave 6 (21-13) | ⬜ pending |
| 21-02-04 | 21-02 | 2 | V4 (RBAC) | T-21-02 | Bartender (non-manage_staff) CANNOT write another staff's `profiles.locale` (RLS-filtered 0-row on the admin direct-UPDATE path), and CAN set only their OWN locale via the `set_own_locale` SECURITY DEFINER RPC (role unchanged) — server-side, not client-UI-only | integration (live Supabase, anon bartender session) | `npm run test:integration -- src/entities/staff/model/locale-rls.integration.test.ts` | ❌ created Wave 2 (21-02 Task 4) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs now map to concrete plan/task IDs. The V4/T-21-02 RBAC guard (21-02 Task 4) closes the previously-silent Wave-0 gap: it proves both the admin-path RLS rejection AND the self-path RPC scoping against live Supabase.*

---

## Wave 0 Requirements

- [x] `src/shared/lib/i18n/index.test.ts` — SC-1 (i18next init resolves, both locales load) — created by **21-01 Task 3** (singleton lives in `shared/lib`, not `app`, for FSD reasons)
- [x] `e2e/46-i18n-locale-switch.spec.ts` — SC-4 (en-US end-to-end smoke) — created by **21-13 Task 1**
- [x] RBAC guard test for admin-sets-another-staff-locale write path (V4/T-21-02) — created by **21-02 Task 4** (`src/entities/staff/model/locale-rls.integration.test.ts`, live-Supabase bartender-session test proving cross-user write rejected + self-write via `set_own_locale` accepted with role unchanged)
- [x] Framework install: none — Vitest/Playwright/RTL already fully configured in this repo

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Printed receipt (Tauri/Rust) renders in the acting staff member's locale | SC-4 / D-06 | Physical/virtual printer output not exercised by Vitest/Playwright; Rust-side `printer.rs` has no existing automated test harness | Log in as an `en-US` staff member, close a tab, confirm the printed receipt lines are English; repeat for `es-MX` |
| Generated PDF reports follow the acting staff member's locale | SC-4 / D-06 | Report PDF builders produce binary output, not asserted by unit tests today | Export a report as an `en-US` staff member vs an `es-MX` staff member, visually diff header/labels |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (i18n init test → 21-01-03; locale-switch E2E → 21-13-01; RBAC guard test → 21-02-04)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner, 2026-07-17) — the previously-silent V4/T-21-02 RBAC guard gap is closed by 21-02 Task 4, which also surfaced and fixed a latent runtime bug: the manage_staff-only `profiles_update_admin` RLS would have blocked bartender self-service, so the self-path now routes through a new `set_own_locale` SECURITY DEFINER RPC (mirroring `clear_must_change_pin`).
