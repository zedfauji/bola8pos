# Phase 32: Touch Target & Focus-Visible Sweep - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 12 (modified) + 3 (new test/spec)
**Analogs found:** 15 / 15 (all patterns exist verbatim in-repo; this is a rollout phase, no analog gaps)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/shared/ui/button.tsx` (+`focusEmphasis` CVA variant) | utility/config (CVA style def) | transform (className) | itself — extend existing `variants` map | exact (self-extension) |
| `src/shared/ui/ConfirmDialog.tsx` (+ passthrough prop) | component | request-response (confirm/cancel) | itself — extend `AlertDialogAction` className merge point (line 136-139) | exact (self-extension) |
| `src/shared/ui/alert-dialog.tsx` (optional: forward `focusEmphasis`) | component | transform | itself — `AlertDialogAction`/`Cancel` `cn(buttonVariants(), className)` (lines 95, 105) | exact (self-extension) |
| `src/widgets/PoolTableGrid/index.tsx` (line 120 raw `Button`→`POSButton`) | component | request-response | Same file, line 104-114 (`POSButton touchSize="default"` filter-toggle already present) | exact — sibling pattern in same file |
| `src/pages/inventory/index.tsx` ("Physical Count" raw Button) | component | request-response | `src/widgets/PoolTableGrid/index.tsx:104-114` (POSButton conversion pattern) | role-match |
| `src/shared/ui/SearchInput.tsx` (clear button) | component (shared, ripple risk) | request-response | `src/shared/ui/QuantityControl.tsx:80-90` (icon button converted to explicit `h-11 w-11` / 44px) | role-match |
| `src/entities/inventory/ui/InventoryRow.tsx` (`SortHeader` native `<button>`) | component | request-response | flagged for planner decision — see Open Question 2 in RESEARCH.md; no forced conversion | partial (planner discretion) |
| `src/widgets/KdsBoard/index.tsx` (3 raw `Button` instances, lines 66-74 shown) | component | request-response | `src/widgets/PoolTableGrid/index.tsx:104-114` (POSButton conversion pattern) | role-match |
| `src/features/void-pool-session` (or wherever `StopSessionConfirm.tsx` lives) → `ConfirmDialog` call site | component | request-response | `ConfirmDialog.tsx` call-site convention (see `ConfirmDialog.tsx` docblock example, lines 58-70) | exact |
| `StopAndMoveDialog.tsx` → `ConfirmDialog` call site | component | request-response | same as above | exact |
| `e2e/44-focus-tab-order.spec.ts` (new) | test | event-driven (keyboard) | `bar-pos/e2e/16-table-status.spec.ts` (spec conventions: fixtures import, `loginAs`) | role-match |
| `src/shared/ui/button.test.tsx` (new) | test | transform | none existing (Wave-0 gap) — follow RTL conventions from any existing `*.test.tsx` in `shared/ui/` | new pattern, no direct analog |
| `src/shared/ui/POSButton.test.tsx` (new) | test | transform | same as above | new pattern, no direct analog |

## Pattern Assignments

### `src/shared/ui/button.tsx` (utility/config, transform)

**Analog:** itself (extend existing CVA `variants` object)

**Current base + size variants** (lines 7-42, full file read):
```typescript
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 ...",
  {
    variants: {
      variant: { default: '...', outline: '...', secondary: '...', ghost: '...', destructive: '...', link: '...' },
      size: { default: '...', xs: '...', sm: '...', lg: '...', icon: '...', 'icon-xs': '...', 'icon-sm': '...', 'icon-lg': '...' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);
```

**Add pattern (D-09)** — new variant slot, following the exact same object-literal shape as `variant`/`size`:
```typescript
focusEmphasis: {
  default: '',
  high: 'focus-visible:ring-4 focus-visible:ring-ring',
},
// defaultVariants: { ..., focusEmphasis: 'default' }
```
Must also destructure `focusEmphasis = 'default'` in the `Button()` function signature (line 44-53) and pass it into `buttonVariants({ variant, size, focusEmphasis, className })` (line 61), mirroring exactly how `variant`/`size` are threaded today.

**twMerge resolution note:** `cn()` = `twMerge(clsx(...))` (`src/shared/lib/utils.ts`) — CVA appends variant classes after base classes, so `ring-4`/`ring-ring` (added) will win over `ring-3`/`ring-ring/50` (base) via last-occurrence-wins. Verify with a unit test, don't trust silently (see RESEARCH.md Assumption A1).

---

### `src/shared/ui/POSButton.tsx` (reference only — no change needed)

Already implements the exact 44/56/72px scale (lines 39-43):
```typescript
const touchSizeClasses = {
  default: 'min-h-[44px]',
  large: 'min-h-[56px] text-base',
  xl: 'min-h-[72px] text-lg font-semibold',
};
```
This is the **rollout target** for every raw-`Button`→`POSButton` conversion (D-01/D-02). No code change to this file itself.

---

### `src/widgets/PoolTableGrid/index.tsx` (component, request-response)

**Analog:** itself — the file already contains the correct target pattern right above the violation.

**Existing correct pattern** (lines 104-114, `Add Table` button):
```tsx
<POSButton
  type="button"
  variant="outline"
  touchSize="default"
  disabled={addTable.isPending}
  onClick={() => { void handleAddTable(); }}
>
  {addTable.isPending ? 'Adding…' : 'Add Table'}
</POSButton>
```

**Violation to convert** (lines 120-136, filters-toggle button, imports raw `Button` from `@shared/ui/button`):
```tsx
<Button
  type="button"
  variant="ghost"
  data-testid="pool-filters-toggle"
  aria-expanded={!filtersCollapsed}
  onClick={() => { setFiltersCollapsed(prev => !prev); }}
  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
>
  {filtersCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
  Filters
</Button>
```
Convert to `POSButton` with `touchSize="default"` (this is not a frequent/primary or destructive action per D-03 tier table — stays at 44px floor), preserving all other props/className verbatim.

**Grid gap (D-06, verify-only, already compliant)** — lines 159, 173:
```tsx
<div className="grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
```
`gap-4` = 16px > 8px floor. No change; flag as regression only if found altered.

---

### `src/widgets/KdsBoard/index.tsx` (component, request-response)

**Analog:** same conversion pattern as `PoolTableGrid` above (`POSButton touchSize="large"` — this is the "bump KDS order" frequent-action per D-03 tier table).

**Violation** (lines 65-75):
```tsx
{item.kdsStatus !== 'done' && (
  <Button
    size="sm"
    variant={item.kdsStatus === 'pending' ? 'secondary' : 'default'}
    disabled={isBumping}
    onClick={handleClick}
    className="w-full"
  >
    {item.kdsStatus === 'pending' ? 'Start' : 'Done'}
  </Button>
)}
```
Convert to `POSButton touchSize="large"` (56px, per D-03: "bump KDS order" is a frequent/primary action), keep `className="w-full"` — already full-width/stacked, satisfies D-07's spacing check without a gap-class change (single button per card, no adjacent sibling to space against).

Import swap needed: `import { Button } from '@shared/ui/button';` → `import { POSButton } from '@shared/ui/POSButton';` (2 more instances of raw `Button` reported by research further down this file — same conversion, not re-read here per no-duplicate-range rule; grep `<Button` in this file at execute time to find all 3).

---

### `src/shared/ui/QuantityControl.tsx` (verify-only — already compliant, D-05 correction)

**No change needed.** Reference pattern for "how a compliant icon-button stepper looks" (lines 80-90):
```tsx
<Button
  type="button"
  variant="outline"
  size="icon"
  onClick={handleDecrement}
  disabled={disabled || !canDecrement}
  aria-label="Decrease quantity"
  className="h-11 w-11 touch-manipulation"
>
  <Minus className="h-4 w-4" />
</Button>
```
`h-11 w-11` = 44px, `gap-2` (line 76, container div) = 8px between the two buttons. Already satisfies TOUCH-01 and TOUCH-03. Use this as the reference shape if `SearchInput.tsx`'s clear button or any other small icon-button needs a non-POSButton 44px treatment (e.g., where `POSButton`'s `min-h` approach doesn't fit an icon-only square button — prefer explicit `h-11 w-11` classes matching this exact pattern for icon-only buttons).

---

### `src/shared/ui/ConfirmDialog.tsx` + `src/shared/ui/alert-dialog.tsx` (component, request-response)

**Analog:** itself — the existing variant-based className merge point.

**Existing merge point** (`ConfirmDialog.tsx` lines 131-149):
```tsx
<AlertDialogAction
  disabled={isLoading || confirmDisabled}
  onClick={() => { void handleConfirm(); }}
  className={cn(
    variant === 'destructive' &&
      'bg-destructive text-destructive-foreground hover:bg-destructive/90'
  )}
>
  {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</>) : confirmLabel}
</AlertDialogAction>
```

**`AlertDialogAction` definition** (`alert-dialog.tsx` lines 91-97) — confirms it does NOT go through `Button()`/`POSButton`, styles itself directly via `buttonVariants()`:
```tsx
const AlertDialogAction = React.forwardRef<...>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
```

**Recommended minimal-diff approach (per RESEARCH.md Pattern 3):** Add an optional `confirmClassName?: string` prop to `ConfirmDialogProps` (mirrors existing `confirmLabel`/`confirmDisabled` prop shape), merge it into the existing `cn(...)` call at line 136-139:
```tsx
className={cn(
  variant === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  confirmClassName
)}
```
Then the 2 call sites (`StopSessionConfirm.tsx`, `StopAndMoveDialog.tsx`) pass:
```tsx
confirmClassName="min-h-[72px] text-lg font-semibold focus-visible:ring-4 focus-visible:ring-ring"
```
This reuses `POSButton`'s exact `xl` class string (`min-h-[72px] text-lg font-semibold`, from `POSButton.tsx:42`) plus the new `focusEmphasis="high"` class string (`focus-visible:ring-4 focus-visible:ring-ring`, from the new `button.tsx` variant) — literal reuse, no new tokens invented.

---

### `e2e/44-focus-tab-order.spec.ts` (new test)

**Analog:** `e2e/16-table-status.spec.ts` for spec conventions (import `test`/`expect` from `./fixtures`, `loginAs`/`logout` from `./helpers/auth`, header-comment listing source files read). Read this file at execute time for exact boilerplate — not re-extracted here since RESEARCH.md already confirms the convention and no further excerpt was pulled to avoid an unnecessary large-file read for a phase that is pure rollout.

**Core pattern to implement:** `page.keyboard.press('Tab')` + `expect(locator).toBeFocused()` loop through the 3 named surfaces (D-12): `ManagerPinDialog` reached via `TableStatusPanel`, inventory `DataTable` search/filter row, other inventory/kitchen-prep form inputs.

---

## Shared Patterns

### Touch-size rollout (`touchSize` prop)
**Source:** `src/shared/ui/POSButton.tsx:39-43`
**Apply to:** Every raw `Button`→`POSButton` conversion across `PoolTableGrid`, inventory page, `SearchInput`, `KdsBoard` (3 instances).
```tsx
const touchSizeClasses = {
  default: 'min-h-[44px]',
  large: 'min-h-[56px] text-base',
  xl: 'min-h-[72px] text-lg font-semibold',
};
```

### Focus-ring baseline (verify-only)
**Source:** `src/shared/ui/button.tsx:8`
**Apply to:** Verify survives className merge on every converted button.
```
focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50
```

### Focus-ring emphasis (new)
**Source:** new `focusEmphasis` CVA variant on `src/shared/ui/button.tsx`
**Apply to:** Exactly 2 destructive `ConfirmDialog` call sites (void/cancel pool session, stop-and-move table) via `ConfirmDialog`'s new `confirmClassName` passthrough.
```
focus-visible:ring-4 focus-visible:ring-ring
```

### `cn()` / twMerge class-merge convention
**Source:** `src/shared/lib/utils.ts` (`cn = (...) => twMerge(clsx(...))`)
**Apply to:** All className merges in this phase — `POSButton`, `Button`, `ConfirmDialog`'s new prop. Last-occurrence-wins for same Tailwind group; `min-h-*` and `h-*`/`ring-*` widths don't conflict across groups.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/shared/ui/button.test.tsx` (new) | test | transform | No existing unit test for `buttonVariants` class output in this repo (Wave-0 gap per RESEARCH.md Validation Architecture) — write a plain RTL `render` + `screen.getByRole('button')` + `className` assertion, no framework needed beyond Vitest/RTL already configured |
| `src/shared/ui/POSButton.test.tsx` (new) | test | transform | Same — Wave-0 gap, same minimal RTL approach |
| "Delete inventory batch" 72px/focusEmphasis target (D-03/D-10) | — | — | Does not exist in codebase (verified via grep, RESEARCH.md Pitfall 5). Planner must drop to the 2 real targets or get user clarification before locking scope — not a pattern-mapping problem, a scope problem to flag upstream. |

## Metadata

**Analog search scope:** `src/shared/ui/`, `src/widgets/PoolTableGrid/`, `src/widgets/KdsBoard/`, `src/pages/inventory/`, `bar-pos/e2e/`
**Files scanned:** `button.tsx`, `POSButton.tsx`, `ConfirmDialog.tsx`, `alert-dialog.tsx`, `PoolTableGrid/index.tsx`, `KdsBoard/index.tsx`, `QuantityControl.tsx` (all read directly, non-overlapping ranges)
**Pattern extraction date:** 2026-07-13
