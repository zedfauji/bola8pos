---
phase: 21-i18n-multi-language
plan: 04
subsystem: i18n
tags: [react-i18next, rbac, staff-management, fsd]

# Dependency graph
requires: ["21-02"]
provides:
  - "features/edit-staff-locale FSD slice (EditLocaleDialog) — admin per-staff locale override, gated manage_staff"
  - "StaffDashboard Language column (Badge variant=outline, uppercase) + gated Change-language row action"
  - "StaffDashboard fully migrated to the staff i18next namespace (single-owner of this file for the phase)"
  - "staff namespace: table.name/role/locale/clockIn/duration, actions.clockIn/clockOut/forcePinChange, section.title/description, search.placeholder, locale.editTrigger/updateSuccess/updateError"
  - "eslint.i18n.config.js: exclude logger.* member calls, id/accessorKey object-properties, and the em-dash placeholder symbol"
affects: [21-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EditLocaleDialog is a near-verbatim clone of EditRoleDialog (role->locale), narrowed to a single target staff prop (row-action-triggered) rather than a staff-picker list, since the admin write targets one row at a time"
    - "Admin override write path (useMutationUpdateStaffLocale, direct UPDATE) never calls i18n.changeLanguage() — only the self-service path (21-03, useMutationSetOwnLocale) does that, on the acting staff's own session"

key-files:
  created:
    - src/features/edit-staff-locale/ui/EditLocaleDialog.tsx
    - src/features/edit-staff-locale/index.ts
    - src/features/edit-staff-locale/ui/EditLocaleDialog.test.tsx
  modified:
    - src/widgets/StaffDashboard/StaffDashboard.tsx
    - src/shared/lib/i18n/locales/es-MX/staff.json
    - src/shared/lib/i18n/locales/en-US/staff.json
    - eslint.i18n.config.js

key-decisions:
  - "StaffDashboard.tsx is fully owned/migrated by this plan — the 21-11 admin sweep must SKIP this file entirely (all its strings, including the new Language column/action, are already in the staff namespace)"
  - "eslint.i18n.config.js callees exclude extended with 'logger\\.\\w+' (regex) — logger.error/.warn/.info/.debug's first argument is an internal telemetry event name (e.g. 'staff.update_locale.failed'), not UI copy, same category as the existing 'can' RBAC exclude"
  - "eslint.i18n.config.js object-properties exclude extended with 'id' and 'accessorKey' — TanStack Table column definitions use these as structural identifiers ({ id: 'locale', accessorKey: 'staff.name' }), same category as the existing 'key' exclude"
  - "eslint.i18n.config.js words exclude extended with '^—$' (em dash) — the existing empty-shift-value placeholder is a symbol, not translatable copy, per the plan's explicit instruction not to translate it"
  - "Reused the same staff:locale.editTrigger key for both the EditLocaleDialog title and the StaffDashboard row-action button label — one copy source for 'Change language' across both surfaces"

patterns-established:
  - "Row-action-triggered dialogs targeting a single entity (not a picker) narrow their props to staff: Staff | null instead of a full list + selected-id pair"

requirements-completed: [SC-2, SC-4]

coverage:
  - id: D1
    description: "EditLocaleDialog clones EditRoleDialog (role->locale), pre-selects the target staff's current locale, lists LocaleSchema.options, and never calls i18n.changeLanguage()"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/features/edit-staff-locale/ui/EditLocaleDialog.test.tsx — 4/4 pass"
        status: pass
      - kind: other
        ref: "grep -n changeLanguage src/features/edit-staff-locale/ui/EditLocaleDialog.tsx — no matches"
        status: pass
    human_judgment: false
  - id: D2
    description: "On Save, useMutationUpdateStaffLocale is called with { staffId, locale }; on success the dialog closes and fires an interpolated success toast ({name}/{locale}); on failure an error toast fires and the dialog stays open"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/features/edit-staff-locale/ui/EditLocaleDialog.test.tsx#on Save.../on failure..."
        status: pass
    human_judgment: false
  - id: D3
    description: "StaffDashboard Language column (Badge variant=outline, uppercase, es-MX/en-US) + gated Change-language row action (ProtectedAction action=manage_staff) mounted alongside EditLocaleDialog"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/widgets/StaffDashboard/StaffDashboard.test.tsx — 3/3 pass (existing suite, unchanged assertions)"
        status: pass
      - kind: other
        ref: "grep -n ProtectedAction src/widgets/StaffDashboard/StaffDashboard.tsx — Change-language button confirmed inside action=\"manage_staff\" wrapper"
        status: pass
    human_judgment: false
  - id: D4
    description: "All pre-existing StaffDashboard hardcoded strings migrated to the staff namespace via t(), es-MX byte-identical to prior literals (zero visual regression)"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "src/widgets/StaffDashboard/StaffDashboard.test.tsx — asserts literal 'Alex'/'Jamie'/'Clock Out'/'Clock In'/'Force PIN Change'/'Search staff…' text against the real i18n singleton, unchanged from pre-migration"
        status: pass
      - kind: other
        ref: "npm run lint:i18n -- src/widgets/StaffDashboard/StaffDashboard.tsx (exit 0) + -- src/features/edit-staff-locale (exit 0)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-07-18
status: complete
---

# Phase 21 Plan 04: Admin Per-Staff Locale Field + StaffDashboard Migration Summary

**`features/edit-staff-locale` FSD slice (EditLocaleDialog, role->locale clone of EditRoleDialog) wired into a new gated Language column/row-action on StaffDashboard, with every pre-existing StaffDashboard string migrated to the `staff` i18next namespace byte-identical to today**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2/2 complete
- **Files modified:** 3 created, 4 modified

## Accomplishments

- `EditLocaleDialog.tsx` — clones `EditRoleDialog`'s Dialog/Select/footer structure exactly, narrowed to a single target `staff: Staff | null` prop (row-action-triggered, not a staff-picker); pre-selects the target's current locale; `handleSubmit` calls `useMutationUpdateStaffLocale({ staffId, locale })`, toasts an interpolated success/error message (`{name}`/`{locale}`), and closes on success; deliberately never calls `i18n.changeLanguage()` — only the target's stored `profiles.locale` changes, the target's own session picks it up on next login/hydrate
- `features/edit-staff-locale/index.ts` — explicit named-export barrel (`EditLocaleDialog` + its props type)
- `staff` namespace seeded with `table.locale`, `locale.editTrigger/updateSuccess/updateError` (Task 1) then extended with `table.name/role/clockIn/duration`, `actions.clockIn/clockOut/forcePinChange`, `section.title/description`, `search.placeholder` (Task 2) — es-MX values for all pre-existing (migrated) keys are byte-identical to the prior English literals; the two brand-new Language keys (`table.locale`, `locale.editTrigger`) carry genuine Spanish per the phase's new-UI copy rule
- `StaffDashboard.tsx` — added a `Language` column (`Badge variant="outline" className="uppercase"`, mirrors the Role column) and a `Change language` row action inside the same `ProtectedAction action="manage_staff"` wrapper already used for `Force PIN Change`; mounted `EditLocaleDialog` alongside the existing `ClockInModal`/`ClockOutDialog`/`ForcePinChangeDialog`; every other pre-existing hardcoded string (column headers, button labels, `SectionHeader` title/description, `DataTable` search placeholder) now renders via `t()` from the `staff` namespace — the em-dash empty-value placeholder is deliberately left as a literal symbol, not translated
- 4 behavior tests in `EditLocaleDialog.test.tsx`: pre-selected locale + both options listed, Save success (mutation args + interpolated toast + close), never calls `changeLanguage`, failure keeps the dialog open with an error toast
- `eslint.i18n.config.js` extended with three new structural excludes needed to get both files' `lint:i18n` gate to exit 0: `logger\.\w+` callees (telemetry event-name literals, not UI copy — same category as the existing `can` RBAC exclude), `id`/`accessorKey` object-properties (TanStack Table structural column identifiers, same category as the existing `key` exclude), and the em-dash symbol in `words.exclude`

## Task Commits

1. **Task 1: features/edit-staff-locale slice (EditLocaleDialog)** — `0dc7c67` (feat)
2. **Task 2: StaffDashboard — Language column + gated row action + full string migration** — `24e7f2e` (feat)

## Files Created/Modified

- `src/features/edit-staff-locale/ui/EditLocaleDialog.tsx` — admin per-staff locale dialog (role->locale clone of EditRoleDialog)
- `src/features/edit-staff-locale/index.ts` — explicit named-export barrel
- `src/features/edit-staff-locale/ui/EditLocaleDialog.test.tsx` — 4 behavior tests
- `src/widgets/StaffDashboard/StaffDashboard.tsx` — Language column + gated row action + full string migration to `t()`
- `src/shared/lib/i18n/locales/{es-MX,en-US}/staff.json` — Language-field keys (Task 1) + table/actions/section/search keys (Task 2)
- `eslint.i18n.config.js` — `logger.*` callee exclude, `id`/`accessorKey` object-property excludes, em-dash word exclude

## Decisions Made

- `StaffDashboard.tsx` is now fully owned/migrated by this plan — record for 21-11 (the later admin-surface sweep): **skip this file entirely**, every string in it (including the brand-new Language column/action) is already in the `staff` namespace.
- Reused the single `staff:locale.editTrigger` key for both the dialog's title and the row-action button label — one copy source for "Change language" across both surfaces, matching the plan's explicit instruction.
- Extended `eslint.i18n.config.js`'s excludes three ways (`logger.*` callees, `id`/`accessorKey` object-properties, em-dash word) — all Rule 3 blocking fixes needed to satisfy each task's own stated `npm run lint:i18n` acceptance criterion, following the exact precedent set by 21-03's `can`/`key` excludes for structural, non-UI-copy literals.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `eslint.i18n.config.js` rejected `logger.error(...)`'s telemetry event-name literal in EditLocaleDialog.tsx**
- **Found during:** Task 1 verification (`npm run lint:i18n -- src/features/edit-staff-locale`)
- **Issue:** `logger.error('edit-staff-locale.submit.failed', { message: result.error.message })` was flagged by `i18next/no-literal-string` — the event-name string is an internal telemetry identifier, not UI copy, but the existing `callees.exclude` list didn't cover member-call loggers.
- **Fix:** Added `'logger\\.\\w+'` to `callees.exclude`.
- **Files modified:** `eslint.i18n.config.js`
- **Verification:** `npm run lint:i18n -- src/features/edit-staff-locale` exits 0.
- **Committed in:** `0dc7c67` (Task 1 commit)

**2. [Rule 3 - Blocking] `eslint.i18n.config.js` rejected TanStack Table's structural `id`/`accessorKey` column properties and the em-dash placeholder in StaffDashboard.tsx**
- **Found during:** Task 2 verification (`npm run lint:i18n -- src/widgets/StaffDashboard/StaffDashboard.tsx`)
- **Issue:** Column definitions like `{ id: 'locale', ... }` and `accessorKey: 'staff.name'` were flagged as untranslated literals (structural identifiers, not copy), and the existing empty-shift-value `<span>—</span>` placeholder was flagged too (a symbol, not translatable text — the plan explicitly says to leave it literal).
- **Fix:** Added `'id'` and `'accessorKey'` to `object-properties.exclude`, and `'^—$'` to `words.exclude`.
- **Files modified:** `eslint.i18n.config.js`
- **Verification:** `npm run lint:i18n -- src/widgets/StaffDashboard/StaffDashboard.tsx` exits 0; re-ran `-- src/features/edit-staff-locale` and `-- src/widgets/SettingsTabsPanel/**` to confirm no regression from the widened excludes.
- **Committed in:** `24e7f2e` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking eslint-config extensions, following the identical precedent already established in 21-03). No scope creep — both were necessary to satisfy each task's own stated acceptance criteria.

## Issues Encountered

None beyond the two auto-fixed items documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `EditLocaleDialog` and the admin write path (`useMutationUpdateStaffLocale`, shipped in 21-02) are fully wired end-to-end: Staff page -> gated row action -> dialog -> RLS-enforced UPDATE -> audited.
- **21-11 (admin surface sweep) must skip `src/widgets/StaffDashboard/StaffDashboard.tsx` entirely** — already fully migrated by this plan, including the new Language column/action.
- `npm run typecheck` clean (only the 2 pre-existing unrelated errors, documented since Phase 11); `npm run lint` exits 0; full unit suite 140 files / 1244 tests pass, 15 todo, 2 skipped — zero regressions vs. the 21-03 baseline (139/1240).

---
*Phase: 21-i18n-multi-language*
*Completed: 2026-07-18*

## Self-Check: PASSED

All created files confirmed on disk (`src/features/edit-staff-locale/ui/EditLocaleDialog.tsx`, `src/features/edit-staff-locale/index.ts`, `src/features/edit-staff-locale/ui/EditLocaleDialog.test.tsx`, this SUMMARY.md). Both task commits (`0dc7c67`, `24e7f2e`) confirmed present in `git log`.
