---
phase: 18
slug: split-payment-multi-method
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library v16 (unit); Playwright v1.59 (E2E) |
| **Config file** | `bar-pos/vitest.config.ts`; `bar-pos/playwright.config.ts` |
| **Quick run command** | `npx vitest run src/widgets/PaymentModal/ui/PaymentForm.test.tsx src/shared/lib/payment-processor.test.ts` |
| **Full suite command** | `npm run test` (unit); `npm run test:e2e` (Playwright, manual pre-release) |
| **Estimated runtime** | ~10s (quick) / full suite per STATE.md baseline |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/widgets/PaymentModal/ui/PaymentForm.test.tsx src/shared/lib/payment-processor.test.ts`
- **After every plan wave:** Run `npm run test` (full unit suite)
- **Before `/gsd-verify-work`:** Full suite green + `npx playwright test e2e/05-payments.spec.ts e2e/17-payment-pane.spec.ts e2e/23-payment-edge-cases.spec.ts e2e/34-split-bill.spec.ts`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-XX | TBD | 0 | SC-1 | — | `payment_group_id`/`split_index` columns exist with correct types/constraints | integration (live Supabase) | New `src/entities/payment/model/*.integration.test.ts` querying `information_schema.columns` | ❌ W0 | ⬜ pending |
| 18-02-XX | TBD | 1 | SC-2 | T-18-01 (idempotency collision), T-18-02 (split total tampering), T-18-03 (partial-charge state) | RPC accepts 1-4 legs, rejects 5, rejects sum≠total, atomic all-or-nothing | unit + integration | `npx vitest run src/shared/lib/payment-processor.test.ts`; new integration test calling `process_split_payment_atomic` directly | ❌ W0 | ⬜ pending |
| 18-03-XX | TBD | 1-2 | SC-3 | — | Split-mode toggle, add/remove row, live remaining-balance, per-row validation | unit (RTL) | `npx vitest run src/widgets/PaymentModal/ui/PaymentForm.test.tsx` | ❌ W0 | ⬜ pending |
| 18-04-XX | TBD | 2 | SC-4 | — | Single-method close unchanged (regression) | unit + E2E | `npx vitest run src/widgets/PaymentModal/ui/PaymentForm.test.tsx`; `npx playwright test e2e/05-payments.spec.ts e2e/17-payment-pane.spec.ts e2e/23-payment-edge-cases.spec.ts` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact Task IDs finalized by planner — map above is req-level, refined once PLAN.md tasks exist.*

---

## Wave 0 Requirements

- [ ] New `describe('PaymentForm — split mode')` block in existing `src/widgets/PaymentModal/ui/PaymentForm.test.tsx` — covers SC-3
- [ ] New integration test file for `process_split_payment_atomic` (live Supabase) following `src/features/split-tab/model/*.integration.test.ts` conventions — covers SC-1, SC-2
- [ ] New unit tests in `src/shared/lib/payment-processor.test.ts` for `processSplitPayment()` — covers SC-2
- [ ] New E2E spec `e2e/4X-split-payment.spec.ts` (next available number after `40-kds-bar`) — covers SC-2, SC-3, D-08, D-09 end-to-end

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification per the map above.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
