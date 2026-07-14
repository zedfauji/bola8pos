---
phase: 33-payment-critical-page-sweep-isolated
verified: 2026-07-13T18:35:00Z
status: gaps_found
score: 6/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "05-payments, 41-split-payment, 42-tip-distribution, 06-transfer, and 09-rbac E2E specs pass unchanged after every payment-surface commit (ROADMAP Success Criterion 3)"
    status: partial
    reason: "3 of 5 required gate specs are fully green in isolated runs (05-payments 8/8, 41-split-payment 3/3, 42-tip-distribution 1/1). The other 2 have reproducible failures: 06-transfer.spec.ts (2 of 5 tests fail, reproduced identically in two independent isolated runs) and 09-rbac.spec.ts (3 of 28 tests fail, reproduced identically to 33-05's and 33-08's own SUMMARY findings). Every failing test's root cause traces to code that predates Phase 33 and was never touched by any of the phase's 7 commits (confirmed via git diff --stat and per-file git log)."
    artifacts:
      - path: "e2e/06-transfer.spec.ts"
        issue: "T4 ('transfer tab to already-occupied table') fails with a Playwright strict-mode violation: getByText(/tab opened/i) resolves to 2 stacked toasts ('Tab opened for Transfer Conflict A' and '...B') instead of 1, because the first toast has not auto-dismissed before the second tab-creation toast fires. T5 ('transfer tab with pool session') then fails with 'Target page, context or browser has been closed' — cascading from the same run. Root cause is in the sonner Toaster (src/app/App.tsx, untouched) and the open-tab/transfer-tab flow (not among Phase 33's 7 files); reproduced in 2 separate isolated `npx playwright test e2e/06-transfer.spec.ts` runs with identical errors."
      - path: "e2e/09-rbac.spec.ts"
        issue: "T7 ('admin deletes a tab') fails on an ambiguous getByRole('button', {name: /delete tab/i}) match — a sibling 'Split tab {name}' button's aria-label incidentally contains the substring 'Delete Tab' when the seeded tab is named 'RBAC Delete Tab'. Root cause is in src/widgets/OrderPanel/ActiveTabSelector.tsx / OrderPanel.tsx (last touched at the initial commit, never in Phase 33's scope). T-RP-01/T-RP-02 fail because the live role_permissions action set has grown (88 expected vs 96 actual switches; an ambiguous 'view_kds'/'view_kds_bar' switch-name match) — root cause is src/widgets/RBACDashboard/PermissionMatrix.tsx (last touched Phase 13, never in Phase 33's scope) plus RBAC seed drift from later features."
    missing:
      - "None of the fixes required to make these 2 specs fully green touch any of Phase 33's 7 in-scope files — this is pre-existing test/seed drift, not a gap in this phase's own deliverable. Flagged per the escalation-gate pattern for a human decision: either (a) accept an override for this must-have given the evidence below, or (b) route the ActiveTabSelector/OrderPanel aria-label collision, the PermissionMatrix switch-count drift, and the toast-stacking timing issue in 06-transfer to a follow-up bug-fix task (none of Phase 34/35's roadmap goals cover this)."
human_verification:
  - test: "Visual spot-check the 7 standardized surfaces (Process Payment / Refund confirm / Void confirm / Confirm Split render at 72px with a visibly thicker ring-4 focus ring; the POS panel toggle and Clear Cart/Reset-to-computed links keep their transparent/underlined look with no solid-primary fill; the TabPaymentCard renders left-aligned/full-width/bordered exactly as before)."
    expected: "All listed visual properties match the pre-phase appearance except the documented touch-size/focus-ring upgrades — no unintended color/layout regression."
    why_human: "Pixel-level visual parity (especially TabPaymentCard's CVA-override className rework) cannot be confirmed by grep/typecheck; this is the one PLAN (33-04) whose own threat model flags it as the highest visual-risk file in the phase."
---

# Phase 33: Payment-Critical Page Sweep (Isolated) Verification Report

