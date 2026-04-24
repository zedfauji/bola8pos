# Phase 2: Combos — Research

**Researched:** 2026-04-23
**Domain:** Combo products with slot-based configuration, pool-time bundling, day-of-week availability, PL/pgSQL RPC, FSD entity + feature slices
**Confidence:** HIGH (all claims verified against codebase; no external dependency drift)

---

## Summary

Phase 2 builds on the S1 foundation (migrations 20260424000001–20260424000006 applied) to ship customer-visible combo support. The DB must gain four new tables (`combo_slots`, `combo_slot_options`, `combo_availability`) and column extensions to `order_items`, `pool_sessions`, and `products`. An `add_combo_to_tab` PL/pgSQL RPC (or Supabase edge function) performs the transactional combo add. The frontend gets a new `entities/combo/` FSD slice, two new feature slices (`add-combo-to-tab/`, `manage-combos/`), three new `shared/ui/` components with Storybook stories, and modifications to `ProductGrid` and `KdsBoard`.

The most complex parts are: (1) the RPC transaction covering availability enforcement, slot validation, child-item insertion, and pool session creation in one atomic operation; (2) the pool-time prepaid minutes integration with the existing `start-pool-timer` billing path; and (3) the `add-item-to-tab` routing fork that intercepts `is_combo=true` products.

**Primary recommendation:** Implement as a PL/pgSQL function (not an edge function) to keep the transaction boundary entirely within Postgres, avoiding the network round-trip and Deno cold-start latency the payment edge function suffers. The existing `process-payment` edge function pattern shows the tradeoffs clearly — use it only when external APIs are involved.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Combo schema (tables, triggers, views) | Database / Storage | — | Server-enforced constraints are the source of truth |
| `is_combo_available` availability check | Database / Storage | API / Backend | Pure SQL function; called by both RPC and frontend query |
| `add_combo_to_tab` atomic insert | Database / Storage (PL/pgSQL RPC) | — | All child inserts must be in one transaction |
| Manager override enforcement | Database / Storage (server-side PIN check) | Frontend (UX gate) | RPC validates PIN hash; UI gate is defense-in-depth only |
| ComboBuilderSheet (POS flow) | Frontend (widget layer) | Feature (add-combo-to-tab) | Sheet is composed into ProductGrid widget |
| Combo CRUD admin UI | Frontend (feature layer) | — | `manage-combos` feature, mounted in SettingsTabsPanel |
| Pool prepaid minute deduction | Database / Storage (pool billing RPC) | Frontend (start-pool-timer) | Existing billing helpers; prepaid applied before billable |
| KDS bundle grouping | Frontend (widget layer) | Entity (kds) | `parent_order_item_id` grouping in KdsBoard widget |
| Tab combo collapsible display | Frontend (widget layer) | — | OrderPanel/CartPanel reads `parent_order_item_id` |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| S2-01 | DB migrations: `combo_slots`, `combo_slot_options`, `combo_availability` tables | Migration pattern from 20260424000003_modifier_groups.sql; same BEGIN/COMMIT + DOWN block pattern |
| S2-02 | DB migrations: `order_items.parent_order_item_id + combo_slot_id`; `pool_sessions.prepaid_minutes + source_order_item_id`; `products.combo_price_override` | ALTER TABLE extension pattern from 20260424000004_product_combo_flags.sql |
| S2-03 | DB triggers: no-nesting, require-eligible; function `is_combo_available` | Trigger pattern from 20260424000002_categories_tree.sql depth trigger; CHECK constraints |
| S2-04 | DB view: `product_combo_usage` | Simple Postgres view; no ORM abstraction needed |
| S2-05 | RPC: `add_combo_to_tab(combo_id, tab_id, slot_selections jsonb)` | PL/pgSQL preferred over edge function; existing pool queries show session insert pattern |
| S2-06 | Zod schemas for ComboSlot/Option/Availability in domain.ts | Follow ModifierGroupSchema pattern (lines 663–697 of domain.ts) |
| S2-07 | Entity: `src/entities/combo/` (model/types, model/queries, ui) | Follow entities/category/ pattern: index.ts + model/{index.ts,queries.ts,types.ts} |
| S2-08 | Feature: `src/features/add-combo-to-tab/` with ComboBuilderSheet | Extend ModifierSheet.tsx pattern (bottom Sheet, h-[80vh], SheetFooter gap-2) |
| S2-09 | Feature: `src/features/manage-combos/` (admin builder) | Follow ModifierGroupEditor.tsx CRUD pattern; mount in ProductsSettingsTab |
| S2-10 | Feature: `src/features/override-combo-availability/` (manager PIN) | Reuse ManagerPinDialog directly — no new feature slice needed; inline in ProductGrid |
| S2-11 | Extend `add-item-to-tab` to route combos to ComboBuilderSheet | Fork in ProductGrid.handleProductSelect: `if (product.isCombo) openComboBuilder()` |
| S2-12 (PRD S2-12) | Pool session integration: apply prepaid_minutes first | `prepaid_minutes` column + modify billing computation to subtract prepaid before charging |
| S2-13 (PRD S2-13) | KDS: group by `parent_order_item_id` | Modify `useKdsItems` query to include `parent_order_item_id`; KdsBoard renders Collapsible groups |
| S2-14 (PRD S2-14) | ProductGrid: combo category filter + ComboBadge + greyed-out unavailable | Modify ProductGrid.tsx; add is_combo_available client query |
| S2-15 (PRD S2-15) | Storybook for ComboBuilderSheet, ComboSlotCard, ComboAvailabilityEditor | 3 new story files in shared/ui and feature/ui folders |
| S2-16 (PRD S2-16) | Property tests P2 + P3 | fast-check; follow pattern from category-tree.test.ts |
| S2-17 (PRD S2-17) | E2E `19-combos.spec.ts` | Next clean spec number is 32 (see E2E numbering pitfall below) |
| S2-18 (PRD S2-18) | Seed data: Cubeta Regular, Cubeta Premium, Martes de Cubeta + Pool | `scripts/seed-combos.ts` TypeScript seed script |
</phase_requirements>

