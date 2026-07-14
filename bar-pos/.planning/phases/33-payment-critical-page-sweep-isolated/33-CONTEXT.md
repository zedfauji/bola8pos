# Phase 33: Payment-Critical Page Sweep (Isolated) - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Standardize POS, payments, split-payment, refund, and tip-distribution surfaces to the shell/token/component/touch/focus conventions established in Phases 30-32 — markup/class-level swaps only, zero prop/handler/validation behavior change, one page/widget per PR, verified against the existing E2E suite. This is the payment-critical counterpart to Phase 31 (component/token sweep) and Phase 32 (touch/focus sweep), both of which explicitly excluded payment surfaces to prove the fix pattern on lower-risk pages first.

</domain>

<decisions>
## Implementation Decisions

### File scope (COMPONENT-04)
- **D-01:** In scope — 7 files (widened from 6 after research; see D-01a/D-01b):
  - `src/pages/pos/index.tsx` (raw `<button>` line 54, per Phase 29 drift audit)
  - `src/widgets/OrderPanel/CartPanel.tsx` (raw `<button>` line 185)
  - `src/widgets/PaymentModal/ui/PaymentForm.tsx` (raw `<button>` line 954)
  - `src/widgets/PaymentPane/ui/TabPaymentCard.tsx` (raw `<button>` line 27)
  - `src/features/process-refund/ui/RefundSheet.tsx` (uses raw shadcn `Button`, no `touchSize`/`focusEmphasis` — not flagged by the drift audit since it scans literal HTML `<button>` only, but needs conversion to `POSButton` for the touch/focus decisions below)
  - `src/features/split-tab/ui/SplitTabSheet.tsx` — **CORRECTION (research, 2026-07-13):** CONTEXT.md originally stated this file was "already converted to `POSButton` in Phase 31 D-02." Research (33-RESEARCH.md) confirmed via `git show 6449f87` that Phase 31's own commit message says it swapped SplitTabSheet's 3 raw buttons to plain `Button`, not `POSButton` — only 2 elements in the file (Evenly-mode picker, Confirm Split) are truly `POSButton` today; the "Add check"/"Add person"/"Remove check" buttons are still raw shadcn `Button`. Per D-01b below, this phase now converts those too.
  - `src/features/void-order/ui/VoidOrderDialog.tsx` — **ADDED (research gap, 2026-07-13):** D-03 names "Void order confirm" as one of the 5 critical 72px+ring actions, but no file in the original 6-file scope contains it. It's `ConfirmDialog`-based and has not yet received the `confirmClassName` treatment Phase 32 applied to `StopSessionConfirm.tsx`/`StopAndMoveDialog.tsx`. Added as the 7th file to actually satisfy D-03 item 3.
- **D-01a:** Out of scope — `src/widgets/TabDrawer/`, `src/widgets/TipDistributionPanel/`, `src/widgets/SettingsTabsPanel/tabs/TipDistributionSettingsTab.tsx`. No raw buttons/inputs found in these; `TipDistributionSettingsTab.tsx` already uses `POSButton touchSize="large"`. No work needed unless the planner's own scan turns up new drift.
- **D-01b:** `SplitTabSheet.tsx`'s remaining raw-`Button` sites ("Add check", "Add person", "Remove check" — Amount/Person mode actions) get converted to `POSButton` in this phase's isolated PR for that file, since the file is already in scope for the remove-leg/split-confirm tier work — fixing the stale Phase 31 drift here avoids a 4th sweep phase for one file.

### Touch-target tier assignment (TOUCH-01/02, extending Phase 32's D-03 rule to payment actions)
- **D-03:** 72px (`xl`, critical tier) applies to 5 named actions, resolved to concrete button targets per file:
  1. Process Payment (final commit button, `PaymentForm.tsx`)
  2. Refund confirm (`RefundSheet.tsx` ~line 314)
  3. Void order confirm (`VoidOrderDialog.tsx` — apply via `confirmClassName` per the `ConfirmDialog` pattern from Phase 32, same as `StopSessionConfirm`/`StopAndMoveDialog`)
  4. Split-payment final confirm (submit-all-legs action, `PaymentForm.tsx` split mode)
  5. Remove split-tab line item / leg — **BOTH** targets get the treatment (research flagged this as ambiguous between two files; user resolved "both," 2026-07-13): `SplitTabSheet.tsx`'s "Remove check" (Amount mode, ~line 693/735 range) AND `PaymentForm.tsx`'s "Remove payment N" (the one `41-split-payment.spec.ts` T3 actually exercises).
- **D-04:** Everything else that's a frequent/primary payment action (add split leg, tip entry confirm, method selector, cancel/back within payment flow, `SplitTabSheet.tsx`'s Add-check/Add-person from D-01b) gets 56px (`large`) per the standard Phase 32 rule. Controls that are neither critical nor frequent stay at the 44px floor.
- **D-03a (pitfall, from research):** Any in-scope element currently using a small `size="icon-sm"` variant (28×28px) must get explicit width handling when `touchSize="xl"` is applied — `min-h-[72px]` alone produces a non-square sliver, not a 72px square target. Planner must call this out per-task where it applies.
- **D-03b (pitfall, from research):** Raw `<button>`/`Button` elements being converted to `POSButton` must have an explicit `variant` set (e.g. `variant="ghost"` or `"link"`) matching their current visual style — `POSButton`'s CVA default is a solid `bg-primary` background, and omitting `variant` on an unstyled raw button would silently change its appearance, violating the zero-behavior-change constraint (Success Criterion 1).