**Phase Goal:** Standardize POS, payments, split-payment, refund, and tip-distribution surfaces to the shell/token/component/touch/focus conventions established in Phases 30-32 — markup/class-level swaps only, zero prop/handler/validation behavior change, one page/widget per PR, verified against the existing E2E suite.
**Verified:** 2026-07-13T18:35:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Zero prop/handler/validation behavior change across all 7 swapped surfaces (ROADMAP SC1 / COMPONENT-04) | ✓ VERIFIED | Direct source read of all 7 files confirms every diff is a `className`/prop-only change (raw `<button>`/shadcn `Button` → `POSButton`, `touchSize`/`focusEmphasis`/`confirmClassName` additions). Every `onClick`, `disabled`, `aria-label`, `aria-pressed`, `data-testid` cited in each plan's must_haves is byte-identical in the current file. `npm run typecheck` shows only the 2 documented pre-existing errors (`tab/model/queries.ts`, `agent/rag.ts`) — 0 new. `npm run lint` exits 0. `PaymentForm.test.tsx` + `PaymentPane.test.tsx` + `VoidOrderDialog.test.tsx` — 39/39 pass. |
| 2 | Each payment-critical surface lands as its own isolated commit/PR (ROADMAP SC2) | ✓ VERIFIED | `git show --stat` on all 7 commits (`3af2694`, `ed99bfd`, `46f1ae1`, `1ea478c`, `88b928f`, `9a647d4`, `1837e9c`) confirms each touches exactly one `src/` file. `git diff --stat` from the pre-phase commit (`c299049`) to `HEAD` shows exactly 7 files changed, matching the declared scope 1:1 — no D-01a out-of-scope file (`TabDrawer/`, `TipDistributionPanel/`, `TipDistributionSettingsTab.tsx`) appears in the diff. |
| 3 | 05-payments, 41-split-payment, 42-tip-distribution, 06-transfer, 09-rbac E2E specs pass unchanged (ROADMAP SC3) | ✗ FAILED (partial) | Independently re-run live against Supabase: `05-payments` 8/8 pass; `41-split-payment` 3/3 pass (T1+T3 in-batch, T2 confirmed in isolation); `42-tip-distribution` 1/1 pass in isolation (fails only when run concurrently with another spec batch — confirmed live-Supabase test-data collision, not a code issue). `06-transfer` 3/5 pass — T4/T5 fail, reproduced identically in 2 separate isolated runs, root-caused to `src/app/App.tsx` (Toaster) + open-tab/transfer-tab flow, none of which are in the 7-file scope. `09-rbac` 23/28 pass — T7/T-RP-01/T-RP-02 fail, root-caused to `src/widgets/OrderPanel/ActiveTabSelector.tsx`/`OrderPanel.tsx` (aria-label collision) and `src/widgets/RBACDashboard/PermissionMatrix.tsx` (seed/action-count drift) — both last modified in Phase 13/initial-commit, years before Phase 33, confirmed absent from the phase's `git diff --stat`. |
| 4 | Requirement COMPONENT-04 fully satisfied | ✓ VERIFIED (with the SC3 caveat above) | Behavior-preservation half of COMPONENT-04 is proven at the code level (Truth 1); the "verified by existing E2E specs passing unchanged" half is the same gap as Truth 3. |

**Score:** 6/8 must-haves verified (per-plan must_haves below all VERIFIED; the roadmap-level SC3 truth is the outstanding gap)

