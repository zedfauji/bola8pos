---
phase: 05-kitchen-prep-cocktails
plan: 05
subsystem: testing
tags: [playwright, e2e, supabase, data-table, hydration]

# Dependency graph
requires:
  - phase: 05-kitchen-prep-cocktails
    provides: prep_productions table, produce_prep_batch flow, /kitchen-prep page (plans 05-01..05-04)
provides:
  - seed-prep.ts verified end-to-end against live Supabase (Salsa Mexicana + Michelada Mix + raw ingredients + prep recipes)
  - e2e/21-prep.spec.ts T1–T5 passing (T3 intentionally skipped, covered by integration I5/I6)
  - deterministic resetPrepIngredientStock covering Tomato, Onion, and Salsa Mexicana baselines
  - fix for StaffSchema mustChangePin mapping bug that broke login app-wide
  - fix for invalid DataTable loading-skeleton markup (div inside tbody) app-wide
affects: [any phase touching DataTable loading states, staff/profiles queries, or E2E specs reusing resetPrepIngredientStock]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "E2E helpers that mutate shared fixture ingredient stock must reset every ingredient the recipe under test touches (not just the bottleneck one), or repeated local runs silently drift state"
    - "Scope Playwright getByRole('dialog') queries by accessible name when more than one dialog-role element can be mounted simultaneously (e.g. persistent AI assistant panel)"

key-files:
  created: []
  modified:
    - src/entities/staff/model/queries.ts
    - e2e/helpers/supabase.ts
    - e2e/21-prep.spec.ts
    - src/shared/ui/DataTable.tsx

key-decisions:
  - "Fixed StaffSchema mustChangePin omission as an in-scope blocker fix, not deferred — it broke login for the entire app, not just Phase 5"
  - "Fixed DataTable's invalid tbody>div skeleton markup in-scope since it's a one-line wrap and affects every DataTable consumer in loading state"
  - "resetPrepIngredientStock now resets Tomato, Onion, AND Salsa Mexicana to seed baselines (previously only Tomato) — T2's exact qty assertion requires a known starting balance for the prep-ingredient output too, not just its raw inputs"

patterns-established:
  - "getByRole('dialog', { name: '...' }) required whenever a persistent side-panel (AI assistant) shares role=dialog with a transient feature dialog"

requirements-completed:
  - S3c-01
  - S3c-02
  - S3c-03

# Metrics
duration: ~90min (including live Supabase outage diagnosis + 3 real bug fixes)
completed: 2026-07-03
---

# Phase 5: Kitchen Prep + Cocktails Summary (Plan 05-05)

**Kitchen Prep E2E suite (T1–T5) green against live Supabase; fixed a login-breaking StaffSchema bug and an app-wide invalid-HTML DataTable skeleton bug discovered along the way**

## Performance

- **Duration:** ~90 min (dominated by diagnosing a paused/cold-started Supabase project and 3 real bugs, not by writing new code)
- **Started:** 2026-07-03T20:16:00Z
- **Completed:** 2026-07-03T21:35:00Z
- **Tasks:** 3 (seed-prep.ts + integration test verification, E2E spec T1–T5, quality gate)
- **Files modified:** 4

## Accomplishments
- Verified seed-prep.ts and integration tests I5/I6 (built in 05-01..05-04) have real assertions, zero placeholders
- Got e2e/21-prep.spec.ts's full T1, T2, T4, T5 suite passing twice in a row against the live remote Supabase project (T3 intentionally skipped per spec comment — covered by integration tests)
- Found and fixed a production bug that broke login for the entire app (not prep-specific)
- Found and fixed an invalid-HTML bug in the shared DataTable component that fires on every loading-state render app-wide
- Full unit suite: 1133/1134 pass (1 pre-existing unrelated failure, documented in STATE.md since Phase 15)

## Task Commits

