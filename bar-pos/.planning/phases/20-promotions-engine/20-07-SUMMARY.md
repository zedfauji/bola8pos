---
phase: 20-promotions-engine
plan: 07
subsystem: frontend
tags: [react, tanstack-query, promotions, pricing-authority, fsd]

# Dependency graph
requires:
  - phase: 20-promotions-engine (plan 03, evaluation + audit)
    provides: "evaluate_promotions_for_item SECURITY DEFINER RPC — sole writer of order_items.unit_price for promotion-eligible items"
  - phase: 20-promotions-engine (plan 06, live DB push)
    provides: "promotions/promotion_availability/applied_promotions LIVE on the remote database; supabase.types.ts regenerated"
provides:
  - "ProductGrid.addItem now submits product.basePrice (undiscounted) — completes the client half of Pitfall 1's server-pricing-authority migration"
  - "isPromotionActive cosmetic/display-only helper (src/shared/lib/domain-helpers.ts)"
  - "useActivePromotions hook + ActivePromotionEntry type (src/entities/promotion)"
  - "Active Promotions banner (repurposed HappyHourBanner.tsx), data-testid active-promotions-banner"
affects: [20-08, 20-09, 20-10, 20-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side day/time window matching mirrored from is_promotion_available()/is_combo_available() (ISODOW conversion, HH:MM string comparison, optional date range) — reused verbatim in isPromotionActive and the banner's countdown helper, cosmetic-only"
    - "Two-query entity hook (promotions + promotion_availability, joined client-side into a Map) for a banner-shaped read, avoiding a per-promotion N+1"

key-files:
  created: []
  modified:
    - src/widgets/OrderPanel/ProductGrid.tsx
    - src/shared/lib/domain-helpers.ts
    - src/shared/lib/domain-helpers.test.ts
    - src/entities/promotion/model/queries.ts
    - src/entities/promotion/index.ts
    - src/entities/promotion/model/index.ts
    - src/widgets/OrderPanel/HappyHourBanner.tsx
    - src/widgets/OrderPanel/HappyHourBanner.test.tsx
    - e2e/20-sprint2-revenue.spec.ts

key-decisions:
  - "isPromotionActive lives in domain-helpers.ts (not the promotion entity) to match the existing isHappyHourActive precedent it retires-in-spirit; it is explicitly documented (JSDoc + code comments at both call sites) as cosmetic/display-only and must never feed a mutation payload"
  - "useActivePromotions fetches promotions (is_active=true) and promotion_availability in two queries, joined into a Map<promotionId, windows[]> client-side — no bulk join endpoint exists yet, and this avoids an N+1 per promotion"
  - "Countdown 'all with a known end time' rule implemented literally: ANY active entry with zero windows ('always available') suppresses the whole 'Ends in…' suffix, matching 20-UI-SPEC.md's States Checklist wording exactly, rather than trying to average/partially-render across mixed known/unknown end times"
  - "Exported useActivePromotions/ActivePromotionEntry from both entities/promotion/index.ts and model/index.ts (not originally listed in the plan's files_modified) so ProductGrid (a widget) can import per FSD boundaries — Rule 3 blocking fix, required for the plan's own acceptance criteria ('useActivePromotions is exported from entities/promotion')"

requirements-completed: [SC-3]

# Metrics
duration: ~40min
completed: 2026-07-10
---

# Phase 20 Plan 07: Client Pricing Rewire + Active Promotions Banner Summary

**Completed the client half of moving pricing authority to the server: `ProductGrid` now submits `product.basePrice` (never a client-computed discounted price) to `create_order_with_items`, and the legacy `HappyHourBanner` is repurposed into a cosmetic, live "Active Promotions" banner backed by `useActivePromotions`, with its always-available countdown bug fixed.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2/2 completed
- **Files modified:** 9 (0 created)

## Accomplishments

- `ProductGrid.tsx`: both `addItem(...)` call sites (`handleProductSelect`, `handleModifierConfirm`) now pass `product.basePrice` / `selectedProduct.basePrice` instead of a `resolveProductPrice()`-computed value; the `resolveProductPrice` import and the per-call `category` locals that existed only to feed it are removed; each call site carries an inline comment explaining the RPC-payload invariant (Pitfall 1)
- `domain-helpers.ts`: new `isPromotionActive(promotion, windows, currentTime)` — cosmetic/display-only pure helper mirroring `is_promotion_available()`'s ISODOW + time-window matching (isActive=false ⇒ false; empty windows ⇒ always active; otherwise day+time+optional-date-range match); JSDoc and inline comments explicitly forbid using it to compute a charged price; 4 new unit tests (no-windows, inside-window, outside-window, inactive-promotion) — 82/82 domain-helpers tests green
- `entities/promotion/model/queries.ts`: new `useActivePromotions()` returning `ActivePromotionEntry[]` (`{ promotion, windows }[]`) for all `is_active: true` promotions, `staleTime: 30_000`; extracted `mapPromotionAvailabilityRow` (previously inlined in `usePromotionAvailabilityWindows`) for reuse; both `useActivePromotions`/`ActivePromotionEntry` re-exported from `entities/promotion/index.ts` and `model/index.ts`
- `HappyHourBanner.tsx` repurposed in place per 20-UI-SPEC.md §4: prop shape changed from `{ categories, now }` to `{ activePromotions: ActivePromotionEntry[] }`; filters to promotions active-right-now via `isPromotionActive`; renders `null` when none active; copy changed to `"Promotions Active — {names}"`; container (`rounded-lg border border-amber-700 bg-amber-950...`, `role="status"`), `Zap` icon, and the 1000ms `setInterval` tick all preserved verbatim; `data-testid` renamed `happy-hour-banner` → `active-promotions-banner`
- **Countdown bug fixed:** the old logic defaulted `endMinutes` to `Infinity` for a category with no HH end time; the new logic explicitly suppresses the "Ends in…" suffix whenever ANY active promotion has zero availability windows ("always available"), and otherwise shows the earliest known end time computed from each active promotion's actually-matched window (not just its first window) — a new `getMatchedWindowEndMinutes` helper handles this
- `HappyHourBanner.test.tsx` rewritten for the new prop shape/testid, including the required "always-available omits Ends in" regression test and an isActive=false regression test; 6/6 green
- `e2e/20-sprint2-revenue.spec.ts` D5 spec updated: `happy-hour-banner` → `active-promotions-banner`, `"Happy Hour Active"` → `"Promotions Active"` text assertion
- `grep -rn "happy-hour-banner" src/ e2e/` returns zero matches — full testid migration confirmed

## Task Commits

Each task was committed atomically:

1. **Task 1: Send basePrice to the RPC + cosmetic isPromotionActive helper + useActivePromotions hook** - `c94da88` (feat)
2. **Task 2: Repurpose HappyHourBanner into the Active Promotions banner** - `cd7f6a2` (feat)

_Note: no plan-metadata commit in this run — per parallel-executor instructions, STATE.md/ROADMAP.md updates are owned by the orchestrator after all wave agents complete._

## Files Created/Modified

- `src/widgets/OrderPanel/ProductGrid.tsx` - addItem calls now pass `basePrice`; wires `useActivePromotions()` into the banner
- `src/shared/lib/domain-helpers.ts` - `isPromotionActive` cosmetic helper
- `src/shared/lib/domain-helpers.test.ts` - 4 new `isPromotionActive` unit tests
- `src/entities/promotion/model/queries.ts` - `useActivePromotions` hook + `ActivePromotionEntry` type + shared `mapPromotionAvailabilityRow`
- `src/entities/promotion/index.ts` - re-exports `useActivePromotions`/`ActivePromotionEntry`
- `src/entities/promotion/model/index.ts` - re-exports `useActivePromotions`/`ActivePromotionEntry`
- `src/widgets/OrderPanel/HappyHourBanner.tsx` - repurposed into the Active Promotions banner
- `src/widgets/OrderPanel/HappyHourBanner.test.tsx` - rewritten for the new prop shape/testid
- `e2e/20-sprint2-revenue.spec.ts` - D5 spec updated to the new testid/copy

## Decisions Made

- Kept `isPromotionActive` in `domain-helpers.ts` rather than the promotion entity — matches the file's existing role as the home of all pure display/pricing-adjacent helpers (`isHappyHourActive`, `resolveProductPrice`, `calculateDiscountAmount`), and both the old and new helpers are explicitly labeled non-authoritative in the same file for easy side-by-side auditing.
- `useActivePromotions` performs two queries (promotions, then `promotion_availability .in('promotion_id', ids)`) rather than a single joined query — no view/RPC exists yet for this shape, and this keeps the hook aligned with the existing `usePromotionAvailabilityWindows` per-promotion query pattern while still avoiding an N+1 (one extra query total, not one per promotion).
- The "omit Ends in… when any active promotion has no windows" rule is implemented at the aggregate level (any zero-window entry suppresses the whole line) rather than per-entry partial rendering, exactly matching 20-UI-SPEC.md's States Checklist: "1+ active promotions, at least one with no time window ('always available'): omits the 'Ends in…' suffix entirely."
- Extended the plan's `files_modified` list with `src/entities/promotion/index.ts` and `src/entities/promotion/model/index.ts` (Rule 3 — blocking fix): `useActivePromotions` existing only in `queries.ts` without a barrel re-export would violate FSD import boundaries when `ProductGrid` (a widget) tries to consume it, and would fail the plan's own acceptance criterion "`useActivePromotions` is exported from entities/promotion."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing `node_modules` and `.env.local`**
- **Found during:** Task 1, first `npx vitest run` attempt
- **Issue:** Fresh worktree checkout had no `node_modules/` and no `.env.local`; Vitest's `global-setup.ts` requires live Supabase credentials project-wide (same situation documented in every prior Phase 20 plan's SUMMARY.md).
- **Fix:** Ran `npm ci` (lockfile-exact install) and copied `.env.local` from the main checkout (`D:/Projects/Code/POS/bola8pos-kiro/bar-pos/.env.local`). Neither is a tracked/committed change.
- **Files modified:** none (local dev-environment plumbing only)
- **Committed in:** N/A (gitignored, not staged)

