---
phase: 14-audit-logs-table
plan: 12
subsystem: frontend
tags: [react, tanstack-query, rbac, staff, login-flow]

requires:
  - phase: 14-audit-logs-table
    provides: "force_pin_change(uuid, text) + clear_must_change_pin(text) SECURITY DEFINER RPCs (14-09)"
provides:
  - "features/force-pin-change slice (useForcePinChange hook + ForcePinChangeDialog)"
  - "StaffDashboard per-row 'Force PIN Change' action (manage_staff gated)"
  - "PINLoginForm 'forced_pin_change' phase (two-step new/confirm PIN, blocks login until resolved)"
affects: []

tech-stack:
  added: []
  patterns:
    - "pre-regen `supabase as any` cast for force_pin_change/clear_must_change_pin RPCs (not yet in supabase.types.ts)"
    - "ConfirmDialog reused as the AlertDialog shell for ForcePinChangeDialog instead of hand-rolling AlertDialogContent/Header/Footer"
    - "PINLoginForm's post-auth continuation logic extracted into proceedAfterAuth() so both the normal 'pin' phase and the new forced_pin_change phase share the existing-shift-lookup / opening-cash-prompt behavior"

key-files:
  created:
    - src/features/force-pin-change/model/useForcePinChange.ts
    - src/features/force-pin-change/ui/ForcePinChangeDialog.tsx
    - src/features/force-pin-change/ui/ForcePinChangeDialog.test.tsx
    - src/features/force-pin-change/index.ts
  modified:
    - src/widgets/StaffDashboard/StaffDashboard.tsx
    - src/widgets/StaffDashboard/StaffDashboard.test.tsx
    - src/widgets/PINLoginForm/PINLoginForm.tsx
    - src/widgets/PINLoginForm/PINLoginForm.test.tsx

key-decisions:
  - "ForcePinChangeDialog is built on the existing `ConfirmDialog` primitive (which already wraps AlertDialogContent/Header/Footer with keyboard support) rather than reassembling the AlertDialog parts by hand — matches ManagerPinDialog's visual shell per the plan while reusing more code."
  - "StaffDashboard's per-row button uses POSButton (the convention already used for Clock In/Clock Out in this file) rather than the raw shadcn Button referenced literally in the plan text — POSButton extends ButtonProps so variant/size props are unaffected."
  - "Gated the trigger on `manage_staff` (admin-only) exactly as the plan specified, one level more restrictive than the RPC's manager+ gate, which remains authoritative (T-14-03 mitigation)."
  - "On mismatch/reuse validation failure in the forced-PIN-change screen, both PIN fields reset AND the error message is passed to both the New-PIN and Confirm-PIN keypads (not just the one visible at failure time) — otherwise resetting `newPin`/`confirmPin` in the same render pass as setting the error would swap the visible keypad back to 'New PIN' before the user ever saw the message, silently dropping it."

requirements-completed: [SC3]

duration: ~45min
completed: 2026-07-04
---

# Phase 14 Plan 12: Force PIN Change UI (StaffDashboard trigger + PINLoginForm forced-reset screen) Summary

**New `force-pin-change` feature slice wired into a StaffDashboard per-row admin action and a non-abandonable two-step PIN reset screen inside PINLoginForm's login state machine**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-04T16:32:00Z
- **Completed:** 2026-07-04T16:47:00Z
- **Tasks:** 3/3 complete
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- **Task 1** — Created `src/features/force-pin-change/`: `useForcePinChange` (TanStack mutation calling `rpc('force_pin_change', { p_staff_id, p_terminal_id })`, mapping RPC errors to `Result`, invalidating `staffKeys.list()` on success) and `ForcePinChangeDialog` (built on the shared `ConfirmDialog` primitive with the exact UI-SPEC copy: title `Force PIN change for {name}?`, body explaining the consequence, confirm label "Force PIN change", success toast `"{name}'s PIN will be changed on next login."`). Barrel `index.ts` + RTL test covering render/confirm/error paths.
- **Task 2** — Added the "Force PIN Change" per-row button to `StaffDashboard`'s actions column, gated by `<ProtectedAction action="manage_staff">` (admin-only UI gate, more restrictive than the RPC's manager+ gate which remains authoritative), wired to a `forcePinTarget` state variable and the shared `ForcePinChangeDialog`. Existing Clock In/Out buttons/handlers untouched. Added an assertion that the button renders once per staff row.
- **Task 3** — Extended `PINLoginForm`'s `Phase` union with `'forced_pin_change'`. Extracted the existing-shift-lookup/opening-cash-prompt logic into a shared `proceedAfterAuth()` so both the normal `'pin'` phase and the new forced-reset phase funnel into the same post-auth continuation. Immediately after a successful `signInWithPassword`, if `selectedStaff.mustChangePin` is true, phase switches to `'forced_pin_change'` instead of continuing. Renders two PINKeypads in sequence (New PIN, then Confirm new PIN once the first reaches 6 digits) with mismatch (`"PINs don't match. Try again."`) and reuse (`"Choose a PIN different from your current one."`) validation, both of which reset the fields back to the New-PIN step while keeping the error message visible. On a valid new PIN, calls `supabase.auth.updateUser({ password: newPin })` then `rpc('clear_must_change_pin', { p_terminal_id })`, then calls `proceedAfterAuth()`. The "Not you? Go back" link is hidden only during this phase. Added 4 new tests covering entry into the phase, the mismatch path, the reuse path, and the full success path (asserting `updateUser`/`rpc` calls and the transition into the opening-cash prompt), using a local `vi.mock('@shared/lib/supabase', ...)` override (the global test-setup mock has no `updateUser`).

## Task Commits

Each task was committed atomically:

