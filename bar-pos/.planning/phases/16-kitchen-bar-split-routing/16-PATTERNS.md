# Phase 16: Kitchen/Bar Split Routing - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 14
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/shared/lib/domain.ts` (`CategorySchema`) | model (Zod schema) | CRUD | same file, same section | exact (in-place edit) |
| `supabase/migrations/2026XXXXXXXXXX_categories_routing.sql` | migration | batch (DDL + backfill) | `supabase/migrations/20260422000005_categories_is_food.sql` | exact |
| `src/entities/kds/model/types.ts` (`KdsOrderItemSchema`) | model (Zod schema) | CRUD | same file, same section | exact (in-place edit) |
| `src/entities/kds/model/queries.ts` (`useKdsItems`) | service/query hook | request-response (Supabase select + client filter) | same file, same section | exact (in-place edit) |
| `src/widgets/KdsBoard/index.tsx` | component (widget) | request-response / UI render | same file, same section | exact (in-place edit) |
| `src/app/kds-bar-route.tsx` (new) | route guard | request-response | `src/app/kds-route.tsx` | exact |
| `src/app/router.tsx` (add `/kds-bar`) | route registration | request-response | same file, `/kds` block (lines 23, 130-138) | exact (in-place edit) |
| `src/pages/kds-bar/index.tsx` (new) | page (thin container) | request-response / UI render | `src/pages/kds/index.tsx` | exact |
| `src/shared/lib/rbac.ts` (add `view_kds_bar`) | config (RBAC action sets) | CRUD (in-memory permission table) | same file, `view_kds` / `KITCHEN_ACTIONS` / `ADMIN_EXTRA` | exact (in-place edit) |
| `src/shared/ui/RoutingBadge.tsx` (new) | component (UI primitive) | transform (props → badge markup) | `src/shared/ui/ChefHatBadge.tsx` | exact |
| `src/features/manage-categories/ui/CategoryTreeEditor.tsx` | component (form + tree UI) | CRUD | same file, `CategoryForm` / `NodeRow` / `handleCreate` / `handleUpdate` | exact (in-place edit) |
| `src/features/add-item-to-tab/ui/ModifierSheet.tsx` (`categoryForPricing` fallback) | component (helper) | transform | same file, line 26 | exact (in-place edit) |
| `src/features/print-precheque/usePrintPreCheque.ts` | service (mutation hook) | request-response / file-I/O (printer) | same file, line 41 | exact (in-place edit) |
| `src/entities/category/model/queries.ts` (`mapCategoryRow`, create/update mutations) | service (query/mutation hooks) | CRUD | same file, lines 38, 158, 192 | exact (in-place edit) |
| `src/widgets/HomeDashboard/ui/HomeDashboard.tsx` (add `/kds-bar` tile) | component (widget config) | CRUD (declarative list) | same file, `ITEMS` array — model new tile on Reports/Inventory/etc. (`requiredAction` pattern), NOT the existing `/kds` tile (`visibleToRoles`, legacy pattern) | role-match (pattern to follow is a *different* entry in the same array than the literal isFood/KDS sibling) |

## Pattern Assignments

### `src/shared/lib/domain.ts` — `CategorySchema.isFood` → `routing`

**Analog:** same file, lines 176-198 (in-place edit, no external analog needed)

**Current field** (line 183):
```typescript
isFood: z.boolean().default(false),
```

**Replace with:**
```typescript
export const CategoryRoutingSchema = z.enum(['KITCHEN', 'BAR', 'NONE']);
export type CategoryRouting = z.infer<typeof CategoryRoutingSchema>;