**2. [Rule 3 - Blocking] `useActivePromotions`/`ActivePromotionEntry` re-exports added to `entities/promotion/index.ts` + `model/index.ts`**
- **Found during:** Task 2, wiring `useActivePromotions` into `ProductGrid.tsx`
- **Issue:** The plan's `files_modified` list for Task 1 covers only `entities/promotion/model/queries.ts`; without also updating the entity's barrel exports, `ProductGrid` (a widget) cannot import `useActivePromotions` without a deep import into `model/`, which violates this project's FSD import-boundary convention (enforced by `eslint-plugin-boundaries`) and would leave the plan's own acceptance criterion ("`useActivePromotions` is exported from entities/promotion") unmet.
- **Fix:** Added `useActivePromotions`/`ActivePromotionEntry` to both `src/entities/promotion/index.ts` and `src/entities/promotion/model/index.ts`, following the exact existing re-export pattern for every other promotion hook.
- **Files modified:** `src/entities/promotion/index.ts`, `src/entities/promotion/model/index.ts`
- **Verification:** `npm run lint` clean; `ProductGrid.tsx` imports `useActivePromotions` from `@entities/promotion` (the public barrel) with no boundary violation.
- **Committed in:** `c94da88` (Task 1 commit)

---

**Total deviations:** 2 (both Rule 3 blocking fixes — 1 local-environment plumbing, 1 barrel-export completeness)
**Impact on plan:** No scope creep. No production behavior changed beyond what each task specified; the barrel-export fix is additive-only re-export wiring.

