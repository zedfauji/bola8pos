---
phase: 16-kitchen-bar-split-routing
plan: 07
subsystem: testing
tags: [playwright, e2e, supabase, kds]

requires:
  - phase: 16-kitchen-bar-split-routing (16-02)
    provides: live categories.routing column
  - phase: 16-kitchen-bar-split-routing (16-05)
    provides: routing-parameterized useKdsItems + /kds-bar board
  - phase: 16-kitchen-bar-split-routing (16-06)
    provides: category admin routing selector + Bar Display dashboard tile
provides:
  - "/kds-bar E2E spec (40-kds-bar.spec.ts) — role access, bar-card rendering, dashboard tile"
  - Routing-parameterized E2E seed helper (last is_food call site migrated)
  - Fixed KdsBoard modifier-name resolution (was fully broken — blocked ALL card rendering)
  - One live category (Hamburguesas y Hot Dogs) flipped to KITCHEN so kitchen-board E2E has real data to render
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - e2e/40-kds-bar.spec.ts
  modified:
    - e2e/helpers/supabase.ts
    - CLAUDE.md
    - src/entities/kds/model/queries.ts
    - src/widgets/HomeDashboard/ui/HomeDashboard.test.tsx
    - src/widgets/RBACDashboard/PermissionMatrix.test.tsx

key-decisions:
  - "T6/T7 dashboard-tile tests assert 'locked' not 'hidden' for kitchen — 16-06 deliberately used the requiredAction gating pattern (lock icon + PIN gate), not the legacy visibleToRoles full-hide pattern. Route-level KdsBarRoute guard (T4) remains the real security boundary."
  - "Fixed a pre-existing, unrelated-to-Phase-16 bug in useKdsItems: it queried a nonexistent order_item_modifiers junction table (order_items.modifier_ids is a plain uuid[] column). This broke the ENTIRE query for any row set, not just modifier display — confirmed present in the pre-Phase-16 baseline commit via git show. Fixed by selecting modifier_ids directly and batch-resolving names from the modifiers table."
  - "Flipped one live category ('Hamburguesas y Hot Dogs') from BAR to KITCHEN routing (user-approved) — every category in the live DB had is_food=false pre-migration, so zero KITCHEN-routed categories existed anywhere, meaning 28-kds.spec.ts's food-card-rendering tests (T5-T7) had no data to exercise. This is a pre-existing data gap, not a Phase 16 regression; the migration's backfill correctly preserved is_food's prior (all-false) values."

patterns-established: []

requirements-completed: [KBR-01, KBR-02, KBR-03, KBR-04]

duration: ~1h 10min
completed: 2026-07-06
---

# Phase 16 Plan 07: E2E Proof + Regression Gate Summary

**`/kds-bar` proven end-to-end via Playwright (role access, bar-card rendering, dashboard tile) and the kitchen KDS regression (28-kds) confirmed unaffected — after fixing a pre-existing modifier-resolution bug that was silently breaking both boards' card rendering.**

## Performance

- **Duration:** ~1h 10min (including live-DB investigation and a real bug fix)
- **Completed:** 2026-07-06
- **Tasks:** 3/3
- **Files modified:** 6 (+ 1 live-data update)

## Accomplishments
- Migrated the last `is_food` call site: `seedKdsFoodOrder(tabId, routing='KITCHEN')` in `e2e/helpers/supabase.ts` now queries `categories.routing`. Confirmed zero `isFood`/`is_food` tokens remain in `src/` or `e2e/` (except the migration SQL).
- Created `e2e/40-kds-bar.spec.ts` (7 tests): role access for bartender/manager/admin (T1-T3), kitchen redirect (T4), bar-card rendering (T5), dashboard-tile visibility for bartender (unlocked, T6) and kitchen (locked, T7).
- Full offline regression gate green: `npm run typecheck`/`lint`/`test` pass except two pre-existing, out-of-scope typecheck errors (`tab/model/queries.ts`, `agent/rag.ts` — untouched since Phases 11/14/15) and the one documented pre-existing `useCloseTab.test.ts:95` failure.
- Updated 3 stale hardcoded-count unit tests to reflect earlier Phase 16 additions (16-03's `view_kds_bar` RBAC action, 16-06's Bar Display tile): `PermissionMatrix.test.tsx` (23→24 rows, 92→96 switches), `HomeDashboard.test.tsx` (7→8 lock icons for bartender).
- **Live E2E run (this session, against a running dev server + `.env.local` credentials):**
  - `e2e/40-kds-bar.spec.ts` — 7/7 passed
  - `e2e/28-kds.spec.ts` — 10/10 passed (KBR-04 confirmed: kitchen board unaffected)
- CLAUDE.md updated: `/kds-bar` route row added, `40-kds-bar` added to the E2E spec list.

## Task Commits

1. **Task 1: Parameterize KDS seed helper + write 40-kds-bar.spec.ts** — `858ab12`
2. **Task 2: Full regression gate + CLAUDE.md docs** — `377c652`
3. **Task 3: Human-verify live E2E** — checkpoint resolved this session:
   - `7d3db60` merge executor worktree (tasks 1-2)
   - `6dfaba3` fix(16-05): resolve KDS modifier names via modifier_ids array, not nonexistent junction table