1. **Task 1 + 2 (pre-existing, verified this session):** `f1ab418` (seed-prep.ts), `5eaf05f` + `5d93b70` (e2e/21-prep.spec.ts) — created in an earlier session, verified against every plan acceptance criterion this session
2. **Fix: mustChangePin mapping bug** — `562ea65` (fix(staff): include mustChangePin when mapping profiles row to Staff)
3. **Fix: E2E flakes + DataTable markup** — `27da4a1` (fix(21-prep,DataTable): correct E2E prep-batch test flakes and invalid DataTable loading markup)

## Files Created/Modified
- `src/entities/staff/model/queries.ts` — `mapStaffRow` now passes `mustChangePin: row.must_change_pin` to `StaffSchema.parse()`; the field's omission threw a ZodError on every row and surfaced as "Failed to load staff. An unexpected error occurred." on `/login`, blocking the entire app
- `e2e/helpers/supabase.ts` — `resetPrepIngredientStock` now resets Tomato (2000g), Onion (300g), and Salsa Mexicana (0) to seed-prep.ts baselines instead of only Tomato; previously Onion and Salsa Mexicana drifted across repeated local runs, causing intermittent `INVENTORY_NEGATIVE` failures and a flaky exact-qty assertion
- `e2e/21-prep.spec.ts` — scoped `getByRole('dialog')` to `{ name: 'Record prep batch' }` on the open/close assertions in T2; the unscoped query matched the always-mounted (off-screen) AI assistant side panel once the prep-batch dialog closed, causing a false "still visible" failure
- `src/shared/ui/DataTable.tsx` — wrapped the loading-state `TableRowSkeleton` in a proper `TableRow`/`TableCell` instead of rendering it as a bare `<div>` directly inside `<TableBody>` (invalid HTML — `<div>` cannot be a child of `<tbody>`); fires a React hydration warning on every `DataTable` consumer in a loading state, not just Kitchen Prep

## Decisions Made
- Treated the `mustChangePin` and `DataTable` bugs as in-scope blocker fixes rather than deferring them: both were discovered as the direct cause of E2E failures during this plan's checkpoint, both are one-line/small fixes, and both have app-wide blast radius (login entirely broken; every loading DataTable emitting invalid markup) — deferring would have left the app broken for reasons unrelated to Phase 5's actual scope.
- Expanded `resetPrepIngredientStock`'s baseline set to cover every ingredient the Salsa Mexicana recipe touches (Tomato, Onion) plus the prep-ingredient output itself (Salsa Mexicana), rather than just the one raw ingredient the original helper targeted — necessary for T2's exact `10.00` qty assertion to be deterministic across repeated local runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocker] StaffSchema.parse() missing mustChangePin field**
- **Found during:** T1 E2E run — login page failed with "Failed to load staff. An unexpected error occurred." for every role
- **Issue:** `mapStaffRow` in `src/entities/staff/model/queries.ts` never passed `mustChangePin` to `StaffSchema.parse()`, but the schema requires it (`mustChangePin: z.boolean()`) — every row threw a ZodError, caught as `unknownError`, surfacing the generic message
- **Fix:** Added `mustChangePin: row.must_change_pin` to the parse call
- **Files modified:** `src/entities/staff/model/queries.ts`
- **Verification:** typecheck exit 0; full E2E login flow (T1/T2/T4/T5) now succeeds
- **Committed in:** `562ea65`

**2. [Blocker] resetPrepIngredientStock only reset Tomato, not Onion or Salsa Mexicana**
- **Found during:** T2/T4 E2E runs — intermittent `INVENTORY_NEGATIVE` on Onion (id `db1de2d0...`) and a flaky exact-qty assertion on Salsa Mexicana
- **Issue:** The Salsa Mexicana recipe consumes both Tomato and Onion, but the reset helper only reset Tomato; repeated local test runs silently depleted Onion to 0 and drifted Salsa Mexicana's on-hand balance upward, breaking both the "insufficient stock" path (fired too early on Onion instead of the intended Tomato-exhaustion path) and T2's `filter({ hasText: '10.00' })` assertion
- **Fix:** Extended the baseline reset to `{ Tomato: 2000, Onion: 300, 'Salsa Mexicana': 0 }`
- **Files modified:** `e2e/helpers/supabase.ts`
- **Verification:** Full spec passes twice in a row (T1/T2/T4/T5 green, T3 skip)
- **Committed in:** `27da4a1`

