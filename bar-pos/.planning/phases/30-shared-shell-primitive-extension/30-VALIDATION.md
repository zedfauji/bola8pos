---
phase: 30
slug: shared-shell-primitive-extension
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-10
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library v16 (unit); Playwright v1.59 (E2E) |
| **Config file** | `bar-pos/vitest.config.ts`; `bar-pos/playwright.config.ts` |
| **Quick run command** | `npx vitest run src/pages/payments/PaymentsPage.test.tsx src/pages/reports/ReportsPage.test.tsx` |
| **Full suite command** | `npm run test` (unit); `npm run test:e2e` (E2E, requires dev server + `.env.local` creds) |
| **Estimated runtime** | ~15s quick / ~2min full unit / ~5min targeted E2E |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck && npm run lint`
- **After every plan wave:** Run `npm run test` (full unit suite) plus targeted `npx playwright test e2e/15-home-navigation.spec.ts e2e/16-table-status.spec.ts e2e/17-payment-pane.spec.ts`
- **Before `/gsd-verify-work`:** Full suite must be green (unit + targeted E2E; full `npm run test:e2e` recommended before release)
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 0 | SHELL-01 | — | N/A | unit | `npx vitest run src/shared/ui/PageContainer.test.tsx` | ❌ W0 | ⬜ pending |
| 30-0X-0X | TBD | 1+ | SHELL-01 | — | Back-link accessible name/href preserved | unit + e2e | `npx vitest run src/pages/payments/PaymentsPage.test.tsx`; `npx playwright test e2e/15-home-navigation.spec.ts e2e/16-table-status.spec.ts e2e/17-payment-pane.spec.ts` | ✅ | ⬜ pending |
| 30-0X-0X | TBD | 1+ | SHELL-02 | — | No dangling imports of deleted `AppShell`/`AppNav` | build/typecheck | `npm run typecheck && npm run lint` | ✅ | ⬜ pending |
| 30-0X-0X | TBD | 1+ | SHELL-03 | — | `CLAUDE.md` routes table matches `router.tsx`'s 17 routes | manual/scripted diff | Wave 0 scratch script replicating `crossCheckRoutes()` regex, or manual diff | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/ui/PageContainer.test.tsx` — new file; cover: (a) no `backTo` → no back-link rendered, (b) `backTo` present + no `backLabel` → renders "Home" text, href matches `backTo`, (c) `backTo` + custom `backLabel` → renders exact custom text
- [ ] SHELL-03 route-diff check — either a small one-off scratch script replicating `scripts/audit-ui-drift.ts`'s `crossCheckRoutes()` regex (do NOT run that script directly — it overwrites Phase 29's `DRIFT-AUDIT.md`), or a manual diff of `router.tsx` routes vs `CLAUDE.md`'s table since this is a one-time doc fix

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification (unit, E2E, or typecheck/lint).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (PageContainer test file, SHELL-03 diff check)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-10
