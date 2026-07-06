# Phase 16: Kitchen/Bar Split Routing - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the existing `categories.isFood` boolean with a `category.routing` enum (`KITCHEN | BAR | NONE`) that drives where order items appear for prep. Add a new `/kds-bar` page (bartender+) mirroring the existing `/kds` (food) board, filtered to `routing = BAR`. Add a `RoutingBadge` widget surfaced in the category admin editor and on KDS cards.

</domain>

<decisions>
## Implementation Decisions

### isFood → routing migration
- **D-01:** Replace `categories.isFood` with `categories.routing` (enum: `KITCHEN | BAR | NONE`) rather than adding routing alongside it. Single source of truth — no risk of `isFood`/`routing` disagreeing.
- **D-02:** Migration must find and update every `isFood` call site (`ModifierSheet.tsx`, `CategoryTreeEditor.tsx`, `print-precheque/usePrintPreCheque.ts`, `entities/category/model/queries.ts`, `entities/kds/model/queries.ts`) — planner/researcher must grep for all usages before removing the column, not just the KDS query.
- **D-03 (backfill default):** `isFood = true` rows → `KITCHEN`. `isFood = false` rows → `BAR` by default (bar-first business — most non-food categories are drinks). `NONE` is not auto-assigned; admins flip individual categories to `NONE` manually post-migration (e.g. merch, non-prepped items).

### /kds-bar page + RBAC
- **D-04:** New RBAC action `view_kds_bar`, granted to `bartender`, `manager`, `admin` (NOT `kitchen` role). Keep existing `view_kds` (currently `kitchen` + `admin` only) untouched for the food board — bartenders must not suddenly gain access to the food KDS via a shared permission.
- **D-05:** `/kds-bar` route follows the exact `KdsRoute` pattern (`src/app/kds-route.tsx`) — new `KdsBarRoute` guard checking `can('view_kds_bar')`, same `Navigate to="/home"` denial shape.

### Widget reuse
- **D-06:** Reuse the existing `KdsBoard` widget (`src/widgets/KdsBoard/index.tsx`) and `useKdsItems` query (`src/entities/kds/model/queries.ts`) parameterized by a routing filter, instead of duplicating a separate bar-specific board. `/kds` passes `routing=KITCHEN`, `/kds-bar` passes `routing=BAR`. Avoids duplicating card/bump/combo-children rendering logic.
- **D-07:** `useKdsItems`'s current hardcoded filter (`if (!isFood) continue`) becomes a routing-equality check driven by the new param; the Supabase query's `categories!inner(id, is_food)` select becomes `categories!inner(id, routing)`.

