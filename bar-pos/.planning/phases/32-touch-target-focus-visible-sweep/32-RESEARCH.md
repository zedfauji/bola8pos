# Phase 32: Touch Target & Focus-Visible Sweep - Research

**Researched:** 2026-07-13
**Domain:** Frontend styling rollout (Tailwind sizing classes + CVA focus-ring variant + Playwright tab-order verification) across 6 existing React/Tauri pages
**Confidence:** HIGH (all findings verified against live repo source, no external library research needed — this phase touches zero new dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Every raw shadcn `Button`/icon-button instance on the 6 in-scope pages gets bumped to a minimum 44px touch target (`POSButton touchSize="default"` or equivalent `min-h-[44px]`) — no exceptions, including icon-only buttons and controls inside dense tables/lists (e.g. `InventoryPagePanel`'s DataTable row actions).
- **D-02:** `PoolTableGrid` (`src/widgets/PoolTableGrid/index.tsx`) mixes `POSButton` and plain `Button` today (line 120 uses raw `Button`) — that raw `Button` gets converted to `POSButton` per D-01.
- **D-03:** Only truly destructive/irreversible actions get the 72px (`xl`) size: void/cancel pool session, stop-and-move table, delete inventory batch. Everything else that's a frequent/primary action (add stock, notify waitlist, seat party, start timer, save prep batch, bump KDS order) gets 56px (`large`). Controls that are neither critical nor a primary/frequent action stay at the 44px floor.
- **D-04:** No control-specific exceptions — the planner does not need to hunt for a fixed-layout constraint that blocks growing a control; none was flagged.
- **D-05:** No literal +/- stepper controls exist on the 6 in-scope pages (inventory's batch-delta field, `InventoryPagePanel.tsx:353`, is a plain signed number input per Phase 31's D-06, not stepper buttons). TOUCH-03 for this phase is a **grid-gap audit**, not a stepper-spacing fix. **RESEARCH CORRECTION: this premise is factually wrong — see Pitfall 4 below. A stepper (`QuantityControl`) does exist in the inventory `DataTable`, already compliant.**
- **D-06:** Enforce an 8px minimum gap between adjacent tappable cards/buttons in `PoolTableGrid` (currently `gap-4` / 16px at `src/widgets/PoolTableGrid/index.tsx:159,173` — already passes, verify not regress), the KDS/`kds-bar` order-card grids, and the kitchen-prep batch grid.
- **D-07:** Include KDS/`kds-bar` per-card action buttons (Start/Ready/Bump-style) in the spacing check even though they're expected to already be stacked/full-width — verify with the actual markup, don't assume compliance.
- **D-08:** FOCUS-01 (baseline visible focus-visible state) is already satisfied app-wide by `src/shared/ui/button.tsx`'s CVA base classes (`focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`) — no work needed for the baseline case, only verify it survives the touch-sizing className changes.
- **D-09:** For FOCUS-02, add a `focusEmphasis="high"` prop to the **base** `src/shared/ui/button.tsx` CVA variants (not just `POSButton`) that swaps the focus ring from `focus-visible:ring-3 focus-visible:ring-ring/50` to `focus-visible:ring-4 focus-visible:ring-ring` (full opacity, +1px width). It's a shared Button prop so future phases can reuse it, even though Phase 32 only wires it up on the 3 controls below.
- **D-10:** Apply `focusEmphasis="high"` to the **same set** identified as 72px-critical in D-03: void/cancel pool session, stop-and-move table, delete inventory batch. No broader set (no "also every primary confirm button") — keep the emphasized ring reserved for genuinely destructive/high-stakes actions. **RESEARCH FLAG: "delete inventory batch" does not exist in the codebase — see Pitfall 5 and Open Question 1.**
- **D-11:** PINKeypad/SearchInput barely intersect these 6 pages directly: `PINKeypad` only appears indirectly via `ManagerPinDialog` (`src/features/manager-pin-gate/ui/ManagerPinDialog.tsx`), which is used from `TableStatusPanel` (`src/widgets/TableStatusPanel/index.tsx`) for PIN-gated actions; `SearchInput` only appears via `DataTable` (`src/shared/ui/DataTable.tsx`), which inventory's page/panel likely uses for its search/filter row.
- **D-12:** FOCUS-03 scope for this phase = verify keyboard tab order through: (a) `ManagerPinDialog`'s PIN entry flow as reached from `TableStatusPanel`, (b) inventory's `DataTable` search/filter row, and (c) any other form inputs on inventory/kitchen-prep (e.g. batch qty, adjustment-reason fields). Not a blanket sweep of every input on every page beyond these named surfaces.
- **D-13:** Verification method is an **automated Playwright test**, not manual click-through-and-document. Add a new spec file `e2e/43-focus-tab-order.spec.ts` asserting Tab-key focus order matches visual order through the surfaces named in D-12. This becomes part of the permanent e2e suite (add to the 22-spec list in `CLAUDE.md` §E2E Test Suite once created). **RESEARCH CORRECTION: `43` collides with the existing `e2e/43-promotions.spec.ts` — use `e2e/44-focus-tab-order.spec.ts` instead. See Pitfall 3.**

### Claude's Discretion

None called out explicitly beyond the implementation-detail latitude implied by D-04 (no fixed-layout exceptions to hunt for) and the minimal-diff-vs-formal-prop-threading choice for `ConfirmDialog`'s extension (see Architecture Pattern 3 / Assumption A2).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope (per CONTEXT.md `<deferred>`).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOUCH-01 | All interactive elements meet a 44px minimum touch target (app floor, above WCAG's 24px legal minimum) | Confirmed `POSButton touchSize="default"` implements this; identified additional raw-Button sites beyond CONTEXT.md's list (inventory "Physical Count" button, `SearchInput` clear button, `KdsBoard`'s 3 buttons, `SortHeader` native button) that must be folded into scope — see Architecture Patterns / Pitfall 1 |
| TOUCH-02 | Frequent-action controls use 56px; critical/rare high-stakes actions use 72px | Confirmed `POSButton touchSize="large"/"xl"` implement these; found that 2 of the 3 named 72px targets route through `ConfirmDialog`/`AlertDialogAction` (not `POSButton`), requiring a new prop-threading pattern — see Architecture Pattern 3; found the 3rd target ("delete inventory batch") does not exist — see Pitfall 5 |
| TOUCH-03 | Adjacent touch targets in grids maintain adequate spacing | Verified `PoolTableGrid` (`gap-4`), KDS/kds-bar card stacking (`space-y-4`/`gap-6`), and `KitchenPrepDashboard`'s on-hand card grid (`gap-4`) are all already compliant (verify-only, no code change); corrected D-05's stepper-absence premise — `QuantityControl` exists and is also already compliant |
| FOCUS-01 | All interactive elements have a visible focus-visible state using `--ring` | Confirmed baseline ring already exists in `buttonVariants` base classes (`button.tsx:8`); confirmed `--ring` token values match UI-SPEC exactly (`globals.css:28,70`) |
| FOCUS-02 | Primary action buttons use a higher-contrast/thicker focus ring | Documented exact CVA variant to add (`focusEmphasis`) and the twMerge class-resolution mechanics that make it work (Architecture Pattern 2); flagged that it needs separate wiring into `ConfirmDialog`/`alert-dialog.tsx` to actually reach the 2 real destructive targets (Pitfall 2) |
| FOCUS-03 | Tab order across forms and keypad/search inputs verified sane | Confirmed exact e2e spec conventions (`./fixtures`, `helpers/auth.ts`) and the correct next-free spec number (`44`, not the colliding `43`); confirmed no existing unit test covers tab order, so this is genuinely new coverage |

