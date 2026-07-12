---
phase: 20-promotions-engine
plan: 11
subsystem: ui
tags: [react, typescript, zod, vitest, happy-hour-retirement, promotions]

# Dependency graph
requires:
  - phase: 20-promotions-engine (plan 10)
    provides: "Live happy_hour_start/happy_hour_end/happy_hour_price columns dropped; every DB-typed consumer already neutralized (reads null for the vestigial Zod fields)"
provides:
  - "The client-side happy-hour calculation path (resolveProductPrice, category-based isHappyHourActive) is fully removed from src/shared/lib/domain-helpers.ts"
  - "ModifierSheet and ProductCard display product.basePrice directly with no client HH pricing/badge logic"
  - "The order-based table-status happy-hour indicator (TableStatusPanel's isHappyHourActive helper + badge) is retired"
  - "Phase 20 (Promotions Engine) is now fully complete — server-side evaluate_promotions is the sole pricing authority, with zero lingering client HH calc code"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Net-removal plan: no new production symbols, only deletions and simplification of existing display consumers to read product.basePrice directly"

key-files:
  created: []
  modified:
    - src/shared/lib/domain-helpers.ts
    - src/shared/lib/domain-helpers.test.ts
    - src/features/add-item-to-tab/ui/ModifierSheet.tsx
    - src/entities/product/ui/ProductCard.tsx
    - src/entities/product/ui/ProductCard.test.tsx
    - src/widgets/TableStatusPanel/index.tsx
    - src/features/print-precheque/usePrintPreCheque.ts

key-decisions:
  - "Deleted src/entities/promotion/model/hh-parity.integration.test.ts (Rule 1/3, not in this plan's files_modified): its sole import (resolveProductPrice) no longer exists after Task 1's deletion, which broke npm run typecheck project-wide. The file's entire premise — proving parity between the legacy client calc and the server promotions engine — is moot now that both the legacy function (this plan) and the underlying happy_hour_* columns (Plan 20-10) are gone. Plan 20-10's own deferred-items.md already flagged this file as a recommended retirement target once its subject was removed, so this is completing a previously-identified cleanup, not new scope creep."
  - "Left receipt-format.ts's happyHourActive field and supabase-contracts.ts's happy_hour_* fields untouched after checking both per Task 2's action item: receipt-format.ts's flag is a plain boolean parameter (not a DB column read) already hardcoded false at its only call site (usePrintPreCheque.ts); supabase-contracts.ts is an explicitly-labeled inert 'Placeholder for Supabase generated types' doc file not imported for its Database.public.Tables shape by any real query code (confirmed via grep, same conclusion Plan 20-10's deferred-items.md already reached for this exact file). Neither depends on the dropped columns in a way that required removal or neutralization beyond what already existed."
  - "ProductCard's now?: Date prop kept in the interface (unused in the component body) rather than removed — ProductGrid.tsx still passes it as a prop at 2 call sites and the plan did not ask to change that call site; leaving the prop type in place avoids an unrelated ProductGrid edit while the component itself no longer reads it for any HH logic."

requirements-completed: [SC-1]

# Metrics
duration: ~50min
completed: 2026-07-10
---

# Phase 20 Plan 11: Retire Client-Side Happy-Hour Calc Path Summary

**Deleted `resolveProductPrice`/`isHappyHourActive` from `domain-helpers.ts` and the order-based `isHappyHourActive` from `TableStatusPanel`; `ModifierSheet`/`ProductCard` now display `product.basePrice` directly with the server's `evaluate_promotions` engine as the sole pricing authority — Phase 20 is complete.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2/2 completed
- **Files modified:** 7 (2 deletions beyond the plan's file list: `hh-parity.integration.test.ts`, plus the plan's own 2 TableStatusPanel deletions)

## Accomplishments

