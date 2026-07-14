# Phase 33: Payment-Critical Page Sweep (Isolated) - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 7 (all modified, no new files)
**Analogs found:** 7 / 7 (all resolved to precedent set by Phases 30-32; no new components)

This phase has zero new files and zero new components. Every "analog" is either (a) a prior file in this same set that already received the target treatment, or (b) `StopSessionConfirm.tsx`/`StopAndMoveDialog.tsx` from Phase 32 for the `ConfirmDialog.confirmClassName` pattern. 33-RESEARCH.md already contains full current-source excerpts (verified against HEAD) for all 7 files — this document maps each to its pattern source and states the exact target diff. Treat 33-RESEARCH.md §Architecture Patterns / §Code Examples as the line-accurate companion to this file.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/pos/index.tsx` | component (page, icon toggle button) | request-response (UI state toggle) | same file's own `Close Tab / Pay` button (line 87, already `POSButton touchSize="large"`) | exact (same file precedent) |
| `src/widgets/OrderPanel/CartPanel.tsx` | component (widget, text-link button) | request-response (cart mutation, local state) | same file's own `Place Order` button (line 171, already `POSButton touchSize="xl"`) | exact (same file precedent) |
| `src/widgets/PaymentModal/ui/PaymentForm.tsx` | component (widget, payment form — 2 distinct buttons in scope) | request-response (payment submit) / event-driven (row removal) | same file's own tip-preset/discount `POSButton` usages (`touchSize="large"`) for the Reset-link conversion; same file's Process/Split-Confirm button (already `xl`, needs `focusEmphasis`) for itself | exact (same file precedent) |
| `src/widgets/PaymentPane/ui/TabPaymentCard.tsx` | component (widget, selectable card-as-button) | request-response (tab selection) | `SplitTabSheet.tsx`'s `POSButton`-wrapped selectable elements (nearest `POSButton`-as-clickable-card precedent) | role-match |
| `src/features/process-refund/ui/RefundSheet.tsx` | feature (sheet form, footer actions) | request-response (refund request → PIN gate) | `src/features/void-order/ui/VoidOrderDialog.tsx` + `StopSessionConfirm.tsx` (destructive/critical confirm pattern); `PaymentForm.tsx`'s Cancel/Process pair for the outline+primary footer-pair shape | role-match (destructive confirm) / exact (footer button pair shape) |
| `src/features/split-tab/ui/SplitTabSheet.tsx` | feature (sheet form, multiple buttons) | request-response (split confirm) / event-driven (row add/remove) | same file's own `Confirm Split` button (already `POSButton touchSize="large"`, needs tier bump) for itself; `PaymentForm.tsx`'s `Remove payment N` ghost-icon-with-`aria-label` button (line 721) for the `Remove check` icon-button conversion | exact (same file) / role-match (icon-button remove pattern) |
| `src/features/void-order/ui/VoidOrderDialog.tsx` | feature (ConfirmDialog wrapper) | request-response (destructive confirm) | `StopSessionConfirm.tsx` / `StopAndMoveDialog.tsx` (Phase 32) — verbatim `confirmClassName` literal | exact |

## Shared Patterns

### Pattern A — `POSButton.tsx` (`src/shared/ui/POSButton.tsx`)
**Applies to:** every file above.
**API:** `touchSize?: 'default' | 'large' | 'xl'` → `min-h-[44px]` / `min-h-[56px] text-base` / `min-h-[72px] text-lg font-semibold`. Forwards all other `ButtonProps` (`variant`, `disabled`, `className`, `aria-*`, `focusEmphasis`) straight through to `Button`. It wraps the same underlying `<button>` DOM element and event handlers as raw `<button>`/shadcn `Button` — swap is behavior-preserving by construction.
**Rule:** `touchSize` only sets `min-height`, never `min-width`. Icon-only buttons using `size="icon-sm"`/`size="icon"` need an explicit width fix (`className="w-[Npx]"` or drop the `size` prop) when bumped to `touchSize="xl"`, or the result is a tall sliver, not a square (see `SplitTabSheet.tsx` "Remove check" below).

### Pattern B — `Button` base CVA (`src/shared/ui/button.tsx`)
**Applies to:** every converted/upgraded button.
**API:** `focusEmphasis?: 'default' | 'high'` → `default: ''`, `high: 'focus-visible:ring-4 focus-visible:ring-ring'` (vs. CVA base default `focus-visible:ring-3`). Default variant if `variant` is omitted is `'default'` — solid `bg-primary` background.
**Rule (critical — zero-visual-change constraint):** any raw `<button>`/unstyled element being converted MUST get an explicit `variant` (`"ghost"` or `"link"`) if its current markup has no background styling, or the conversion silently adds a solid primary-color background. Applies to: `pos/index.tsx` panel toggle, `CartPanel.tsx` Clear Cart, `PaymentForm.tsx` Reset-to-computed link.

### Pattern C — `ConfirmDialog.confirmClassName` (`src/shared/ui/ConfirmDialog.tsx`)
**Source call sites:** `StopSessionConfirm.tsx`, `StopAndMoveDialog.tsx` (Phase 32).
**Applies to:** `VoidOrderDialog.tsx` (this phase's D-03 item 3).
**Verbatim literal to copy (do not paraphrase):**
```
confirmClassName="min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring"
```
This is an opt-in prop merged via `cn()` onto the `AlertDialogAction` only — no other change needed in `VoidOrderDialog.tsx`.

### Pattern D — Dead hand-rolled sizing/ring classes must be deleted on swap
**Applies to:** `RefundSheet.tsx` ("Request approval" currently has literal `min-h-[56px]` in `className` — delete when adding `touchSize="xl"`), `TabPaymentCard.tsx` (currently has hand-rolled `focus-visible:ring-2 focus-visible:ring-ring` in its card `className` — delete when swapping to `POSButton`, whose CVA base already supplies its own ring).

---

## Pattern Assignments

### `src/pages/pos/index.tsx` (component, panel-toggle icon button)

**Analog:** same file's `Close Tab / Pay` button (already-converted precedent, line ~87)

**Current (raw `<button>`, lines 57-72, verified in 33-RESEARCH.md):**
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
**Target pattern:** swap to `POSButton`, add explicit `variant="ghost"` (Pattern B rule — this button has custom bg/border styling, must not pick up CVA default's `bg-primary`), keep `data-testid`/`aria-label`/`aria-pressed`/`onClick` verbatim. `h-9 w-9` (36px) is below the 44px floor — fix width explicitly (e.g. `w-11` alongside default `touchSize`) per 33-RESEARCH.md's note; this button is not one of D-03's 5 critical actions, so `touchSize="default"` (44px floor) is correct, not `large`/`xl`.
**`POSButton` import:** already present in this file (`import { PageContainer, POSButton, ProtectedAction } from '@shared/ui';`) — no new import line needed.

---

### `src/widgets/OrderPanel/CartPanel.tsx` (component, Clear Cart text-link)

**Analog:** same file's `Place Order` button (already `POSButton touchSize="xl"`, line ~171) — establishes the file's own `POSButton` import + usage convention.

**Current (raw `<button>`, lines 185-193):**
```tsx
<button
  type="button"
  className="text-sm text-muted-foreground underline decoration-muted-foreground/60 underline-offset-2 hover:text-foreground"
  onClick={() => { clearCart(); }}
