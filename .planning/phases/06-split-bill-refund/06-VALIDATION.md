---
phase: 6
slug: split-bill-refund
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 6 — Validation Strategy

> **MANDATORY AGENT GUARDRAIL — E2E runs and browser console**
>
> On **every** E2E test run (Playwright, CI, or agent retry loops), **tail or otherwise capture the browser console for that run** (project-standard: trace/console events, reporter output, headed DevTools, or equivalent) and **read it before concluding why a test failed or before re-running the same spec**. Failures are often explained only in the console (uncaught exceptions, failed network calls, React errors, hydration warnings). **Do not** repeatedly execute the same failing E2E in a tight loop without console evidence — that burns tokens and time while the real signal sits in logs the agent never opened. Treat “console captured and reviewed for this run” as **non-optional** and part of the same step as “test run completed.”

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + React Testing Library v16 + fast-check v4 + Playwright v1.59 |
| **Config file** | `bar-pos/vitest.config.ts` / `bar-pos/playwright.config.ts` |
| **Quick run command** | `cd bar-pos && npm run typecheck && npm run lint && npm run test` |
| **Full suite command** | `cd bar-pos && npm run test && npm run test:e2e` |
| **Estimated runtime** | ~60s unit/typecheck; ~5min E2E |

---

## Sampling Rate

