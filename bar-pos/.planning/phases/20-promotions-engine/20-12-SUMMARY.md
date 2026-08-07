---
phase: 20-promotions-engine
plan: 12
subsystem: promotions
tags: [supabase, postgres, check-constraint, i18next, playwright, e2e, react-query]

# Dependency graph
requires:
  - phase: 20-promotions-engine
    provides: promotions/promotion_availability schema, PromotionBuilderForm, Settings -> Promotions admin UI (earlier 20-xx plans)
provides:
  - "Working '+ Add promotion' create path (draft insert no longer trips promotions_item_target_check)"
  - "Sibling save-path guard closing the identical CHECK-violation hazard on Save"
  - "Corrected e2e/43-promotions.spec.ts T1 for the new pool_billing draft default"
  - "Fixed E2E locale-pin regression (resetTestState() was reverting the 4 E2E accounts to es-MX every beforeEach)"
affects: [20-13, any-future-promotions-plan, e2e-suite-locale-assertions]

actuals:
  tokens: 3535
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Neutral FK-less draft default: use the one enum member with no companion NOT-NULL CHECK (pool_billing) as a safe placeholder for an incomplete draft row, rather than relaxing the constraint."
    - "Client-side guard as UX-only, not security: PromotionBuilderForm.handleSave's new validation rungs are explicitly documented as non-authoritative — the DB CHECK constraints remain the real enforcement."

key-files:
  created:
    - .planning/phases/20-promotions-engine/COVERAGE.md
  modified:
    - src/entities/promotion/model/queries.ts
    - src/entities/promotion/model/queries.test.ts
    - src/features/manage-promotions/ui/PromotionBuilderForm.tsx
    - src/features/manage-promotions/ui/PromotionBuilderForm.test.tsx
    - src/shared/lib/i18n/locales/es-MX/featMgmt.json
    - src/shared/lib/i18n/locales/en-US/featMgmt.json
    - e2e/43-promotions.spec.ts
    - e2e/helpers/supabase.ts

key-decisions:
  - "Changed the draft insert's default target_type from 'item' to 'pool_billing' — the one target type with no required FK — rather than relaxing promotions_item_target_check or adding a migration."
  - "Added a client-side validation rung in handleSave mirroring the same two CHECK constraints, explicitly documented as a UX improvement only (not the security control)."
  - "Fixed e2e/helpers/supabase.ts's resetTestState() to exclude the 4 pinned E2E login accounts from its blanket profiles.locale reset (Rule 3 deviation, out of this plan's original file list but required to make T1 pass at all)."

patterns-established:
  - "A fresh/incomplete draft row for any table with target-type-conditional FK CHECK constraints should default to the FK-free enum member, not an arbitrary first option."

requirements-completed: [SC-4]

coverage:
  - id: D1
    description: "'+ Add promotion' click no longer trips the Postgres 23514 promotions_item_target_check violation; opens the Edit Promotion dialog on a pool_billing draft"
    requirement: "SC-4"
    verification:
      - kind: e2e
        ref: "e2e/43-promotions.spec.ts#T1: admin creates, edits (disables), and deletes a promotion via Settings -> Promotions"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sibling save path (PromotionBuilderForm.handleSave) blocks saving an item-target promotion with no product selected (and category-target with no category), showing a translated toast instead of reaching Postgres"
    verification:
      - kind: unit
        ref: "src/features/manage-promotions/ui/PromotionBuilderForm.test.tsx#saving an item-target promotion with no product selected shows an error toast and never calls the update mutation"
        status: pass
    human_judgment: false
  - id: D3
    description: "Draft insert's target_type is pinned to pool_billing with no target_product_id/target_category_id — regression-guarded at the unit level"
    verification:
      - kind: unit
        ref: "src/entities/promotion/model/queries.test.ts#useMutationCreatePromotion draft insert targets pool_billing (no required FK) and carries no target_product_id/target_category_id"
        status: pass
    human_judgment: false
  - id: D4
    description: "Order-time auto-apply (T2) still works end to end after the draft-default change — no regression to the pricing path"
    verification:
      - kind: e2e
        ref: "e2e/43-promotions.spec.ts#T2: an active item-target promotion auto-applies at order time with no confirmation step (D-02)"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-07
