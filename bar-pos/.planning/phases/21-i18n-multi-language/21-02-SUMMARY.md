---
phase: 21-i18n-multi-language
plan: 02
subsystem: staff-locale
tags: [supabase, rls, zod, tanstack-query, zustand, i18n]

# Dependency graph
requires: ["21-01"]
provides:
  - "profiles.locale column live (NOT NULL DEFAULT 'es-MX' + CHECK IN ('es-MX','en-US'))"
  - "set_own_locale(p_locale, p_terminal_id) SECURITY DEFINER RPC live — self-service, auth.uid()-scoped"
  - "LocaleSchema + StaffSchema.locale (required, default 'es-MX') in domain.ts"
  - "mapStaffRow carries row.locale through into every Staff object"
  - "useMutationSetOwnLocale (self, RPC) + useMutationUpdateStaffLocale (admin, direct+audited) in entities/staff/model/queries.ts"
  - "staff-store fires i18n.changeLanguage(staff.locale) on login and on rehydrate"
  - "getCurrentLocale() accessor in shared/lib/i18n for non-component consumers"
  - "V4/T-21-02 RBAC guard integration test (locale-rls.integration.test.ts)"
affects: [21-03, 21-04, 21-05, 21-06, 21-07, 21-08, 21-09, 21-10, 21-11, 21-12, 21-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two write paths for profiles.locale: self-service via set_own_locale SECURITY DEFINER RPC (auth.uid()-scoped, no target-id param, mirrors clear_must_change_pin); admin via direct UPDATE gated by the pre-existing manage_staff profiles_update_admin RLS policy — no new policy needed"
    - "i18n.changeLanguage() is driven exclusively by the staff record (profiles.locale) on login/rehydrate — never navigator.language, so locale never leaks between staff sharing one kiosk terminal"
    - "getCurrentLocale() in shared/lib/i18n resolves i18n.language through LocaleSchema.safeParse for non-component call sites (receipts/PDFs, Phase 28)"

key-files:
  created:
    - supabase/migrations/20260718000000_profiles_locale.sql
    - src/entities/staff/model/queries.test.ts
    - src/entities/staff/model/locale-rls.integration.test.ts
  modified:
    - src/shared/lib/supabase.types.ts
    - src/shared/lib/domain.ts
    - src/shared/lib/audit-actions.ts
    - src/shared/lib/i18n/index.ts
    - src/entities/staff/model/queries.ts
    - src/entities/staff/model/store.ts
    - src/entities/staff/model/types.ts
    - src/entities/tab/ui/TabDetail.stories.tsx
    - src/entities/tab/ui/TabDetail.test.tsx
    - src/features/clock-in-staff/ui/ClockInModal.test.tsx
    - src/features/clock-out-staff/ui/ClockOutDialog.test.tsx
    - src/features/force-pin-change/ui/ForcePinChangeDialog.test.tsx
    - src/features/start-pool-timer/ui/StartSessionSheet.test.tsx
    - src/features/void-order/ui/VoidOrderDialog.test.tsx
    - src/widgets/AuditLogTable/AuditLogTable.test.tsx
    - src/widgets/CajaDashboard/CajaDashboard.test.tsx
    - src/widgets/HomeDashboard/ui/HomeDashboard.test.tsx
    - src/widgets/PaymentModal/PaymentModal.test.tsx
    - src/widgets/PaymentModal/ui/PaymentForm.test.tsx
    - src/widgets/PaymentPane/ui/PaymentPane.test.tsx
    - src/widgets/StaffDashboard/StaffDashboard.test.tsx

key-decisions:
  - "Types manually transcribed into supabase.types.ts (Docker unavailable for `supabase gen types --local`, established repo precedent) — added locale to profiles Row/Insert/Update and set_own_locale to the Functions map, alphabetically placed"
  - "Blocking migration push required an unplanned migration-history repair first: 3 pre-existing local migrations (20260712000001, 20260713000001, 20260713000002) were already live under different tracked version ids (20260712182544/20260713144447/20260713144547) — verified byte-for-byte equivalence live via `supabase db query` (policy + function-body checks) before running `supabase migration repair --status reverted/applied` to reconcile history. No schema SQL was executed by the repair; it only corrected the tracking table."
  - "record_audit's p_user_id param is optional (string, not nullable) under exactOptionalPropertyTypes — omitted the key entirely in the admin mutation's record_audit call rather than passing p_user_id: null (which the existing staff.role_change call routes around via an `as never` cast)"
  - "mapStaffRow exported (was previously module-private) so Task 2's behavior tests could exercise it directly per the plan's test map"
  - "Every literal Staff-typed test fixture across the repo (18 test/story files) required a `locale` field addition once StaffSchema made it required-with-default; fixtures built through intermediate variables (not literal object expressions) additionally needed `locale: 'es-MX' as const` to avoid TS widening the literal to `string`"

patterns-established:
  - "getCurrentLocale() is the canonical accessor for locale outside React component context — Phase 28's money formatter and 21-05's receipt/PDF builders should import this rather than reading i18n.language directly"

requirements-completed: [SC-2]

coverage:
  - id: D1
    description: "profiles.locale column exists live with NOT NULL DEFAULT 'es-MX' and a CHECK constraint restricting values to es-MX/en-US"
    requirement: "SC-2"
    verification:
      - kind: other
        ref: "npx supabase db query against live project: information_schema.columns + pg_constraint confirm column + CHECK; re-run of `supabase db push` reported 'Remote database is up to date' (idempotent)"
        status: pass
    human_judgment: false
  - id: D2
    description: "StaffSchema.parse() fills locale='es-MX' when missing/null; mapStaffRow carries row.locale through"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/entities/staff/model/queries.test.ts#StaffSchema.locale, #mapStaffRow locale"
        status: pass
    human_judgment: false
  - id: D3
    description: "i18n.changeLanguage(currentStaff.locale) fires on login and on staff-store rehydrate — never navigator.language"
    requirement: "SC-2"
    verification:
      - kind: other
        ref: "src/entities/staff/model/store.ts login() + onRehydrateStorage() — grep-verified two call sites, both reading staff.locale"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two write paths exist: useMutationSetOwnLocale (self, RPC) and useMutationUpdateStaffLocale (admin, direct+audited)"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/entities/staff/model/queries.test.ts#useMutationSetOwnLocale, #useMutationUpdateStaffLocale"
        status: pass
    human_judgment: false
  - id: D5
    description: "V4/T-21-02: bartender cannot write another staff's locale (RLS-filtered 0-row); can set only own locale via set_own_locale (role unchanged)"
    requirement: "SC-2"
    verification:
      - kind: integration
        ref: "src/entities/staff/model/locale-rls.integration.test.ts — 2/2 pass against live Supabase, run twice to confirm idempotency"
        status: pass
    human_judgment: false
  - id: D6
    description: "getCurrentLocale() returns the resolved Locale for non-component consumers (receipts/PDFs, Phase 28)"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/entities/staff/model/queries.test.ts#getCurrentLocale"
        status: pass
    human_judgment: false

duration: ~90min
completed: 2026-07-18
status: complete
---

# Phase 21 Plan 02: Staff Locale Data Spine Summary

**Live `profiles.locale` column + `set_own_locale` self-service RPC, `LocaleSchema`/`StaffSchema.locale`, both write-path mutations (self-RPC + admin-direct), staff-store `i18n.changeLanguage()` hydrate on login/rehydrate, `getCurrentLocale()` accessor, and a passing V4/T-21-02 RBAC guard integration test against live Supabase**

## Performance

- **Duration:** ~90 min
- **Tasks:** 4/4 complete
- **Files:** 3 created, 20 modified

## Accomplishments

- Migration `20260718000000_profiles_locale.sql` applied to remote Supabase: `profiles.locale text NOT NULL DEFAULT 'es-MX'` + `profiles_locale_check` CHECK constraint, plus `set_own_locale(p_locale, p_terminal_id)` SECURITY DEFINER RPC (auth.uid()-scoped, no target-id param, audits via `record_audit('staff.locale_change', ...)`)
- Reconciled a pre-existing migration-history drift (3 local migrations tracked under different remote version ids) that was blocking the push — verified live equivalence via direct SQL queries before repairing history, no schema changes made by the repair itself
- `supabase.types.ts` manually transcribed: `locale` on `profiles` Row/Insert/Update, `set_own_locale` in the Functions map
- `LocaleSchema = z.enum(['es-MX','en-US'])` + `StaffSchema.locale` (required, `.default('es-MX')`) in `domain.ts`; `mapStaffRow` carries `row.locale` through and is now exported
- `useMutationSetOwnLocale` (self-service, calls the RPC, no staffId) and `useMutationUpdateStaffLocale` (admin, direct UPDATE + client-side audit) added to `entities/staff/model/queries.ts`
- `entities/staff/model/store.ts`: `i18n.changeLanguage(staff.locale)` fires in both `login()` and `onRehydrateStorage()`
- `getCurrentLocale()` added to `shared/lib/i18n/index.ts`
- `'staff.locale_change'` registered in `audit-actions.ts`
- 7 new unit tests in `queries.test.ts` (StaffSchema default/parse/reject, mapStaffRow, getCurrentLocale, both mutations) + 2 integration tests in `locale-rls.integration.test.ts` proving the RBAC guard live

## Task Commits

1. **Task 1: Migration + BLOCKING db push + types transcription** — `41cdb71` (feat)
2. **Task 2: LocaleSchema + StaffSchema.locale + mapStaffRow + mock updates** — `6db7b46` (feat)
3. **Task 3: Both locale mutations + store hydrate + getCurrentLocale** — `56714b8` (feat)
4. **Task 4: V4/T-21-02 RBAC guard integration test** — `7f57aa6` (test)

## Files Created/Modified

- `supabase/migrations/20260718000000_profiles_locale.sql` — column + CHECK + `set_own_locale` RPC
- `src/shared/lib/supabase.types.ts` — `profiles.locale` + `set_own_locale` transcribed
- `src/shared/lib/domain.ts` — `LocaleSchema`, `StaffSchema.locale`, registry entries
- `src/shared/lib/audit-actions.ts` — `'staff.locale_change'` enumerated
- `src/shared/lib/i18n/index.ts` — `getCurrentLocale()`
- `src/entities/staff/model/queries.ts` — `mapStaffRow` (exported, carries `locale`), `useMutationSetOwnLocale`, `useMutationUpdateStaffLocale`
- `src/entities/staff/model/store.ts` — `i18n.changeLanguage()` on login + rehydrate
- `src/entities/staff/model/types.ts` — `mockStaff` entries gain `locale: 'es-MX'`
- `src/entities/staff/model/queries.test.ts` — 7 new tests
- `src/entities/staff/model/locale-rls.integration.test.ts` — new, 2 tests (V4/T-21-02)
- 18 other test/story files across `entities/tab`, `features/*`, `widgets/*` — `locale` field added to literal `Staff`-typed fixtures (Rule 1 fallout of making the field required)

## Decisions Made

- Manually transcribed types into `supabase.types.ts` rather than regenerating (Docker unavailable — established repo precedent).
- Discovered and repaired a migration-history drift blocking the BLOCKING push: 3 local migration files' changes were already live under different tracked remote version ids. Verified live equivalence via `npx supabase db query` (RLS policy existence + function-body content checks) before running `supabase migration repair --status reverted <phantom-ids>` then `--status applied <local-ids>` — a tracking-table-only operation, no SQL executed against the schema.
- Omitted `p_user_id` from the admin mutation's `record_audit` RPC call (rather than passing `null`) since the generated type for that param is `string | undefined`, not nullable, under `exactOptionalPropertyTypes`.
- Exported `mapStaffRow` (previously module-private) so it could be unit-tested directly, per the plan's test map.
- Fixed 18 test/story files whose literal `Staff`-typed mocks broke once `locale` became a required field on `StaffSchema` — most needed only `locale: 'es-MX'`, but 5 files that route fixtures through an inferred `const foo = {...}` binding (rather than an in-place literal) additionally needed `locale: 'es-MX' as const` to avoid TypeScript widening the literal union to `string`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration-history drift blocked the BLOCKING db push**
- **Found during:** Task 1, `npx supabase db push`
- **Issue:** `supabase migration list` showed 3 local migrations (`20260712000001`, `20260713000001`, `20260713000002`) with no remote counterpart, and 3 remote-only entries (`20260712182544`, `20260713144447`, `20260713144547`) with no local file — `db push` refused to proceed ("Remote migration versions not found in local migrations directory").
- **Fix:** Verified via `npx supabase db query --linked` that the live schema already matched each local migration's intended change (the `order_items_delete_bartender` policy exists; `transfer_tab`/`transfer_pool_session` function bodies already contain the version-bump fix) — confirming the 3 remote-only version ids were the SAME changes tracked under different ids (likely applied via SQL editor at an earlier timestamp, then the migration files were renamed to the repo's clean `NNNNNN` convention without a corresponding history repair). Ran `supabase migration repair --status reverted 20260712182544 20260713144447 20260713144547` then `--status applied 20260712000001 20260713000001 20260713000002` — a tracking-table-only operation. `db push` then succeeded cleanly.
- **Files modified:** None (remote migration-history table only; no local files changed by the repair itself).
- **Verification:** `supabase migration list` shows all local/remote versions aligned; re-running `db push` reports "Remote database is up to date."
- **Committed in:** N/A (no local file changes from the repair — captured here for traceability only)

