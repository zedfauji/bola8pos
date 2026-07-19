---
phase: 21-i18n-multi-language
fixed_at: 2026-07-19T05:57:19Z
review_path: .planning/phases/21-i18n-multi-language/21-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 21: Code Review Fix Report

**Fixed at:** 2026-07-19T05:57:19Z
**Source review:** .planning/phases/21-i18n-multi-language/21-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (2 critical, 1 warning — `fix_scope: critical_warning`)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: Self-service locale change is not persisted to the Zustand store — reverts to the old language on next app reload/restart

**Files modified:** `src/entities/staff/model/queries.ts`
**Commit:** `5de42bb`
**Applied fix:** `useMutationSetOwnLocale`'s `onSuccess` now updates `useStaffStore`'s persisted `currentStaff.locale` (via `useStaffStore.setState`) in addition to invalidating `staffKeys.list()`, mirroring the existing `useStaffStore.getState().updateShift(...)` pattern already used elsewhere in the same file. `onRehydrateStorage` now reads the freshly-persisted locale instead of the stale pre-change value on next app launch.

### WR-01: `EditLocaleDialog`'s pre-selected locale desyncs from the target `staff` prop — can display, and silently save, the wrong locale

**Files modified:** `src/widgets/StaffDashboard/StaffDashboard.tsx`, `src/features/edit-staff-locale/ui/EditLocaleDialog.test.tsx`
**Commit:** `81ae5ab`
**Applied fix:** Applied the review's "force a remount per target" option, matching the existing `ClockOutDialog` pattern already used in the same file (`key={clockOutTarget ? ... : 'clock-out-idle'}`). `EditLocaleDialog` now receives `key={localeTarget?.id ?? 'locale-idle'}` in `StaffDashboard.tsx`, so React fully remounts the dialog (resetting `selectedLocale` from the fresh `staff` prop) whenever the admin opens it for a different staff row, instead of relying on Radix's `onOpenChange`, which never fires for this externally-controlled `open` transition.

Deviated from the review's alternate `useEffect` suggestion after Tier-2 verification: `eslint-plugin-react-hooks`'s `set-state-in-effect` rule (project lint config, `max-warnings: 0`) flags synchronous `setState` inside `useEffect` as an anti-pattern and failed lint. The key-remount approach is also React's officially recommended pattern for "resetting state when a prop changes" and was already an established convention in this exact file, so it was the better fit per project conventions.

Added the regression test the review explicitly requested: renders the dialog once, then re-renders (with a changed `key`, matching the fixed `StaffDashboard` usage) for a *different* staff whose locale differs from the first, and asserts the combobox now shows the second staff's locale.

### WR-02: ESC/POS column math uses UTF-16 code-unit length, not UTF-8 byte width — will misalign as soon as a translated label contains a multi-byte character

**Files modified:** `src/shared/lib/receipt-format.ts`, `src/shared/lib/receipt-format.test.ts`
**Commit:** `afbd95b`
**Applied fix:** Added a `byteWidth()` helper (`new TextEncoder().encode(s).length`) plus two truncation helpers (`truncateToByteWidth`, `truncateFromEndToByteWidth`) that truncate by whole characters so a multi-byte character is never split mid-sequence. `padRight`, `lineLeftRight`, and `centerLine` now measure and pad against UTF-8 byte width instead of `String.prototype.length`, matching what `printer.rs` actually sends over the wire (`line.as_bytes()`). Scoped the fix to the three named functions only (`receipt-format.ts:8-24` per the finding); the separate `barAddress` chunking loop in `buildThermalReceiptText` was left untouched as out of scope for this finding.

Added the regression test the review implicitly called for: builds a pre-cheque with `happyHourActive: true` (exercising the existing `"★ HORA FELIZ ACTIVA ★"` catalog string the review cited as already-affected) and asserts the rendered line is exactly 32 UTF-8 bytes via `TextEncoder`, not merely `<= 32` characters as the pre-existing test suite checked.

## Skipped Issues

None — all in-scope findings were fixed.

---

**Post-fix verification (full gate, run in the isolated worktree after all 3 fixes):**
- `npm run typecheck` — 2 pre-existing errors remain (`src/entities/tab/model/queries.ts:788`, `src/shared/lib/agent/rag.ts:60`), confirmed present at the pre-fix commit (`2d4cf49`) and unrelated to any file touched by this fix pass. No new typecheck errors introduced.
- `npm run lint` — clean, 0 warnings/errors (`max-warnings: 0`).
- `npm run test` — 140 test files passed, 2 skipped, 1250 tests passed, 15 todo — same baseline as pre-fix, plus the 2 new regression tests added above.

_Fixed: 2026-07-19T05:57:19Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