status: complete
---

# Phase 20 Plan 12: Fix promotion-creation CHECK-constraint crash (G-20-2) Summary

**Draft promotion insert now defaults to the FK-free `pool_billing` target type instead of hardcoding `item`, closing the Postgres 23514 crash on every "+ Add promotion" click, plus a matching client-side guard on the sibling save path and a live E2E proof.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-07T22:16:55Z
- **Completed:** 2026-08-07T23:12:00Z (approx)
- **Tasks:** 3
- **Files modified:** 8 (+1 created: COVERAGE.md)

## Accomplishments
- Fixed the root-cause defect (G-20-2): `useMutationCreatePromotion`'s draft insert hardcoded `target_type: 'item'` with no product FK, tripping `promotions_item_target_check` on every draft creation. Now defaults to `pool_billing`, the one target type with no required FK.
- Closed the identical hazard on the sibling save path: `PromotionBuilderForm.handleSave` now validates that an item target has a selected product (and a category target has a selected category) before calling `useMutationUpdatePromotion`, via two new translated i18n keys (`productRequired`/`categoryRequired`).
- Corrected `e2e/43-promotions.spec.ts` T1 to explicitly switch "Applies to" to Item before reaching for the Product picker, since a fresh draft no longer opens on the Item target type.
- Proved the fix live in a real browser: `npx playwright test e2e/43-promotions.spec.ts` — both T1 (create/edit/delete) and T2 (order-time auto-apply) pass.
- Regression-guarded the draft default at the unit level (`queries.test.ts`), confirmed to fail when the value is reverted.

## Task Commits

Each task was committed atomically:

1. **Task 2 (RED): failing test for the save-path guard** - `e70b295` (test)
2. **Task 2 (GREEN): the save-path guard itself** - `d986abd` (feat)
3. **Task 1: draft insert fix + E2E correction + COVERAGE.md + locale-reset deviation fix** - `e4fd9d5` (fix)
4. **Task 3: unit regression guard for the draft default** - `eda22e0` (test)

_TDD task (Task 2) committed RED before GREEN, per the TDD execution flow. Task 1 was committed after Task 2 in this session because verifying Task 1's live E2E gate required first diagnosing and fixing the locale-reset deviation described below — task numbering in the plan is unaffected._

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified
- `src/entities/promotion/model/queries.ts` - Draft insert `target_type` changed from `'item'` to `'pool_billing'`; docstring updated to explain why.
- `src/entities/promotion/model/queries.test.ts` - New `useMutationCreatePromotion` describe block pinning the draft insert's `target_type`/absent FK columns.
- `src/features/manage-promotions/ui/PromotionBuilderForm.tsx` - `handleSave` gained two validation rungs (item→product, category→category) before the mutation call.
- `src/features/manage-promotions/ui/PromotionBuilderForm.test.tsx` - New test case covering the item-target-no-product save block.
- `src/shared/lib/i18n/locales/{es-MX,en-US}/featMgmt.json` - Added `managePromotions.builder.productRequired` and `.categoryRequired`.
- `e2e/43-promotions.spec.ts` - T1 now explicitly selects the Item target type before the Product picker.
- `e2e/helpers/supabase.ts` - `resetTestState()` no longer reverts the 4 pinned E2E login accounts' locale to es-MX.
- `.planning/phases/20-promotions-engine/COVERAGE.md` - New file declaring no external API integration.