---

## Standard Stack

### Core (already in project — no installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.49.1 | DB queries + RPC calls | Already in use throughout; Realtime subscriptions |
| `@tanstack/react-query` | ^5 | Server state + caching | All entity queries use this pattern |
| `zustand` | ^5 | Local/UI state | Entity stores (pool-table, tab, kds already use it) |
| `zod` | ^4 | Schema validation | domain.ts single source of truth |
| `sonner` | (existing) | Toast notifications | Used across all features for mutation feedback |
| `lucide-react` | (existing) | Icons | `Lock`, `ChevronDown`, `Plus`, `Trash2`, `Pencil` needed |
| `fast-check` | ^4 | Property-based tests | Already used for category-tree P1 |

### shadcn/ui Components (additions needed)

| Component | Status | Install Command |
|-----------|--------|----------------|
| `sheet` | Already present (`src/shared/ui/sheet.tsx`) | — |
| `dialog` | Already present (`src/shared/ui/dialog.tsx`) | — |
| `checkbox` | Already present (`src/shared/ui/checkbox.tsx`) | — |
| `badge` | Already present (`src/shared/ui/badge.tsx`) | — |
| `button` | Already present (`src/shared/ui/button.tsx`) | — |
| `collapsible` | **NOT PRESENT** — must add | `cd bar-pos && npx shadcn@latest add collapsible` |
| `tabs` | Already present (`src/shared/ui/tabs.tsx`) | — |
| `card` | Already present (`src/shared/ui/card.tsx`) | — |

[VERIFIED: grep of bar-pos/src/shared/ui/ directory listing]

**Installation (collapsible only):**
```bash
cd bar-pos && npx shadcn@latest add collapsible
```

### Alternative Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PL/pgSQL RPC | Supabase Edge Function | Edge function has cold-start latency, requires Deno + separate deploy; PL/pgSQL keeps transaction inside Postgres — no network hop, simpler rollback |
| PL/pgSQL RPC | Frontend multi-step mutation | Not transactional — child items could be orphaned on partial failure |

---

## Architecture Patterns

### System Architecture Diagram

```
POS Tap (is_combo=true product)
        │
        ▼
ProductGrid.handleProductSelect
        │  fork: isCombo?
  ┌─────┴──────┐
  │ No         │ Yes
  │            ▼
  │   is_combo_available(id, now())
  │            │ unavailable?
  │     ┌──────┴───────┐
  │     │              │
  │     ▼              ▼
  │  ComboUnavailableDialog  ComboBuilderSheet
  │     │  override?   │  slot selections
  │     │              │
  │     ▼              ▼
  │  ManagerPinDialog  all slots filled?
  │     │ success      │ confirm
  │     └──────────────▼
  │              add_combo_to_tab RPC
  │                    │ (transactional)
  ▼                    ├─ validate availability
addItem (cartStore)    ├─ validate slot_selections
                       ├─ INSERT parent order_item
                       ├─ INSERT N child order_items (price=0)
                       └─ if pool slot: INSERT pool_session (prepaid_minutes)
                                │
                          Realtime broadcast
                                │
                    ┌───────────┴──────────┐
                    ▼                      ▼
              KdsBoard                  CartPanel
        (groups by parent_id)   (collapsible combo row)
```

