---
phase: 27-one-shot-inventory-cigarette-box-pattern
plan: 05
subsystem: frontend
tags: [zod, tanstack-query, supabase, open-units, product-schema]

# Dependency graph
requires:
  - phase: 27-one-shot-inventory-cigarette-box-pattern
    provides: "27-02's live open_units table + products.units_per_package/parent_product_id columns; 27-04's live open_open_unit/correct_open_unit/void_open_unit RPCs"
provides:
  - "OpenUnitStatusSchema/OpenUnitSchema/OpenUnitCorrectionSchema in src/shared/lib/domain.ts, plus ProductSchema.unitsPerPackage/.parentProductId"
  - "src/entities/open-unit/ entity: openUnitKeys, useOpenUnits, useMutationOpenOpenUnit, useMutationCorrectOpenUnit, useMutationVoidOpenUnit"
affects: ["27-06 (product-admin surface binds unitsPerPackage/parentProductId)", "27-07/27-08 (admin Open-Units tab UI binds these hooks)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-type-regen `const db = supabase as any` + file-level eslint-disable + TODO(27-05), mirroring entities/inventory/model/queries.ts, for the not-yet-regenerated open_units table and products columns"
    - "mapRpcError(): RPC exception-message-prefix -> AppErrorCode mapping that preserves the RPC's own message verbatim (D-08's interpolated remaining count reaches the UI untouched), mirroring entities/prep/model/queries.ts's INVENTORY_NEGATIVE precedent"
    - "All three lifecycle mutations dispatch exclusively through db.rpc(...) — zero .insert()/.update()/.delete() in the entity file, enforced by a grep acceptance gate"

key-files:
  created:
    - src/entities/open-unit/model/types.ts
    - src/entities/open-unit/model/queries.ts
    - src/entities/open-unit/model/queries.test.ts
    - src/entities/open-unit/index.ts
    - src/shared/lib/domain.open-unit-schema.test.ts
  modified:
    - src/shared/lib/domain.ts
    - src/shared/lib/mocks.ts
    - src/shared/lib/domain.test.ts
    - src/shared/lib/domain.product-schema.test.ts
    - src/shared/lib/domain-helpers.test.ts
    - src/shared/lib/groupOrderItems.test.ts
    - src/entities/inventory/model/store.test.ts
    - src/entities/tab/model/cartStore.test.ts
    - src/entities/tab/ui/CartItem.stories.tsx
    - src/entities/tab/ui/TabDetail.stories.tsx
    - src/features/add-combo-to-tab/ComboBuilderSheet.test.tsx
    - src/features/add-item-to-tab/ui/ModifierSheet.stories.tsx
    - src/features/physical-count/model/usePhysicalCount.test.ts
    - src/features/remove-tab-item/ui/RemoveTabItemDialog.test.tsx
    - src/features/void-order/ui/VoidOrderDialog.test.tsx
    - src/shared/ui/PersonCard/PersonCard.stories.tsx
    - src/shared/ui/SubTabColumn/SubTabColumn.stories.tsx
    - src/widgets/OrderPanel/CartPanel.stories.tsx
    - src/widgets/PaymentModal/PaymentModal.test.tsx

key-decisions:
  - "Every existing ProductSchema.parse/safeParse call site and every Product-typed object literal across the tree was updated to supply unitsPerPackage: null / parentProductId: null (Rule 1/plan-mandated) — the plan explicitly names mapProductRow (src/entities/product/model/queries.ts) as deferred to 27-06, but did not enumerate the ~17 other fixture/story call sites that npm run typecheck and npm run test surfaced; all were fixed inline per the plan's own instruction to keep the tree green."
  - "mapProductRow in src/entities/product/model/queries.ts was deliberately left untouched (per plan) — it will throw at runtime against a real DB row until 27-06 wires the two new columns, but no existing test exercises it directly (both test files that reference useProducts mock the hook entirely), so npm run test stays green without touching that file."
  - "index.ts's query-hook re-exports were briefly committed as part of Task 1 before model/queries.ts existed (would break typecheck if that commit were checked out alone) — caught immediately and corrected with a small follow-up commit before Task 2 restored the full surface, preserving true per-task commit atomicity."

requirements-completed: [SC-1, SC-3]

coverage:
  - id: D1
    description: "OpenUnitStatusSchema/OpenUnitSchema/OpenUnitCorrectionSchema added to domain.ts matching 27-02's live open_units column list; ProductSchema gains unitsPerPackage/parentProductId; entities/open-unit/model/types.ts re-exports only"
    verification:
      - kind: unit
        ref: "src/shared/lib/domain.open-unit-schema.test.ts (11 tests) — status/remainingCount/reason validation, unitsPerPackage/parentProductId null and populated cases"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run lint"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/entities/open-unit/ exposes a validated read hook (useOpenUnits) and three RPC-backed mutation hooks (useMutationOpenOpenUnit/useMutationCorrectOpenUnit/useMutationVoidOpenUnit), all dispatching via db.rpc with zero direct table writes, with RPC error messages mapped to AppErrorCode while preserved verbatim"
    verification:
      - kind: unit
        ref: "src/entities/open-unit/model/queries.test.ts (10 tests) — row mapping to Date/never-throws-on-bad-row, activeOnly filter, RPC dispatch args, DUPLICATE_ENTRY/AUTH_FORBIDDEN/INVENTORY_NEGATIVE/VALIDATION_ERROR/NOT_FOUND/fallback error-code mapping with verbatim message, client-side blank-reason rejection"
        status: pass
      - kind: other
        ref: "grep -c db.rpc( queries.ts == 3; grep -cE .(insert|update|delete)( queries.ts == 0; grep supabase as any queries.ts — all pass"
        status: pass
    human_judgment: false

# Metrics
duration: ~50min
completed: 2026-07-31
status: complete
---

# Phase 27 Plan 05: Open-Unit Client Schemas & Entity Queries Summary

**Zod schemas (`OpenUnitSchema`/`OpenUnitStatusSchema`/`OpenUnitCorrectionSchema` + `ProductSchema.unitsPerPackage`/`.parentProductId`) and a new `entities/open-unit` module exposing a validated read hook plus three RPC-backed mutation hooks (`open_open_unit`/`correct_open_unit`/`void_open_unit`) that plans 27-06 through 27-08 bind to.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-31
- **Tasks:** 2 of 2 complete
- **Files modified:** 22 total (5 new, 17 pre-existing fixture/story files updated for the new required-nullable `ProductSchema` fields)

## Accomplishments

- Added an `// OPEN UNITS` section to `domain.ts` immediately after `INVENTORY LOG`: `OpenUnitStatusSchema` (`z.enum(['active','exhausted','void'])`, matching 27-02's live `CHECK` constraint verbatim), `OpenUnitSchema` (all 11 live columns plus an optional joined `product`), and `OpenUnitCorrectionSchema` (`openUnitId`/`remainingCount`/trimmed-non-blank `reason`).
- Extended `ProductSchema` with `unitsPerPackage: z.number().int().positive().nullable()` and `parentProductId: UuidSchema.nullable()` — declared nullable-not-optional per `exactOptionalPropertyTypes`, flowing into `ProductCreateSchema`/`ProductUpdateSchema` through the existing `.omit()`/`.partial()` derivations with no extra edit. Registered both new schemas in the `domain.schemas`/`domain.types` aggregate map alongside `Inventory`.
- Created `src/entities/open-unit/model/types.ts` (two-line re-export, mirrors `entities/inventory/model/types.ts` exactly) and `src/entities/open-unit/index.ts` (public surface).
- Created `src/entities/open-unit/model/queries.ts`: `useOpenUnits({ activeOnly? })` selects `open_units` joined to `products`/`categories`, threads every row through a local `mapOpenUnitRow` (Result-typed — a bad row logs `open_unit.map_failed` and returns `resultError`, never throws), returns the same `data`/`resultError`/`isEmpty`/`isIdleOrLoading` shape `useInventory` uses. `useMutationOpenOpenUnit`/`useMutationCorrectOpenUnit`/`useMutationVoidOpenUnit` dispatch exclusively through `db.rpc(...)` — grep-verified zero `.insert()`/`.update()`/`.delete()` in the file. A shared `mapRpcError()` maps each RPC's exception-message prefix (`DUPLICATE_ENTRY`/`AUTH_FORBIDDEN`/`INVENTORY_NEGATIVE`/`VALIDATION_ERROR`/`NOT_FOUND`, else `SUPABASE_ERROR`) to an `AppErrorCode` while carrying the RPC's own message through untouched, so D-08's interpolated remaining-count text reaches the UI verbatim. Correct/void reject a blank `reason` client-side before dispatching (UX shortcut; the RPC's own guard is the real control). No new `AppErrorCode` was added — every code needed already existed.
- Wrote `src/shared/lib/domain.open-unit-schema.test.ts` (11 tests) and `src/entities/open-unit/model/queries.test.ts` (10 tests) covering every `<behavior>` case from both tasks.
- Ran the full unit suite twice (before and after the final commit): **147 test files, 1352 tests passed, 15 todo, 0 failed.** `npm run typecheck` and `npm run lint` both clean.
- This worktree had no `node_modules` (fresh checkout) and no `.env.local` (required by the global test setup, which pings the live Supabase project before any test file runs) — ran `npm ci` and copied `.env.local` from the sibling non-worktree checkout (gitignored, not committed) before any verification command could run.

## Task Commits

Each task was committed atomically:

1. **Task 1: OpenUnit Zod schemas and the two new ProductSchema fields** - `92b28f8` (feat)
2. **Follow-up: restore Task 1/Task 2 commit atomicity on index.ts** - `579f2dc` (fix)
3. **Task 2: open-unit entity queries — read hook + 3 RPC-backed mutation hooks** - `c812be7` (feat)

**Plan metadata:** this SUMMARY.md commit (pending)

## Files Created/Modified

- `src/shared/lib/domain.ts` - `OpenUnitStatusSchema`/`OpenUnitSchema`/`OpenUnitCorrectionSchema`, `ProductSchema.unitsPerPackage`/`.parentProductId`, aggregate map entries, 2 mock-product literals updated
- `src/entities/open-unit/model/types.ts` - two-line re-export of the three OpenUnit schemas/types
- `src/entities/open-unit/model/queries.ts` - `openUnitKeys`, `useOpenUnits`, 3 RPC-backed mutation hooks, `mapRpcError`/`mapOpenUnitRow`
- `src/entities/open-unit/model/queries.test.ts` - row/error mapping behavior coverage (10 tests)
- `src/entities/open-unit/index.ts` - public entity surface
- `src/shared/lib/domain.open-unit-schema.test.ts` - OpenUnit*/ProductSchema field behavior coverage (11 tests)
- 16 other fixture/story files (`mocks.ts`, `domain.test.ts`, `domain.product-schema.test.ts`, `domain-helpers.test.ts`, `groupOrderItems.test.ts`, `inventory/model/store.test.ts`, `tab/model/cartStore.test.ts`, and 10 more `.test.ts(x)`/`.stories.tsx` files) - added `unitsPerPackage: null, parentProductId: null` to every pre-existing `Product`-shaped literal so `npm run typecheck`/`npm run test` stay green

## Decisions Made

See `key-decisions` in the frontmatter:
1. Every existing `ProductSchema.parse`/`safeParse` call site and every `Product`-typed literal across the tree (17 files beyond `domain.ts` itself) was updated with the two new required-nullable fields — the plan named one call site (`mapProductRow`) explicitly but not the rest; `npm run typecheck` and `npm run test` surfaced the complete list, and all were fixed per the plan's own "keep the tree green" instruction.
2. `mapProductRow` in `src/entities/product/model/queries.ts` was deliberately left unfixed, exactly as the plan specifies (27-06's scope) — verified safe because both test files referencing `useProducts` mock the hook entirely rather than exercising the real mapping function.
3. A brief commit-atomicity slip on `index.ts` (query-hook exports landed in Task 1's commit before `model/queries.ts` existed) was caught and corrected with an explicit follow-up commit before Task 2, so every commit in this plan's history typechecks in isolation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 17 additional `ProductSchema` call sites beyond the one the plan named**
- **Found during:** Task 1, running `npm run typecheck` and `npm run test` after adding the two new required-nullable `ProductSchema` fields.
- **Issue:** The plan's action text named only `mapProductRow` as a call site that would break, deferring its fix to 27-06. `npm run typecheck` surfaced 8 additional TS2739 "missing properties" errors from `Product`-typed literals (typed assignments, which TS does check structurally even though `.parse(unknown)` calls are not compile-checked), and `npm run test` then surfaced 2 more runtime `ZodError` failures from `.parse()` call sites not caught by typecheck (`ProductSchema.parse` accepts `unknown`, so missing fields there are only caught at runtime).
- **Fix:** Added `unitsPerPackage: null, parentProductId: null` to every affected literal: `mocks.ts` (5 `ProductSchema.parse` sites), `domain.test.ts`/`domain.product-schema.test.ts`/`domain-helpers.test.ts`/`groupOrderItems.test.ts` (test fixtures), `entities/inventory/model/store.test.ts`, and 10 typed-`Product`/`OrderItem.product` literals across `entities/tab`, `features/*`, `shared/ui/*`, and `widgets/*` test/story files.
- **Files modified:** listed in `key-files.modified` above.
- **Commit:** `92b28f8`

**2. [Rule 1 - Bug] Restored per-task commit atomicity on `index.ts`**
- **Found during:** immediately after committing Task 1, while preparing Task 2's diff.
- **Issue:** `index.ts` had been authored in full (type re-exports + query-hook re-exports) in a single `Write` call before either task was committed. Task 1's commit therefore included `index.ts`'s `export { ... } from './model/queries'` line even though `model/queries.ts` (Task 2's deliverable) did not exist in that commit — checking out Task 1's commit alone would fail `npm run typecheck`.
- **Fix:** Trimmed `index.ts` back to the type-only surface in a small follow-up commit, then Task 2's commit re-added the query-hook re-exports alongside the file that backs them.
- **Files modified:** `src/entities/open-unit/index.ts`
- **Commit:** `579f2dc` (trim), re-added in `c812be7`

---

**Total deviations:** 2 (both Rule 1 auto-fixes)
**Impact on plan:** No scope creep — deviation 1 is exactly the "give them explicit null values… so the tree stays green" instruction the plan itself specifies, applied to a longer call-site list than the plan enumerated. Deviation 2 is a self-correction of the executor's own commit sequencing, with no effect on the shipped code.

## Issues Encountered

- This worktree checkout had no `node_modules` (per-checkout state, gitignored) and no `.env.local` — the latter is required because `src/test/global-setup.ts` pings the live Supabase project before any Vitest file runs, even for pure-unit tests with no live-DB assertions. Resolved with `npm ci` and copying `.env.local` from the sibling non-worktree checkout at `/home/widowsvail/Hard-Disk/Projects/Code/POS/bola8pos-kiro/bar-pos/.env.local` (not committed; gitignored in both locations).

## User Setup Required

None. All work is pure client-layer TypeScript against already-live backend RPCs/tables (27-02/27-04) — no new migration, no live push required for this plan.

## Next Phase Readiness

Plan 27-05 is complete. `useOpenUnits`, `useMutationOpenOpenUnit`, `useMutationCorrectOpenUnit`, and `useMutationVoidOpenUnit` are importable from `@entities/open-unit`, every row is Zod-validated, every mutation routes through an RPC, and RPC error messages reach the caller intact. Plans 27-06 (product-admin surface binding `unitsPerPackage`/`parentProductId`) and 27-07/27-08 (the admin Open-Units tab UI) can now bind directly to these hooks and types.

---

## Self-Check: PASSED

- `src/shared/lib/domain.ts` (OpenUnit* schemas + ProductSchema fields) — FOUND
- `src/entities/open-unit/model/types.ts` — FOUND
- `src/entities/open-unit/model/queries.ts` — FOUND
- `src/entities/open-unit/model/queries.test.ts` — FOUND
- `src/entities/open-unit/index.ts` — FOUND
- `src/shared/lib/domain.open-unit-schema.test.ts` — FOUND
- Commit `92b28f8` — FOUND in `git log --oneline`
- Commit `579f2dc` — FOUND in `git log --oneline`
- Commit `c812be7` — FOUND in `git log --oneline`
- `npx vitest run --project unit --reporter=dot src/entities/open-unit` — 10 passed, 0 failed — CONFIRMED
- `npm run test` (full unit suite) — 147/149 files (2 skipped), 1352/1367 tests passed, 15 todo, 0 failed — CONFIRMED
- `npm run typecheck` — clean — CONFIRMED
- `npm run lint` — clean — CONFIRMED

---
*Phase: 27-one-shot-inventory-cigarette-box-pattern*
*Completed: 2026-07-31*