**2. [Rule 1 - Bug] 18 test/story files broke once StaffSchema.locale became required**
- **Found during:** Task 2, `npm run typecheck`
- **Issue:** Every literal `Staff`-typed object across the test suite (mocks in `TabDetail.test.tsx`/`.stories.tsx`, `ClockInModal.test.tsx`, `ClockOutDialog.test.tsx`, `ForcePinChangeDialog.test.tsx`, `StartSessionSheet.test.tsx`, `VoidOrderDialog.test.tsx`, `AuditLogTable.test.tsx`, `CajaDashboard.test.tsx`, `HomeDashboard.test.tsx`, `PaymentModal.test.tsx`, `PaymentForm.test.tsx`, `PaymentPane.test.tsx`, `StaffDashboard.test.tsx`, `queries.clock.test.ts`) was missing the now-required `locale` field.
- **Fix:** Added `locale: 'es-MX'` (or `'es-MX' as const` where the fixture is bound to an intermediate `const` consumed elsewhere as a wider type) to each fixture.
- **Files modified:** Listed under key-files.modified above.
- **Verification:** `npm run typecheck` returns to only the 2 pre-existing unrelated errors (`entities/tab/model/queries.ts`, `shared/lib/agent/rag.ts`); `npm run test` — 138 files / 1235 tests pass, 15 todo, 2 skipped, zero regressions from the pre-existing baseline.
- **Committed in:** `6db7b46` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking-issue repair, 1 bug-fix fallout). Both were necessary to satisfy the plan's own stated acceptance criteria (idempotent `db push`, clean `typecheck`). No scope creep.

## Issues Encountered

None beyond the two auto-fixed items documented above.

## User Setup Required

None — the BLOCKING migration push was executed directly (supabase CLI was already authenticated and linked to the `bar-pos` project; no `SUPABASE_ACCESS_TOKEN` prompt was needed).

## Next Phase Readiness

- `LocaleSchema`, `StaffSchema.locale`, `useMutationSetOwnLocale`, `useMutationUpdateStaffLocale`, and `getCurrentLocale()` are all ready for 21-03 (self-service Settings tab) and 21-04 (admin Staff-page control).
- 21-05 (receipts/PDFs) can import `getCurrentLocale()` directly rather than re-deriving locale from `profiles`.
- Phase 28 (Money Formatter Utility, future milestone) can consume `getCurrentLocale()` without any additional plumbing.

---
*Phase: 21-i18n-multi-language*
*Completed: 2026-07-18*

## Self-Check: PASSED

All created files confirmed on disk: `supabase/migrations/20260718000000_profiles_locale.sql`, `src/entities/staff/model/queries.test.ts`, `src/entities/staff/model/locale-rls.integration.test.ts`. All 4 task commits (`41cdb71`, `6db7b46`, `56714b8`, `7f57aa6`) confirmed present in `git log`.