>
  Clear Cart
</button>
```
**Target pattern (Pattern A + B):**
```tsx
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
`POSButton` already imported in this file. Do NOT touch `Place Order` (line 171) — not named in D-03/D-04 for this phase, leave `touchSize="xl"` as-is with no `focusEmphasis` addition.

---

### `src/widgets/PaymentModal/ui/PaymentForm.tsx` (widget — 2 distinct in-scope elements)

**Analog for "Reset to computed" (raw `<button>`, lines 954-964):** same file's discount/tip `POSButton` usages establish `variant`/`className` merge convention.
```tsx
// current
<button type="button" data-testid="card-override-reset" className="text-xs text-muted-foreground underline" onClick={() => { setCardChargeOverride(null); }}>
  Reset to computed (${runningTotal.toFixed(2)})
</button>
// target — Pattern A+B, floor tier (not named critical/frequent)
<POSButton type="button" variant="ghost" touchSize="default" data-testid="card-override-reset" className="text-xs text-muted-foreground underline" onClick={() => { setCardChargeOverride(null); }}>
  Reset to computed (${runningTotal.toFixed(2)})
</POSButton>
```

**Analog for Process Payment / split-final-confirm button (already `POSButton touchSize="xl"`, lines ~1000-1021):** self — prop-only addition, no primitive swap.
```tsx
// add focusEmphasis="high" only; everything else (label logic, disabled, className, onClick) untouched
<POSButton type="button" touchSize="xl" focusEmphasis="high" disabled={...} className="w-full bg-[var(--pos-accent)] text-black hover:bg-[var(--pos-accent)]/90" onClick={...}>
```