### Focus ring escalation (FOCUS-02, extending Phase 32's D-09/D-10)
- **D-05:** `focusEmphasis="high"` applies to exactly the same target set as D-03 (72px tier), including both remove-leg targets — Process Payment, Refund confirm, Void confirm (via `confirmClassName` on `VoidOrderDialog.tsx`'s `ConfirmDialog`), Split-final-confirm, `SplitTabSheet.tsx`'s Remove-check, `PaymentForm.tsx`'s Remove-payment-N. Sizing and focus-ring tier stay in lockstep for this phase; no separate narrower "destructive-only" ring rule.

### PR/commit sequencing
- **D-06:** Roadmap already locks "one page/widget per PR, isolated commits" (Success Criterion 2) — sequencing order is left to planner discretion (no preferred file order).

### Claude's Discretion
- Exact ordering of the isolated PRs within Wave planning.
- Whether shared `Button`/`POSButton` prop work (if any additional prop is needed beyond what Phase 32 already added) lands as its own preliminary commit or inline with the first widget PR.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — COMPONENT-04 full text
- `.planning/ROADMAP.md` §Phase 33 — goal, success criteria, isolated-PR requirement, E2E gate list (`05-payments`, `41-split-payment`, `42-tip-distribution`, `06-transfer`, `09-rbac`)

### Prior phase precedent
- `.planning/phases/31-component-token-spacing-consistency-sweep/31-CONTEXT.md` D-01/D-02 — establishes the payment-critical file boundary this phase picks up (pos/index.tsx, CartPanel.tsx, PaymentForm.tsx, TabPaymentCard.tsx deferred here). **Correction:** D-02's claim that `SplitTabSheet.tsx` was "already converted to POSButton" is only partially true — see D-01/D-01b.
- `.planning/phases/32-touch-target-focus-visible-sweep/32-CONTEXT.md` D-03/D-09/D-10 — the 44/56/72px tier rule, `focusEmphasis="high"` pattern, and the `confirmClassName`-on-`ConfirmDialog` pattern (used by `StopSessionConfirm.tsx`/`StopAndMoveDialog.tsx`) this phase extends to payment actions and to `VoidOrderDialog.tsx`
- `.planning/phases/29-ui-drift-audit/DRIFT-AUDIT.md` — source-of-truth raw-`<button>` inventory (lines 56-91) confirming the original 4 audit-flagged files
- `.planning/phases/33-payment-critical-page-sweep-isolated/33-RESEARCH.md` — **MANDATORY read.** Per-file exact line numbers/current markup for all 7 files, the SplitTabSheet.tsx/VoidOrderDialog.tsx scope corrections, the icon-sm+touchSize=xl CSS pitfall, the POSButton-default-variant pitfall, and the full testid/accessible-name inventory the 5 gate E2E specs depend on

### Code — components being extended
- `src/shared/ui/POSButton.tsx` — `touchSize` prop (default=44px, large=56px, xl=72px); target for all conversions in this phase
- `src/shared/ui/button.tsx` — base `Button` CVA with `focusEmphasis` prop (added in Phase 32 D-09); reused, not modified, in this phase
- `src/shared/ui/ConfirmDialog.tsx` — `confirmClassName` passthrough (added in Phase 32); reused for `VoidOrderDialog.tsx`

### Code — in-scope payment-critical files (7)
- `src/pages/pos/index.tsx:54`
- `src/widgets/OrderPanel/CartPanel.tsx:185`
- `src/widgets/PaymentModal/ui/PaymentForm.tsx:954` (also hosts Process Payment + split-final-confirm + Remove-payment-N)
- `src/widgets/PaymentPane/ui/TabPaymentCard.tsx:27`
- `src/features/process-refund/ui/RefundSheet.tsx:307,314` (raw `Button`, refund confirm/cancel)
- `src/features/split-tab/ui/SplitTabSheet.tsx` (mixed `POSButton`/raw `Button` — see D-01/D-01b; exact current line numbers in 33-RESEARCH.md)
- `src/features/void-order/ui/VoidOrderDialog.tsx` (added; `ConfirmDialog`-based, needs `confirmClassName`)

### E2E gate (zero behavior change proof)
- `bar-pos/e2e/05-payments.spec.ts`, `41-split-payment.spec.ts`, `42-tip-distribution.spec.ts`, `06-transfer.spec.ts`, `09-rbac.spec.ts` — must pass unchanged after every payment-surface commit (Success Criterion 3). 33-RESEARCH.md confirms all assert via accessible-name/testid matching, not DOM structure — safe under pure className/prop diffs as long as button text/aria-label/testid are preserved verbatim.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `POSButton` (`touchSize`: default/large/xl) and `Button`'s `focusEmphasis="high"` prop — both already exist from Phases 30-32; this phase is a rollout/conversion task on payment surfaces, no new component work.

### Established Patterns
- Phase 32 D-03/D-09/D-10 established the destructive-action-gets-72px-and-emphasized-ring pattern (void/stop-session); this phase's D-03/D-05 extend that same pattern to money-commit and money-destructive actions (Process Payment, Refund, Void, Split-final-confirm, Remove-leg).
- Phase 31 D-01/D-02 already drew the exact file boundary between non-payment (Phase 31) and payment-critical (this phase) scope — no re-litigation needed.

### Integration Points
- `PaymentForm.tsx` hosts both the single-payment Process button and the split-payment final-confirm action — both live in the same file, converted in the same isolated PR unless the planner finds a reason to split further.
- `RefundSheet.tsx` currently imports raw shadcn `Button` (not `POSButton`) — this is the one file in scope that needs a full primitive swap, not just prop additions.

</code_context>

<specifics>
## Specific Ideas

No visual redesign — sizing/spacing/focus-ring/primitive-swap pass only, matching Phases 31-32's approach exactly. Zero prop/handler/validation behavior change is a hard constraint (Success Criterion 1) — this is markup/class-level only.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 33-Payment-Critical Page Sweep (Isolated)*
*Context gathered: 2026-07-13*