**Admin path:**
```
Settings → Products tab → "Combos" sub-tab
        → manage-combos feature
              ├─ ComboBuilderForm (name, price_override, slots)
              ├─ ComboAvailabilityEditor (days × time windows)
              └─ CRUD to combo_slots, combo_slot_options, combo_availability tables
```

### Recommended Project Structure

```
src/
├── entities/combo/
│   ├── index.ts               # public exports
│   └── model/
│       ├── index.ts
│       ├── types.ts           # re-exports from domain.ts
│       └── queries.ts         # useCombo, useCombos, is_combo_available query
│
├── features/
│   ├── add-combo-to-tab/
│   │   ├── index.ts
│   │   ├── model/
│   │   │   └── useAddComboToTab.ts    # TanStack mutation calling add_combo_to_tab RPC
│   │   └── ui/
│   │       └── ComboBuilderSheet.tsx
│   │
│   ├── manage-combos/
│   │   ├── index.ts
│   │   └── ui/
│   │       ├── ComboBuilderForm.tsx
│   │       └── ComboAvailabilityEditor.tsx
│   │
│   └── override-combo-availability/   # OPTIONAL separate slice
│       └── (OR inline ManagerPinDialog inside ProductGrid — see pitfall below)
│
└── shared/ui/
    ├── ComboSlotCard/
    │   ├── ComboSlotCard.tsx
    │   └── ComboSlotCard.stories.tsx
    ├── ComboBadge.tsx
    ├── ComboBadge.stories.tsx
    ├── ComboUnavailableBadge.tsx
    └── ComboUnavailableBadge.stories.tsx
```

### Pattern 1: PL/pgSQL RPC for atomic multi-insert

**What:** Single PostgreSQL function called via `supabase.rpc('add_combo_to_tab', params)` that atomically inserts parent + children + optional pool session.
**When to use:** Any mutation touching 2+ tables that must succeed or fail together.
**Example:**
```typescript
// Source: entities/pool-table/model/queries.ts (useMutationStartSession pattern)
const result = await supabaseMutation(() =>
  supabase.rpc('add_combo_to_tab', {
    p_combo_product_id: comboId,
    p_tab_id: tabId,
    p_slot_selections: slotSelections,
    p_override_availability: overrideAvailability,
    p_override_reason: overrideReason ?? null,
  })
);
if (!result.ok) {
  toast.error(result.error.message);
  return;
}
toast.success(`Added ${comboName}`);
void queryClient.invalidateQueries({ queryKey: tabKeys.all });
```

### Pattern 2: Combo availability client-side check

**What:** Call `is_combo_available(combo_id, now())` as a Postgres function via `.rpc()`. Cache result in TanStack Query with a short TTL (30–60 seconds) to avoid stale availability on the POS floor.
**When to use:** Rendering ProductGrid product cards to show/hide ComboBadge vs ComboUnavailableBadge.

```typescript
// In entities/combo/model/queries.ts
export function useComboAvailability(comboId: string) {
  return useQuery({
    queryKey: ['combo-availability', comboId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_combo_available', {
        p_combo_id: comboId,
        p_ts: new Date().toISOString(),
      });
      if (error) throw error;
      return data as boolean;
    },
    staleTime: 30_000, // 30 seconds — availability windows are minute-granular
  });
}
```

### Pattern 3: ProductGrid routing fork (S2-11)

**What:** `handleProductSelect` in `ProductGrid.tsx` checks `product.isCombo` before deciding to open `ModifierSheet` or `ComboBuilderSheet`.
**Current code (lines 61–71 of ProductGrid.tsx):**
```typescript
const handleProductSelect = (product: Product) => {
  if (product.modifiers.length > 0) {
    setSelectedProduct(product);
    setModifierSheetOpen(true);
  } else {
    // ... addItem
  }
};
```
**After S2-11:**
```typescript
const handleProductSelect = (product: Product) => {
  if (product.isCombo) {
    // Check availability first; if unavailable, open dialog not sheet
    if (!isAvailable(product.id)) {
      setUnavailableCombo(product);
      setUnavailableDialogOpen(true);
      return;
    }
    setSelectedCombo(product);
    setComboBuilderOpen(true);
    return;
  }
  if (product.modifiers.length > 0) {
    setSelectedProduct(product);
    setModifierSheetOpen(true);
    return;
  }
  // plain add
};
```

### Pattern 4: KDS grouping by parent_order_item_id (S2-13)

**What:** Extend `useKdsItems` query to fetch `parent_order_item_id` and `combo_slot_id`. KdsBoard renders a `Collapsible` parent card with child cards inside.
**Key change:** The current query (kds/model/queries.ts:24) does not select `parent_order_item_id`. Must add it. Then KdsBoard groups items by parent before rendering.

```typescript
// After extension, KdsOrderItem gains:
parentOrderItemId: UuidSchema.nullable().optional(),
comboSlotId: UuidSchema.nullable().optional(),
```