</phase_requirements>


## Summary

This phase is a mechanical rollout, not new-pattern work: `POSButton`'s `touchSize` scale already implements the 44/56/72px targets, and the base `Button` CVA already has a baseline focus-visible ring. The only genuinely new code is a `focusEmphasis` variant on `buttonVariants`. Research confirms CONTEXT.md's file list (`PoolTableGrid`, `TableStatusPanel`, `InventoryPagePanel`, `KitchenPrepDashboard`, `KdsBoard`) is accurate but incomplete, and surfaces four load-bearing corrections the planner must account for before writing tasks: (1) the new e2e spec number `43` collides with an existing spec, (2) one of the three named "72px + focusEmphasis" destructive targets (delete inventory batch) does not exist anywhere in the codebase, (3) the two destructive targets that *do* exist route through `ConfirmDialog`/`AlertDialogAction`, not `POSButton` — a different component that needs its own prop-threading to accept `touchSize`/`focusEmphasis`, and (4) D-05's premise that no stepper control exists in scope is factually wrong (one exists, already compliant, in the inventory `DataTable`).

**Primary recommendation:** Convert the additional raw-`Button` sites found below alongside CONTEXT.md's list; extend `ConfirmDialog` (not `POSButton`) with optional `confirmTouchSize`/`confirmFocusEmphasis` passthrough props for the 2 real destructive-confirm targets; renumber the new e2e spec to `44-focus-tab-order.spec.ts`; and get explicit user sign-off on the "delete inventory batch" gap before locking D-03/D-10's target set.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Touch-target sizing (`touchSize` classes) | Browser / Client | — | Pure Tailwind class application on existing React components, no server involvement |
| Focus-ring escalation (`focusEmphasis` CVA variant) | Browser / Client | — | CSS-only visual state driven by `:focus-visible`, no data flow |
| Grid-gap spacing audit | Browser / Client | — | Static Tailwind `gap-*` classes on existing grid containers |
| Tab-order verification | Browser / Client | Test / Tooling (Playwright) | Keyboard focus order is a DOM/browser behavior; Playwright drives a real browser to assert it — no backend involved |