1. **Task 1: features/force-pin-change slice — useForcePinChange hook + ForcePinChangeDialog** - `b291684` (feat)
2. **Task 2: Add the "Force PIN Change" per-row action to StaffDashboard** - `eefa70f` (feat)
3. **Task 3: Add the 'forced_pin_change' phase to PINLoginForm** - `5e5ba2c` (feat)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `src/features/force-pin-change/model/useForcePinChange.ts` - Mutation hook calling `force_pin_change` RPC
- `src/features/force-pin-change/ui/ForcePinChangeDialog.tsx` - Confirm dialog with exact UI-SPEC copy + success toast
- `src/features/force-pin-change/ui/ForcePinChangeDialog.test.tsx` - RTL coverage (render, confirm, null-staff, RPC error)
- `src/features/force-pin-change/index.ts` - Barrel exports
- `src/widgets/StaffDashboard/StaffDashboard.tsx` - "Force PIN Change" per-row action (manage_staff gated)
- `src/widgets/StaffDashboard/StaffDashboard.test.tsx` - Assertion for the new per-row button
- `src/widgets/PINLoginForm/PINLoginForm.tsx` - `forced_pin_change` phase in the login state machine
- `src/widgets/PINLoginForm/PINLoginForm.test.tsx` - 4 new tests for the forced-PIN-change flow

## Decisions Made

- `ForcePinChangeDialog` reuses the generic `ConfirmDialog` primitive (matches the plan's "reuse ManagerPinDialog's visual shell" instruction while sharing more code, since `ConfirmDialog` already wraps that exact AlertDialog composition with keyboard support).
- `POSButton` used for the new StaffDashboard action instead of a raw shadcn `Button`, matching the existing Clock In/Out convention in that file.
- Both PIN-entry keypads receive `pinChangeError` (not just the currently-visible one) so a mismatch/reuse error set in the same tick as the field reset is still shown to the user — see key-decisions in frontmatter for the full rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Error message dropped on the same render as the field reset**
- **Found during:** Task 3, while writing the mismatch/reuse test cases
- **Issue:** Setting `pinChangeError` and resetting `newPin`/`confirmPin` in the same synchronous handler caused React to batch both updates into one render; since the visible keypad is chosen by `newPin.length < 6`, the reset immediately swapped the UI back to the "New PIN" keypad in the same render the error was set, so the error text (attached only to the "Confirm PIN" keypad) never appeared on screen.
- **Fix:** Pass `error={pinChangeError}` to both the New-PIN and Confirm-PIN keypads, clearing it only when the user starts typing again (mirrors the existing `'pin'` phase's error-clear-on-change pattern).
- **Files modified:** `src/widgets/PINLoginForm/PINLoginForm.tsx`
- **Commit:** `5e5ba2c`

None else - the rest of the plan executed as written.

## Issues Encountered

- Worktree had no `node_modules` (fresh checkout) and no `.env.local` (gitignored, untracked) — ran `npm install` (1240 packages) and copied `.env.local` from the main repo checkout, consistent with the same issue documented in 14-02/14-09-SUMMARY.md. Neither is a plan deliverable.
- `.planning/` is entirely gitignored in this repo except previously force-added SUMMARY.md files. This worktree's checkout of `.planning/` is sparse (missing PROJECT.md, STATE.md, config.json, and every Phase 14 PLAN.md except what prior waves force-added) — those files, including this plan's own `14-12-PLAN.md`, were read from the main repo's working tree (`D:/Projects/Code/POS/bola8pos-kiro/bar-pos/.planning/...`) instead, matching the pattern noted in 14-02/14-09-SUMMARY.md's Issues Encountered sections.
- `npm run lint` (full-project) shows 5 pre-existing errors unrelated to this plan's files (`src/app/App.tsx`, `src/entities/tab/model/queries.concurrent.test.ts`, `src/shared/ui/ErrorBoundary.tsx`) — already logged in 14-11-SUMMARY.md's deferred items; not re-logged here, out of scope per the executor scope-boundary rule. Lint on this plan's own files (`src/features/force-pin-change`, `src/widgets/StaffDashboard`, `src/widgets/PINLoginForm`) is clean.

## User Setup Required

None - no external service configuration required. This plan is UI-only and depends on the `force_pin_change`/`clear_must_change_pin` RPCs already authored in 14-09 (migration push deferred to 14-14, per that plan's note).

## Next Phase Readiness

- SC3 (forced-PIN-change capability) UI is now complete end-to-end: manager/admin trigger (StaffDashboard) → `force_pin_change` RPC → `mustChangePin` flag → staff-side forced reset screen (PINLoginForm) → `clear_must_change_pin` RPC → normal login continuation.
- 14-14's push gate must include the `force_pin_change`/`clear_must_change_pin` migration (`20260703000005_force_pin_change.sql`, authored in 14-09) before this feature is live against remote Supabase — no migration changes were needed in this plan.

## Self-Check: PASSED

- FOUND: `src/features/force-pin-change/model/useForcePinChange.ts`
- FOUND: `src/features/force-pin-change/ui/ForcePinChangeDialog.tsx`
- FOUND: `src/features/force-pin-change/ui/ForcePinChangeDialog.test.tsx`
- FOUND: `src/features/force-pin-change/index.ts`
- FOUND: `src/widgets/StaffDashboard/StaffDashboard.tsx` (modified)
- FOUND: `src/widgets/PINLoginForm/PINLoginForm.tsx` (modified)
- FOUND commit `b291684` (Task 1)
- FOUND commit `eefa70f` (Task 2)
- FOUND commit `5e5ba2c` (Task 3)

---
*Phase: 14-audit-logs-table*
*Completed: 2026-07-04*