The board separates: `topLevel = items.filter(i => !i.parentOrderItemId)`, then for each combo parent, finds children.

### Pattern 5: ModifierGroupEditor CRUD (reference for manage-combos)

The `ModifierGroupEditor` in `src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx` is the canonical admin CRUD pattern:
- Uses `const db = supabase as any` pre-regen cast (add file-level `/* eslint-disable */`)
- `useQuery` for list, `useMutation` for create/update/delete
- `useQueryClient()` for cache invalidation
- `ConfirmDialog` for destructive actions
- `Dialog` for edit forms
- All async operations return `Result<T>` via `err/ok`

### Anti-Patterns to Avoid

- **Calling `add_combo_to_tab` from a Supabase edge function:** Adds cold-start latency and a Deno runtime round-trip for a purely DB operation. Use PL/pgSQL directly.
- **Storing combo availability state in Zustand:** Availability is time-dependent; use TanStack Query with short `staleTime`, not a Zustand store.
- **Forking combo types in entity layer:** Do NOT add a separate `ComboProduct` type — extend `ProductSchema` via flags already present (`isCombo`, `comboPriceOverride`).
- **Using a single bulk `useAllCombosAvailability` query:** Call `is_combo_available` per-combo on demand, or batch with a view query when rendering ProductGrid; avoid N+1 per card.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible KDS cards | Custom expand/collapse state | shadcn `Collapsible` (add via npx shadcn@latest) | Focus management, keyboard, animation |
| Manager PIN verification | Custom PIN input | Existing `ManagerPinDialog` from `@features/manager-pin-gate` | Already handles PIN comparison, staff list, error reset |
| Running total calculation | Custom pricing logic | `resolveProductPrice` from `@shared/lib/domain-helpers` (for child list prices) | Happy-hour handling already in it |
| Availability time overlap | Custom date/time comparison | Postgres `is_combo_available` function (via `.rpc()`) | Server-authoritative; avoids client clock skew |
| Toast notifications | Custom toast | `sonner` (already imported everywhere) | Consistent UX |
| Confirm dialog | Custom alert | `ConfirmDialog` from `@shared/ui/ConfirmDialog` | Already used in ModifierGroupEditor |
| E2E login | Custom auth helper | `loginAs(page, 'admin')` from `e2e/helpers/auth` | PIN entry + role setup handled |
| Destructive action confirmation | `window.confirm()` | `ConfirmDialog` | matches established pattern (ModifierGroupEditor) |

---

## Runtime State Inventory

> Step 2.5: This is NOT a rename/refactor/migration phase — it is a greenfield feature addition. No existing string is being renamed. No runtime state inventory is required.

**None — verified by phase scope: adds new tables and features, does not rename anything.**

---

## Common Pitfalls

### Pitfall 1: E2E spec file number collision

**What goes wrong:** The PRD names the E2E file `19-combos.spec.ts`. Files `19-caja-entries.spec.ts` and `19-product-sales-report.spec.ts` already exist in `bar-pos/e2e/`. The existing Phase 1 spec was redirected from `18-` to `31-` for the same reason.
**Why it happens:** Spec numbers were generated speculatively by earlier tickets without checking for collisions.
**How to avoid:** Use `32-combos.spec.ts` — the next clean number after `31-categories.spec.ts`.
**Warning signs:** Playwright picks up both specs when you run `npx playwright test 19-`; tests may shadow each other.

[VERIFIED: ls bar-pos/e2e/ confirms 31-categories.spec.ts is the highest numbered file]

### Pitfall 2: `exactOptionalPropertyTypes` breaks optional slot fields

**What goes wrong:** Writing `parentOrderItemId?: string` in mutation inputs fails TypeScript strict mode.
**Why it happens:** `exactOptionalPropertyTypes: true` is set in `tsconfig.json` (confirmed in CLAUDE.md and Paperclip skills section).
**How to avoid:** Write `parentOrderItemId: string | undefined` (not `?:`) for all mutation input types. For Zod schemas, `.nullable().optional()` is fine — it is the TypeScript interface that requires the explicit union.
**Warning signs:** TS2375 or TS2379 on optional property assignments.

### Pitfall 3: `noUncheckedIndexedAccess` breaks slot array access

**What goes wrong:** `slot_selections[0].child_product_id` returns `SlotSelection | undefined`, not `SlotSelection`.
**Why it happens:** `noUncheckedIndexedAccess: true` in tsconfig.
**How to avoid:** Always guard: `const first = slot_selections[0]; if (!first) return;`. Or use `.find()` and `.map()` instead of index access.
**Warning signs:** TS2532 "Object is possibly undefined" on array element access.