// inside CategorySchema:
routing: CategoryRoutingSchema.default('NONE'),
```
Follow the existing `DiscountTypeSchema`/`DiscountType` pattern just above (lines 165-170) for how this codebase pairs a `z.enum` schema with an exported const-object mirror — **not required** here since `CategoryRouting` is consumed as a plain string union in UI selects (`SelectItem value="KITCHEN"`), but keep naming consistent (`CategoryRoutingSchema` mirrors `DiscountTypeSchema`).

`CategoryCreateSchema`/`CategoryUpdateSchema` derive via `.omit`/`.partial` — no changes needed there, they follow the base schema automatically.

---

### `supabase/migrations/*_categories_routing.sql` (new)

**Analog:** `supabase/migrations/20260422000005_categories_is_food.sql` (full file, 3 lines):
```sql
-- Add is_food flag for KDS printer routing (food → KDS, drinks → printer)
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_food BOOLEAN NOT NULL DEFAULT false;
```

**Pattern to follow** — single comment header + `ALTER TABLE`, per D-03 backfill and D-01 column replacement. Suggested shape (planner to sequence per D's "Claude's Discretion" note on wave ordering):
```sql
-- Replace categories.is_food boolean with categories.routing enum (D-01/D-03)
CREATE TYPE category_routing AS ENUM ('KITCHEN', 'BAR', 'NONE');

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS routing category_routing NOT NULL DEFAULT 'NONE';

-- Backfill: is_food=true -> KITCHEN, is_food=false -> BAR (bar-first default per D-03)
UPDATE categories SET routing = CASE WHEN is_food THEN 'KITCHEN' ELSE 'BAR' END;

ALTER TABLE categories DROP COLUMN is_food;
```
No DOWN script required — this migration falls after Phase 8 (S6), so per CLAUDE.md convention a DOWN script (`ALTER TABLE categories DROP COLUMN routing; ALTER TABLE categories ADD COLUMN is_food BOOLEAN NOT NULL DEFAULT false; DROP TYPE category_routing;`) should be included alongside the UP migration — check the most recent migration files (post-`20260422`) for the DOWN-script file-naming/pairing convention before authoring.

---

### `src/entities/kds/model/types.ts` — `KdsOrderItemSchema.isFood` → `routing`

**Analog:** same file (23 lines total, in-place edit)

**Current** (line 10):
```typescript
isFood: z.boolean(),
```

**Replace with:**
```typescript
routing: CategoryRoutingSchema, // import from '@shared/lib/domain'
```
(per UI-SPEC section B: `KdsOrderItem` needs a `routing` field so `KdsCard`/`ComboKdsCard` can render `RoutingBadge`.)

---

### `src/entities/kds/model/queries.ts` — `useKdsItems()` routing param

**Analog:** same file, full 127 lines (in-place edit)

**Current select** (lines 41-48):
```typescript
products!inner(
  id,
  name,
  categories!inner(
    id,
    is_food
  )
),
```
**→** becomes `categories!inner(id, routing)`.

**Current filter** (lines 15, 72-73):
```typescript
export function useKdsItems() {
  ...
  const isFood = row.products?.categories?.is_food as boolean | undefined;
  if (!isFood) continue;
```
**→** per D-06/D-07, becomes:
```typescript
export function useKdsItems(routing: 'KITCHEN' | 'BAR') {
  ...
  const categoryRouting = row.products?.categories?.routing as string | undefined;
  if (categoryRouting !== routing) continue;
```
Also update the query key (line 10-13) to be parameterized so `/kds` and `/kds-bar` don't share a cache entry:
```typescript
export const kdsKeys = {
  all: ['kds'] as const,
  items: (routing: 'KITCHEN' | 'BAR') => [...kdsKeys.all, 'items', routing] as const,
};
```
And the item push (line 87) — replace `isFood: true,` with `routing: categoryRouting as 'KITCHEN' | 'BAR',`.

**Realtime bridge** (`useKdsRealtimeBridge`, lines 106-127) — invalidates `kdsKeys.items()` on any `order_items` change; with a parameterized key this needs `void queryClient.invalidateQueries({ queryKey: kdsKeys.all })` (broad invalidate, both boards) rather than a single routing-specific key, since the bridge doesn't know which board(s) are mounted.

---

### `src/widgets/KdsBoard/index.tsx` — routing prop threading

**Analog:** same file, full 269 lines (in-place edit)

**Component signature** (line 154):
```typescript
export function KdsBoard() {
  useKdsRealtimeBridge();
  const { data: result, isLoading, isError, refetch } = useKdsItems();
```
**→**
```typescript
export function KdsBoard({ routing }: { routing: 'KITCHEN' | 'BAR' }) {
  useKdsRealtimeBridge();
  const { data: result, isLoading, isError, refetch } = useKdsItems(routing);
```

**Empty-state copy** (line 202-206) and **error copy** (line 172) — currently hardcoded `"No active food orders"` / `"Could not load kitchen queue."` — per UI-SPEC section D, derive from a `stationLabel`:
```typescript
const stationLabel = routing === 'KITCHEN' ? 'kitchen' : 'bar';
// `No active ${stationLabel} orders`
// `Could not load ${stationLabel} queue.`
```

**RoutingBadge placement** (`KdsCard` line 44-47, `ComboKdsCard` line 101-109) — per UI-SPEC section B, insert `<RoutingBadge routing={item.routing} />` immediately after the product-name `<p>`, wrapped in a `flex items-center gap-2` div, before `ComboBadge` where both render. Import: `import { RoutingBadge } from '@shared/ui/RoutingBadge';` alongside the existing `import { ComboBadge } from '@shared/ui/ComboBadge';` (line 6).

`Loading kitchen queue...` copy (line 166) is not called out in UI-SPEC's copy table — leave as-is unless the planner decides to parameterize it too for consistency (UI-SPEC does not require this).

---

### `src/app/kds-bar-route.tsx` (new)

**Analog:** `src/app/kds-route.tsx` (full file, 16 lines) — exact clone, single string swap:
```typescript
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@entities/staff/model/usePermissions';

type KdsBarRouteProps = {
  children: ReactNode;
};

export function KdsBarRoute({ children }: KdsBarRouteProps) {
  const { can } = usePermissions();
  if (!can('view_kds_bar')) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}
```

---

### `src/app/router.tsx` — register `/kds-bar`

**Analog:** same file — `/kds` lazy import (line 23) and route block (lines 129-138)

**Lazy import block** (add after line 24, alongside `KdsPage`):
```typescript
const KdsBarPage = lazy(() => import('../pages/kds-bar'));
```
**Import guard** (add after line 7):
```typescript
import { KdsBarRoute } from './kds-bar-route';
```
**Route registration** (add after the `/kds` `<Route>` block, lines 129-138):
```tsx
<Route
  path="/kds-bar"
  element={
    <ProtectedRoute>
      <KdsBarRoute>
        <KdsBarPage />
      </KdsBarRoute>
    </ProtectedRoute>
  }
/>
```

---

### `src/pages/kds-bar/index.tsx` (new)

**Analog:** `src/pages/kds/index.tsx` (full file, 15 lines) — exact clone, title + prop swap (matches UI-SPEC section C verbatim):
```tsx
import { KdsBoard } from '@widgets/KdsBoard';
import { BackToHomeButton, LiveTimeDisplay, PageContainer } from '@shared/ui';

export default function KdsBarPage() {
  return (
    <div className="flex h-screen flex-col">
      <BackToHomeButton />
      <main className="flex-1 overflow-auto">
        <PageContainer title="Bar Display" actions={<LiveTimeDisplay />}>
          <KdsBoard routing="BAR" />
        </PageContainer>
      </main>
    </div>
  );
}
```
`/kds/index.tsx` must also be updated to pass `routing="KITCHEN"` explicitly (per D-05/UI-SPEC — no implicit default).

---

### `src/shared/lib/rbac.ts` — add `view_kds_bar`

**Analog:** same file (111 lines, in-place edit) — model the new action on `view_kds`'s placement in `STAFF_ACTIONS` (line 32) and its role-set membership (`KITCHEN_ACTIONS` line 67, `ADMIN_EXTRA` line 78).

1. Add to the `STAFF_ACTIONS` union (after line 32):
```typescript
'view_kds',
'view_kds_bar',
```
2. Add to `BARTENDER_ACTIONS` (lines 41-51) — new action:
```typescript
'view_kds_bar',
```
3. `MANAGER_ACTIONS` and `ADMIN_ACTIONS` (lines 81, 83) already spread `BARTENDER_ACTIONS`, so bartender+manager+admin all inherit `view_kds_bar` automatically once added to `BARTENDER_ACTIONS` — **do not** also add it to `KITCHEN_ACTIONS` (line 66-71), per D-04 (`kitchen` role must NOT gain `view_kds_bar`).
4. `rbacDenialMessage()` (lines 105-110) — `view_kds_bar` is not admin-only (not in `ADMIN_EXTRA`), so it correctly falls through to "Manager access required" — no change needed there, but note bartenders themselves have the action so the denial message only applies to `kitchen` role users hitting `/kds-bar` (expected per D-04).

---

### `src/shared/ui/RoutingBadge.tsx` (new)

**Analog:** `src/shared/ui/ChefHatBadge.tsx` (full file, 11 lines):
```typescript
import { ChefHat } from 'lucide-react';
import { Badge } from './badge';

export function ChefHatBadge() {
  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <ChefHat className="h-3 w-3" aria-hidden />
      Prep
    </Badge>
  );
}
```
**New file, per UI-SPEC section A** (exact code given in UI-SPEC, reproduced verbatim — this is a locked design contract, not a suggestion):
```tsx
import { Beer, UtensilsCrossed } from 'lucide-react';
import { Badge } from './badge';
import type { CategoryRouting } from '@shared/lib/domain';

export function RoutingBadge({ routing }: { routing: CategoryRouting }) {
  if (routing === 'NONE') return null;
  const Icon = routing === 'KITCHEN' ? UtensilsCrossed : Beer;
  const label = routing === 'KITCHEN' ? 'Kitchen' : 'Bar';
  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}
```
Follow `ComboBadge.stories.tsx` / `ChefHatBadge.stories.tsx` conventions for the required Storybook story (CLAUDE.md: "Storybook required for every new `shared/ui/` component").

---

### `src/features/manage-categories/ui/CategoryTreeEditor.tsx` — routing selector + NodeRow badge

**Analog:** same file, full read (lines 1-370+, in-place edit across `CategoryFormData` interface, `CategoryForm`, `NodeRow`, `handleCreate`, `handleUpdate`)

**`CategoryFormData` interface** (lines 35-38):
```typescript
interface CategoryFormData {
  name: string;
  color: string;
}
```
**→ add `routing: CategoryRouting` (default `'NONE'` per UI-SPEC section G).**

**`CategoryForm` component** (lines 47-96) — add `routing` state + the new `FormField` block (exact JSX given in UI-SPEC section G) directly after the existing "Color" `FormField` (line 85), before the Cancel/Save button row (line 86). Needs new imports: `Select, SelectTrigger, SelectValue, SelectContent, SelectItem` from `@shared/ui/select` (already installed, used elsewhere — verify exact import path via `Glob('src/shared/ui/select.tsx')`), plus `Beer, UtensilsCrossed` from `lucide-react`.

**`NodeRow`** (lines 117-212) — insert `RoutingBadge`/"Not routed" text immediately after the name span (line 160), before the depth badge (line 163), per UI-SPEC section H:
```tsx
<span className="flex-1 text-sm font-medium">{category.name}</span>
{category.routing === 'NONE' ? (
  <span className="text-xs text-muted-foreground">Not routed</span>
) : (
  <RoutingBadge routing={category.routing} />
)}
<span className="text-xs text-muted-foreground">L{depth + 1}</span>
```
Requires `import { RoutingBadge } from '@shared/ui/RoutingBadge';`.

**`handleCreate`** (lines 290-322) — hardcoded `isFood: false,` (line 311) becomes `routing: data.routing,`.

**`handleUpdate`** (lines 324-333) — currently does NOT persist `isFood`/`color` beyond name+color:
```typescript
async function handleUpdate(id: string, data: CategoryFormData) {
  const payload: CategoryUpdate = { id, name: data.name, color: data.color };
```
**→** must add `routing: data.routing` to close the gap flagged in UI-SPEC section G ("the first time routing/isFood becomes editable post-creation"):
```typescript
const payload: CategoryUpdate = { id, name: data.name, color: data.color, routing: data.routing };
```

---

### `src/features/add-item-to-tab/ui/ModifierSheet.tsx` — `categoryForPricing` fallback

**Analog:** same file, `categoryForPricing()` helper (lines 17-29, in-place edit)

**Current fallback object** (line 26):
```typescript
isFood: false,
```
**→** `routing: 'NONE',` (this fallback only fires when `product.category` is missing entirely — a synthetic placeholder category, so `'NONE'` is the correct default, matching the schema default).

---

### `src/features/print-precheque/usePrintPreCheque.ts` — kdsEnabled filter

**Analog:** same file, mutation body (lines 24-51, in-place edit)

**Current filter** (line 41):
```typescript
.filter(item => !kdsEnabled || item.product?.category?.isFood !== true)
```
**→** per D-02, this excludes food items from the pre-cheque when KDS is enabled — needs to become a routing check. Given this file only distinguishes "goes to a KDS board" vs "prints on receipt," and kitchen+bar routing both imply "has a KDS board," the equivalent condition is:
```typescript
.filter(item => !kdsEnabled || item.product?.category?.routing === 'NONE')
```
(i.e. only `NONE`-routed items still print on the pre-cheque when KDS is enabled; `KITCHEN` and `BAR` items are both now KDS-routed and excluded from the printed pre-cheque.) Flag this inference to the planner for confirmation — CONTEXT.md/UI-SPEC do not explicitly state the desired pre-cheque behavior for `BAR`-routed items, only that the call site must be updated (D-02).

---

### `src/entities/category/model/queries.ts` — row mapper + mutations

**Analog:** same file, full 211 lines (in-place edit at 3 sites)

**`mapCategoryRow`** (line 38):
```typescript
isFood: (row as { is_food?: boolean }).is_food ?? false,
```
**→**
```typescript
routing: (row as { routing?: CategoryRouting }).routing ?? 'NONE',
```

**`useMutationCreateCategory` insert row** (line 158):
```typescript
is_food: input.isFood,
```
**→** `routing: input.routing,`

**`useMutationUpdateCategory` partial update** (line 192):
```typescript
if (rest.isFood !== undefined) row.is_food = rest.isFood;
```
**→** `if (rest.routing !== undefined) row.routing = rest.routing;`

Also update `import type { Category, CategoryCreate, CategoryUpdate } from '@shared/lib/domain';` (line 3) to also import `CategoryRouting` if used as an explicit cast type in the mapper.

`Tables<'categories'>` / `TablesInsert<'categories'>` / `TablesUpdate<'categories'>` types (from `supabase.types.ts`, line 15 import) will be stale until regenerated — per CLAUDE.md's documented workaround, either regenerate types after the migration lands (`npx supabase gen types typescript --local > src/shared/lib/supabase.types.ts`) or use the documented `const db = supabase as any` + file-level eslint-disable workaround if types must be updated before migration lands in the dev DB.

---

### `src/widgets/HomeDashboard/ui/HomeDashboard.tsx` — new `/kds-bar` tile

**Analog to follow:** the `requiredAction`-pattern tiles (Reports line 45-51, Inventory line 52-58, Kitchen Prep line 66-72) — **NOT** the existing `/kds` tile (line 94-99, which uses the legacy `visibleToRoles` pattern).

**Existing `/kds` tile (legacy pattern, do not replicate):**
```typescript
{
  path: '/kds',
  label: 'Kitchen Display',
  icon: UtensilsCrossed,
  visibleToRoles: ['admin', 'kitchen'],
},
```

**New tile to add (per UI-SPEC section F, matches `requiredAction` convention):**
```typescript
{
  path: '/kds-bar',
  label: 'Bar Display',
  icon: Beer,
  requiredAction: 'view_kds_bar',
  managerLabel: 'Bartender',
},
```
Requires `import { Beer } from 'lucide-react';` added to the existing icon import block. `managerLabel: 'Bartender'` is a new value (existing values are only `'Manager'`/`'Admin'`) — verify the badge-rendering component (`gatedTarget`/tooltip logic, lines 102-180) doesn't hardcode an enum for this prop before assuming it renders correctly (UI-SPEC flags this as a verify-at-implementation-time item, not a blocker).

---

## Shared Patterns

### Role-gated route guard
**Source:** `src/app/kds-route.tsx` (also `src/app/reports-route.tsx`, `src/app/rbac-route.tsx`, `src/app/waitlist-route.tsx` — same shape)
**Apply to:** `src/app/kds-bar-route.tsx`
```typescript
export function KdsRoute({ children }: KdsRouteProps) {
  const { can } = usePermissions();
  if (!can('view_kds')) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}
```
Silent redirect (no toast) — matches `KdsRoute` precedent, distinct from `AuditRoute`'s toast-on-redirect variant (per UI-SPEC section E explicit callout).

### Additive RBAC action sets
**Source:** `src/shared/lib/rbac.ts` lines 41-90
**Apply to:** rbac.ts edit for `view_kds_bar`
New actions are added to the specific role `Set`s that should have them (`BARTENDER_ACTIONS`), then composed upward via spread (`MANAGER_ACTIONS = [...BARTENDER_ACTIONS, ...MANAGER_EXTRA]`, `ADMIN_ACTIONS = [...MANAGER_ACTIONS, ...ADMIN_EXTRA]`) — never edit the composed sets directly.

### Badge component shape
**Source:** `src/shared/ui/ChefHatBadge.tsx`
**Apply to:** `src/shared/ui/RoutingBadge.tsx`
`Badge variant="secondary" className="flex items-center gap-1"` + `lucide-react` icon (`h-3 w-3 aria-hidden`) + text label. Neutral variant only — no color-coding by value (explicit UI-SPEC constraint, see Color section: RoutingBadge deliberately does not spend the 10% accent budget).

### Thin page + widget composition
**Source:** `src/pages/kds/index.tsx`
**Apply to:** `src/pages/kds-bar/index.tsx`
`BackToHomeButton` + `PageContainer title=... actions={<LiveTimeDisplay />}` wrapping a single widget — pages carry zero logic, per FSD `pages/` layer responsibility in CLAUDE.md.

### HomeDashboard declarative tile config
**Source:** `src/widgets/HomeDashboard/ui/HomeDashboard.tsx` `ITEMS` array, `requiredAction` pattern (Reports/Inventory/Settings/Kitchen Prep/Waitlist/Rbac/Audit entries)
**Apply to:** new `/kds-bar` tile
`{ path, label, icon, requiredAction, managerLabel }` — gating logic (`can(item.requiredAction)`, `ManagerPinGate` on click) already generic; no additional code needed beyond adding the object.

## No Analog Found

None — every file in scope has a direct in-repo analog (either an existing sibling file to clone, or the same file being edited in place following its own established internal conventions).

## Metadata

**Analog search scope:** `src/entities/kds/`, `src/entities/category/`, `src/widgets/KdsBoard/`, `src/widgets/HomeDashboard/`, `src/app/` (route guards + router), `src/pages/kds/`, `src/shared/ui/` (badges), `src/shared/lib/` (domain.ts, rbac.ts), `src/features/manage-categories/`, `src/features/add-item-to-tab/`, `src/features/print-precheque/`, `supabase/migrations/`
**Files scanned:** 14 target files + 6 analog-only reference files (ChefHatBadge, ComboBadge, HomeDashboard, router.tsx, domain.ts full CategorySchema block, is_food migration)
**Pattern extraction date:** 2026-07-06