- **After every task commit:** Run `cd bar-pos && npm run typecheck && npm run lint && npm run test`
- **After every plan wave:** Run `cd bar-pos && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green (`npm run test && npm run test:e2e`)
- **Max feedback latency:** ~60 seconds (unit + typecheck)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | migrations | 1 | S4-01 | ENUM 'split' added outside transaction | manual | `supabase db push` then inspect DB | ❌ Wave 0 | ⬜ pending |
| 06-01-02 | migrations | 1 | S4-02 | refunds/refund_items + is_refund constraint fixed | manual | inspect DB schema | ❌ Wave 0 | ⬜ pending |
| 06-01-03 | migrations | 1 | S4-03–06 | split RPCs transactional; ITEM_ASSIGNED_TWICE blocked | integration | `npx vitest run src/features/split-tab/` | ❌ Wave 0 | ⬜ pending |
| 06-01-04 | migrations | 1 | S4-07 | process_refund blocks REFUND_EXCEEDS_ORIGINAL; AUTH_FORBIDDEN | integration | `npx vitest run src/features/process-refund/` | ❌ Wave 0 | ⬜ pending |
| 06-01-05 | migrations | 1 | S4-14 | auto-close fires after last sub-tab; ignores refund rows | E2E | `npx playwright test e2e/34-split-bill.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 06-02-01 | types-zod | 1 | S4-08 | TabStatus includes 'split'; RefundSchema validates | unit | `npx vitest run src/shared/lib/domain.test.ts` | ✅ extend | ⬜ pending |
| 06-02-02 | types-zod | 1 | S4-08 | AppErrorCode includes 6 new Phase 6 codes | unit | `npx vitest run src/shared/lib/result.test.ts` | ✅ extend | ⬜ pending |
| 06-03-01 | entities | 2 | S4-09 | useSubTabs filters by parent_tab_id; useTabList excludes sub-tabs | unit | `npx vitest run src/entities/tab/` | ✅ extend | ⬜ pending |
| 06-03-02 | entities | 2 | S4-09 | useRefunds/useRefundsByPayment return correct data shapes | unit | `npx vitest run src/entities/refund/` | ❌ Wave 0 | ⬜ pending |
| 06-04-01 | shared-ui | 2 | S4-12 | SubTabColumn renders Empty/Selected/WithItems variants | Storybook | `npx storybook dev --ci` | ❌ Wave 0 | ⬜ pending |
| 06-04-02 | shared-ui | 2 | S4-12 | PersonCard renders with editable name + ring state | Storybook | `npx storybook dev --ci` | ❌ Wave 0 | ⬜ pending |
| 06-05-01 | split-tab | 3 | S4-10 | isValid per mode: Evenly N≥2; Item all assigned; ByPerson N≥2; ByAmount remaining≤1cent | unit | `npx vitest run src/features/split-tab/` | ❌ Wave 0 | ⬜ pending |
| 06-05-02 | split-tab | 3 | S4-15 | P8 conservation: sub-tab totals sum to parent ± 1 cent | property | `npx vitest run src/shared/lib/split-math.test.ts` | ❌ Wave 0 | ⬜ pending |
| 06-05-03 | split-tab | 3 | S4-15 | P9 rounding: N-way split payments sum exactly | property | same file | ❌ Wave 0 | ⬜ pending |
| 06-06-01 | process-refund | 3 | S4-11 | RefundSheet isValid: items≥1 + reason set + total>0 | unit | `npx vitest run src/features/process-refund/` | ❌ Wave 0 | ⬜ pending |
| 06-06-02 | process-refund | 3 | S4-15 | P10: refund amount ≤ original; restock produces inverse ledger | property | `npx vitest run src/features/process-refund/refund-math.test.ts` | ❌ Wave 0 | ⬜ pending |
| 06-07-01 | payments-page | 3 | S4-13 | Refund button hidden for is_refund/fully_refunded/non-paid rows | unit | `npx vitest run src/pages/payments/` | ✅ extend | ⬜ pending |
| 06-07-02 | payments-page | 3 | S4-13 | RefundsList DataTable renders columns with correct order | unit | same | ✅ extend | ⬜ pending |
| 06-08-01 | integration | 4 | S4-16 | Split by item: 10 items, 3 persons → 3 sub-tabs correct totals | integration | `npx vitest run src/features/split-tab/split-tab.integration.test.ts` | ❌ Wave 0 | ⬜ pending |
| 06-08-02 | integration | 4 | S4-17 | Refund 2 of 5 with restock → rows created; deplete stub safe | integration | `npx vitest run src/features/process-refund/process-refund.integration.test.ts` | ❌ Wave 0 | ⬜ pending |
| 06-09-01 | e2e-split | 5 | S4-18 | Full split bill E2E: evenly + by item + auto-close | E2E | `npx playwright test e2e/34-split-bill.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 06-09-02 | e2e-refund | 5 | S4-19 | Full refund E2E: select items, PIN, verify rows, block double-refund | E2E | `npx playwright test e2e/35-refund.spec.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `bar-pos/supabase/migrations/20260427000001_split_bill_schema.sql` — S4-01, S4-02 (schema + ENUM + CHECK fixes)
- [ ] `bar-pos/supabase/migrations/20260427000002_split_tab_rpcs.sql` — S4-03..S4-06 (4 split RPCs)
- [ ] `bar-pos/supabase/migrations/20260427000003_process_refund_rpc.sql` — S4-07 (process_refund)
- [ ] `bar-pos/supabase/migrations/20260427000004_parent_auto_close_trigger.sql` — S4-14 (trigger)
- [ ] `bar-pos/src/shared/lib/split-math.ts` — pure utility for split/rounding (P8, P9)
- [ ] `bar-pos/src/shared/lib/split-math.test.ts` — P8 + P9 property tests (fast-check)
- [ ] `bar-pos/src/features/process-refund/refund-math.test.ts` — P10 property test
- [ ] `bar-pos/src/entities/refund/model/queries.ts` — refundKeys + useRefunds + useRefundsByPayment
- [ ] `bar-pos/e2e/34-split-bill.spec.ts` — split bill E2E spec stub
- [ ] `bar-pos/e2e/35-refund.spec.ts` — refund E2E spec stub

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ENUM 'split' applied to live DB | S4-01 | `ALTER TYPE` non-transactional; cannot auto-verify in unit tests | After `supabase db push`: `SELECT enum_range(NULL::tab_status)` — confirm 'split' present |
| Sub-tabs visible in OrderPanel sub-checks section | S4-10 | Visual UX; no headless assertion | Open a tab in Tauri dev build → split by item → verify parent shows sub-checks panel |
| Manager PIN gate blocks bartender | S4-11 | RBAC integration; E2E PIN flow | Login as bartender → attempt refund → PIN modal appears and rejects bartender PIN |
| Combo children follow parent in split | S4-03 | Complex DB join; hard to unit-test reliably | Manual smoke: add Cubeta Regular (combo) to tab → split by item → verify combo children appear in correct sub-check |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
