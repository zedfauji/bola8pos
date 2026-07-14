---
phase: 33
slug: payment-critical-page-sweep-isolated
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-13
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 (unit) + Playwright ^1.59.1 (E2E) |
| **Config file** | `bar-pos/vitest.config.ts` (unit), `bar-pos/playwright.config.ts` (E2E) |
| **Quick run command** | `npm run typecheck && npm run lint` |
| **Full suite command** | `npm run test` (unit); `npm run test:e2e` (E2E — requires `requireIntegrationEnv()` live Supabase creds) |
| **Estimated runtime** | ~30s (typecheck+lint) / ~120s (full E2E gate specs) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck && npm run lint`
- **After every plan wave (isolated PR per file):** Run that file's relevant gate spec(s) from the map below
- **Before `/gsd-verify-work`:** All 5 required gate specs green (`05-payments`, `41-split-payment`, `42-tip-distribution`, `06-transfer`, `09-rbac`)
- **Max feedback latency:** ~120s (single E2E spec run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 33-01-* | 01 | 1 | COMPONENT-04 | — | POS payment flow (cash/card, tender, discount, tip) unaffected by markup swap | E2E | `npx playwright test e2e/05-payments.spec.ts` | ✅ | ⬜ pending |
| 33-02-* | 02 | 1 | COMPONENT-04 | — | Split-payment (multi-method) add/remove/submit unaffected | E2E | `npx playwright test e2e/41-split-payment.spec.ts` | ✅ | ⬜ pending |
| 33-03-* | 03 | 1 | COMPONENT-04 | — | Tip-distribution config + close-caja computation unaffected | E2E | `npx playwright test e2e/42-tip-distribution.spec.ts` | ✅ | ⬜ pending |
| 33-04-* | 04 | 1 | COMPONENT-04 | — | Tab transfer flow (`TabDrawer` route context) unaffected | E2E | `npx playwright test e2e/06-transfer.spec.ts` | ✅ | ⬜ pending |
| 33-05-* | 05 | 1 | COMPONENT-04 | — | RBAC-gated void/refund/delete-tab flows unaffected (`VoidOrderDialog.tsx`, refund trigger) | E2E | `npx playwright test e2e/09-rbac.spec.ts` | ✅ | ⬜ pending |

*Secondary (non-gate, should stay green): `e2e/29-panel-toggle.spec.ts`, `e2e/35-refund.spec.ts`, `e2e/17-payment-pane.spec.ts`.*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files, no framework install — all 5 gate specs already exist and pass on `main`.

---

## Manual-Only Verifications

All phase behaviors have automated verification. **Caveat:** the 5 gate specs require `requireIntegrationEnv()` (live `.env.local` Supabase credentials). If unavailable in the execution sandbox, verification of that spec becomes a `checkpoint:human-verify` gate — consistent with how Phases 30 and 32 handled E2E verification when the dev server/live DB wasn't reachable from the agent's environment.

---

## Validation Sign-Off

- [x] All tasks have automated verify (E2E gate spec) or Wave 0 dependencies (none needed)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none missing)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