### RoutingBadge placement
- **D-08:** `RoutingBadge` widget appears in two places: (1) `CategoryTreeEditor.tsx` as part of the routing selector/config UI for admins, and (2) on `KdsCard`/bar-KDS cards for operational clarity (so kitchen/bar staff can visually confirm an item's routing, useful once/if any cross-listing exists).

### Claude's Discretion
- Exact `RoutingBadge` visual treatment (color per routing value, icon vs text) — no specific look was requested; follow existing badge patterns (`ComboBadge`) for consistency.
- Whether `NONE`-routed items are simply excluded from both `/kds` and `/kds-bar` queries (most likely) or need any special handling — not raised as a concern, default to simple exclusion.
- Wave/task ordering for the migration (column add → backfill → call-site updates → column drop) vs a single combined migration.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap / Requirements
- `.planning/ROADMAP.md` §"Phase 16: Kitchen/Bar Split Routing" — goal, success criteria, depends-on (added this session; previously only a summary bullet existed with no detail section)
- `.planning/PROJECT.md` — Phase 16 listed as depending on Phase 14 (Audit Logs, complete)
- **GAP:** ROADMAP originally referenced `.planning/comparison/POS-COMPARISON.md` as the requirements source for phases 14–28 — this file does not exist anywhere in the repo (confirmed via `find`, same gap already flagged in `14-CONTEXT.md`). Do not re-derive it from memory; treat the ROADMAP bullet + this CONTEXT.md as the actual requirements source.

### Existing Implementation to Extend/Modify
- `src/shared/lib/domain.ts` — `CategorySchema` (`isFood: z.boolean().default(false)` at line ~183) — replace with `routing` enum field
- `supabase/migrations/20260422000005_categories_is_food.sql` — original `is_food` migration; new migration must add `routing`, backfill, then drop `is_food`
- `src/entities/kds/model/queries.ts` — `useKdsItems()` hardcodes `is_food` filter and `categories!inner(id, is_food)` select — needs routing param + column rename
- `src/widgets/KdsBoard/index.tsx` — generic board (card, bump, combo-children) — needs a routing-filter prop threaded through
- `src/app/kds-route.tsx` — `KdsRoute` guard pattern to replicate for `KdsBarRoute`
- `src/pages/kds/index.tsx` — existing food KDS page, pattern to replicate for `/kds-bar` page
- `src/app/router.tsx` — `/kds` route registration (line ~130) — add `/kds-bar` alongside it
- `src/shared/lib/rbac.ts` — `STAFF_ACTIONS`, `KITCHEN_ACTIONS`, `ADMIN_EXTRA`, `BARTENDER_ACTIONS`/`MANAGER_ACTIONS` sets — add `view_kds_bar` to bartender/manager/admin sets
- `src/features/manage-categories/ui/CategoryTreeEditor.tsx` — category admin editor, needs routing selector replacing isFood toggle
- Other `isFood` call sites to check: `src/features/add-item-to-tab/ui/ModifierSheet.tsx`, `src/features/print-precheque/usePrintPreCheque.ts`, `src/entities/category/model/queries.ts`

### Established Patterns (from Phase 14 context, still relevant)
- `record_audit` pattern: post-mutation, pre-RETURN, success-path only, non-fatal on audit failure — apply if any routing-change RPC is added (e.g. bulk category routing update)
- Manager+/role-gated route pattern: `ReportsRoute`, `RbacRoute`, `KdsRoute` — all same shape (`usePermissions().can(...)` → `Navigate to="/home"`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `KdsBoard` (`src/widgets/KdsBoard/`): fully generic pending/in-progress board with combo-child collapsing, bump button, realtime bridge — reuse via a routing-filter prop (D-06) rather than duplicating.
- `useKdsItems` (`src/entities/kds/model/queries.ts`): existing query already joins `products → categories`, just needs the filter column swapped from `is_food` to `routing` and parameterized.
- `KdsRoute` (`src/app/kds-route.tsx`): 10-line permission-gate pattern, trivially cloneable for `KdsBarRoute`.
- `ComboBadge` (`src/shared/ui/ComboBadge`): existing badge component pattern to model `RoutingBadge` styling after.

### Established Patterns
- Role-gated pages use a dedicated `*Route` wrapper component + `usePermissions().can(action)`, not inline route-level checks.
- RBAC actions are additive sets per role (`BARTENDER_ACTIONS`, `MANAGER_EXTRA`, `ADMIN_EXTRA`, `KITCHEN_ACTIONS`) composed into `ROLE_SET` — new actions get added to the specific role sets that should have them, not a shared catch-all.
- Category admin editing lives in `CategoryTreeEditor.tsx` inside `features/manage-categories/`.

### Integration Points
- `src/app/router.tsx` — add `/kds-bar` route + lazy import, following the exact `/kds` block structure (lines ~130-137).
- `HomeDashboard` — likely needs a tile for `/kds-bar` similar to existing `/kds` tile (verify during planning — not explicitly confirmed in this discussion).
- CLAUDE.md routes table — add `/kds-bar` row per existing routes-table convention.

</code_context>

<specifics>
## Specific Ideas

No additional specific UI/behavior references beyond the decisions above — this phase closely mirrors the existing `/kds` implementation, just filtered differently and gated to a different role set.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-kitchen-bar-split-routing*
*Context gathered: 2026-07-06*