## Issues Encountered

None beyond the deviations above. `npm run typecheck` reports only the 2 pre-existing, unrelated errors already documented in `deferred-items.md`/STATE.md since Plan 20-06 (`src/entities/tab/model/queries.ts:778`, `src/shared/lib/agent/rag.ts:60`) — neither touched by this plan, and no new typecheck errors were introduced.

## User Setup Required

None — no external service configuration required. This plan is 100% client-side React/TypeScript wiring against the already-live Phase 20 database schema (Plan 20-06).

## Next Phase Readiness

- The client-half of Pitfall 1's server-pricing-authority migration is now complete for the item/category order-flow path: `ProductGrid` never sends a client-discounted `unit_price`. Plan 20-08 (pool billing's client rewire) is the remaining half, per this plan's scope note.
- `useActivePromotions`/`isPromotionActive`/`ActivePromotionEntry` are now available for reuse by any future promotions-aware UI (e.g. Plan 20-09's parity gate, or the Settings → Promotions admin list if it wants a live-preview affordance).
- `resolveProductPrice`/`isHappyHourActive` remain in `domain-helpers.ts` and are still used by `ProductCard.tsx` (out of scope for this plan, per the plan's file list) — Plan 20-10 is explicitly responsible for retiring `resolveProductPrice` entirely and dropping the legacy `happy_hour_*` columns (Pitfall 4's verification-gated column drop).
- All `happy-hour-banner` testid references are fully migrated (`grep` confirms zero matches in `src/` and `e2e/`); Plan 20-09's e2e/UAT gate can rely on `active-promotions-banner` exclusively going forward.

---
*Phase: 20-promotions-engine*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: src/widgets/OrderPanel/ProductGrid.tsx
- FOUND: src/shared/lib/domain-helpers.ts
- FOUND: src/shared/lib/domain-helpers.test.ts
- FOUND: src/entities/promotion/model/queries.ts
- FOUND: src/entities/promotion/index.ts
- FOUND: src/entities/promotion/model/index.ts
- FOUND: src/widgets/OrderPanel/HappyHourBanner.tsx
- FOUND: src/widgets/OrderPanel/HappyHourBanner.test.tsx
- FOUND: e2e/20-sprint2-revenue.spec.ts
- FOUND commit: c94da88 (Task 1, verified via `git cat-file -e`)
- FOUND commit: cd7f6a2 (Task 2, verified via `git cat-file -e`)