No API/backend/database tier is touched by this phase — 100% client-tier + test-tooling.

## Standard Stack

No new libraries. This phase extends only already-installed, already-used project code:

| Component | Location | Role in this phase |
|-----------|----------|---------------------|
| `POSButton` | `src/shared/ui/POSButton.tsx` | Rollout target — `touchSize` prop already implements 44/56/72px scale |
| `Button` / `buttonVariants` | `src/shared/ui/button.tsx` | Extension target — add `focusEmphasis` CVA variant |
| `ConfirmDialog` / `alert-dialog.tsx` | `src/shared/ui/ConfirmDialog.tsx`, `src/shared/ui/alert-dialog.tsx` | **New extension target not in CONTEXT.md's canonical_refs** — see Architecture Patterns below |
| Playwright | `bar-pos/playwright.config.ts`, `e2e/` | Already installed (`^1.59`), used for the new tab-order spec |
| Vitest + RTL | `bar-pos/vitest.config.ts` | Already installed, used for `focusEmphasis` class-application unit test |

**Installation:** None required — zero new packages.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. No `npm install` commands appear in any plan task; slopcheck/registry verification is skipped per the gate's own scope rule ("Required whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
User (keyboard or touch) ──▶ 6 in-scope pages (pool-tables, pool-table-status,
                                inventory, kitchen-prep, kds, kds-bar)
                                    │
                    ┌───────────────┼───────────────────────┐
                    ▼                                       ▼
     Raw shadcn <Button> / icon-button          Destructive confirm actions
     instances found on these pages              (void/cancel pool session,
     (grid buttons, table row actions,            stop-and-move-table)
     search-clear, sort-header, retry, bump)                │
                    │                                       ▼
                    ▼                          ConfirmDialog ──▶ AlertDialogAction /
     Convert to POSButton{touchSize}            AlertDialogCancel (alert-dialog.tsx)
     (44 / 56 / 72px per D-03 table)             — currently NOT POSButton-based;
                    │                             needs new confirmTouchSize /
                    ▼                             confirmFocusEmphasis passthrough
     Button CVA (button.tsx) — base focus-       props to reach 72px + focusEmphasis
     visible ring (D-08, verify-only) +
     new focusEmphasis="high" variant (D-09)
                    │
                    ▼
     Playwright e2e/44-focus-tab-order.spec.ts (renumbered from the
     colliding e2e/43-*) asserts Tab-key order through:
       (a) ManagerPinDialog reached via TableStatusPanel
       (b) inventory DataTable search/filter row
       (c) other inventory/kitchen-prep form inputs
```

### Recommended Project Structure

No new files/folders beyond the one new e2e spec — this phase edits in place:

```
src/shared/ui/button.tsx              # + focusEmphasis CVA variant
src/shared/ui/ConfirmDialog.tsx       # + confirmTouchSize / confirmFocusEmphasis passthrough (new, not in CONTEXT.md)
src/shared/ui/alert-dialog.tsx        # AlertDialogAction/Cancel forward focusEmphasis into buttonVariants()
src/widgets/PoolTableGrid/index.tsx   # line 120 raw Button -> POSButton (D-02)
src/pages/inventory/index.tsx         # "Physical Count" raw Button -> POSButton (new finding)
src/shared/ui/SearchInput.tsx         # clear button raw Button -> POSButton (new finding, shared-component ripple)
src/entities/inventory/ui/InventoryRow.tsx  # SortHeader native <button> — flag for planner decision (new finding)
src/widgets/KdsBoard/index.tsx        # 3 raw Button instances -> POSButton (new finding, shared by kds + kds-bar)
e2e/44-focus-tab-order.spec.ts        # NEW spec (renumbered from colliding 43)
```

### Pattern 1: `touchSize`/`focusEmphasis` class flow through `cn()`/twMerge

**What:** `POSButton` merges its `touchSizeClasses[touchSize]` map first, then `className`, via `cn()` (`clsx` + `tailwind-merge`). `Button` itself merges `buttonVariants({variant, size, className})` through the same `cn()`. Because `tailwind-merge` treats `h-*`/`min-h-*` as non-conflicting groups, an existing `h-8` (default `size`) and an added `min-h-[72px]` (touchSize) coexist without dropping either — the browser resolves the taller `min-height` as the effective floor. This is exactly the pattern already used successfully by every existing `POSButton touchSize="large"` instance in the codebase (e.g. `PoolTableCard`, `TableStatusPanel`).

**When to use:** Any conversion of a raw `Button` → `POSButton`, or wiring a new `focusEmphasis` variant onto the base CVA.

**Example (existing, verified working):**
```tsx
// Source: src/entities/pool-table/ui/PoolTableCard.tsx:150-165
<POSButton
  type="button"
  variant="destructive"
  touchSize="large"
  className="w-full"
  onClick={e => { e.stopPropagation(); onStopSession(); }}
