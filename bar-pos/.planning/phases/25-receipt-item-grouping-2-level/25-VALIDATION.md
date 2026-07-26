---
phase: 25
slug: receipt-item-grouping-2-level
status: planned
nyquist_compliant: true
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

> No REQUIREMENTS.md exists for this milestone; requirement IDs below are the SC-N success criteria from 25-CONTEXT.md/ROADMAP.md. Task ID / Plan / Wave columns filled in from the four PLAN.md files created 2026-07-26.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-T1 | 25-01 | 1 | SC-1 — `groupByCategory` groups items into category buckets, sorted, with an "uncategorized" trailing bucket | T-25-01 | Category/modifier names stripped of C0/C1 control chars before reaching `printer.rs` byte stream | unit | `npx vitest run src/shared/lib/groupOrderItemsForReceipt.test.ts` | ❌ W0 → created by 25-01-T1 | ⬜ pending |
| 25-01-T1 | 25-01 | 1 | SC-2 (thermal) — `buildThermalReceiptText` consumes `groupByCategory` + `formatModifierLines` | T-25-02 | Headers go through `centerLine()` — 32-byte truncation on a char boundary | unit | `npx vitest run src/shared/lib/receipt-format.test.ts` | ✅ exists, extend | ⬜ pending |
| 25-01-T2 | 25-01 | 1 | SC-2 (pre-cheque) — `buildPreChequeText` consumes the same helpers; no inline modifier loop remains | — | N/A | unit + source assertion | `npx vitest run src/shared/lib/receipt-format.test.ts` | ✅ exists | ⬜ pending |
| 25-01-T3 | 25-01 | 1 | SC-3 — Single-level receipts (all items same/no category) still render correctly | — | N/A | unit (property-based, fast-check) | `npx vitest run src/shared/lib/groupOrderItemsForReceipt.test.ts` | ❌ W0 → created by 25-01-T1 | ⬜ pending |
| 25-02-T1 | 25-02 | 2 | SC-2b — `process-payment` Edge Function returns `categoryId`/`categoryName`/`modifierNames` per receipt item | T-25-04, T-25-06, T-25-07 | Scope inherited from the existing `tab_id` filter; parameterized `.eq()`/`.in()` only; one batched modifier query | source assertion (no Deno harness exists) | grep gate printing `EDGE_FN_FIELDS_OK` | ❌ W0 — manual-only, documented below | ⬜ pending |
| 25-02-T2 | 25-02 | 2 | SC-2b — live confirmation | — | N/A | integration (manual, blocking checkpoint) | manual invocation via `supabase functions serve` / deployed function | ❌ no harness | ⬜ pending |
| 25-03-T1 | 25-03 | 2 | SC-2 (KDS) — `KdsCard` consumes `formatModifierLines`, no `groupByCategory` (D-04) | T-25-08 | React text children only, never `dangerouslySetInnerHTML` | unit (RTL) | `npx vitest run src/widgets/KdsBoard/KdsCard.test.tsx` | ❌ W0 → created by 25-03-T1 (confirmed: no KdsBoard test file exists) | ⬜ pending |
| 25-04-T1 | 25-04 | 2 | SC-2 (PDF, data) — `get_caja_report` returns `categoryId`/`categoryName` and camelCase keys | T-25-10, T-25-11 | Typed `p_caja_id UUID` arg, no `EXECUTE format(...)`, single `CREATE OR REPLACE` | source assertion | grep gate printing `MIGRATION_BODY_OK` | ❌ W0 → created by 25-04-T1 | ⬜ pending |
| 25-04-T2 | 25-04 | 2 | SC-2 (PDF, applied) — migration applied, not just written | T-25-13 | Applied-state assertion; build/typecheck/test pass without the push and would report a false green | CLI assertion + human-check | `supabase migration list \| grep 20260726000001` | n/a | ⬜ pending |
| 25-04-T3 | 25-04 | 2 | SC-2 (PDF, render) — `pdf.tsx` consumes `groupByCategory`; renderer smoke test | T-25-12 | N/A | unit (renderer mocked — smoke only) | `npx vitest run src/shared/lib/exporters/pdf.test.ts` | ✅ exists, extend | ⬜ pending |
| 25-04-T4 | 25-04 | 2 | SC-4 — Print/PDF/KDS outputs consistent for the same order data | — | N/A | manual/UAT (blocking checkpoint) | `npm run test` for the unit floor; cross-surface check is manual | Partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/shared/lib/groupOrderItemsForReceipt.test.ts` — new file, covers SC-1/SC-3, follow `category-tree.test.ts`'s fast-check property pattern. **Assigned: 25-01 Task 1 (scaffold) + Task 3 (properties), Wave 1.**
- [ ] Manual verification path for the `process-payment` Edge Function change (SC-2b) — no existing Deno/integration test harness for this function. **Assigned: 25-02 Task 1 (grep source gate) + Task 2 (blocking human-verify checkpoint), Wave 2.** Building a Deno harness is out of proportion for this phase's size.
- [x] Confirm whether `src/widgets/KdsBoard/index.test.tsx` (or similar) exists — **confirmed during planning: `src/widgets/KdsBoard/` contains only `index.tsx`, no test file.** New file `src/widgets/KdsBoard/KdsCard.test.tsx` assigned to 25-03 Task 1, Wave 2.
- [ ] `src/shared/lib/exporters/pdf.test.ts` fully mocks `@react-pdf/renderer`, so it cannot assert rendered structure — PDF grouping correctness is covered indirectly by `groupOrderItemsForReceipt.test.ts` plus the 25-04 Task 4 cross-surface checkpoint. Recorded as a known coverage ceiling, not a gap to close in this phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Edge Function returns `categoryId`/`categoryName`/`modifierNames` per receipt item | SC-2b | No Deno/integration test harness for `process-payment` exists in-repo | Invoke `process-payment` against local Supabase (`supabase functions serve`) and inspect the returned `ReceiptData` payload for category/modifier fields |
| Print/PDF/KDS outputs consistent for the same order data | SC-4 | Cross-surface consistency across 3 render paths (thermal, PDF, KDS) is best confirmed against one real order, not fully unit-testable | Create one order with 2+ categories and modifiers; compare thermal receipt, PDF export, and KDS card output for the same order |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < N/A (see Sampling Rate)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** plan-time — task map bound to 25-01..25-04 on 2026-07-26
