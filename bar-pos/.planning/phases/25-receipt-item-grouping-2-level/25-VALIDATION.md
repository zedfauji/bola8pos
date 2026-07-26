---
phase: 25
slug: receipt-item-grouping-2-level
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-26
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4.1.4 (unit), Playwright v1.59 (e2e) |
| **Config file** | `vitest.config.ts` (project: `unit`); `playwright.config.ts` |
| **Quick run command** | `npx vitest run src/shared/lib/groupOrderItemsForReceipt.test.ts` |
| **Full suite command** | `npm run test` (unit); `npm run test:e2e` (manual, pre-release) |
| **Estimated runtime** | Not separately measured for this phase — bounded by the existing `npm run test` unit-suite baseline |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>`
- **After every plan wave:** Run `npm run test` (full unit suite) + `npm run typecheck` + `npm run lint`
- **Before `/gsd-verify-work`:** Full unit suite green, plus a manual verification pass against a real Supabase Edge Function invocation (no automated integration harness exists for `process-payment` today)
- **Max feedback latency:** Not specified — bounded by `npm run test` CI run time

---

## Per-Task Verification Map

> No REQUIREMENTS.md exists for this milestone; requirement IDs below are the SC-N success criteria from 25-CONTEXT.md/ROADMAP.md. Task ID / Plan / Wave columns are TBD — assigned once the planner creates PLAN.md files.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SC-1 — `groupOrderItemsForReceipt`/category-grouping groups items into category buckets, sorted, with an "uncategorized" trailing bucket | — | N/A | unit | `npx vitest run src/shared/lib/groupOrderItemsForReceipt.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-2 — `receipt-format.ts`, KDS card, PDF export all consume shared modifier/grouping helpers (no duplicated logic) | — | N/A | unit + manual code read | `npx vitest run src/shared/lib/receipt-format.test.ts` | ✅ exists, extend | ⬜ pending |
| TBD | TBD | TBD | SC-2b — `process-payment` Edge Function returns `categoryId`/`categoryName`/`modifierNames` per receipt item | — | N/A | integration (manual) | manual verification against local Supabase / `supabase functions serve` | ❌ W0 — no Deno test harness | ⬜ pending |
| TBD | TBD | TBD | SC-3 — Single-level receipts (all items same/no category) still render correctly | — | N/A | unit (property-based, fast-check) | `npx vitest run src/shared/lib/groupOrderItemsForReceipt.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-4 — Print/PDF/KDS outputs consistent for the same order data | — | N/A | unit (shared fixture) + manual/UAT | `npm run test` | Partial — check `src/widgets/KdsBoard/*.test.tsx` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/lib/groupOrderItemsForReceipt.test.ts` — new file, covers SC-1/SC-3, follow `category-tree.test.ts`'s fast-check property pattern
- [ ] Manual verification path for the `process-payment` Edge Function change (SC-2b) — no existing Deno/integration test harness for this function; confirm via local Supabase invocation or a UAT step
- [ ] Confirm whether `src/widgets/KdsBoard/index.test.tsx` (or similar) exists before assuming KDS modifier-format changes are covered

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Edge Function returns `categoryId`/`categoryName`/`modifierNames` per receipt item | SC-2b | No Deno/integration test harness for `process-payment` exists in-repo | Invoke `process-payment` against local Supabase (`supabase functions serve`) and inspect the returned `ReceiptData` payload for category/modifier fields |
| Print/PDF/KDS outputs consistent for the same order data | SC-4 | Cross-surface consistency across 3 render paths (thermal, PDF, KDS) is best confirmed against one real order, not fully unit-testable | Create one order with 2+ categories and modifiers; compare thermal receipt, PDF export, and KDS card output for the same order |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < N/A (see Sampling Rate)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
