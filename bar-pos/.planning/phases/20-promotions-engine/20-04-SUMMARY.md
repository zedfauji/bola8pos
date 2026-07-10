---
phase: 20-promotions-engine
plan: 04
subsystem: ui
tags: [react, admin-ui, promotions, fsd, feature-slice, settings]

# Dependency graph
requires:
  - phase: 20-promotions-engine (plan 02, promotion contracts)
    provides: entities/promotion/ Zod schemas + 7 TanStack Query hooks (usePromotions, usePromotion, useMutationCreatePromotion, useMutationUpdatePromotion, useMutationDeletePromotion, usePromotionAvailabilityWindows, usePromotionActive)
provides:
  - "Settings → Promotions admin surface: ManagePromotionsTab (list/create/edit/delete + inline Active toggle + target-type badges)"
  - "PromotionBuilderForm (create/edit dialog: name, discount type/value, fixed-price stacking hint, target type/picker, priority, active toggle)"
  - "PromotionAvailabilityEditor (near-verbatim ComboAvailabilityEditor clone for day/time windows)"
  - "features/manage-promotions/ explicit-named barrel"
  - "SettingsTabsPanel 'promotions' tab entry (gated on manage_products)"
affects: [20-09 (e2e/UAT gate exercises this admin surface)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Near-verbatim clone-and-rename pattern (ComboAvailabilityEditor -> PromotionAvailabilityEditor): only prop/table/column/query-key names swapped, all layout/copy/state-machine logic byte-identical"
    - "Ad-hoc badge classes (bg-{color}-500/20 text-{color}-300) reused from ComboBuilderForm's slotTypeBadge convention, extended from 2 to 4 values for target_type"
    - "Radix Select label association via useId()-generated id shared between <label htmlFor> and <SelectTrigger id>, matching CategoryTreeEditor.tsx precedent (satisfies jsx-a11y/label-has-associated-control)"

key-files:
  created:
    - src/features/manage-promotions/ui/PromotionAvailabilityEditor.tsx
    - src/features/manage-promotions/ui/PromotionBuilderForm.tsx
    - src/features/manage-promotions/ui/ManagePromotionsTab.tsx
    - src/features/manage-promotions/ui/ManagePromotionsTab.test.tsx
    - src/features/manage-promotions/ui/PromotionBuilderForm.test.tsx
    - src/features/manage-promotions/index.ts
  modified:
    - src/widgets/SettingsTabsPanel/index.tsx

key-decisions:
  - "Category-target label rendered as a plain <span> (not <label>) since CategoryTreePicker is a tree widget with its own internal sr-only labelling, not a single associable form control — avoids a jsx-a11y/label-has-associated-control false-positive without adding a fake htmlFor target"
  - "Discount-type and target-type Select labels use useId()-shared ids between <label htmlFor> and <SelectTrigger id>, mirroring the existing CategoryTreeEditor.tsx 'cat-routing' convention rather than introducing the FormField wrapper (kept the file a direct structural clone of ComboBuilderForm.tsx, which does not use FormField)"
  - "Row summary formatting (percentage/fixed_amount/fixed_price/pool_grant) implemented as a pure function in ManagePromotionsTab.tsx, keyed first on targetType==='pool_grant' then discountType — matches the UI-SPEC Copywriting Contract table exactly; explicitly cosmetic/display-only, never fed into a mutation payload"
  - "Inline Active Switch reuses a single useMutationUpdatePromotion() instance shared across all rows (not one hook per row) — mirrors the codebase's existing pattern of colocating one mutation instance per list component rather than per-row hook instances"

requirements-completed: [SC-4]

# Metrics
duration: ~90min
completed: 2026-07-09
---

# Phase 20 Plan 04: Promotions Admin UI (Settings → Promotions) Summary

**Settings → Promotions admin surface — three-file clone of the Combos admin pattern (list tab + builder dialog + availability editor) adapted to promotions' discount/target fields, registered in SettingsTabsPanel gated on `manage_products`.**

## Performance

- **Duration:** ~90 min (includes fresh-worktree `npm ci` + `.env.local` bootstrap)
- **Completed:** 2026-07-09
- **Tasks:** 3/3 completed
- **Files modified:** 7 (1 modified, 6 created)

## Accomplishments
- `PromotionAvailabilityEditor.tsx` — near-verbatim clone of `ComboAvailabilityEditor.tsx`: day-of-week chips + time windows, delete-then-reinsert save mutation against `promotion_availability`/`promotion_id`, identical copy ("No windows = always available", "+ Add window", "Saving…", "End time must be after start time").
- `PromotionBuilderForm.tsx` — create/edit dialog implementing all 8 fields per `20-UI-SPEC.md` §2: name, discount type (`Select`: percentage/fixed_amount/fixed_price), conditionally-rendered discount value (plain `%` `Input` vs `MoneyInput`, cleared on type switch), the fixed-price stacking hint (shown only for `fixed_price`), target type (`Select`: item/category/pool_billing/pool_grant), conditionally-rendered target picker (native product `<select>` vs `CategoryTreePicker`, cleared on type switch, hidden for pool targets), priority, and an Active `Switch`. Saves via `useMutationUpdatePromotion` with the full camelCase payload.
- `ManagePromotionsTab.tsx` — list/empty/error/loading states, "+ Add promotion" create-then-open-edit flow, each row showing name + cosmetic discount summary + target-type badge (4 ad-hoc colors) + inline Active `Switch` + Edit/Delete, edit dialog composing `PromotionBuilderForm` + `border-t` + `PromotionAvailabilityEditor`, delete via `ConfirmDialog` with the immutable-audit-trail copy.
- `features/manage-promotions/index.ts` — explicit-named barrel exporting `ManagePromotionsTab`.
- `SettingsTabsPanel/index.tsx` — registered the "Promotions" tab (`key: 'promotions'`) inside the existing `canManageProducts` push block, adjacent to `key: 'combos'`.
- RTL tests: `ManagePromotionsTab.test.tsx` (5 tests — loading/error/empty/populated/create-in-flight) and `PromotionBuilderForm.test.tsx` (3 tests — discount-type swap-and-clear, fixed-price hint conditional, target-picker swap), all mocking `@entities/promotion`/`@entities/category` hooks. All 8 tests pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: PromotionAvailabilityEditor + PromotionBuilderForm** - `b4afdeb` (feat)
2. **Task 2: ManagePromotionsTab + barrel + SettingsTabsPanel registration** - `c94aa80` (feat)
3. **Task 3: RTL tests for ManagePromotionsTab + PromotionBuilderForm** - `5258e7e` (test)

_Note: no plan-metadata commit in this run — per parallel-executor instructions, STATE.md/ROADMAP.md updates are owned by the orchestrator after all wave agents complete._

## Files Created/Modified
- `src/features/manage-promotions/ui/PromotionAvailabilityEditor.tsx` (277 lines) - day/time availability picker, clone of `ComboAvailabilityEditor.tsx`
- `src/features/manage-promotions/ui/PromotionBuilderForm.tsx` (359 lines) - create/edit dialog with 8 fields + conditional swaps
- `src/features/manage-promotions/ui/ManagePromotionsTab.tsx` (255 lines) - list tab with create/edit/delete + inline toggle + badges
- `src/features/manage-promotions/ui/ManagePromotionsTab.test.tsx` (186 lines) - 5 RTL tests
- `src/features/manage-promotions/ui/PromotionBuilderForm.test.tsx` (184 lines) - 3 RTL tests
- `src/features/manage-promotions/index.ts` (1 line) - barrel
- `src/widgets/SettingsTabsPanel/index.tsx` - +2 lines (import + tab entry)

## Decisions Made
- Category-target field label uses a plain `<span>` instead of `<label>` (see key-decisions above) — deliberate a11y-lint-driven choice, not a plan deviation.
- Discount-type/target-type `Select` labels associate via `useId()`-shared ids on `<label htmlFor>` + `<SelectTrigger id>`, matching the existing `CategoryTreeEditor.tsx` convention rather than introducing `FormField` (kept the file a direct structural clone of `ComboBuilderForm.tsx`, which doesn't use `FormField`).
- `formatRowSummary()` in `ManagePromotionsTab.tsx` checks `targetType === 'pool_grant'` first (minutes-granted copy), then falls through to a `discountType` switch for the remaining 3 summary strings — exactly matches the UI-SPEC Copywriting Contract table.

## Deviations from Plan

None — plan executed as written. All acceptance criteria met on the first implementation pass; only lint/import-order/a11y adjustments were needed (see key-decisions), which are covered by Rule 1 (bug-fix-during-implementation) and don't change scope or behavior.

## Issues Encountered
- Fresh worktree checkout had no `node_modules/` and no `.env.local` (same as Plan 20-02's documented setup). Ran `npm ci` (lockfile-exact install) and copied `.env.local` from the main repo checkout to unblock `npx vitest run` (the project's Vitest global-setup connects to live Supabase even for hook-mocked component tests). Neither action modified any tracked file — `.env.local` remains gitignored.
- Radix `Select` interactions in RTL/jsdom needed `hasPointerCapture`/`releasePointerCapture`/`scrollIntoView` no-op polyfills in `PromotionBuilderForm.test.tsx` (jsdom doesn't implement these pointer-capture APIs) — a one-time `beforeAll` polyfill, not a plan deviation, needed because this is the first test file in the repo to exercise Radix `Select` open/select interactions directly.

## User Setup Required

None - no external service configuration required. (The `.env.local` copy above is local dev-environment bootstrapping only, not a new secret or service.)

## Known Stubs

None. Both `usePromotionEligibleProducts` (item target picker) and the category tree picker are wired to real data sources (`products` table query / `useCategories()`); no hardcoded empty arrays or placeholder text flow into rendered UI.

## Next Phase Readiness
- The Settings → Promotions admin surface is feature-complete for SC-4: managers/admins can create, edit (discount + target + priority + active + availability), and delete promotions.
- `evaluate_promotions_for_item` (server-side, later plans) remains the sole writer of a charged price — every value rendered in this plan's UI (row summaries, stacking hint) is display-only and never fed into a mutation payload as a final price.
- Plan 20-09's e2e/UAT gate is the intended verification point for live click-through of this tab (per this plan's own `<verification>` section).
- No blockers for downstream plans.

## Self-Check: PASSED

All 7 created/modified files verified present on disk; all 3 task commits (`b4afdeb`, `c94aa80`, `5258e7e`) verified present via `git log --oneline` on the current worktree branch. (`git log --all` reported a `fatal: bad object` error due to a broken ref in an unrelated sibling worktree branch — not a symptom of missing commits on this branch; verified via `git log --oneline -6` instead.)

---
*Phase: 20-promotions-engine*
*Completed: 2026-07-09*
