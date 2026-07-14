# Phase 33: Payment-Critical Page Sweep (Isolated) - Research

**Researched:** 2026-07-13
**Domain:** React/TS markup-level conversion (raw `<button>` / shadcn `Button` → `POSButton`, `touchSize`/`focusEmphasis` prop wiring) on payment-critical surfaces
**Confidence:** HIGH (all findings verified by reading current source at the exact paths/lines; two real contradictions found between CONTEXT.md's line citations and current source — flagged below)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**File scope (COMPONENT-04)**
- **D-01:** In scope — 6 files:
  - `src/pages/pos/index.tsx` (raw `<button>` line 54, per Phase 29 drift audit)
  - `src/widgets/OrderPanel/CartPanel.tsx` (raw `<button>` line 185)
  - `src/widgets/PaymentModal/ui/PaymentForm.tsx` (raw `<button>` line 954)
  - `src/widgets/PaymentPane/ui/TabPaymentCard.tsx` (raw `<button>` line 27)
  - `src/features/process-refund/ui/RefundSheet.tsx` (uses raw shadcn `Button`, no `touchSize`/`focusEmphasis` — needs conversion to `POSButton`)
  - `src/features/split-tab/ui/SplitTabSheet.tsx` (already converted to `POSButton` in Phase 31 D-02, but its `touchSize`/`focusEmphasis` tiers for split-final-confirm and remove-leg actions are still unset — wire them per D-02/D-03 below)
- **D-02:** Out of scope — `src/widgets/TabDrawer/`, `src/widgets/TipDistributionPanel/`, `src/widgets/SettingsTabsPanel/tabs/TipDistributionSettingsTab.tsx`. No raw buttons/inputs found in these; `TipDistributionSettingsTab.tsx` already uses `POSButton touchSize="large"`. No work needed unless the planner's own scan turns up new drift.

**Touch-target tier assignment (TOUCH-01/02, extending Phase 32's D-03 rule to payment actions)**
- **D-03:** 72px (`xl`, critical tier) applies to 5 actions — this widens Phase 32's "destructive/irreversible only" rule to also cover final money-commit actions on payment surfaces:
  1. Process Payment (final commit button, `PaymentForm.tsx`)
  2. Refund confirm (`RefundSheet.tsx`)
  3. Void order confirm
  4. Split-payment final confirm (submit-all-legs action, `PaymentForm.tsx` split mode)
  5. Remove split-tab line item / leg (`SplitTabSheet.tsx`)
- **D-04:** Everything else that's a frequent/primary payment action (add split leg, tip entry confirm, method selector, cancel/back within payment flow) gets 56px (`large`) per the standard Phase 32 rule. Controls that are neither critical nor frequent stay at the 44px floor.

**Focus ring escalation (FOCUS-02, extending Phase 32's D-09/D-10)**
- **D-05:** `focusEmphasis="high"` applies to exactly the same 5-action set as D-03 (72px tier) — Process Payment, Refund confirm, Void confirm, Split-final-confirm, Remove split-leg. Sizing and focus-ring tier stay in lockstep for this phase; no separate narrower "destructive-only" ring rule.

**PR/commit sequencing**
- **D-06:** Roadmap already locks "one page/widget per PR, isolated commits" (Success Criterion 2) — sequencing order is left to planner discretion (no preferred file order).

### Claude's Discretion
- Exact ordering of the isolated PRs within Wave planning.
- Whether shared `Button`/`POSButton` prop work (if any additional prop is needed beyond what Phase 32 already added) lands as its own preliminary commit or inline with the first widget PR.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMPONENT-04 | Payment-critical surfaces (POS, payments, split-payment, refund, tip-distribution) receive only markup/class-level swaps — zero prop/handler/validation behavior change, verified by existing E2E specs (`05-payments`, `41-split-payment`, `42-tip-distribution`, `06-transfer`, `09-rbac`) passing unchanged | Per-file current-source markup documented below (§Architecture Patterns); exact diff shapes given per file; E2E accessible-name/testid contract confirmed unaffected by `className`-only additions (§Code Examples, §Common Pitfalls) |

</phase_requirements>

## Summary

This is a pure markup/prop conversion phase — no new dependencies, no new components. `POSButton` (`touchSize`: default 44px / large 56px / xl 72px) and `Button`'s `focusEmphasis` (`default` / `high` → `ring-4`) already exist from Phases 30-32 and need no changes. The work is: (1) swap 3 raw `<button>` elements and RefundSheet's raw shadcn `Button` usages to `POSButton`, and (2) add/adjust `touchSize`/`focusEmphasis` props on already-`POSButton` elements per the D-03/D-04/D-05 tier rules.

I read all 6 in-scope files at their current HEAD state and found the actual line numbers have drifted from CONTEXT.md's citations (git history moved between Phase 31 and now), and — more importantly — found **two real contradictions** between CONTEXT.md's D-01 canonical-refs claims and the current source that the planner must resolve before writing tasks:

1. **SplitTabSheet.tsx is NOT "already converted to POSButton" everywhere.** Phase 31 commit `6449f87` ("swap SplitTabSheet's 3 raw buttons to Button (D-02)") converted 3 raw `<button>` elements to plain shadcn **`Button`** (not `POSButton`) — a deliberate choice because those 3 (Add check, Add person, Remove check) were judged non-critical. Only 2 elements in the file are actually `POSButton`: the Evenly-mode number picker (touchSize="xl", line ~487) and Confirm Split (touchSize="large", line ~792). CONTEXT.md's citation of lines 597/693/735 as "already POSButton" describes the 3 plain-`Button` elements, not POSButton instances.
2. **"Void order confirm" (D-03 item 3) has no source file in the D-01 6-file scope.** The void-confirm button lives in `src/features/void-order/ui/VoidOrderDialog.tsx`, which is not one of the 6 listed files. This file already uses the exact `ConfirmDialog confirmClassName` pattern Phase 32 established for the other two destructive 72px confirms (`StopSessionConfirm.tsx`, `StopAndMoveDialog.tsx`) — but `VoidOrderDialog.tsx` itself has **not** been updated with `confirmClassName` yet. The planner needs to either add this file as an (undocumented) 7th in-scope file, or explicitly descope "Void order confirm" from this phase with a written reason.

Both are detailed with full evidence in **Common Pitfalls** and **Open Questions** below. Everything else is low-risk, mechanical `className`/prop-only work.

**Primary recommendation:** Convert each file's raw button(s) to `POSButton` and wire `touchSize`/`focusEmphasis` per the tier table below, in 6 (or 7, pending the VoidOrderDialog decision) isolated single-file commits/PRs. All 5 gate E2E specs assert on accessible name (`getByRole('button', {name})`) or explicit `data-testid`s — none of which are touched by these changes, so behavior/testability risk is near-zero as long as button **text content**, **aria-label wording**, and **existing `data-testid` attributes** are preserved verbatim.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Touch-target sizing (`touchSize`) | Browser / Client (React component markup) | — | Pure CSS `min-height` utility classes applied via `POSButton`; no server/data-layer involvement |
| Focus-ring emphasis (`focusEmphasis`) | Browser / Client | — | CSS `focus-visible` pseudo-class ring width; purely visual, no state |
| Primitive swap (`<button>`/`Button` → `POSButton`) | Browser / Client | — | `POSButton` wraps `Button` (same DOM `<button>` element, same event handlers); zero behavior change by construction |
| Payment/refund/split business logic (unaffected) | API / Backend (Supabase RPC, edge functions) | Browser / Client (mutation hooks) | Out of scope for this phase — CONTEXT.md's zero-behavior-change constraint means no touch here |

This phase touches **only** the Browser/Client tier (JSX markup + CVA class props). No frontend-server, API, or database changes are implicated — confirmed by reading all 6 files: none of the target buttons have their `onClick`/`disabled`/`aria-*` logic touched in this research's proposed diffs.

## Standard Stack

No new dependencies. This phase reuses two components that already exist and require no modification:

| Component | Location | Relevant API | Confidence |
|-----------|----------|---------------|------------|
| `POSButton` | `src/shared/ui/POSButton.tsx` | `touchSize?: 'default' \| 'large' \| 'xl'` → `min-h-[44px]` / `min-h-[56px] text-base` / `min-h-[72px] text-lg font-semibold`. Forwards all other `ButtonProps` (incl. `focusEmphasis`, `variant`, `disabled`, `className`, `aria-*`) straight to `Button`. | HIGH — read full source |
| `Button` (base) | `src/shared/ui/button.tsx` | `focusEmphasis?: 'default' \| 'high'` (CVA variant) → `default: ''`, `high: 'focus-visible:ring-4 focus-visible:ring-ring'` (vs. the CVA base's `focus-visible:ring-3`). Default variant is `'default'` if omitted. | HIGH — read full source |
| `ConfirmDialog` | `src/shared/ui/ConfirmDialog.tsx` | `confirmClassName?: string` — merged (via `cn()`) onto the `AlertDialogAction` (confirm button) only, opt-in, no default behavior change. Already used by `StopSessionConfirm.tsx` and `StopAndMoveDialog.tsx` with the exact literal `"min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring"`. | HIGH — read full source + both existing call sites via grep |

**Installation:** None — zero new packages this phase.

## Package Legitimacy Audit

Not applicable — this phase installs no new packages (pure existing-component-prop-wiring phase). Skip protocol steps 1–4.

## Architecture Patterns

### Per-File Findings

#### 1. `src/pages/pos/index.tsx`
- **Actual raw `<button>`:** lines 57–72 (not line 54 as CONTEXT.md states — line drift, harmless, same element). Toggle for order-panel visibility.
  ```tsx
  <button
    type="button"
    data-testid="pos-order-panel-toggle"
    aria-label={orderPanelCollapsed ? 'Show order panel' : 'Hide order panel'}
    aria-pressed={orderPanelCollapsed}
    onClick={() => { setOrderPanelCollapsed(prev => !prev); }}
    className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-md border bg-background/80 shadow-sm hover:bg-accent"
  >
    {orderPanelCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
  </button>
  ```
- `POSButton` is **already imported** (`import { PageContainer, POSButton, ProtectedAction } from '@shared/ui';`, line 18) and already used once (Close Tab / Pay button, line 87, `touchSize="large"`).
- **None of D-03's 5 critical actions live in this file.** This is an icon-only panel toggle — not a payment/money action, no mention in D-03/D-04.
- **Fixed size `h-9 w-9` (36px square) is BELOW the 44px TOUCH-01 floor** — converting to `POSButton` (which only adds `min-h-[X]`, not `min-w`) without also removing/adjusting the fixed `h-9 w-9` will not actually widen the target; the height floor gets satisfied by `min-h-[44px]` overriding `h-9`'s height (see CSS precedence note in Common Pitfalls), but width stays 36px — a non-square touch target. Recommend either drop `touchSize` (leave default, since default is exactly the 44px floor — but width is still 36px) or add `w-11` alongside `touchSize="default"` to make a true 44×44 square. **Not covered by D-03/D-04; treat as TOUCH-01-floor-compliance cleanup, planner discretion on exact className.**
- **E2E dependency:** `e2e/29-panel-toggle.spec.ts` uses `page.getByTestId('pos-order-panel-toggle')` — testid must survive the swap. Not one of the 5 required gate specs but should not be broken.
- **`Close Tab / Pay` button (line 87–98) is already `POSButton touchSize="large"`.** It's wrapped in `ProtectedAction action="close_tab"` — confirmed `ProtectedAction` only clones `disabled`, never touches `className`/`touchSize`/`focusEmphasis`, so wrapping is safe to extend. Not itself in D-03's 5-action list (it opens the PaymentModal, it doesn't commit the payment) — stays `large` per D-04.

#### 2. `src/widgets/OrderPanel/CartPanel.tsx`
- **Actual raw `<button>`:** lines 185–193, "Clear Cart" (not line 185 alone — confirmed exact match).
  ```tsx
  <button
    type="button"
    className="text-sm text-muted-foreground underline decoration-muted-foreground/60 underline-offset-2 hover:text-foreground"
    onClick={() => { clearCart(); }}
  >
    Clear Cart
  </button>
  ```
- `POSButton` **already imported** (`import { POSButton } from '@shared/ui/POSButton';`, line 15) and already used for "Place Order" (line 171–181, `touchSize="xl"`, **no `focusEmphasis` set**).
- **"Place Order" is NOT one of D-03's 5 named critical actions** (D-03 names "Process Payment", not "Place Order" — Place Order only adds items to the tab, it doesn't move money) yet it already carries `touchSize="xl"` from an earlier, unrelated phase. This phase's D-01 file-scope note for this file only flags the raw "Clear Cart" `<button>` — it does **not** direct any change to the "Place Order" button. **Leave Place Order's `touchSize="xl"` untouched; do not add `focusEmphasis="high"` to it unless the planner explicitly extends discretion here (not granted by CONTEXT.md).**
- "Clear Cart" is a plain text-link — no D-03/D-04 assignment given (it's a destructive-ish but low-stakes/reversible action — clearing an unsubmitted cart, not money). Falls under D-04's "everything else" tier at most, or could stay at the 44px floor since it's a secondary/tertiary action, not "frequent primary." Converting to `POSButton` only adds `min-h`/press-scale CSS — the underline-text visual styling in `className` is preserved via `cn()` merge, so the link-like appearance survives.
- **No E2E spec asserts on this exact button's classes** — greps across `e2e/` found no `Clear Cart` text/testid match in the 5 gate specs (used to be quantity in cart, but not directly referenced as a button-name in the assertions read).

#### 3. `src/widgets/PaymentModal/ui/PaymentForm.tsx`
- **Actual raw `<button>`:** lines 954–964 (matches CONTEXT.md's 954 citation exactly), "Reset to computed" card-override-reset link.
  ```tsx
  <button
    type="button"
    data-testid="card-override-reset"
    className="text-xs text-muted-foreground underline"
    onClick={() => { setCardChargeOverride(null); }}
  >
    Reset to computed (${runningTotal.toFixed(2)})
  </button>
  ```
- `POSButton` **already imported** (`import { ..., POSButton, ... } from '@shared/ui';`, line 27) and used extensively (tip presets `large`, discount scope/type `large`, split-row method selectors `large`, payment-method selectors `xl`, Remove-payment ghost icon button **no touchSize set**, Add-payment-method outline button **no touchSize set**, Process/Split-Confirm `xl` **no focusEmphasis**, Cancel `large`).
- **This file hosts 2 of D-03's 5 critical actions:**
  1. **Process Payment / split-final-confirm — same button, dual label.** Lines 1000–1021: `POSButton touchSize="xl"` already, `focusEmphasis` currently unset (defaults to `'default'`, thin ring). Label switches between `"Process payment"` / `"Confirm card payment"` / `"Confirm & close tab"` (single mode) and `"Process split payment"` (split mode) via the same `primaryLabel` computed value — **one JSX element serves both D-03 items 1 and 4.** Needs: add `focusEmphasis="high"`.
  2. **Remove payment leg — candidate for D-03 item 5** ("Remove split-tab line item / leg"). Lines 721–733:
     ```tsx
     <POSButton
       type="button"
       variant="ghost"
       aria-label={`Remove payment ${String(index + 1)}`}
       disabled={isProcessing}
       className="px-2 text-destructive"
       onClick={() => { dispatchSplitRows({ type: 'REMOVE_ROW', rowId: row.id }); }}
     >
       <Trash2 className="h-4 w-4" />
     </POSButton>
     ```
     **No `touchSize` set (defaults to 44px "default").** This is the button `41-split-payment.spec.ts` T3 exercises directly (`Remove payment 1`, `Remove payment 3`, `Remove payment 4` by aria-label) — see **Open Questions** for why this is a stronger match for D-03 item 5 than anything in `SplitTabSheet.tsx`.
- **Card-override-reset "Reset to computed" button** (the one raw `<button>` in this file) is not in D-03/D-04's named tiers — secondary/rare action, floor tier is fine.
- **`data-testid` inventory in this file** (must survive untouched): `payment-btn-cash`, `payment-btn-card`, `payment-btn-rappi`, `discount-section`, `discount-scope-{scope}`, `discount-type-{type}`, `discount-value-input`, `discount-applied-label`, `discount-row`, `card-override-reset`.
- **Accessible-name-driven E2E assertions on buttons in this file** (must survive text/aria-label unchanged): `'Cancel'`, `/process payment/i`, `/confirm card payment/i`, `'Process split payment'` (exact), `'Terminal BBVA'` (payment-label driven, config-dependent), `'+ Add payment method'` (exact), `` `Remove payment ${n}` `` (aria-label, exact).

#### 4. `src/widgets/PaymentPane/ui/TabPaymentCard.tsx`
- **Actual raw `<button>`:** the entire component's root is a `<button>`, lines 27–66 (matches CONTEXT.md's line 27 citation).
  ```tsx
  <button
    type="button"
    aria-label={`tab ${tab.customerName}`}
    aria-pressed={selected}
    onClick={onClick}
    className={cn(
      'w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      selected && 'border-primary ring-1 ring-primary bg-accent'
    )}
  >
    {/* card content: name, item count, MoneyDisplay, badges */}
  </button>
  ```
- `POSButton` is **NOT currently imported** in this file — this file needs a fresh import (`import { POSButton } from '@shared/ui/POSButton';` or via the `@shared/ui` barrel, matching the existing `import { MoneyDisplay } from '@shared/ui';` barrel-import style already in the file).
- **No D-03 critical action lives here** — this is a tab-selector card (method-selector-adjacent, "frequent" per D-04) → `touchSize="large"` fits D-04's "frequent/primary payment action" language (selecting which tab to pay is a frequent, non-destructive, non-final action).
- **Note the existing `focus-visible:ring-2 focus-visible:ring-ring` baked directly into the card's own `className`** — this predates `Button`'s CVA `focusEmphasis` system (CVA base already applies `focus-visible:ring-3 focus-visible:ring-ring/50`; this card's hand-rolled `focus-visible:ring-2` is a **duplicate/conflicting** focus-ring declaration that will need to be dropped when swapping to `POSButton` (the CVA base supplies its own ring by default; keeping both classes concatenated via `cn()` risks Tailwind class-order-dependent conflicts, and violates the "reuse the shared primitive's own ring system" pattern established in Phases 30-32).
- **`aria-label`, `aria-pressed`, and the entire content tree (badges, MoneyDisplay, item count) must be preserved verbatim** — `17-payment-pane.spec.ts` (not a gate spec, but exists) asserts `getByRole('button', { name: /tab {customerName}/i })` extensively; none of the 5 required gate specs (05/41/42/06/09) reference `TabPaymentCard` directly by grep, but breaking this contract would still be a regression worth avoiding.

#### 5. `src/features/process-refund/ui/RefundSheet.tsx`
- **Actual raw shadcn `Button` usage:** lines 307–320 (matches CONTEXT.md's 307/314 citation exactly).
  ```tsx
  <SheetFooter className="px-6 pb-6 flex gap-3">
    <Button
      variant="outline"
      className="flex-1"
      onClick={() => { onOpenChange(false); }}
    >
      Close refund
    </Button>
    <Button
      className="flex-1 min-h-[56px]"
      disabled={!isValid || mutation.isPending}
      onClick={() => { setPinOpen(true); }}
    >
      Request approval
    </Button>
  </SheetFooter>
  ```
- **Import today:** `import { Button, MoneyDisplay, QuantityControl } from "@shared/ui";` (line 14) — this is the **one file in scope needing a full primitive swap**, not just prop addition: `Button` → `POSButton` for both footer buttons (`MoneyDisplay`/`QuantityControl` stay imported and untouched — confirmed no other usage of `Button` elsewhere in this file, i.e. no accidental behavior coupling from the swap).
- **"Request approval" (line 314–320) is D-03 item 2, "Refund confirm."** It already hand-rolls `min-h-[56px]` in `className` — this is the file's own pre-existing approximation of the `large` tier, done before `POSButton` existed in this file. Needs: swap to `POSButton touchSize="xl" focusEmphasis="high"` (drop the manual `min-h-[56px]` since `touchSize="xl"` supersedes it — leaving both would create a class-order conflict since both set `min-height`; `xl` uses `min-h-[72px]`, more specific/later in `cn()` output would win, but the leftover `min-h-[56px]` literal in `className` is dead weight that should be deleted for cleanliness. **Important:** confirm `disabled={!isValid || mutation.isPending}` and `onClick` stay 100% unchanged — this button opens the `ManagerPinDialog`, it does not itself submit the refund (submission happens in `handleSubmitRefund()`, invoked from `ManagerPinDialog`'s `onSuccess`, out of scope, untouched).
- **"Close refund" (line 307–313)** pairs with "Request approval" as the cancel action — D-04's "cancel/back within payment flow" tier → `POSButton variant="outline" touchSize="large"`.
- **No `data-testid` on either button** — both are matched by accessible name only (`getByRole('button', {name: 'Close refund'})` pattern used nowhere in the 5 gate specs directly, but `e2e/35-refund.spec.ts` — not a gate spec, but exists — uses `getByRole('button', { name: /request approval/i })` (line 251, 464). **Text content `"Request approval"` and `"Close refund"` must be preserved verbatim.**

#### 6. `src/features/split-tab/ui/SplitTabSheet.tsx`
- **`POSButton` is imported** (`import { POSButton } from '@shared/ui/POSButton';`, line 19) — used at 2 sites only:
  1. **Evenly-mode number picker** (lines 487–499, `touchSize="xl"`, no `focusEmphasis`). Not a D-03/D-04-named action (it's a numeric mode-selector, not confirm/remove) — leave as-is unless planner wants consistency pass (not required by CONTEXT.md).
  2. **"Confirm Split" — the split-final-confirm for the split-TAB feature** (lines 792–801):
     ```tsx
     <POSButton
       touchSize="large"
       className="flex-1"
       disabled={!isValid || isMutating}
       onClick={() => { void handleConfirm(); }}
     >
       Confirm Split
     </POSButton>
     ```
     Currently `touchSize="large"`, no `focusEmphasis`. **This is the clean, unambiguous match for D-03 item 4's "split-final-confirm" as applied to SplitTabSheet.tsx** (it finalizes/commits the tab split into N sub-tabs — the natural "split-final-confirm" for *this* feature; distinct from PaymentForm.tsx's own "Process split payment" button, which is item 4's *other* candidate for the split-PAYMENT feature — see Open Questions, both may need the upgrade). Needs: `touchSize="xl" focusEmphasis="high"`.
- **The other 3 raw-`<button>`-turned-`Button` elements from Phase 31 D-02 remain plain shadcn `Button`, NOT `POSButton`** — contradicting CONTEXT.md's D-01 claim these are "already POSButton":
  - **Add check** (item mode, lines 597–606): `<Button variant="outline" type="button" ...>` — dashed-tile add-column button, aria-label "Add sub-check column". D-04 "everything else" tier at most — no critical designation. Leave as plain `Button` unless converting for TOUCH-01-floor consistency (not required by D-01/D-03/D-04 for this phase — Phase 31 already made the call to keep it `Button` not `POSButton`).
  - **Add person** (person mode, lines 693–704): same pattern as Add check, aria-label "Add person".
  - **"Remove check" — the actual candidate for D-03 item 5** ("remove split-tab line item / leg" as literally scoped to *this* file): lines 736–748 (not 735 as CONTEXT.md states — 1-line drift):
    ```tsx
    {amountRows.length > 2 && (
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={() => { removeAmountRow(row.id); }}
        aria-label={`Remove check ${String(i + 1)}`}
      >
        <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </Button>
    )}
    ```
    Currently a plain `Button variant="ghost" size="icon-sm"` (a **28px square icon button** via CVA's `size-7` utility) — this is the Amount-mode "remove a split check/leg" action. Needs conversion to `POSButton` **plus** careful sizing (see Common Pitfalls — `size="icon-sm"` fixes width via `size-7`, and `POSButton`'s `touchSize="xl"` only adds `min-h-[72px]`, producing a 28px-wide × 72px-tall non-square target unless the width is separately widened).
- **`Button`, `POSButton`, and `Input` are all separately imported** (`import { Button } from '@shared/ui/button';`, `import { POSButton } from '@shared/ui/POSButton';`, line 19 & 22) — both stay imported after conversion since some `Button` usages (Add check, Add person, "Keep tab open" cancel, "Add check" sm-size row-add in Amount mode) are **not** part of this phase's scope per D-01/D-03/D-04 and should remain plain `Button`.
- **Two more plain-`Button` sites exist that are NOT named in CONTEXT.md at all** (worth flagging as drift the planner may choose to leave, since D-01 only names "already POSButton at 597/693/735" — it does not claim exhaustive coverage of every `Button` in the file):
  - "Keep tab open" cancel button (line 789): `<Button variant="outline" className="flex-1" onClick={handleCancel}>Keep tab open</Button>` — D-04 cancel/back tier candidate, `POSButton variant="outline" touchSize="large"` would fit, but not explicitly required.
  - "Add check" (sm, Amount mode row-add, lines 751–759): `<Button variant="outline" size="sm" onClick={addAmountRow} className="w-full"><Plus .../>Add check</Button>` — same tier as the other "Add X" buttons.
- **Not one of the 5 required gate specs (`05-payments`, `41-split-payment`, `42-tip-distribution`, `06-transfer`, `09-rbac`) exercises `SplitTabSheet.tsx` directly** — its coverage lives in `e2e/34-split-bill.spec.ts` (not a gate spec for this phase). This lowers the blast-radius risk of changes to this file relative to the other 5, but zero-behavior-change is still the hard constraint per Success Criterion 1 regardless of gate-spec coverage.

### Recommended Project Structure
No new files/folders — all changes are in-place edits to the 6 (or 7, pending VoidOrderDialog decision) existing files.

### System Architecture Diagram

```
User tap/click
      │
      ▼
┌─────────────────────────────┐
│  POSButton (shared/ui)      │  ← touchSize prop → min-h-[44/56/72px] CSS class only
│    wraps                    │
│  Button (shared/ui, CVA)    │  ← focusEmphasis prop → focus-visible:ring-{3|4} CSS class only
└─────────────┬────────────────┘
              │ same onClick / disabled / aria-* passthrough (unchanged)
              ▼
   Existing feature/widget business logic (untouched)
   (handlePrimary, handleSplitPrimary, handleSubmitRefund,
    handleConfirm, dispatchSplitRows, clearCart, ...)
              │
              ▼
   Supabase RPC / edge function (untouched — out of scope)
```
Every arrow below "same onClick/disabled/aria-* passthrough" is explicitly **not modified** by this phase — the diagram terminates at the prop boundary to make the zero-behavior-change constraint visually obvious to the planner.

### Pattern 1: Raw `<button>` → `POSButton` swap
**What:** Replace the HTML tag and add `touchSize`, keep every other prop/attribute/child verbatim.
**When to use:** `pos/index.tsx` (panel toggle), `CartPanel.tsx` (Clear Cart), `PaymentForm.tsx` (card-override-reset), `TabPaymentCard.tsx` (whole card).
**Example (CartPanel.tsx "Clear Cart"):**
```tsx
// Before
<button
  type="button"
  className="text-sm text-muted-foreground underline decoration-muted-foreground/60 underline-offset-2 hover:text-foreground"
  onClick={() => { clearCart(); }}
>
  Clear Cart
</button>

// After — className preserved verbatim via cn() merge in POSButton; touchSize adds min-height only
<POSButton
  type="button"
  variant="ghost"
  touchSize="default"
  className="text-sm text-muted-foreground underline decoration-muted-foreground/60 underline-offset-2 hover:text-foreground"
  onClick={() => { clearCart(); }}
>
  Clear Cart
</POSButton>
```
Note: adding `variant="ghost"` (or omitting `variant`, which defaults to `'default'` — a solid primary-color background) is a real visual decision the planner must make explicitly, since the raw `<button>` had **no** CVA variant styling at all (transparent, text-only). Defaulting to `Button`'s `variant="default"` would visually break the link-like appearance (adds a solid background) despite the `className` override — Tailwind's cascade means the CVA base's `bg-primary` class and the custom `className`'s (absent) background class don't conflict, so the CVA default background **will** show through unless `variant="ghost"` or `variant="link"` is explicitly set. **This is a genuine zero-visual-change risk the planner must address per-button** — same issue applies to `pos/index.tsx`'s icon toggle and `PaymentForm.tsx`'s "Reset to computed" link.

### Pattern 2: Raw shadcn `Button` → `POSButton` swap (RefundSheet.tsx only)
**What:** Change the import and component name only; all variant/className/disabled/onClick stay identical (since `POSButton` extends `ButtonProps` and forwards everything).
**Example:**
```tsx
// Before
import { Button, MoneyDisplay, QuantityControl } from "@shared/ui";
...
<Button className="flex-1 min-h-[56px]" disabled={!isValid || mutation.isPending} onClick={() => { setPinOpen(true); }}>
  Request approval
</Button>

// After
import { MoneyDisplay, POSButton, QuantityControl } from "@shared/ui";
...
<POSButton
  touchSize="xl"
  focusEmphasis="high"
  className="flex-1"
  disabled={!isValid || mutation.isPending}
  onClick={() => { setPinOpen(true); }}
>
  Request approval
</POSButton>
```
No `variant` ambiguity here — `Button`'s default is `variant="default"` and was already being used unstyled (no `variant` prop passed originally either), so `POSButton`'s default matches exactly.

### Pattern 3: Prop-only addition on existing `POSButton` (no primitive swap)
**What:** Add/change `touchSize`/`focusEmphasis` values only.
**Example (PaymentForm.tsx Process Payment / split-final-confirm):**
```tsx
// Before
<POSButton
  type="button"
  touchSize="xl"
  disabled={isProcessing || (isSplitMode ? !canSubmitSplit : !canSubmit)}
  className="w-full bg-[var(--pos-accent)] text-black hover:bg-[var(--pos-accent)]/90"
  onClick={...}
>

// After — one prop added, nothing else touched
<POSButton
  type="button"
  touchSize="xl"
  focusEmphasis="high"
  disabled={isProcessing || (isSplitMode ? !canSubmitSplit : !canSubmit)}
  className="w-full bg-[var(--pos-accent)] text-black hover:bg-[var(--pos-accent)]/90"
  onClick={...}
>
```

### Anti-Patterns to Avoid
- **Silently changing `variant` on a converted button without flagging it:** as shown in Pattern 1, converting a bare `<button>` (no CVA styling) to `POSButton` without an explicit `variant` will silently apply `variant="default"`'s solid primary background — this IS a visual change, arguably violating "markup/class-level swaps only" if done carelessly. Always set `variant="ghost"` or `variant="link"` explicitly when the original raw button had no background styling.
- **Leaving stale hand-rolled `min-h-[Npx]` classes alongside a new `touchSize` prop** (RefundSheet.tsx's `min-h-[56px]`) — dead, confusing, and risks future maintainers not understanding which value wins.
- **Applying `touchSize="xl"` to a `size="icon-sm"`/`size="icon"` button without adjusting width** — produces a non-square, visually broken touch target (see Common Pitfalls).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| 72px destructive-confirm styling | A new CVA variant or bespoke `className` string | `ConfirmDialog`'s existing `confirmClassName` prop, literal string `"min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring"` (copy exactly from `StopSessionConfirm.tsx`/`StopAndMoveDialog.tsx`) | Two prior call sites already established this exact literal; a third (`VoidOrderDialog.tsx`, if in scope) should match verbatim for consistency, not reinvent |
| Touch-target sizing | Inline `min-h-[Npx]` per button | `POSButton`'s `touchSize` prop | Centralizes the 44/56/72 scale; inline literals (as RefundSheet currently has) are exactly the drift this phase is fixing |
| Focus-ring emphasis | Inline `focus-visible:ring-N` classes (as `TabPaymentCard.tsx` currently hand-rolls) | `Button`'s `focusEmphasis` CVA variant | Same reasoning — `TabPaymentCard.tsx`'s own `focus-visible:ring-2 focus-visible:ring-ring` predates the CVA system and should be removed in favor of `POSButton`'s built-in ring, not layered on top of it |

**Key insight:** Every "problem" in this phase already has an established, precedent-backed shared-primitive answer from Phases 30-32. There is no case in these 6 files where a new pattern needs to be invented — the work is 100% "apply the existing pattern here too."

## Common Pitfalls

### Pitfall 1: `touchSize="xl"` on a fixed-width icon button produces a non-square target
**What goes wrong:** `POSButton`'s `touchSize` classes only set `min-height` (e.g. `min-h-[72px]`), never width. If the underlying `Button`'s `size` prop is `icon-sm` (`size-7` = 28×28px, a Tailwind utility setting both width AND height) or `icon` (`size-8`), CSS resolves the conflict as: explicit `height` (28px) is overridden by `min-height` (72px) — a browser always renders `max(height, min-height)` for the box's final height — but `width` stays 28px since nothing else touches it. Result: a 28px-wide, 72px-tall sliver, not a 72×72 touch target.
**Why it happens:** `size-*` Tailwind utilities set both dimensions in one class; `min-h-[Npx]` only constrains one axis; CVA's later-class-wins merge via `cn()` doesn't help because `min-height` and `height` are different CSS properties (no override, they compose via `max()`).
**Where this bites in this phase:** `SplitTabSheet.tsx`'s "Remove check" button (`size="icon-sm"`) is the leading candidate for D-03 item 5 ("remove-leg", 72px + high-emphasis ring per D-03/D-05). Converting it naively (`<POSButton size="icon-sm" touchSize="xl" focusEmphasis="high">`) will NOT produce the intended 72px square.
**How to avoid:** Either (a) drop `size="icon-sm"` and let the button use `POSButton`'s default sizing with the icon as sole child (adds horizontal padding from the base CVA `size="default"` — probably wide enough), or (b) explicitly pair `touchSize="xl"` with a matching width override in `className` (e.g. `className="w-[72px]"`), or (c) keep `size="icon-lg"` (36px, the largest icon preset) and accept it's still short of 72px if a true square 72px icon button isn't visually desired for a "remove one split-check row" action (arguably not as high-stakes as Process Payment). **Flag this exact tradeoff for the planner to decide explicitly in the task description**, since none of the three options is "zero visual change" — this is a real design decision that CONTEXT.md's D-03/D-05 rule doesn't anticipate for icon-only buttons.
**Warning signs:** Visual regression / manual click-through showing a tall, narrow "X" button instead of a square one.

### Pitfall 2: CONTEXT.md's SplitTabSheet.tsx line citations describe plain `Button`, not `POSButton`
**What goes wrong:** CONTEXT.md's canonical_refs section states `src/features/split-tab/ui/SplitTabSheet.tsx:597,693,735` are "already converted to `POSButton` in Phase 31 D-02" and that only their `touchSize`/`focusEmphasis` need wiring. Reading the actual file (and the Phase 31 commit `6449f87`, message: "swap SplitTabSheet's 3 raw buttons to **Button** (D-02)") shows these 3 elements are plain shadcn `Button`, not `POSButton`. This was a deliberate, documented Phase 31 choice (not an oversight) — but CONTEXT.md's Phase 33 authoring appears to have mis-transcribed "Button" as "POSButton."
**Why it happens:** Cross-phase context drift — CONTEXT.md was likely authored by skimming Phase 31's summary rather than re-reading the current file.
**How to avoid:** The planner must write tasks against the **actual current source** (documented in full above), not CONTEXT.md's line/component citations. Where D-03 assigns a 72px/high-emphasis tier to one of these 3 buttons (only "Remove check" plausibly qualifies — see Pitfall 3), the task must include a full `Button`→`POSButton` primitive swap, not just a prop addition.
**Warning signs:** A task written as "add `touchSize`/`focusEmphasis` props to `SplitTabSheet.tsx:735`" will fail — `Button` (not `POSButton`) doesn't have a `touchSize` prop; TypeScript will reject it at compile time (`focusEmphasis` DOES exist on `Button` directly via the CVA export, so that half would silently compile — but `touchSize` would not).

### Pitfall 3: Ambiguous file attribution for D-03 item 5 ("remove split-tab line item / leg")
**What goes wrong:** D-03 item 5 is phrased "Remove split-tab line item / leg (`SplitTabSheet.tsx`)" — but there are **two** plausible "remove a leg" buttons across the 6-file scope:
  - `SplitTabSheet.tsx`'s "Remove check" (Amount mode, removes a sub-tab/check row when splitting a TAB into N checks) — matches the file citation literally, but is not covered by any of the 5 required gate E2E specs.
  - `PaymentForm.tsx`'s "Remove payment N" (removes a payment-method row when splitting a single PAYMENT across up to 4 methods) — matches the word "leg" far more naturally (payment legs are the domain term used throughout `41-split-payment.spec.ts` and `SplitPaymentLegInput` in the code itself), and IS directly exercised by the required gate spec `41-split-payment.spec.ts` T3 (adds/removes rows, asserts `Remove payment 1/3/4` by aria-label).
**Why it happens:** "Split tab" and "split payment" are two distinct, similarly-named features in this codebase (`split-tab` feature folder vs. `PaymentForm.tsx`'s internal split-payment-mode) — CONTEXT.md's D-03 item 5 phrasing conflates them.
**How to avoid:** Do not silently pick one. Surface this to the user/planner as an explicit decision point before locking task scope (see Open Questions below) — my recommendation is to apply the 72px+high-ring upgrade to **both**, since both are independently defensible "remove a split leg" actions and neither costs much extra (both are small, isolated, single-button diffs), but this doubles the number of D-03/D-05-tier buttons from 5 to 6 relative to CONTEXT.md's stated count, which the planner should call out explicitly rather than silently deviate from the "5 actions" framing.
**Warning signs:** A plan-checker or verifier pass that counts "exactly 5 buttons upgraded to xl+high" will flag either 4 (if neither ambiguous candidate is picked correctly) or 6 (if both are upgraded) as a mismatch against CONTEXT.md's literal "5 actions" language.

### Pitfall 4: "Void order confirm" (D-03 item 3) has no file in the D-01 scope list
**What goes wrong:** D-03 lists "Void order confirm" as one of the 5 critical actions. The only place a "Void order" confirm button exists in the codebase is `src/features/void-order/ui/VoidOrderDialog.tsx` (confirmed via full-codebase grep — no other component renders `confirmLabel="Void order"` or equivalent). This file is **not** in D-01's 6-file scope, and D-02 (out-of-scope files) doesn't mention it either — it's simply absent from CONTEXT.md's discussion entirely.
**Why it happens:** Likely an oversight during context-gathering — the discussion enumerated file scope by re-deriving from Phase 31's boundary (which only concerned raw-button/component-swap work), while D-03's touch-tier list was derived independently from the roadmap's "critical/destructive action" concept, and the two lists were never cross-checked against each other.
**How to avoid:** `VoidOrderDialog.tsx` already uses `ConfirmDialog` and the `confirmClassName` prop is available (established, unmodified, opt-in) — adding the exact literal `confirmClassName="min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring"` (verbatim match to `StopSessionConfirm.tsx`/`StopAndMoveDialog.tsx`) is a 1-line, fully-isolated, zero-risk addition consistent with "one page/widget per PR." Recommend the planner add this as a 7th isolated PR/task, OR the user must explicitly confirm descoping "Void order confirm" from Phase 33 (in which case D-03 item 3's requirement goes unaddressed by this phase, which contradicts the roadmap's stated goal). This file is also covered by `09-rbac.spec.ts` (`T-RBAC-09`/void-order tests, one of the 5 required gate specs) — assertion is `voidDialog.getByRole('button', { name: /void order/i }).click()` (accessible name only, unaffected by `confirmClassName` addition).
**Warning signs:** A verifier checking "5/5 D-03 actions have `focusEmphasis="high"` applied" will find `VoidOrderDialog.tsx` untouched and fail the check, unless this gap is explicitly resolved (add the file, or document the descope) before execution.

### Pitfall 5: Default `variant` change when swapping unstyled raw `<button>` elements
Covered in depth under "Anti-Patterns to Avoid" above (Pattern 1) — repeating here because it's a genuine E2E-breaking risk if missed: `Button`'s CVA default `variant="default"` applies `bg-primary text-primary-foreground`. Any raw `<button>` with no background styling (all 3 candidates in `pos/index.tsx`, `CartPanel.tsx`, `PaymentForm.tsx`'s card-override-reset) will visually gain a solid colored background unless `variant="ghost"` or `variant="link"` is set explicitly during conversion. This does not break E2E text/testid matching (Playwright's `getByRole`/`getByTestId` don't care about background color) but **does** violate the "markup/class-level swaps only, zero...behavior change" framing if interpreted to include visual appearance, and is very likely to be caught by any human/visual review.

## Code Examples

### Full per-file diff-shape summary (for planner task-writing)

| File | Element | Current | Target | Swap type |
|------|---------|---------|--------|-----------|
| `pos/index.tsx:57` | Panel toggle | raw `<button>`, `h-9 w-9` | `POSButton variant="ghost" touchSize="default"` + explicit width fix for square target | Primitive swap + variant decision |
| `CartPanel.tsx:185` | Clear Cart | raw `<button>`, text-link style | `POSButton variant="ghost"` (or `variant="link"`), tier per D-04 or floor | Primitive swap + variant decision |
| `CartPanel.tsx:171` | Place Order | `POSButton touchSize="xl"` already | **No change** — not named in D-03/D-04 for this phase | None |
| `PaymentForm.tsx:1000` | Process Payment / Process split payment (dual-label, one element) | `POSButton touchSize="xl"`, no `focusEmphasis` | add `focusEmphasis="high"` | Prop-only |
| `PaymentForm.tsx:721` | Remove payment N | `POSButton variant="ghost"`, no `touchSize` (44px default) | pending Open Question resolution — candidate for `touchSize="xl" focusEmphasis="high"` | Prop-only |
| `PaymentForm.tsx:954` | Reset to computed | raw `<button>`, text-link style | `POSButton variant="ghost"` (or `variant="link"`), floor tier (not named critical/frequent) | Primitive swap + variant decision |
| `PaymentForm.tsx:1024` | Cancel | `POSButton touchSize="large"` already | **No change** — matches D-04 cancel/back tier already | None |
| `TabPaymentCard.tsx:27` | Whole card | raw `<button>`, hand-rolled `focus-visible:ring-2` | `POSButton touchSize="large"`, drop hand-rolled ring classes (CVA base supplies its own) | Primitive swap + import add |
| `RefundSheet.tsx:307` | Close refund | `Button variant="outline"` | `POSButton variant="outline" touchSize="large"` | Primitive swap |
| `RefundSheet.tsx:314` | Request approval | `Button` with hand-rolled `min-h-[56px]` | `POSButton touchSize="xl" focusEmphasis="high"`, drop hand-rolled `min-h-[56px]` | Primitive swap + D-03 tier |
| `SplitTabSheet.tsx:487` | Evenly number picker | `POSButton touchSize="xl"` already | **No change** — not named in D-03/D-04 | None |
| `SplitTabSheet.tsx:597` | Add check | `Button variant="outline"` (Phase 31) | **No change per D-01/D-04** unless planner extends discretion | None (or optional consistency pass) |
| `SplitTabSheet.tsx:693` | Add person | `Button variant="outline"` (Phase 31) | **No change per D-01/D-04** unless planner extends discretion | None (or optional consistency pass) |
| `SplitTabSheet.tsx:737` | Remove check | `Button variant="ghost" size="icon-sm"` (Phase 31) | pending Pitfall 1/3 resolution — candidate for `POSButton touchSize="xl" focusEmphasis="high"` + width fix | Primitive swap + sizing decision |
| `SplitTabSheet.tsx:792` | Confirm Split | `POSButton touchSize="large"`, no `focusEmphasis` | `touchSize="xl" focusEmphasis="high"` | Prop-only |
| `SplitTabSheet.tsx:789` | Keep tab open | `Button variant="outline"` | **No change per D-01/D-04** unless planner extends discretion | None (or optional consistency pass) |
| `VoidOrderDialog.tsx` (NOT in D-01 scope) | Void order confirm | `ConfirmDialog` with no `confirmClassName` | add `confirmClassName="min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring"` | Prop-only — **pending scope decision, see Open Questions** |

## State of the Art

Not applicable — no external library/API version drift is relevant to this phase (internal component reuse only).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-03 item 5 ("remove split-tab line item / leg") should apply to `PaymentForm.tsx`'s "Remove payment N" button (in addition to, or instead of, `SplitTabSheet.tsx`'s "Remove check") | Common Pitfalls #3, Code Examples table | If wrong, either an untested/non-gate-covered button gets the 72px treatment while the gate-tested one doesn't (weaker E2E proof of the change), or vice versa — low functional risk either way since it's a `className`-only difference, but affects whether the phase's "5 critical actions" claim is literally true |
| A2 | `VoidOrderDialog.tsx` should be added as an implicit 7th in-scope file for this phase, using the exact `confirmClassName` literal from `StopSessionConfirm.tsx`/`StopAndMoveDialog.tsx` | Common Pitfalls #4, Code Examples table | If wrong (user wants it explicitly descoped instead), D-03 item 3 ("Void order confirm") goes permanently unaddressed by the v2.2 milestone unless a follow-up phase picks it up — moderate risk of an incomplete-looking requirement |
| A3 | The panel-toggle icon button in `pos/index.tsx` and "Clear Cart"/"Reset to computed" text-link buttons need an explicit `variant="ghost"` (or `variant="link"`) set during conversion to avoid an unintended solid-background visual regression | Common Pitfalls #5, Pattern 1 | If wrong (variant doesn't actually matter, or a different variant is preferred), the planner may need to adjust the `variant` choice per button — low risk, easily caught in a visual/manual review before merge |

## Open Questions (RESOLVED)

1. **Which button (or both) satisfies D-03 item 5 "remove split-tab line item / leg"?**
   - What we know: `SplitTabSheet.tsx`'s literal file-name match ("Remove check", Amount mode) vs. `PaymentForm.tsx`'s domain-term match ("Remove payment N", tested by the required gate spec `41-split-payment.spec.ts`).
   - What's unclear: CONTEXT.md explicitly attributes this to `SplitTabSheet.tsx` by filename, but the semantics ("leg") and gate-spec coverage point to `PaymentForm.tsx`.
   - Recommendation: Apply the 72px/high-ring upgrade to **both** (low cost, both independently defensible, avoids under-covering either interpretation) OR ask the user for a single explicit answer before task-writing if the planner/plan-checker wants literal "exactly 5" traceability to CONTEXT.md's count.

2. **Is `VoidOrderDialog.tsx` in scope for this phase despite being absent from D-01's file list?**
   - What we know: It's the only file implementing D-03 item 3 ("Void order confirm"); the `ConfirmDialog confirmClassName` mechanism it needs is a 1-line, zero-risk, already-established pattern; `09-rbac.spec.ts` (a required gate spec) exercises the void-order flow by accessible name only.
   - What's unclear: Whether its absence from D-01 was deliberate (descoped, addressed elsewhere/never) or an oversight.
   - Recommendation: Add it as a 7th isolated-PR file using the verbatim `confirmClassName` literal already used twice in Phase 32. If the user objects, they can strike it and D-03 item 3 becomes explicitly out-of-scope/deferred with a documented reason.

3. **Should `SplitTabSheet.tsx`'s remaining plain-`Button` sites (Add check, Add person, Keep tab open, Add-check-sm-in-Amount-mode) also get a consistency pass?**
   - What we know: D-01 only claims (incorrectly) that 3 sites are "already POSButton"; D-04's "everything else...gets 56px" language could be read to also require these non-critical buttons to move off the 44px shadcn `Button` default onto `POSButton` `large`.
   - What's unclear: CONTEXT.md doesn't explicitly direct action on these; Phase 31 deliberately chose plain `Button` for them (commit message explicitly says "Button", not an accident).
   - Recommendation: Treat as **out of scope** for Phase 33 — Phase 31 already made a considered decision here, and COMPONENT-04's zero-behavior-change framing plus D-01's narrow 6-file list suggests these were intentionally excluded (they're not "payment-critical" in the sense of moving money — they add UI columns, not payments). Only revisit if the planner's own drift scan flags them.

## Environment Availability

Skip — this phase is a pure frontend markup/prop-wiring change with zero new external tool/service/runtime dependencies. All required tooling (Node, npm, Vitest, Playwright, TypeScript) is the project's existing dev environment, already verified functional by every prior phase in this milestone (30, 31, 32).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 (unit) + Playwright ^1.59.1 (E2E) |
| Config file | `bar-pos/vitest.config.ts` (unit), `bar-pos/playwright.config.ts` (E2E) |
| Quick run command | `npx vitest run src/path/to/file.test.ts` (unit); `npx playwright test e2e/05-payments.spec.ts` (single E2E spec, requires dev server + `.env.local` E2E creds) |
| Full suite command | `npm run test` (unit); `npm run test:e2e` (E2E, requires `requireIntegrationEnv()` — live Supabase creds) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMPONENT-04 | POS payment flow (cash/card, tender, discount, tip) unaffected by markup swap | E2E | `npx playwright test e2e/05-payments.spec.ts` | ✅ exists |
| COMPONENT-04 | Split-payment (multi-method) add/remove/submit unaffected | E2E | `npx playwright test e2e/41-split-payment.spec.ts` | ✅ exists |
| COMPONENT-04 | Tip-distribution config + close-caja computation unaffected | E2E | `npx playwright test e2e/42-tip-distribution.spec.ts` | ✅ exists |
| COMPONENT-04 | Tab transfer flow (uses `TabDrawer`, out-of-scope file, but shares route context with `pos/index.tsx`) unaffected | E2E | `npx playwright test e2e/06-transfer.spec.ts` | ✅ exists |
| COMPONENT-04 | RBAC-gated void/refund/delete-tab flows unaffected (exercises `VoidOrderDialog.tsx` and the refund trigger flow) | E2E | `npx playwright test e2e/09-rbac.spec.ts` | ✅ exists |
| COMPONENT-04 (secondary, non-gate) | Panel-toggle testid survives | E2E | `npx playwright test e2e/29-panel-toggle.spec.ts` | ✅ exists, not a required gate but should stay green |
| COMPONENT-04 (secondary, non-gate) | Refund flow's "Request approval"/"Close refund" text survives | E2E | `npx playwright test e2e/35-refund.spec.ts` | ✅ exists, not a required gate but should stay green |
| COMPONENT-04 (secondary, non-gate) | `TabPaymentCard` aria-label contract survives | E2E | `npx playwright test e2e/17-payment-pane.spec.ts` | ✅ exists, not a required gate but should stay green |

### Sampling Rate
- **Per task commit:** `npm run typecheck && npm run lint` (fast, catches the `touchSize`-doesn't-exist-on-`Button` class of error from Pitfall 2 immediately) — plus the single relevant E2E spec if dev server + creds are available in the execution environment.
- **Per wave merge (i.e., per isolated-PR file):** run that file's specifically-relevant gate spec(s) from the table above.
- **Phase gate:** All 5 required gate specs (`05-payments`, `41-split-payment`, `42-tip-distribution`, `06-transfer`, `09-rbac`) green before `/gsd-verify-work`, per Success Criterion 3. Note these require `requireIntegrationEnv()` (live `.env.local` Supabase credentials) — if unavailable in the execution sandbox, this becomes a `checkpoint:human-verify` gate, consistent with how prior phases (30, 32) handled E2E verification when the dev server/live DB wasn't reachable from the agent's environment.

### Wave 0 Gaps
None — this phase adds no new behavior requiring new test files; it only must not regress the existing 5 gate specs (already exist, already pass on `main` per STATE.md's Phase 32 in-progress note — no indication any of these 5 are currently red).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unaffected — no auth logic touched |
| V3 Session Management | No | Unaffected |
| V4 Access Control | No (indirectly relevant) | `ProtectedAction` (Close Tab/Pay) and RBAC-gated actions (`process_refund`, void-order) are exercised by the changed buttons but their **gating logic is not modified** — only `className`/`touchSize`/`focusEmphasis` props change; `disabled`/`onClick`/`aria-*` are preserved verbatim per every diff shape above |
| V5 Input Validation | No | No form/input validation logic touched — `MoneyInput`/`QuantityControl`/`Checkbox`/`Select` components in these files are explicitly left untouched per CONTEXT.md and confirmed by source read |
| V6 Cryptography | No | Unaffected |

### Known Threat Patterns for this stack
Not applicable — this phase introduces no new attack surface (no new inputs, no new network calls, no new auth/authz code paths). The one control-flow-adjacent risk is **accidental disabling/enabling logic drift** if a task incorrectly touches the `disabled={...}` expression while adding `touchSize`/`focusEmphasis` — mitigated by the explicit "preserve verbatim" instruction embedded in every diff shape in this document, and by `npm run typecheck` catching prop-shape mismatches immediately.

## Sources

### Primary (HIGH confidence — direct source reads this session)
- `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\.planning\phases\33-payment-critical-page-sweep-isolated\33-CONTEXT.md` — locked decisions
- `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\.planning\REQUIREMENTS.md` — COMPONENT-04 full text
- `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\.planning\STATE.md` — project history/decisions
- `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\src\pages\pos\index.tsx` (full read)
- `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\src\widgets\OrderPanel\CartPanel.tsx` (full read)
- `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\src\widgets\PaymentModal\ui\PaymentForm.tsx` (full read)
- `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\src\widgets\PaymentPane\ui\TabPaymentCard.tsx` (full read)
- `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\src\features\process-refund\ui\RefundSheet.tsx` (full read)
- `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\src\features\split-tab\ui\SplitTabSheet.tsx` (full read)
- `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\src\shared\ui\POSButton.tsx`, `button.tsx`, `ConfirmDialog.tsx`, `ProtectedAction.tsx` (full reads)
- `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\src\features\void-order\ui\VoidOrderDialog.tsx` (full read)
- `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\e2e\05-payments.spec.ts`, `41-split-payment.spec.ts`, `42-tip-distribution.spec.ts` (full reads); `06-transfer.spec.ts`, `09-rbac.spec.ts` (grep + targeted section reads)
- `git log`/`git show` on `SplitTabSheet.tsx` — confirmed Phase 31 commit `6449f87` converted 3 raw buttons to plain `Button`, not `POSButton`
- `.planning/phases/31-component-token-spacing-consistency-sweep/31-CONTEXT.md` (full read) — confirms D-02's original intent
- `.planning/config.json` — confirms `nyquist_validation: true`, no `security_enforcement: false` override
- `package.json` (via node -e) — confirmed Vitest ^4.1.4, Playwright ^1.59.1, matching CLAUDE.md's stated versions

### Secondary (MEDIUM confidence)
None — all findings this session were verified directly against source files, git history, or config, not via external web search (this phase required zero external library research).

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing components read in full
- Architecture (per-file findings): HIGH — every file read in full at current HEAD; exact line numbers, imports, and JSX verified
- Pitfalls: HIGH for the mechanical ones (icon-sizing CSS conflict, variant-default visual regression); MEDIUM for the "which file/button satisfies D-03 item 5 / item 3" ambiguities since these are interpretive gaps in CONTEXT.md, not code facts — flagged explicitly as Open Questions rather than asserted as fact

**Research date:** 2026-07-13
**Valid until:** Effectively indefinite for the mechanical findings (source code doesn't drift without a commit) — but if any other phase touches these 6 files before Phase 33 executes, line numbers should be re-verified. Recommend re-reading source at execution time if more than ~7 days elapse.