## Decisions Made
- **`pool_billing` as the neutral draft default**, not a schema relaxation: the plan's `root_cause_brief` explicitly rejected weakening `promotions_item_target_check` via a new migration in favor of this client-side fix. No migration was written; no constraint was relaxed.
- **Client guard is UX-only, not the security boundary**: `handleSave`'s new checks mirror the DB CHECK constraints but are documented (matching the plan's threat register T-20-03) as non-authoritative — Postgres remains the real enforcement.
- **Fixed the E2E locale-reset regression inline** (see Deviations) rather than deferring it, since without the fix Task 1's required live-browser verification could not run at all.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `resetTestState()` was silently reverting the 4 E2E accounts' locale pin before every login, blocking T1 from ever finding English-labeled UI elements**
- **Found during:** Task 1's `<verify>` step (`npx playwright test e2e/43-promotions.spec.ts -g "T1"`)
- **Issue:** T1 failed at `page.getByRole('tab', { name: 'Promotions' }).click()` — the Settings page was rendering in Spanish (`Promociones`, not `Promotions`). Root-caused via the browser's own DOM snapshot plus direct Supabase queries: `scripts/setup-dev-users.ts` (commit `331e1b6`, 2026-08-07) pins the 4 E2E login accounts (`profiles.locale`) to `en-US` because most E2E specs assert on English text, and confirmed the DB row was correctly `en-US` immediately after running `npm run setup:dev-users`. But `e2e/helpers/supabase.ts`'s `resetTestState()` (added 2026-07-18, commit `75dcdb4`, three weeks *before* the en-US pin) unconditionally force-resets `profiles.locale = 'es-MX'` for every profile row on every spec's `beforeEach` — including the 4 pinned accounts — silently undoing the pin on every single test run across (very likely) the majority of the E2E suite that calls `resetTestState()` before login.
- **Fix:** Excluded the 4 named E2E accounts (read from `E2E_ADMIN_NAME`/`E2E_MANAGER_NAME`/`E2E_BARTENDER_NAME`/`E2E_KITCHEN_NAME`) from the blanket locale reset in `resetTestState()`, so both fixes coexist: locale-switching specs (e.g. `46-i18n-locale-switch.spec.ts`) still get a deterministic es-MX baseline for any *other* profile they touch, while the 4 fixed login accounts stay pinned to en-US.
- **Files modified:** `e2e/helpers/supabase.ts`
- **Verification:** Re-ran `npx playwright test e2e/43-promotions.spec.ts -g "T1"` after the fix — passed. Then ran the full spec file (T1 + T2) — both passed.
- **Committed in:** `e4fd9d5` (part of Task 1's commit)
- **Scope note:** This file is not in Plan 20-12's `files_modified` list, but the fix was required to make Task 1's own `<verify>` command pass at all — a genuine blocking issue (Rule 3), not scope creep. Flagged in this SUMMARY for visibility since it likely also unblocks other E2E specs that were silently affected by the same regression.

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to make Task 1's required live-browser verification possible at all. No scope creep beyond the minimum fix (4-name exclusion list, no broader refactor of `resetTestState()`).

## Issues Encountered

**Pre-existing, out-of-scope `npm run test` failures (documented, not fixed):** the full unit suite (`npm run test`) shows 6 failed / 1408 passed / 15 todo. All 6 failures are unrelated to this plan's files:
- 5 in `src/widgets/PINLoginForm/PINLoginForm.test.tsx` — the test-environment i18next instance renders es-MX where the tests assert English text (`Set a new PIN`, `Start shift`, etc.), despite `test-setup.ts` pinning `en-US`. Reproduces identically in complete file isolation (no cross-file pollution from this session).
- 1 in `src/entities/staff/model/queries.clock.test.ts` — a live-DB test-isolation flake already documented in this phase's own `deferred-items.md` history (Plan 20-09).

Neither touches any file this plan modified. Logged in `.planning/phases/20-promotions-engine/deferred-items.md` (Plan 20-12, Task 3 section) and in `.planning/WINDOWS.md` (entry #6, kind `deviation`) per SCOPE BOUNDARY — not fixed here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-20-2 is closed. Plan 20-13 (and G-20-3 through G-20-6) is unblocked — promotion creation via the UI now works end to end.
- `npm run typecheck` and `npm run lint` are both clean (0 errors).
- `npm run test`: 1408 pass, 6 pre-existing failures unrelated to this plan (see Issues Encountered).
- `npx playwright test e2e/43-promotions.spec.ts`: both T1 and T2 pass in a real browser (Google Chrome via Playwright, headed, against the live remote Supabase project).
- Flagging for whoever picks up the `PINLoginForm.test.tsx` i18next locale race: it is unrelated to promotions but affects a core auth-flow test file and may be worth a dedicated cleanup plan.

---
*Phase: 20-promotions-engine*
*Completed: 2026-08-07*

## Self-Check: PASSED

All 10 referenced files confirmed present on disk; all 4 task commit hashes (`e70b295`, `d986abd`, `e4fd9d5`, `eda22e0`) confirmed present in git history.