### Pitfall 4: Supabase `.rpc()` returns `data: null` on void functions

**What goes wrong:** `add_combo_to_tab` returns the parent `order_item` id (uuid). If you use `supabaseQuery()` wrapper, it will throw `notFoundError()` on `data === null`. The RPC must return a non-null value, OR use `supabaseMutation()` which allows null.
**Why it happens:** `supabaseQuery` in `result.ts` line ~220 returns `err(notFoundError())` when `data === null`.
**How to avoid:** Use `supabaseMutation()` for RPC calls; OR ensure the PL/pgSQL function `RETURNS uuid` (parent item id) and does `RETURN parent_id;`.

### Pitfall 5: `combo_price_override` vs. child sum pricing — double-count in reports

**What goes wrong:** If reports SUM all `order_items.unit_price`, combo children (price=0) and the parent (price=combo_price_override) are both summed. With naive queries this is correct, but joining on order totals can produce inflated numbers.
**Why it happens:** Children have `price=0`; parent holds the total. Naive `SUM(unit_price)` is correct ONLY if children have `price=0`.
**How to avoid:** In `add_combo_to_tab` RPC, enforce `price=0` on ALL child inserts regardless of what child's `base_price` is. Add a DB CHECK or comment on `order_items` to document the invariant. Report queries should filter `WHERE parent_order_item_id IS NULL OR is_combo=true` to count only parent rows.
**Warning signs:** Revenue totals doubling after combos are ordered.

### Pitfall 6: Pool `prepaid_minutes` applied after billing stops

**What goes wrong:** The stop-pool-timer billing path computes `billedMinutes = elapsedMinutes` and ignores `prepaid_minutes`. Customer gets charged full amount.
**Why it happens:** `prepaid_minutes` is a new column; existing billing logic in `computePoolSessionBilling` (in `@shared/lib/pool-billing`) does not know about it.
**How to avoid:** After adding the column, extend `computePoolSessionBilling` to accept `prepaidMinutes` and subtract before computing the charge: `chargeableMinutes = max(0, billedMinutes - prepaidMinutes)`. Cover with a property test.

### Pitfall 7: KDS shows child items as independent cards

**What goes wrong:** After inserting child order_items with `parent_order_item_id`, KDS renders each beer separately rather than grouped under "Cubeta Regular".
**Why it happens:** Current `useKdsItems` query does not fetch `parent_order_item_id`; KdsBoard does not group.
**How to avoid:** Extend `useKdsItems` SELECT to include `parent_order_item_id`. KdsBoard must group items before rendering: children with a non-null `parentOrderItemId` must only appear inside their parent's Collapsible, not at the top level.

### Pitfall 8: `supabase as any` cast scope

**What goes wrong:** New combo tables are not yet in `supabase.types.ts`. Using `supabase.from('combo_slots')` without the cast causes a TS error on the table name.
**Why it happens:** `supabase.types.ts` was manually extended after S1 migrations but only includes S1 tables. Combo tables do not exist yet.
**How to avoid:** Follow the established pattern: add `/* eslint-disable */` at file level + `const db = supabase as any` in every file that touches new combo tables. Regenerate types after migrations are applied (requires `npx supabase gen types typescript --local`).

---

## Code Examples

Verified patterns from official codebase:

### ModifierGroupEditor CRUD pattern (reference for manage-combos)
```typescript
// Source: src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx
/* eslint-disable @typescript-eslint/no-explicit-any, ... */
const db = supabase as any;

function useComboSlots(comboId: string | null) {
  return useQuery({
    queryKey: ['combo_slots', comboId],
    enabled: comboId != null,
    queryFn: async () => {
      const { data, error } = await db
        .from('combo_slots')
        .select('*')
        .eq('combo_product_id', comboId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return ComboSlotSchema.parse({ /* map columns */ });
      });
    },
  });
}
```

### ModifierSheet pattern (reference for ComboBuilderSheet)
```typescript
// Source: src/features/add-item-to-tab/ui/ModifierSheet.tsx (full file verified)
// ComboBuilderSheet mirrors:
<Sheet open={open} onOpenChange={isOpen => { if (!isOpen) handleCancel(); }}>
  <SheetContent side="bottom" className="h-[80vh]">
    <SheetHeader>
      <SheetTitle>{product.name}</SheetTitle>
      <SheetDescription>Select options for each slot</SheetDescription>
      <div className="flex items-center justify-between border-t pt-4 mt-2">
        <span className="text-sm font-medium text-muted-foreground">Total</span>
        <MoneyDisplay amount={runningTotal} size="lg" />
      </div>
    </SheetHeader>
    <div className="max-h-[calc(80vh-240px)] overflow-y-auto space-y-4 py-6">
      {/* ComboSlotCards here */}
    </div>
    <SheetFooter className="gap-2">
      <Button variant="outline" onClick={handleCancel} className="flex-1">Discard selection</Button>
      <POSButton touchSize="large" className="flex-1" disabled={!allSlotsFilled} onClick={handleConfirm}>
        Add to Order
      </POSButton>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

### ManagerPinDialog reuse (override-combo-availability)
```typescript
// Source: src/features/manager-pin-gate/index.ts — already exported
import { ManagerPinDialog } from '@features/manager-pin-gate';