**Analog for "Remove payment N" (already `POSButton variant="ghost"`, no `touchSize`, lines ~721-733):** self — this is D-03 item 5's gate-spec-tested candidate (per Open Question A1 in research, recommend applying the upgrade here in addition to `SplitTabSheet.tsx`'s "Remove check"). Add `touchSize="xl" focusEmphasis="high"` — same icon-button width-fix concern as `SplitTabSheet.tsx` applies here too since it's currently unset/44px default with a `Trash2` icon child (no explicit `size="icon-*"`, so width is likely fine at default padding — verify visually at execution).

**Do not touch:** Cancel button (line ~1024, already `POSButton touchSize="large"` — matches D-04, no change).

---

### `src/widgets/PaymentPane/ui/TabPaymentCard.tsx` (whole-card button)

**Analog:** no `POSButton`-as-clickable-card precedent exists in-repo exactly; closest is `SplitTabSheet.tsx`'s `POSButton`-wrapped confirm/picker elements for the "how `POSButton` composes with a `cn()`-merged `className` block" pattern, plus this file's own pre-CVA hand-rolled ring as the thing being removed (Pattern D).

**Current (raw `<button>` root, lines 27-66):**
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
**Target pattern:** add fresh import `import { POSButton } from '@shared/ui/POSButton';` (or via barrel, matching existing `import { MoneyDisplay } from '@shared/ui';` style already in file). Swap to `POSButton touchSize="large"` (D-04 "frequent" tier — tab selection is frequent, non-destructive, non-final). Drop the hand-rolled `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` (Pattern D — CVA base already supplies its own ring via `focusEmphasis` default). Keep `aria-label`, `aria-pressed`, `onClick`, and all child content (badges/MoneyDisplay/item count) verbatim — `17-payment-pane.spec.ts` asserts on `getByRole('button', { name: /tab {customerName}/i })`.

---

### `src/features/process-refund/ui/RefundSheet.tsx` (sheet footer, 2 buttons — full primitive swap)

**Analog for both buttons:** `PaymentForm.tsx`'s Cancel/Process footer pair (outline + primary/critical action side by side) for the two-button-footer shape; `StopSessionConfirm.tsx`/`VoidOrderDialog.tsx` for the destructive-confirm 72px+high-ring tier applied to "Request approval."

**Current (lines 307-320):**
```tsx
import { Button, MoneyDisplay, QuantityControl } from "@shared/ui";
...
<Button variant="outline" className="flex-1" onClick={() => { onOpenChange(false); }}>
  Close refund
</Button>
<Button className="flex-1 min-h-[56px]" disabled={!isValid || mutation.isPending} onClick={() => { setPinOpen(true); }}>
  Request approval
</Button>
```
**Target:**
```tsx
import { MoneyDisplay, POSButton, QuantityControl } from "@shared/ui";
...
<POSButton variant="outline" touchSize="large" className="flex-1" onClick={() => { onOpenChange(false); }}>
  Close refund
</POSButton>
<POSButton touchSize="xl" focusEmphasis="high" className="flex-1" disabled={!isValid || mutation.isPending} onClick={() => { setPinOpen(true); }}>
  Request approval
</POSButton>
```
Note (Pattern D): delete the dead `min-h-[56px]` literal — `touchSize="xl"` supersedes it. No `variant` ambiguity on "Request approval" (was already unstyled/default). `disabled`/`onClick` must stay byte-identical — this button opens `ManagerPinDialog`, it does not submit the refund itself. Text `"Request approval"`/`"Close refund"` must be preserved verbatim (`35-refund.spec.ts` asserts by accessible name).