### Required Artifacts (all 7 in-scope files)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/pages/pos/index.tsx` | Panel toggle → `POSButton variant="ghost" touchSize="default"`, `w-11` width fix, testid/aria/onClick verbatim | ✓ VERIFIED | Confirmed via direct read: line 57 `<POSButton ... data-testid="pos-order-panel-toggle" ... className="... flex w-11 items-center ...">`; `Close Tab / Pay` button (line 87) untouched. |
| `src/widgets/OrderPanel/CartPanel.tsx` | Clear Cart → `POSButton variant="ghost" touchSize="default"`; Place Order untouched | ✓ VERIFIED | Confirmed via direct read: Clear Cart at line 185 is `POSButton`; Place Order (line 171) unchanged, no `focusEmphasis` added. |
| `src/widgets/PaymentModal/ui/PaymentForm.tsx` | Process Payment `focusEmphasis="high"`; Remove payment N `touchSize="xl" focusEmphasis="high"`; Reset-to-computed → `POSButton` | ✓ VERIFIED | Confirmed at lines 724-726 (Remove payment N), 1006-1007 (Process Payment), 959-960 (Reset-to-computed, `data-testid="card-override-reset"` intact). |
| `src/widgets/PaymentPane/ui/TabPaymentCard.tsx` | Root → `POSButton variant="ghost" touchSize="large"` with visual-parity overrides | ✓ VERIFIED | Confirmed full-file read: `flex-col items-stretch justify-start`, `border-border`, hand-rolled `focus-visible:ring-2` removed, `aria-label`/`aria-pressed`/`onClick` verbatim. |
| `src/features/process-refund/ui/RefundSheet.tsx` | Both footer buttons → `POSButton` (Close refund=outline/large, Request approval=xl/high), dead `min-h-[56px]` removed | ✓ VERIFIED | Confirmed: import no longer includes `Button`; both buttons present with exact props; `disabled`/`onClick` unchanged. |
| `src/features/split-tab/ui/SplitTabSheet.tsx` | Confirm Split + Remove check → xl/high (Remove check `w-[72px]` square); Add check/Add person → `POSButton large` | ✓ VERIFIED | Confirmed: `size="icon-sm"` fully removed at Remove check site, `className="w-[72px]"` present; Add check/Add person converted; Evenly picker/Keep tab open/sm Add-check left untouched (plain `Button` import still present for those). |
| `src/features/void-order/ui/VoidOrderDialog.tsx` | `confirmClassName` verbatim literal matching `StopSessionConfirm`/`StopAndMoveDialog` | ✓ VERIFIED | Literal `"min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring"` matches character-for-character across all 3 files. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| pos/index.tsx panel toggle | `setOrderPanelCollapsed` | onClick (unchanged) | ✓ WIRED | Verified byte-identical onClick body. |
| CartPanel Clear Cart | `clearCart()` | onClick (unchanged) | ✓ WIRED | Verified byte-identical. |
| PaymentForm Remove payment N | `dispatchSplitRows({type:'REMOVE_ROW'})` | onClick (unchanged) | ✓ WIRED | Verified; matches `41-split-payment.spec.ts` T3's exact aria-label pattern, T3 passes. |
| PaymentForm Process Payment | `handlePrimary`/split submit | onClick + disabled expr (unchanged) | ✓ WIRED | Verified byte-identical `disabled={isProcessing || (isSplitMode ? !canSubmitSplit : !canSubmit)}`. |
| TabPaymentCard root | `onClick` prop | passthrough (unchanged) | ✓ WIRED | Verified; `17-payment-pane`/`05-payments` batch (from 33-04's own run) exercised this end-to-end. |
| RefundSheet Request approval | `setPinOpen(true)` | onClick (unchanged) | ✓ WIRED | Verified; `T-RP-05` (rbac refund-blocked-for-bartender) passes, confirming the accessible name still resolves. |
| SplitTabSheet Confirm Split | `handleConfirm` | onClick (unchanged) | ✓ WIRED | Verified byte-identical `disabled={!isValid || isMutating}`. |
| SplitTabSheet Remove check | `removeAmountRow` | onClick (unchanged) | ✓ WIRED | Verified byte-identical. |
| VoidOrderDialog ConfirmDialog | `onConfirm` (void mutation) | unchanged, only confirmClassName added | ✓ WIRED | Verified; `title`, `confirmLabel="Void order"` unchanged. |

### Behavioral Spot-Checks / E2E Gate (independently re-run, not taken from SUMMARY.md)

| Spec | Command | Result | Status |
|------|---------|--------|--------|
| `e2e/05-payments.spec.ts` | `npx playwright test e2e/05-payments.spec.ts e2e/09-rbac.spec.ts` | 8/8 payments tests pass | ✓ PASS |
| `e2e/41-split-payment.spec.ts` | batch run + isolated `-g "T2"` rerun | 3/3 pass (T1, T3 in batch; T2 confirmed solo — was flaky only when batched with 42-tip-distribution/other specs on the shared live Supabase project) | ✓ PASS |
| `e2e/42-tip-distribution.spec.ts` | isolated solo run | 1/1 pass (47.1s) — failed only when run concurrently with the 05/09 batch process (2 Playwright processes hitting the same live Supabase instance simultaneously); this is a test-execution artifact of my own verification method, not a code defect | ✓ PASS |
| `e2e/06-transfer.spec.ts` | isolated solo run, twice | 3/5 pass both times; T4 ("...error toast shown") and T5 ("...pool charge preserved") fail identically both runs | ✗ FAIL (pre-existing, unrelated to the 7 in-scope files — see gap below) |
| `e2e/09-rbac.spec.ts` | batch run with 05-payments | 23/28 pass, 2 skipped; T7, T-RP-01, T-RP-02 fail — same 3 tests, same root causes documented in 33-05-SUMMARY.md/33-08-SUMMARY.md | ✗ FAIL (pre-existing, unrelated to the 7 in-scope files — see gap below) |
| `e2e/09-rbac.spec.ts` T-RP-05 | `-g "T-RP-05"` solo | 1/1 pass — confirms the refund accessible-name/role contract this phase touched is intact | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|-------------|--------|----------|
| COMPONENT-04 | 33-01..33-08 | Payment-critical surfaces receive markup/class-only swaps, zero behavior change, verified by 5 gate E2E specs | ⚠️ PARTIAL | Zero-behavior-change half fully proven (Truth 1/2). E2E-verification half: 3/5 gate specs fully green; 2/5 have pre-existing/unrelated failures (Truth 3). |

No orphaned requirements — COMPONENT-04 is the only requirement mapped to Phase 33 in REQUIREMENTS.md, and it is the only one declared across all 8 plans' `requirements:` frontmatter.

### Anti-Patterns Found

None. No `TODO`/`FIXME`/`HACK`/`PLACEHOLDER`/`TBD`/`XXX` markers, no empty-implementation stubs, no hardcoded-empty-data patterns, in any of the 7 modified files.

### Deferred Items

None — no later phase (34: Visual Regression Baseline, 35: Guardrails) addresses fixing the `06-transfer` toast-stacking timing or the `09-rbac` permission-matrix/aria-label drift, so this gap could not be matched against any later-phase goal per the deferred-item filter.

### Gaps Summary

The phase's own deliverable — 7 isolated, markup/class-only swaps with zero prop/handler/validation change — is fully and independently verified at the code level: every file was read directly (not taken from SUMMARY.md), every cited `onClick`/`disabled`/`aria-label`/`data-testid` is byte-identical, typecheck/lint/unit tests are clean against the documented baseline, and all 7 commits are correctly isolated one-file-per-commit.

The one outstanding gap is Roadmap Success Criterion 3: 2 of the 5 required E2E gate specs (`06-transfer`, `09-rbac`) currently have reproducible test failures. Both were traced to specific files (`src/app/App.tsx`'s Toaster + the open-tab/transfer-tab flow; `src/widgets/OrderPanel/ActiveTabSelector.tsx`/`OrderPanel.tsx`; `src/widgets/RBACDashboard/PermissionMatrix.tsx`) that are conclusively **outside** Phase 33's 7-file scope (confirmed via `git diff --stat` and per-file `git log`, all last modified in Phase 13, the initial commit, or earlier — years before Phase 33). This strongly suggests pre-existing test/seed drift rather than a regression introduced by this phase's changes, and it matches the exact failure signatures already documented in `33-05-SUMMARY.md` and `33-08-SUMMARY.md`'s own investigation notes.

However, 33-08-SUMMARY.md's own claim that `06-transfer` passed 5/5 could not be reproduced — I found the same 2 tests (T4, T5) failing in 2 independent isolated re-runs. Per the adversarial-verification mandate, this discrepancy between the SUMMARY's claim and the independently-observed current state must be surfaced rather than accepted at face value, even though the underlying root cause is very likely unrelated to this phase's diff.

**Recommendation:** Given the strength of the root-cause evidence (git history conclusively places every failing test's dependency outside the 7-file diff), this looks like an acceptable pre-existing-defect situation rather than a phase-introduced regression. If the developer agrees, add an override to this VERIFICATION.md's frontmatter for Truth 3, e.g.:

```yaml
overrides:
  - must_have: "05-payments, 41-split-payment, 42-tip-distribution, 06-transfer, and 09-rbac E2E specs pass unchanged after every payment-surface commit"
    reason: "06-transfer T4/T5 and 09-rbac T7/T-RP-01/T-RP-02 failures trace to files (App.tsx Toaster, ActiveTabSelector.tsx, OrderPanel.tsx, PermissionMatrix.tsx) last modified in Phase 13/initial-commit — confirmed absent from Phase 33's 7-file diff. Pre-existing test/seed drift, not a regression from this phase's className/prop-only swaps."
    accepted_by: "<developer name>"
    accepted_at: "<ISO timestamp>"
```

Otherwise, route the toast-stacking timing fix (06-transfer) and the RBAC permission-matrix/aria-label collision fix (09-rbac) to a follow-up bug-fix task before considering Success Criterion 3 fully closed.

### Human Verification Required

1. **Visual parity spot-check on the 7 standardized surfaces**
   - **Test:** Open the POS page, a payment modal (single + split mode), the refund sheet, the split-tab sheet, and the void-order dialog. Tab to each of the upgraded controls with keyboard focus.
   - **Expected:** Process Payment / Refund confirm / Void confirm / Confirm Split render at a visibly taller (~72px) size with a noticeably thicker focus ring on keyboard focus; the POS panel toggle, Clear Cart, and Reset-to-computed keep their transparent/underlined look (no solid-color fill); the TabPaymentCard renders left-aligned, full-width, with a visible border when unselected — pixel-identical to pre-phase except the documented size/ring upgrades.
   - **Why human:** Pixel-level CSS-cascade parity (especially TabPaymentCard's CVA-override rework, the phase's own highest-visual-risk file per its threat model) cannot be confirmed by grep or typecheck.

---

_Verified: 2026-07-13T18:35:00Z_
_Verifier: Claude (gsd-verifier)_