>
  Stop Session
</POSButton>
```

### Pattern 2: `focusEmphasis` CVA variant — placement matters for twMerge dedup

**What:** The base `focus-visible:*` classes live in `buttonVariants`'s **base string** (`button.tsx:8`), not in a `variant`/`size` slot. A new `focusEmphasis` CVA variant slot (`default: ''`, `high: 'focus-visible:ring-4 focus-visible:ring-ring'`) will be concatenated by CVA's internal `clsx` *after* the base string, then the whole result is passed through `Button`'s own `cn(buttonVariants({...}))` call, which runs `tailwind-merge`. Because `tailwind-merge` resolves same-group conflicts by **last occurrence wins**, and the variant classes appear after the base classes in the joined string, `ring-4`/`ring-ring` will correctly override `ring-3`/`ring-ring/50`. This should work with a straightforward CVA variant addition — but it is a class-merge edge case worth a one-line unit test (see Validation Architecture) rather than trusting it silently.

**Example implementation sketch:**
```tsx
// src/shared/ui/button.tsx — add to the variants object
focusEmphasis: {
  default: '',
  high: 'focus-visible:ring-4 focus-visible:ring-ring',
},
// add to defaultVariants: focusEmphasis: 'default'
```

### Pattern 3: `ConfirmDialog` is not `POSButton`-based — new passthrough needed

**What:** `ConfirmDialog` (`src/shared/ui/ConfirmDialog.tsx`) renders its confirm/cancel buttons via `AlertDialogAction`/`AlertDialogCancel` (`src/shared/ui/alert-dialog.tsx`), which style themselves with `buttonVariants()` directly — they do **not** go through the `Button()` function or `POSButton`. `ConfirmDialog` has 20 call sites app-wide (`Grep` verified), so any change must be additive/opt-in, not a global default change.

**Why this matters for this phase specifically:** Both real destructive/72px targets — the pool-session "Stop & finalize" confirm (`StopSessionConfirm.tsx` → `ConfirmDialog`) and the "Stop & Move" confirm (`StopAndMoveDialog.tsx` → `ConfirmDialog`) — are `AlertDialogAction` instances, not `POSButton`. D-01's "convert raw Button to POSButton" instruction does not apply to them; a different mechanism is needed.

**Recommended minimal-diff approach:** Add two optional props to `ConfirmDialog` (e.g. `confirmClassName?: string`) that get merged into `AlertDialogAction`'s existing `className` merge point (`cn(buttonVariants({variant:'destructive'?}), className)` in `alert-dialog.tsx:95`). Since `AlertDialogAction` already accepts and merges `className`, passing the literal `min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring` string through this prop from the 2 call sites achieves the visual result without needing `AlertDialogAction` to formally understand a `focusEmphasis` prop. This is the smallest diff. An alternative (larger diff, more consistent with D-09's "reusable prop" intent) is to have `alert-dialog.tsx` accept and forward a real `focusEmphasis` prop into its own `buttonVariants({focusEmphasis})` call — flag this tradeoff for the planner to choose; either is technically correct.

### Anti-Patterns to Avoid

- **Converting `PINKeypad`'s own buttons to `POSButton`:** They are already `h-16` (64px), exceeding the 44px floor. `PINKeypad` is also consumed by `clock-in-staff` and `PINLoginForm` (out-of-scope pages per CONTEXT.md's Integration Points warning). Converting it is unnecessary for touch-target compliance and carries real ripple risk — recommend leaving it untouched this phase, verify-only for FOCUS-01 baseline survival.
- **Applying `confirmFocusEmphasis`/`confirmTouchSize` as new `ConfirmDialog` defaults:** Would silently resize all 20 existing `ConfirmDialog` callers (including payment-critical flows explicitly out of scope for Phase 32, reserved for Phase 33). Must be opt-in per-call-site props only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 44/56/72px touch scale | A new size prop/component | `POSButton`'s existing `touchSize` | Already implements exactly this scale, already proven in production usage across the codebase |
| Higher-contrast focus ring | A new ring color/utility class scattered per-component | New `focusEmphasis` CVA variant on shared `buttonVariants` | Keeps the ring token single-sourced in `button.tsx`, reusable by future phases per D-09 |
| Tab-order assertions | Manual click-through checklist | Playwright `page.keyboard.press('Tab')` + `expect(locator).toBeFocused()` loop | Automatable, repeatable, becomes permanent regression coverage (D-13) |

**Key insight:** Every piece of "infrastructure" this phase needs already exists in the codebase. The work is entirely application (which classes/props go on which existing elements), not construction.

## Common Pitfalls

### Pitfall 1: Assuming CONTEXT.md's file list is exhaustive
**What goes wrong:** Shipping a rollout that misses raw `Button`/icon-button instances CONTEXT.md's scouting pass didn't catch, leaving TOUCH-01 partially unsatisfied.
**Why it happens:** CONTEXT.md's canonical_refs were gathered via targeted discussion, not an exhaustive grep of the 6 in-scope pages' full component trees (including shared components they consume, like `SearchInput`, `DataTable`, `QuantityControl`, `KdsBoard`).
**How to avoid:** This research's additional findings (SortHeader, SearchInput clear button, KdsBoard's 3 Buttons, inventory's Physical Count button, QuantityControl stepper) close that gap — the planner should fold them into task scope alongside CONTEXT.md's list.
**Warning signs:** A post-hoc grep for `<Button` / `size="icon"` / `size="sm"` on the 6 pages' full render trees turns up more hits than the plan converted.

### Pitfall 2: `focusEmphasis` silently no-ops on `ConfirmDialog`/`AlertDialogAction`
**What goes wrong:** Planner adds `focusEmphasis="high"` to `buttonVariants` (D-09), assumes it "just works" on the 2 destructive confirm buttons because they're described as `POSButton`-equivalent in CONTEXT.md, ships it, and the ring never appears because `AlertDialogAction` doesn't consume the `Button` component or the `focusEmphasis` prop at all.
**Why it happens:** CONTEXT.md's canonical_refs never mention `ConfirmDialog.tsx`/`alert-dialog.tsx` — the document implicitly assumes the 3 destructive controls are simple `POSButton`s like everything else in `PoolTableCard`.
**How to avoid:** See Architecture Pattern 3 above — explicitly plan the `ConfirmDialog` extension as its own task.
**Warning signs:** Visual QA of the "Stop & finalize"/"Stop & Move" confirm buttons shows no visible ring-width change after the `focusEmphasis` prop lands on `button.tsx`.

### Pitfall 3: e2e spec number collision
**What goes wrong:** `e2e/43-focus-tab-order.spec.ts` (D-13's literal filename) collides with the already-existing `e2e/43-promotions.spec.ts` (shipped by the parallel Phase 20 promotions-engine branch, merged per `.planning/STATE.md`'s 2026-07-13 commit log). Writing to `43-*` either silently shadows Playwright's file-glob test discovery in unexpected ways or requires an awkward rename later.
**Why it happens:** CONTEXT.md was authored before checking the current max spec number in `e2e/`; `43` was free when the milestone's roadmap was drafted but got claimed by unrelated work that merged afterward.
**How to avoid:** Use `e2e/44-focus-tab-order.spec.ts` — verified as the next free number (highest existing is `43-promotions.spec.ts`, confirmed via `ls e2e/*.spec.ts`).
**Warning signs:** `ls e2e/*.spec.ts | sort` before creating the file — the planner should always re-verify this at execute time in case another phase lands a spec in between.

### Pitfall 4: Trusting D-05's "no stepper exists" premise verbatim
**What goes wrong:** Skipping any stepper-specific verification because D-05 states none exist, missing that `InventoryRow.tsx`'s `QuantityAdjustCell` renders `QuantityControl` (`src/shared/ui/QuantityControl.tsx`) — a literal three-button +/- stepper — once per row in the inventory page's main `DataTable`.
**Why it happens:** D-05 correctly identified that the *dialog's* batch-delta field (`InventoryPagePanel.tsx:353`) is a plain input, but didn't account for the separate, always-visible per-row stepper in the table itself.
**How to avoid:** Treat this as a **verify-only** item, same tier as D-06's `PoolTableGrid` gap check — `QuantityControl`'s buttons are already `h-11 w-11` (44px) with `gap-2` (8px) between them, so it already satisfies both TOUCH-01 and TOUCH-03. No code change needed, but the plan's language should not claim "no stepper exists" — it should say "one stepper exists, already compliant."
**Warning signs:** A future audit or user click-through finds a 44px-floor violation on the inventory table's quantity column that the plan claimed didn't need checking.

### Pitfall 5: "Delete inventory batch" — target does not exist
**What goes wrong:** The plan tries to apply `touchSize="xl"` + `focusEmphasis="high"` to a "delete inventory batch" button per D-03/D-10/UI-SPEC, but no such feature exists anywhere in the codebase (grepped `delete`, `Delete`, `batch` case-insensitively across `src/` — no delete-a-batch UI, no delete-a-production-record UI, no delete-an-inventory-row UI). The closest adjacent features are: inventory's "Adjust"/batch-adjustment dialog (add/remove stock via a signed delta — not a delete), and `KitchenPrepDashboard`'s prep-batch `DataTable` (read-only list, no per-row delete action).
**Why it happens:** Likely a naming/scope mismatch during `/gsd-discuss-phase` — either the feature was planned for a future phase and referenced early, or it's describing a different action under an inaccurate name.
**How to avoid:** **This must go back to the user before the plan locks the "3 controls" set.** Two honest options: (a) proceed with only 2 real destructive/72px+focusEmphasis targets (pool-session stop-confirm, stop-and-move-confirm) and drop the third slot, or (b) the user clarifies what "delete inventory batch" actually refers to (e.g., maybe it means the physical-count form's discard action, or a not-yet-built feature that should be deferred). Do not invent a delete-batch UI to satisfy the decision — that would be scope creep and violates "no control reordering."
**Warning signs:** A task references a component/file that doesn't exist when the executor goes to touch it.

## Code Examples

### Existing baseline focus ring (verify-only, FOCUS-01)
```tsx
// Source: src/shared/ui/button.tsx:8 (verified live)
"...focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50..."
```

### Existing 56px POSButton usage pattern (reuse for D-01 conversions)
```tsx
// Source: src/widgets/TableStatusPanel/index.tsx:276-284
<POSButton
  type="button"
  variant="secondary"
  touchSize="large"
  className="min-h-[56px]"
  onClick={handleAddItems}
>
  Add More Items
</POSButton>
```
Note: several existing `TableStatusPanel` buttons redundantly pass both `touchSize="large"` AND `className="min-h-[56px]"` — harmless (twMerge dedupes identical classes) but the planner should not treat this redundant pattern as required; `touchSize="large"` alone is sufficient going forward.

### Existing already-compliant stepper (verify-only, D-05 correction)
```tsx
// Source: src/shared/ui/QuantityControl.tsx:80-90 (44px height/width, 8px gap)
<Button type="button" variant="outline" size="icon" className="h-11 w-11 touch-manipulation" ... />
```

### Existing full-width stacked KDS bump button (D-07 verification target)
```tsx
// Source: src/widgets/KdsBoard/index.tsx:66-74 — needs POSButton conversion (currently size="sm", 28px)
<Button
  size="sm"
  variant={item.kdsStatus === 'pending' ? 'secondary' : 'default'}
  disabled={isBumping}
  onClick={handleClick}
  className="w-full"
>
  {item.kdsStatus === 'pending' ? 'Start' : 'Done'}
</Button>
```

## State of the Art

Not applicable — no external library versions or ecosystem shifts are relevant to this phase; it is 100% internal codebase convention application.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tailwind-merge`'s last-occurrence-wins resolution will correctly override `ring-3`/`ring-ring/50` with a `focusEmphasis="high"` variant's `ring-4`/`ring-ring` classes, since CVA places variant classes after base classes in the joined string before the outer `cn()` call | Architecture Pattern 2 | If wrong, the emphasized ring silently fails to render (both classes present, wrong one visually wins, or Tailwind's own CSS-cascade order — not just twMerge's string dedup — ends up choosing the lower-specificity one). Mitigated by recommending a Wave 0 unit test that asserts the actual rendered className list, not just trusting the theory. |
| A2 | The minimal-diff `ConfirmDialog` extension (pass raw classes via a new `confirmClassName`-style prop) is preferable to formally threading a `focusEmphasis` prop through `alert-dialog.tsx`'s `buttonVariants()` call | Architecture Pattern 3 | Low risk either way — both are valid; this is a style/consistency judgment call for the planner, not a correctness risk. |
| A3 | "Delete inventory batch" (D-03/D-10) has no existing implementation and should be either dropped to a 2-item target set or clarified by the user, rather than newly built | Pitfall 5 | High risk if wrong — if the user actually meant an existing feature under a different name that this research missed, dropping the target set to 2 would under-deliver FOCUS-02/TOUCH-02. Must be confirmed with the user before planning proceeds, not silently assumed. |

## Open Questions

1. **What does "delete inventory batch" refer to, if not a currently-shipped feature?**
   - What we know: No delete-a-batch, delete-a-production-record, or delete-an-inventory-row UI exists anywhere in `src/` (verified via case-insensitive grep for `delete`/`batch` across the whole `src/` tree — 24 files match "batch" generally, none are a delete action).
   - What's unclear: Whether this was a planning error (name for a not-yet-built feature), a stale reference to an idea explored and dropped during `/gsd-discuss-phase`, or shorthand for something else entirely (e.g., the physical-count discard flow).
   - Recommendation: Surface this to the user before `/gsd-plan-phase` finalizes D-03/D-10's target set. Do not build a new delete-batch feature to fill the gap (that would violate the phase's explicit "no control reordering"/sizing-only boundary) — either drop to 2 targets or get a corrected pointer.

2. **Should the SortHeader native `<button>` (InventoryRow.tsx) be in scope for D-01?**
   - What we know: It's a raw native `<button>` element (not the shadcn `Button` component, not an icon-button), used for column-sort toggling in the inventory `DataTable` header. D-01's literal phrasing is "every raw shadcn `Button`/icon-button instance."
   - What's unclear: Whether a non-Button-component native `<button>` counts under D-01's scope, or whether it's COMPONENT-01 territory (Phase 31, raw `<button>` → `POSButton`) that's already out of Phase 32's stated boundary.
   - Recommendation: Treat as informational for the planner — flag it, let the planner decide whether it's in/out of Phase 32 scope given its ambiguous 44px status (small `px-2 py-1` padding, likely well under 44px).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Unit framework | Vitest v4 + React Testing Library v16 |
| Unit config file | `bar-pos/vitest.config.ts` |
| E2E framework | Playwright v1.59 |
| E2E config file | `bar-pos/playwright.config.ts` |
| Quick run command | `npx vitest run src/shared/ui/button.test.tsx` (new file, doesn't exist yet) |
| Full suite command | `npm run test` (unit) / `npm run test:e2e` (Playwright) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOUCH-01 | Every raw Button on 6 pages meets 44px floor | manual/code-review + existing e2e regression (16-table-status, 28-kds, 40-kds-bar, 10-inventory, 21-prep) still pass | `npx playwright test e2e/16-table-status.spec.ts e2e/28-kds.spec.ts e2e/40-kds-bar.spec.ts e2e/10-inventory.spec.ts e2e/21-prep.spec.ts` | ✅ (all exist) |
| TOUCH-02 | 56px/72px assigned per the D-03 tier table | unit — assert `touchSize` prop/class on the converted elements | new `src/shared/ui/POSButton.test.tsx` asserting className output per `touchSize` | ❌ Wave 0 |
| TOUCH-03 | 8px+ grid gap on tappable grids | code-review (this research already verified all 3 named grids compliant) | none — static markup, no automated geometry test in this stack | N/A |
| FOCUS-01 | Baseline ring survives touchSize className merge | unit | new `src/shared/ui/button.test.tsx` asserting base ring classes present after `touchSize`/`focusEmphasis` combos | ❌ Wave 0 |
| FOCUS-02 | `focusEmphasis="high"` swaps to `ring-4`/`ring-ring` | unit | same `button.test.tsx` file, asserts twMerge resolves correctly (closes Assumption A1) | ❌ Wave 0 |
| FOCUS-03 | Tab order matches visual order on the 3 named surfaces | e2e | `npx playwright test e2e/44-focus-tab-order.spec.ts` (new, renumbered) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/shared/ui/button.test.tsx src/shared/ui/POSButton.test.tsx` (once created) + `npm run typecheck` + `npm run lint`
- **Per wave merge:** `npm run test` (full unit suite) + the 6 targeted existing e2e specs listed above
- **Phase gate:** Full unit suite green + `npx playwright test e2e/44-focus-tab-order.spec.ts` green before `/gsd-verify-work`. Full `npm run test:e2e` run is optional/manual per this project's existing convention (CLAUDE.md: "`npm run test:e2e` is run manually before releases").

### Wave 0 Gaps
- [ ] `src/shared/ui/button.test.tsx` — new file, covers FOCUS-01/FOCUS-02 (`focusEmphasis` variant class assertions, closes Assumption A1)
- [ ] `src/shared/ui/POSButton.test.tsx` — new file, covers TOUCH-02 (`touchSize` class assertions across default/large/xl)
- [ ] `e2e/44-focus-tab-order.spec.ts` — new file, covers FOCUS-03 (D-13), correctly numbered to avoid the `43-promotions.spec.ts` collision
- [ ] No framework installs needed — Vitest/RTL/Playwright all already configured and used elsewhere in the repo

## Security Domain

Not applicable — `security_enforcement` has no bearing here; this phase makes zero changes to authentication, authorization, session handling, input validation, or data access. `ManagerPinDialog`'s PIN-gate logic itself is untouched (only its surrounding tab-order is verified, not its access-control behavior). No new ASVS-relevant surface is introduced.

## Sources

### Primary (HIGH confidence — verified via direct file reads against the live repo, 2026-07-13)
- `src/shared/ui/POSButton.tsx`, `src/shared/ui/button.tsx` — touchSize scale + CVA base, confirmed exact class strings match UI-SPEC's cited line numbers
- `src/shared/ui/ConfirmDialog.tsx`, `src/shared/ui/alert-dialog.tsx` — confirmed the 2 real destructive targets are NOT POSButton-based (new finding, not in CONTEXT.md)
- `src/widgets/PoolTableGrid/index.tsx` — confirmed line 120 raw `Button` (D-02) and lines 159/173 `gap-4` (D-06), exact line-number match with CONTEXT.md
- `src/widgets/TableStatusPanel/index.tsx`, `src/features/manager-pin-gate/ui/ManagerPinDialog.tsx`, `src/shared/ui/PINKeypad.tsx` — confirmed D-11/D-12 tab-order surfaces and PINKeypad's existing 64px compliance
- `src/pages/inventory/index.tsx`, `src/widgets/InventoryPagePanel.tsx`, `src/entities/inventory/ui/InventoryRow.tsx`, `src/shared/ui/QuantityControl.tsx` — confirmed D-05's stepper-absence claim is wrong (new finding) and found the "Physical Count" raw Button (new finding)
- `src/shared/ui/SearchInput.tsx`, `src/shared/ui/DataTable.tsx` — confirmed the shared search clear-button ripple risk (new finding)
- `src/widgets/KdsBoard/index.tsx`, `src/pages/kds/index.tsx`, `src/pages/kds-bar/index.tsx` — confirmed 3 raw Button instances shared by both pages, confirmed card stacking is full-width/vertical not side-by-side (D-07)
- `src/widgets/KitchenPrepDashboard/ui/KitchenPrepDashboard.tsx`, `src/features/produce-prep-batch/ui/PrepProductionForm.tsx`, `PrepBatchPreview.tsx` — confirmed no delete-batch UI exists anywhere (Pitfall 5)
- `src/app/globals.css` lines 28/70 — confirmed `--ring` token values match UI-SPEC exactly
- `src/shared/lib/utils.ts` — confirmed `cn()` = `twMerge(clsx(...))`, informs Assumption A1
- `bar-pos/e2e/*.spec.ts` directory listing — confirmed `43-promotions.spec.ts` already exists, next free number is 44 (Pitfall 3)
- `bar-pos/e2e/helpers/auth.ts`, `bar-pos/e2e/fixtures.ts`, `bar-pos/e2e/16-table-status.spec.ts` — confirmed spec conventions (import `test`/`expect` from `./fixtures`, `loginAs`/`logout` from `./helpers/auth`, header-comment listing source files read)
- `src/features/manager-pin-gate/ui/ManagerPinDialog.test.tsx` — confirmed existing unit coverage has no tab-order assertions (gap is genuinely new, not duplicated work)
- `.planning/config.json` — confirmed `nyquist_validation: true`

### Secondary (MEDIUM confidence)
- None — no external/web sources were needed for this phase; all research was live-repo verification.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all existing code read directly
- Architecture: HIGH — `ConfirmDialog`/`alert-dialog.tsx` gap and stepper-correction verified by direct source reads, not inference
- Pitfalls: HIGH — e2e number collision and missing delete-batch feature both confirmed via direct filesystem/grep checks, not speculation

**Research date:** 2026-07-13
**Valid until:** Low churn risk (internal-only rollout) — valid until the next phase that touches `button.tsx`/`ConfirmDialog.tsx`/`e2e/` numbering (informally, ~30 days or until Phase 33 starts, whichever first, since Phase 33 also touches `Button`-based components on payment pages)