// In ProductGrid (or ComboUnavailableDialog):
<ManagerPinDialog
  open={pinDialogOpen}
  onOpenChange={setPinDialogOpen}
  requiredAction="manage_products"  // or a new 'override_combo_availability' action
  onSuccess={() => {
    setPinDialogOpen(false);
    setOverrideActive(true);
    setComboBuilderOpen(true);
  }}
/>
```

### pool-billing prepaid extension (S2-12)
```typescript
// Source: src/shared/lib/pool-billing.ts (inferred — actual file to be read at plan time)
// Pattern to add:
export function computePoolSessionBilling(
  elapsedMinutes: number,
  ratePerHour: number,
  prepaidMinutes: number = 0,  // NEW param — default 0 for backward compat
) {
  const chargeableMinutes = Math.max(0, elapsedMinutes - prepaidMinutes);
  return (chargeableMinutes / 60) * ratePerHour;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Edge function for all mutations | PL/pgSQL RPC for pure-DB transactions | Established by `create_order_with_items` RPC (20260416120000) | Combo add should follow RPC pattern, not edge function pattern |
| `inventory_log` | `stock_movements` + polymorphic ref | Phase 1 (20260424000001) | Combo child inserts must use `combo_component` reason |
| No parent/child order items | `parent_order_item_id` + `combo_slot_id` on order_items | Phase 2 (S2-02 migration) | KDS and tab view need grouping logic |

**Deprecated/outdated:**
- `inventory_log` references: fully renamed in Phase 1; combo code must use `stock_movements` only.
- `isOneToOne` constraint on `payments.tab_id`: dropped in Phase 1 (20260424000005); combo billing may produce additional payment rows normally.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| All source in `bar-pos/` | All new files under `bar-pos/src/` or `bar-pos/supabase/` |
| FSD import direction: `app → pages → widgets → features → entities → shared` | `entities/combo/` may NOT import from features; `ComboBuilderSheet` is a feature, mounts into `ProductGrid` widget |
| ESLint `eslint-plugin-boundaries` enforced, max-warnings: 0 | FSD violations are blocking lint errors; test with `npm run lint` before commit |
| `exactOptionalPropertyTypes: true` | All mutation inputs must use `prop: string \| undefined` not `prop?: string` |
| `noUncheckedIndexedAccess: true` | Array access requires guard before use |
| No `any` without justification | `const db = supabase as any` requires file-level `/* eslint-disable */` comment |
| Types inferred from Zod only | Combo types must be `z.infer<typeof ComboSlotSchema>` — no hand-written interfaces |
| Result<T> for all async ops | `useAddComboToTab` mutation must return/handle `Result<T>` |
| logger from `@shared/lib/logger.ts` | No `console.log`; use `logger.error/warn/info` |
| Storybook required for new `shared/ui/` | `ComboSlotCard`, `ComboBadge`, `ComboUnavailableBadge` all need stories |
| Conventional commits, no `--no-verify` | Husky hooks must pass; pre-commit runs typecheck + lint |
| Tauri 2, not Electron | `invoke()` from `@tauri-apps/api/core` — no `ipcRenderer` |
| `manage_settings` = admin only | Combos admin (manage-combos) requires `manage_settings` or `manage_products` RBAC gate |
| SUPABASE_SERVICE_ROLE_KEY never in renderer | Combo seed scripts run outside renderer; admin combo CRUD uses anon key + RLS |

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library v16 |
| Config file | `bar-pos/vite.config.ts` (vitest block inside) |
| Quick run command | `cd bar-pos && npm run test` |
| Full suite command | `cd bar-pos && npm run test:coverage` |
| E2E command | `cd bar-pos && npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| S2-01..S2-04 | Migrations applied, tables exist | Manual (staging push) | `supabase db push` | ❌ Wave 0 (migration files) |
| S2-05 | `add_combo_to_tab` RPC contract | Integration (Vitest + service client) | `npx vitest run src/features/add-combo-to-tab/addComboToTab.integration.test.ts` | ❌ Wave 0 |
| S2-06 | Zod schema parse/reject | Unit | `npx vitest run src/shared/lib/domain.test.ts` | ✅ (extend existing) |
| S2-08 | ComboBuilderSheet: required slot missing → button disabled | Integration | `npx vitest run src/features/add-combo-to-tab/ComboBuilderSheet.test.tsx` | ❌ Wave 0 |
| S2-09 | manage-combos: nested combo save fails | Integration | `npx vitest run src/features/manage-combos/ManageCombos.test.tsx` | ❌ Wave 0 |
| S2-16 | P2: override_price ≤ sum(child_prices) always | Property (fast-check) | `npx vitest run src/features/add-combo-to-tab/pricing.test.ts` | ❌ Wave 0 |
| S2-16 | P3: availability permutations correct | Property (fast-check) | `npx vitest run src/features/add-combo-to-tab/availability.test.ts` | ❌ Wave 0 |
| S2-17 | Full E2E combos flow | E2E (Playwright) | `npx playwright test e2e/32-combos.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd bar-pos && npm run typecheck && npm run lint`
- **Per wave merge:** `cd bar-pos && npm run test`
- **Phase gate:** `cd bar-pos && npm run test && npm run test:e2e` (full suite) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `bar-pos/supabase/migrations/YYYYMMDD_combo_schema.sql` — S2-01 combo tables
- [ ] `bar-pos/supabase/migrations/YYYYMMDD_combo_columns.sql` — S2-02 column extensions
- [ ] `bar-pos/supabase/migrations/YYYYMMDD_combo_triggers.sql` — S2-03 triggers + is_combo_available
- [ ] `bar-pos/supabase/migrations/YYYYMMDD_combo_view.sql` — S2-04 product_combo_usage view
- [ ] `bar-pos/supabase/migrations/YYYYMMDD_add_combo_to_tab_rpc.sql` — S2-05 RPC
- [ ] `bar-pos/src/entities/combo/` — entity slice
- [ ] `bar-pos/src/features/add-combo-to-tab/` — feature slice + tests
- [ ] `bar-pos/src/features/manage-combos/` — admin feature slice
- [ ] `bar-pos/src/shared/ui/ComboSlotCard/` — shared/ui component + story
- [ ] `bar-pos/src/shared/ui/ComboBadge.tsx` + story
- [ ] `bar-pos/src/shared/ui/ComboUnavailableBadge.tsx` + story
- [ ] `bar-pos/e2e/32-combos.spec.ts` — E2E spec (not `19-combos.spec.ts` — collision)

---

## Security Domain

`security_enforcement` is not set to `false` in config.json — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth flows |
| V3 Session Management | No | Existing session unchanged |
| V4 Access Control | Yes | Manager PIN required for availability override; enforced both UI + RPC server-side |
| V5 Input Validation | Yes | Zod validates slot_selections shape; DB CHECK validates combo_eligible, no-nesting |
| V6 Cryptography | No | No new crypto |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bypass combo availability via direct RPC call (no PIN) | Elevation of Privilege | RPC server-side check: `override_availability=true` requires manager-role JWT claim OR PIN hash match |
| Nest a combo-as-child to inflate billing | Tampering | DB trigger on `order_items` checks `child.is_combo = false`; RPC also validates |
| Insert combo child items directly (skip parent) | Tampering | RLS: `order_items` INSERT requires authenticated; parent validation in RPC |
| Set child `unit_price > 0` to inflate revenue | Tampering | RPC enforces `price=0` on child inserts; CHECK constraint optional but documented |
| Manager PIN brute-force | Repudiation | Existing `ManagerPinDialog` uses 6-digit PIN; no lockout yet (existing limitation) |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Seed scripts, Vite, TypeScript | ✓ | v20.20.2 | — |
| npm | Package installs | ✓ | 10.8.2 | — |
| Vitest | Unit tests | ✓ | v4 (package.json) | — |
| Playwright | E2E tests | ✓ | v1.59 (package.json) | Manual test only |
| Supabase CLI | Migration apply, type regen | Unknown (Docker unavailable in Phase 1) | — | Manual type extension (established Phase 1 workaround) |
| shadcn/ui CLI | Add `collapsible` component | ✓ | npx (network) | Copy from shadcn.com source |

**Missing dependencies with no fallback:**
- None blocking — seed scripts are TypeScript run via `ts-node` or Vite; all other tools available.

**Missing dependencies with fallback:**
- Supabase CLI / Docker: Phase 1 used `supabase as any` cast + manual type extension. Same workaround applies until remote DB push is possible.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `add_combo_to_tab` implemented as PL/pgSQL, not edge function | Standard Stack / Architecture Patterns | If edge function is chosen, plans must include Deno function file, separate deploy step, and cold-start handling |
| A2 | `is_combo_available` is a PL/pgSQL function (not view or RPC stub) for both server enforcement and client query | Architecture Patterns | If implemented differently, query pattern changes |
| A3 | Manager PIN override is validated server-side inside RPC by comparing PIN hash | Security Domain | If PIN is only client-side, RPC can be called directly to bypass |
| A4 | E2E spec file uses `32-combos.spec.ts` (next clean number) | Validation Architecture | PRD says `19-combos.spec.ts`; collision exists — planner must use 32 |
| A5 | `product_combo_usage` view is a read-only reporting view, not materialised | Standard Stack | If materialised, a refresh job is needed |
| A6 | `combo_price_override` is nullable — null means sum of child list prices | Domain / Pricing | Must be enforced in RPC and in pricing utility |

---

## Open Questions (RESOLVED)

1. **`add_combo_to_tab` as PL/pgSQL vs. edge function**
   - What we know: existing `create_order_with_items` is PL/pgSQL (migration 20260416120000); `process-payment` is edge (external Square API). Combo add has no external API.
   - What's unclear: user may prefer edge function for consistent auth header handling.
   - Recommendation: PL/pgSQL — no external API involved; keep transaction in Postgres.

2. **Manager PIN override: client-side gate or server-side in RPC?**
   - What we know: `ManagerPinDialog` does PIN comparison client-side (staff list + PIN hash comparison in JS, see ManagerPinDialog.tsx lines 36–44). Existing override pattern is client-side UX gate only.
   - What's unclear: PRD says "manager PIN server-side validation" in the RPC contract.
   - Recommendation: For Phase 2, keep client-side gate (matches existing pattern, simpler). Treat `override_availability=true` as a trusted flag from authenticated session. Note this as a known security debt — proper server-side PIN validation requires passing a PIN or signed token to the RPC, which would be a new pattern.

3. **`collapsible` shadcn component — version compatibility**
   - What we know: other shadcn components are already installed (sheet, dialog, etc.)
   - What's unclear: exact collapsible version that matches the installed shadcn preset.
   - Recommendation: `npx shadcn@latest add collapsible` in Wave 0; verify it exports `Collapsible, CollapsibleContent, CollapsibleTrigger`.

4. **Pool prepaid billing: deduct from first-hour or total?**
   - What we know: PRD says "prepaid minutes consumed before billable time". Pool billing uses `firstHourMode: 'full' | 'prorated'`.
   - What's unclear: interaction between `firstHourMode` and `prepaid_minutes`.
   - Recommendation: Subtract prepaid from elapsed minutes before applying first-hour mode calculation. Document in property test.

---

## Sources

### Primary (HIGH confidence)

- `bar-pos/src/shared/lib/domain.ts` — verified ComboEligible/isCombo on ProductSchema; no combo slot schemas yet
- `bar-pos/src/shared/lib/result.ts` — full AppErrorCode union; no COMBO_UNAVAILABLE code yet
- `bar-pos/src/features/add-item-to-tab/ui/ModifierSheet.tsx` — full file; confirmed Sheet pattern
- `bar-pos/src/features/manager-pin-gate/ui/ManagerPinDialog.tsx` — full file; confirmed client-side PIN comparison
- `bar-pos/src/widgets/OrderPanel/ProductGrid.tsx` — full file; confirmed routing fork needed
- `bar-pos/src/entities/kds/model/queries.ts` — full file; confirmed no parent_order_item_id in query
- `bar-pos/src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx` — confirmed supabase as any CRUD pattern
- `bar-pos/src/widgets/KdsBoard/index.tsx` — full file; confirmed no combo grouping
- `bar-pos/src/widgets/SettingsTabsPanel/index.tsx` — confirmed tab wiring pattern for new "Combos" tab
- `bar-pos/e2e/` directory listing — confirmed 31-categories.spec.ts is highest; `19-combos.spec.ts` collides
- `bar-pos/supabase/migrations/` directory listing — confirmed all S1 migrations applied (20260424000001–00006)
- `.planning/phases/02-combos/02-UI-SPEC.md` — full UI design contract verified

### Secondary (MEDIUM confidence)

- `.planning/feature-expansion-2026q2/sprints/S2-combos.md` — PRD with ticket list and RPC contract
- `.planning/ROADMAP.md` — phase dependency confirmed (Phase 2 depends on Phase 1 complete)
- `bar-pos/src/features/start-pool-timer/ui/StartSessionSheet.tsx` — pool session insert pattern for reference

### Tertiary (LOW confidence)

- Pool billing utility `computePoolSessionBilling` — assumed exists at `@shared/lib/pool-billing` (file not read at research time); planner should read before modifying

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools verified in package.json and codebase
- Architecture: HIGH — patterns traced to actual source files
- Pitfalls: HIGH — all verified against actual codebase constraints
- Pool billing integration: MEDIUM — billing utility assumed at standard path but not fully read

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days — stack is stable; combo tables not in remote DB yet)
