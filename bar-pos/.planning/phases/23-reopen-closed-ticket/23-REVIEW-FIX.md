---
phase: 23-reopen-closed-ticket
fixed_at: 2026-07-21T06:20:00Z
review_path: .planning/phases/23-reopen-closed-ticket/23-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 23: Code Review Fix Report

**Fixed at:** 2026-07-21T06:20:00Z
**Source review:** .planning/phases/23-reopen-closed-ticket/23-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04 — `fix_scope: critical_warning`, IN-01 excluded)
- Fixed: 4
- Skipped: 1

## Fixed Issues

### CR-01: `reopen_tab`'s offsetting caja expense double-counts on a tab's second reopen

**Files modified:** `supabase/migrations/20260721000001_fix_reopen_tab_double_count.sql` (new), `src/features/reopen-tab/model/reopen-tab-rpc.integration.test.ts`
**Commit:** `1f685ba`
**Applied fix:** The buggy migration (`20260720000004_reopen_tab_rpc.sql`) had already been pushed to the remote Supabase project (ref `shsrhxleopmovzpzqmex`) in a prior wave of this phase, so editing it in place would not change the live database function. Wrote a NEW migration (`20260721000001_fix_reopen_tab_double_count.sql`) with `CREATE OR REPLACE FUNCTION reopen_tab(...)`, reproducing the entire existing function body verbatim except step 6/7, which now captures the voided total via `WITH newly_voided AS (UPDATE ... RETURNING amount) SELECT COALESCE(SUM(amount), 0) INTO v_voided_total FROM newly_voided` instead of re-summing `status = 'reopened_void'` across the whole tab (which double-counted amounts voided by a prior reopen of the same tab). Ran `npx supabase db push` to apply it to remote (confirmed applied). Function signature unchanged, so no `supabase.types.ts` regeneration needed. Added a new regression test (`CR-01: reopening the SAME tab a second time...`) to the integration suite that reopens a tab, repays it in full, reopens it again, and asserts the second reopen's `voidedPaymentTotal` and caja expense equal only the second payment's amount ($20), not the sum of both voided payments ($40). Ran the full integration suite (10 tests, including the new one) against the live pushed fix — all passed.

### WR-01: `tabs.reopen_count` / `tabs.last_reopened_at` are selected but never mapped into `Tab`

**Files modified:** `src/entities/tab/model/queries.ts`
**Commit:** `de23fe4`
**Applied fix:** Added `reopenCount`/`lastReopenedAt` to `mapTabRow`'s `TabSchema.parse(...)` call, conditionally spreading them in from the raw row (`row.reopen_count`/`row.last_reopened_at`, both already correctly typed by the generated `supabase.types.ts` — no unsafe cast needed, unlike the review's suggested snippet which cast defensively). Mirrors the existing `version` field's conditional-spread pattern in the same function.

### WR-03: `RefundButton` and `EditTicketButton` don't hide for `reopened_void` payments

**Files modified:** `src/widgets/PaymentPane/ui/PaymentPane.tsx`
**Commit:** `db0e74f`
**Applied fix:** Added `payment.status === 'reopened_void'` to both buttons' hide conditions, matching `ReopenTabButton`'s existing guard exactly as suggested in the review.

### WR-04: `ReopenTabDialog`'s Cancel/success/version-conflict paths bypass the local state-reset handler

**Files modified:** `src/features/reopen-tab/ui/ReopenTabDialog.tsx`
**Commit:** `e2156f7`
**Applied fix:** Routed all three raw `onOpenChange(false)` call sites (Cancel button onClick, the version-conflict branch, and the success branch inside `handleSubmitReopen`) through `handleOpenChange(false)` instead, so `reason`/`pinOpen` are reset on every close path of this persistently-mounted dialog.

## Skipped Issues

### WR-02: `entities/payment/model/types.ts` hand-duplicates `domain.ts`'s `PaymentSchema` instead of deriving from it

**File:** `src/entities/payment/model/types.ts:7-27` vs `src/shared/lib/domain.ts:615-646`
**Reason:** The review itself classifies this as non-blocking and explicitly recommends deferring it: *"Not blocking for this phase, but flagging... Consider consolidating... in a follow-up cleanup phase."* Verified the two schemas have diverged further than the review's excerpt shows — `domain.ts`'s `PaymentSchema` additionally has `discountScope`/`discountType`/`discountValue`/`discountAmount`, `paymentGroupId`, `splitIndex`, and a different `isRefund` default (`.default(false)` vs. entity's bare `.optional()`) — and `entities/payment/model/types.ts` also carries Storybook mock-data fixtures (`mockPayments`) shaped to its own schema. Consolidating now (importing/`.pick`/`.omit` from `domain.ts`) is a nontrivial cross-cutting refactor with a real risk of behavior change across every `entities/payment` consumer, well beyond the scope of this atomic review-fix pass. Deferred to a dedicated cleanup phase per the reviewer's own recommendation.
**Original issue:** `entities/payment/model/types.ts` defines its own independent `PaymentSchema` rather than reusing/extending `domain.ts`'s, violating the project's "single source of truth" type convention. This phase added `status: z.enum(['completed', 'reopened_void']).default('completed')` by hand to both copies in lockstep, which is why the review flagged it even though it's not itself a bug in this phase's diff.

---

_Fixed: 2026-07-21T06:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