---

### `src/features/split-tab/ui/SplitTabSheet.tsx` (multiple buttons — mixed swap/prop-only)

**Analog for "Confirm Split" (already `POSButton touchSize="large"`, lines ~792-801):** self, prop-only upgrade.
```tsx
// before
<POSButton touchSize="large" className="flex-1" disabled={!isValid || isMutating} onClick={() => { void handleConfirm(); }}>
  Confirm Split
</POSButton>
// after
<POSButton touchSize="xl" focusEmphasis="high" className="flex-1" disabled={!isValid || isMutating} onClick={() => { void handleConfirm(); }}>
  Confirm Split
</POSButton>
```

**Analog for "Remove check" (currently plain `Button variant="ghost" size="icon-sm"`, lines ~736-748):** `PaymentForm.tsx`'s "Remove payment N" ghost-icon-with-`aria-label` `POSButton` (line ~721) is the nearest in-repo icon-button-as-destructive-remove pattern.
```tsx
// current
{amountRows.length > 2 && (
  <Button variant="ghost" size="icon-sm" type="button" onClick={() => { removeAmountRow(row.id); }} aria-label={`Remove check ${String(i + 1)}`}>
    <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
  </Button>
)}
// target — full primitive swap Button -> POSButton, PLUS explicit width fix (Pitfall 1 in RESEARCH.md:
// touchSize only sets min-height; size="icon-sm" sets a fixed 28px width via `size-7`, which combined
// with min-h-[72px] produces a 28px x 72px sliver, not a square). Drop size="icon-sm", add className width.
{amountRows.length > 2 && (
  <POSButton variant="ghost" touchSize="xl" focusEmphasis="high" type="button" className="w-[72px]" onClick={() => { removeAmountRow(row.id); }} aria-label={`Remove check ${String(i + 1)}`}>
    <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
  </POSButton>
)}
```
Both `Button` and `POSButton` imports stay in this file (some plain-`Button` sites — Add check, Add person, Keep tab open, per D-01b's "no additional change" list — remain plain `Button`, except Add check/Add person which D-01b now converts to `POSButton touchSize="large"` per the phase's CONTEXT.md correction). **Do not touch** the Evenly-mode number picker (line ~487, already `POSButton touchSize="xl"`, no `focusEmphasis` — not named in D-03/D-04).

**D-01b addition (Add check / Add person, lines ~597, ~693):** convert both from `<Button variant="outline" ...>` to `<POSButton variant="outline" touchSize="large" ...>` — same swap shape as `RefundSheet.tsx`'s "Close refund," D-04 frequent tier.

---

### `src/features/void-order/ui/VoidOrderDialog.tsx` (ConfirmDialog wrapper — 1-line addition)

**Analog:** `StopSessionConfirm.tsx` / `StopAndMoveDialog.tsx` (Phase 32) — verbatim literal, no deviation.

**Target (add one prop to the existing `ConfirmDialog` call, nothing else):**
```tsx
<ConfirmDialog
  ...
  confirmClassName="min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring"
  ...
/>
```
`disabled`/`onClick`/`onConfirm`/label text must stay untouched. `09-rbac.spec.ts` asserts `getByRole('button', { name: /void order/i })` — accessible name unaffected by className addition.

## No Analog Found

None. Every file in scope maps to an existing in-repo precedent — either a sibling button in the same file already carrying the target `touchSize`/`focusEmphasis`, or the Phase 32 `ConfirmDialog.confirmClassName` call sites. No new component or pattern is required for this phase.

## Metadata

**Analog search scope:** `src/shared/ui/POSButton.tsx`, `src/shared/ui/button.tsx`, `src/shared/ui/ConfirmDialog.tsx`, and the 7 in-scope files themselves (self-referential precedent — this is a rollout/conversion phase, not new-pattern authorship).
**Files scanned:** 7 target files + 3 shared-ui primitives + 2 Phase 32 `ConfirmDialog` call sites (`StopSessionConfirm.tsx`, `StopAndMoveDialog.tsx`), all already fully read and excerpted in `33-RESEARCH.md`.
**Pattern extraction date:** 2026-07-13