- `domain-helpers.ts`: removed `resolveProductPrice` (client-side happy-hour price resolver) and the category-based `isHappyHourActive`, plus their now-unused `Category`/`Product` type imports. `calculateDiscountAmount`/`DiscountType`/`DiscountScope` (unrelated manual-discount feature) and the COSMETIC/DISPLAY-ONLY `isPromotionActive` (Phase 20's own server-mirroring helper) were left untouched.
- `domain-helpers.test.ts`: removed the `resolveProductPrice` describe block and both `isHappyHourActive` describe blocks (the original suite and the "Sprint 2 — boundary tests" suite); updated imports accordingly. 64 tests remain in the touched files (all pass).
- `ModifierSheet.tsx`: removed the `categoryForPricing` helper, the `category` memo, and the `resolveProductPrice` import; `runningTotal` now computes directly from `product.basePrice + modifierSum`, rounded to 2 decimals as before. The "Item total" display now reflects base price — the server applies any promotion at order time.
- `ProductCard.tsx`: removed the `isHappyHourActive`/`resolveProductPrice` imports, the `inHappyHour`/`displayPrice` derivation, and the "HAPPY HOUR" badge; displays `product.basePrice` directly. The `now?: Date` prop stays in the interface (still passed by `ProductGrid.tsx`) but is no longer read inside the component.
- `ProductCard.test.tsx`: replaced the two HH-badge assertions with a base-price-renders assertion (via `aria-label` lookup on the `MoneyDisplay` span, since the visible text is split across two DOM text nodes) and a regression test confirming no "HAPPY HOUR" text ever renders.
- `TableStatusPanel/index.tsx`: removed the `isHappyHourActive` import, the `happyHour` memo, and the "Happy Hour Active" badge it drove. The "Active Promotions" banner (existing OrderPanel UI, outside this plan's scope) covers promotion visibility going forward.
- Deleted `src/widgets/TableStatusPanel/isHappyHourActive.ts` (order-based HH helper, scanning `activeOrders` for any category HH window) and `isHappyHourActive.test.ts` (13 tests removed with it — no other file imported this helper).
- `usePrintPreCheque.ts`: replaced the stale `TODO: compute happyHourActive once an isHappyHourActive(...) helper exists` comments (2 occurrences) with a note explaining `happyHourActive` is permanently `false` now that promotions are server-applied and already reflected in each item's `lineTotal` — no behavioral change (the field was already hardcoded `false`).
- Checked `receipt-format.ts` and `supabase-contracts.ts` for residual `happy_hour`/`happyHour` references per the plan's action item — both confirmed inert/non-blocking (see key-decisions); left unmodified.
- Full gate green: `npm run typecheck` (only the 2 pre-existing documented errors — `tab/model/queries.ts:780`, `agent/rag.ts:60`, both predating Phase 20), `npm run lint` (exit 0, only the same pre-existing informational `eslint-plugin-boundaries` legacy-selector notice), `npm run test` (1213/1214 pass — only the pre-existing documented `useCloseTab.test.ts:95` failure since Phase 15, no new regressions).
- `grep -n "resolveProductPrice" src/shared/lib/domain-helpers.ts` → zero matches (verify command's negated-grep criterion satisfied).

## Task Commits

Each completed task was committed atomically:

1. **Task 1: Remove resolveProductPrice + isHappyHourActive; switch ModifierSheet + ProductCard to base price** - `36477d5` (feat)
2. **Task 2: Retire the table-status HH indicator + residual cleanup + full gate** - `ebcabaa` (feat)

_Note: no plan-metadata commit in this run — per parallel-executor instructions, STATE.md/ROADMAP.md updates are owned by the orchestrator after all wave agents complete._

## Files Created/Modified

- `src/shared/lib/domain-helpers.ts` - removed `resolveProductPrice` + category-based `isHappyHourActive` + their now-unused `Category`/`Product` imports
- `src/shared/lib/domain-helpers.test.ts` - removed the corresponding test blocks; trimmed imports
- `src/features/add-item-to-tab/ui/ModifierSheet.tsx` - removed `categoryForPricing`/`resolveProductPrice`; `runningTotal` computed from `product.basePrice` directly
- `src/entities/product/ui/ProductCard.tsx` - removed HH badge + HH price resolution; displays `product.basePrice`
- `src/entities/product/ui/ProductCard.test.tsx` - dropped HH-badge assertions, added base-price + no-badge assertions
- `src/widgets/TableStatusPanel/index.tsx` - removed `isHappyHourActive` import/memo/badge
- `src/widgets/TableStatusPanel/isHappyHourActive.ts` - deleted (order-based HH helper)
- `src/widgets/TableStatusPanel/isHappyHourActive.test.ts` - deleted (13 tests)
- `src/features/print-precheque/usePrintPreCheque.ts` - replaced stale `isHappyHourActive` TODO comments with an explanatory note (no behavior change)
- `src/entities/promotion/model/hh-parity.integration.test.ts` - deleted (Rule 1/3 deviation, see below)

## Decisions Made

See `key-decisions` in frontmatter: (1) deletion of the now-broken `hh-parity.integration.test.ts`, (2) leaving `receipt-format.ts`/`supabase-contracts.ts` unmodified after confirming both are inert with respect to the column drop, (3) keeping `ProductCard`'s unused `now?: Date` prop in the interface for `ProductGrid.tsx` call-site compatibility.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Bug/Blocking] Deleted `src/entities/promotion/model/hh-parity.integration.test.ts`**
- **Found during:** Task 1, first `npm run typecheck` run after deleting `resolveProductPrice` from `domain-helpers.ts`.
- **Issue:** This Plan-20-09-authored integration test file imports `resolveProductPrice` from `domain-helpers.ts` (`import { resolveProductPrice } from '../../../shared/lib/domain-helpers';`) to compare the legacy client-side HH price against the server-evaluated price. Removing `resolveProductPrice` (this plan's own Task 1 action) broke `npm run typecheck` with `TS2305: Module has no exported member 'resolveProductPrice'`. The file was already known to fail at *runtime* since Plan 20-10's column drop (documented in `deferred-items.md` as "Plan 20-10, Task 1" fallout: `42703 column does not exist` on the now-dropped `happy_hour_*` columns it inserts/selects against) — this plan's deletion additionally broke it at *compile time*, which is a hard blocker for both this task's own acceptance criteria (`npm run typecheck` exit 0) and Task 2's full-gate requirement.
- **Fix:** Deleted the file outright rather than patching its import. Its entire purpose — proving parity between the legacy client calc and the server promotions engine before the columns were dropped — is now moot: the legacy function no longer exists (this plan) and the columns no longer exist (Plan 20-10), so there is nothing left to compare. `deferred-items.md`'s Plan 20-10 entry had already flagged this exact file as "Recommended follow-up (not assigned to any plan yet): retire or rewrite `hh-parity.integration.test.ts` now that its subject... no longer exists" — this deletion completes that flagged follow-up rather than introducing new scope.
- **Files modified:** `src/entities/promotion/model/hh-parity.integration.test.ts` (deleted)
- **Verification:** `npm run typecheck` green after deletion (only the 2 pre-existing documented errors remain); this file is not part of `npm run test`'s default unit scope (it's an integration test gated by `describe.skipIf` on live env vars), so its removal has no effect on the unit suite count, confirmed by the full-suite run in Task 2 (1213/1214 pass, same baseline).
- **Committed in:** `36477d5` (Task 1 commit)

---

**Total deviations:** 1 (Rule 1/3 — bug/blocking, directly caused by this plan's own Task 1 deletion, not new scope)
**Impact on plan:** The deletion was necessary to keep this plan's own stated acceptance criteria (typecheck green) achievable and had already been flagged as a natural follow-up by the prior plan's deferred-items log. No architectural changes; no scope creep beyond what correctness required.

## Issues Encountered

- **`node_modules`/`.env.local` missing in the fresh worktree** — same recurring situation documented in every prior Phase 20 plan's SUMMARY.md. Ran `npm ci` and copied `.env.local` from the main checkout (`D:/Projects/Code/POS/bola8pos-kiro/bar-pos/.env.local`); neither is a tracked/committed change.
- **`ProductCard.test.tsx`'s base-price assertion needed `getByLabelText` instead of `getByText`** — `MoneyDisplay` renders the currency symbol and the formatted amount as two adjacent text nodes inside one `<span>` (pre-existing behavior of `MoneyDisplay`, unrelated to this plan), so `screen.getByText('$5.50')` threw a multi-node match error. Used `screen.getByLabelText('$5.50 dollars')` (the span's `aria-label`) instead, which is both more robust and consistent with how `MoneyDisplay`'s accessible name is already exposed elsewhere in the test suite.
- **Pre-existing, unrelated snapshot drift** (`src/shared/lib/__snapshots__/buildStartTicketText.test.ts.snap`, line-ending normalization only) was already present in the working tree before this session started (visible in the initial `git status` at agent spawn). Left untouched and unstaged — not part of this plan's changes, consistent with the same note in the prior plan's (20-10) SUMMARY.md.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 20 (Promotions Engine) is now fully complete across all 11 plans. The server-side `evaluate_promotions`/`evaluate_promotions_for_item` RPC path (Plans 20-01 through 20-09) is the sole pricing authority; the legacy client-side happy-hour calculation path is fully removed at every layer:
  - DB columns dropped (Plan 20-10)
  - DB-typed consumers neutralized (Plan 20-10)
  - Client calc functions (`resolveProductPrice`, both `isHappyHourActive` variants) deleted (this plan)
  - Display consumers (`ModifierSheet`, `ProductCard`, `TableStatusPanel`) switched to base price / promotion-agnostic display (this plan)
- No known stubs or placeholder data introduced by this plan — it is a pure net-removal plan with base-price display as the (already-correct, pre-promotion) fallback; the server engine remains the authority for any actually-applied discount.
- No blockers for any future phase. The `@deprecated`-vestigial `happyHourStart`/`happyHourEnd`/`happyHourPrice` nullable Zod fields in `domain.ts` remain as documented housekeeping (explicitly out of scope for this plan per its `<objective>`) — a future cleanup plan could remove them from the schema entirely if desired, but nothing currently depends on them being present.

---
*Phase: 20-promotions-engine*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: commit `36477d5` (Task 1)
- FOUND: commit `ebcabaa` (Task 2)
- VERIFIED: `src/shared/lib/domain-helpers.ts` contains zero `resolveProductPrice`/`isHappyHourActive` matches
- VERIFIED: `src/widgets/TableStatusPanel/isHappyHourActive.ts` no longer exists
- VERIFIED: `npm run typecheck` — only the 2 pre-existing documented errors
- VERIFIED: `npm run lint` — exit 0
- VERIFIED: `npm run test` — 1213/1214 pass, only the pre-existing documented `useCloseTab.test.ts:95` failure