## Files Created/Modified
- `e2e/40-kds-bar.spec.ts` - new spec, 7 tests covering D-04 access control + rendering + tile
- `e2e/helpers/supabase.ts` - `seedKdsFoodOrder` parameterized by routing, last `is_food` site removed
- `src/entities/kds/model/queries.ts` - fixed `useKdsItems` to resolve modifier names via `modifier_ids` array instead of a nonexistent `order_item_modifiers` join
- `src/widgets/HomeDashboard/ui/HomeDashboard.test.tsx` - lock-icon count 7→8
- `src/widgets/RBACDashboard/PermissionMatrix.test.tsx` - row/switch counts updated for `view_kds_bar`
- `CLAUDE.md` - `/kds-bar` route + `40-kds-bar` spec documented

## Decisions Made
- Accepted 16-06's tile-gating design (locked, not hidden) as correct and wrote T6/T7 to match actual behavior rather than reverting a completed dependency plan.
- Fixed the `order_item_modifiers` bug in-band rather than deferring, since it silently broke ALL KDS card rendering (both `/kds` and `/kds-bar`) — leaving it broken would have made this plan's own verification (and the phase's core deliverable) impossible to prove.
- User-approved live-data change: flipped "Hamburguesas y Hot Dogs" to `routing=KITCHEN` so the kitchen board's E2E tests had real data — the alternative (skip kitchen card-rendering assertions) was declined in favor of a real fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed `order_item_modifiers` query bug blocking all KDS card rendering**
- **Found during:** Task 3 (live E2E run) — `40-kds-bar.spec.ts` T5 failed with the UI showing "Could not load bar queue."
- **Issue:** `useKdsItems` selected `order_item_modifiers(modifiers(id, name))`, a PostgREST embed for a relationship that has never existed. `order_items` stores selected modifiers as a plain `modifier_ids uuid[]` column (confirmed via schema migration inspection and via `git show` against the pre-Phase-16 baseline — this bug predates Phase 16 entirely). PostgREST returned `PGRST200`, failing the entire query for any row set — so this silently broke both `/kds` and `/kds-bar` card rendering, not just modifier-name display.
- **Fix:** Select `modifier_ids` directly in the main query; batch-fetch matching rows from the `modifiers` table in a second query and resolve names client-side.
- **Files modified:** `src/entities/kds/model/queries.ts`
- **Verification:** Re-ran both `40-kds-bar.spec.ts` (7/7 pass, was 6/7) and `28-kds.spec.ts` (10/10 pass, was 7/10) after the fix.
- **Committed in:** `6dfaba3`

**2. [Rule 2 - Missing Critical] Live-data fix: no KITCHEN-routed category existed anywhere**
- **Found during:** Task 3 (live E2E run) — `28-kds.spec.ts` T5-T7 failed with `seedKdsFoodOrder: no KITCHEN-routed category found`.
- **Issue:** Querying the live `categories` table showed every single category routed to `BAR` — confirming that `is_food` was `false` for all categories *before* the 16-02 migration ran (the backfill CASE faithfully preserved this pre-existing state). This is a pre-existing data gap unrelated to Phase 16's code, but it made kitchen-board E2E card rendering unverifiable.
- **Fix:** User-approved: `UPDATE categories SET routing = 'KITCHEN' WHERE name = 'Hamburguesas y Hot Dogs';` run directly against the live project.
- **Files modified:** none (live data only, no code/migration change)
- **Verification:** `28-kds.spec.ts` T5-T7 passed after the update.
- **Committed in:** N/A (live DB state change, not a file commit)

---

**Total deviations:** 2 auto-fixed (both missing-critical, both required to complete this plan's own verification gate). No scope creep — both fixes were prerequisites for proving KBR-02/KBR-04, which is this plan's entire purpose.
**Impact on plan:** Necessary; without them, `40-kds-bar.spec.ts` and `28-kds.spec.ts` could not have been proven to pass at all.

## Issues Encountered
- First `supabase db push` attempt in 16-02 failed on an enum-cast bug (already documented in 16-02-SUMMARY.md).
- This plan's own live-verify checkpoint surfaced two additional pre-existing issues (see Deviations above) that were blocking, not cosmetic — both required fixing to complete the phase's verification.
- Two deferred, genuinely out-of-scope `is_food` references remain in `e2e/18-modifier-notes-kds.spec.ts` and `e2e/31-categories.spec.ts` (logged to `deferred-items.md` by the executor) — neither is a live bug today (one is already `test.skip`'d), left for future cleanup.

## User Setup Required
None — dev server + `.env.local` E2E credentials were already present in this environment; no new external service configuration required.

## Next Phase Readiness
- **Phase 16 complete.** All four requirements (KBR-01 through KBR-04) verified:
  - KBR-01: `categories.routing` live, migrated, and E2E-seeded via routing param.
  - KBR-02: `/kds-bar` renders bar-routed items, gated to bartender+ (E2E-proven, 7/7).
  - KBR-03: `RoutingBadge` shown on KDS cards and category admin UI.
  - KBR-04: existing kitchen KDS flow unaffected (28-kds regression green, 10/10).
- Two minor deferred items logged in `deferred-items.md` for future cleanup (unrelated `is_food` references in two other E2E specs, neither a live bug).
- The `useKdsItems` modifier-resolution fix benefits the existing (already-shipped) kitchen `/kds` board too — this was a latent production bug now fixed as a side effect of Phase 16's verification work.

---
*Phase: 16-kitchen-bar-split-routing*
*Completed: 2026-07-06*