**3. [Blocker] Ambiguous getByRole('dialog') selector in T2**
- **Found during:** T2 E2E run — "dialog not visible" assertion failed even though the prep-batch dialog had genuinely closed
- **Issue:** The app always mounts an AI assistant side panel with `role="dialog"` (translated off-screen via CSS when closed, but still present in the DOM), so the unscoped `getByRole('dialog')` matched it once the prep-batch dialog closed
- **Fix:** Scoped both the open and close assertions to `getByRole('dialog', { name: 'Record prep batch' })`
- **Files modified:** `e2e/21-prep.spec.ts`
- **Verification:** T2 passes reliably across repeated runs
- **Committed in:** `27da4a1`

**4. [Minor, app-wide] DataTable loading skeleton — invalid HTML**
- **Found during:** T2 browser console capture — React hydration warning "In HTML, `<div>` cannot be a child of `<tbody>`"
- **Issue:** `DataTable.tsx`'s loading-state branch rendered `TableRowSkeleton` (root element `<div>`) directly inside `<TableBody>` without a `<TableRow>`/`<TableCell>` wrapper
- **Fix:** Wrapped each skeleton in `<TableRow><TableCell colSpan={columns.length}><TableRowSkeleton .../></TableCell></TableRow>`
- **Files modified:** `src/shared/ui/DataTable.tsx`
- **Verification:** typecheck + lint clean; console warning no longer appears in E2E browser logs; visual loading-state layout unchanged
- **Committed in:** `27da4a1`

---

**Total deviations:** 4 auto-fixed (2 blocking-for-checkpoint, 1 blocking-for-test-reliability, 1 minor app-wide)
**Impact on plan:** All four were necessary to reach a genuinely green checkpoint rather than a checkpoint that only looked green due to test/data pollution. No scope creep — no new features added, only correctness fixes surfaced by attempting real verification.

## Issues Encountered
- Supabase project (`shsrhxleopmovzpzqmex`) DNS was initially unresolvable, then returned Cloudflare 521 (origin down) during wake-from-pause, then PostgREST returned `PGRST205` ("table not found in schema cache") even though migrations were confirmed applied — resolved via `NOTIFY pgrst, 'reload schema'`. Purely an infrastructure cold-start issue, not a code defect.
- `supabase db push` failed with "Remote migration versions not found in local migrations directory" for 4 migrations (`rpc_versioned_group_a`, `drop_orphan_rpc_overloads_15_02`, `fix_combo_rls`, `force_pin_change`) that are legitimately applied to remote but whose `.sql` files aren't in this local checkout — worked around by not running `db push` for this plan (not needed once the schema-cache reload resolved the actual blocker); left as a pre-existing repo/remote drift for the user to reconcile separately, out of this plan's scope.

## User Setup Required
None — no external service configuration required. (The Supabase project itself needed to be awake/reachable, which the user resolved before this session resumed.)

## Next Phase Readiness
- Phase 5 (Kitchen Prep + Cocktails) is now fully complete: all 5 plans have SUMMARY.md, E2E suite green.
- Two pre-existing, unrelated items remain open in the repo (both flagged, neither touched by this plan): 5 lint errors traced to Phase 15 commit `761cacb`, and migration-history drift between local `.sql` files and 4 already-applied remote migrations.
- Phase 13 (`13-01`, `13-06`) also still lacks SUMMARY.md per `/gsd-health` — separate from this plan, flagged for a future `/gsd-execute-phase 13` pass.

---
*Phase: 05-kitchen-prep-cocktails*
*Completed: 2026-07-03*
