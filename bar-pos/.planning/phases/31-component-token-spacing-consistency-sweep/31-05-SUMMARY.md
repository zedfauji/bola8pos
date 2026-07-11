---
phase: 31-component-token-spacing-consistency-sweep
plan: 05
subsystem: ui
tags: [react, radix, shadcn, checkbox, jsx-a11y]

# Dependency graph
requires:
  - phase: 30-shared-shell-primitive-extension
    provides: shared/ui Checkbox primitive already had 4 production consumers (IngredientForm, ModifierSheet, ProductForm, ComboSlotCard) proving the pattern
provides:
  - Zero raw `type="checkbox"` inputs remaining in ModifierGroupEditor and HardwareSettingsTab
  - All 8 checkbox instances across the 2 files use shared/ui Checkbox with onCheckedChange + strict === true comparison
affects: [component-token-spacing-consistency-sweep, ui-drift-audit-followups]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Checkbox primitive swap: checked={x} + onCheckedChange={c => setX(c === true)}, never !!c (Radix CheckedState is boolean|'indeterminate')"
    - "Radix Checkbox.Root renders a button[role=checkbox], not a labelable native input — wrapping it in a bare <label> fails jsx-a11y/label-has-associated-control; needs explicit id + htmlFor (or label wraps text only, id/htmlFor pairs the control)"

key-files:
  created: []
  modified:
    - src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx
    - src/widgets/SettingsTabsPanel/tabs/HardwareSettingsTab.tsx

key-decisions:
  - "Added explicit id=\"group-is-required\" + htmlFor on ModifierGroupEditor's Required checkbox — the plan assumed implicit label-wrapping works for Radix Checkbox.Root, but jsx-a11y/label-has-associated-control doesn't recognize a wrapped button[role=checkbox] as an associable control; explicit id/htmlFor was required to pass lint."

patterns-established:
  - "Checkbox primitive swap: checked={x} + onCheckedChange={c => setX(c === true)}, never !!c"

requirements-completed: [COMPONENT-02]

# Metrics
duration: 12min
completed: 2026-07-11
---

# Phase 31 Plan 05: Checkbox Primitive Swap Summary

**Replaced all 8 raw `type="checkbox"` inputs across ModifierGroupEditor (2) and HardwareSettingsTab (6) with the existing shared/ui Checkbox primitive, using strict `onCheckedChange={(c) => setX(c === true)}` per RESEARCH Pitfall 3.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-11T19:31:00Z
- **Completed:** 2026-07-11T19:43:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ModifierGroupEditor's "Required" checkbox and per-modifier row checkbox now render via `Checkbox` from `@shared/ui/checkbox`
- HardwareSettingsTab's 6 mapped receipt-setting checkboxes now render via `Checkbox`, preserving `id={receipt-<key>}` + `Label htmlFor` pairing
- Zero raw `type="checkbox"` inputs remain in either file; zero `!!c` truthy-casts

## Task Commits

Each task was committed atomically:

1. **Task 1: ModifierGroupEditor — swap 2 raw checkboxes to Checkbox (D-04)** - `0ff5fdc` (feat)
2. **Task 2: HardwareSettingsTab — swap 6 mapped raw checkboxes to Checkbox (D-04)** - `0489981` (feat)

**Plan metadata:** committed alongside this SUMMARY.md (worktree mode — orchestrator handles final metadata commit)

## Files Created/Modified
- `src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx` - 2 `Checkbox` instances (Required toggle + per-modifier attach row) replacing raw `input type="checkbox"`
- `src/widgets/SettingsTabsPanel/tabs/HardwareSettingsTab.tsx` - 6 mapped `Checkbox` instances (receipt settings) replacing raw `input type="checkbox"`

## Decisions Made
- Added explicit `id="group-is-required"` + `htmlFor` to ModifierGroupEditor's Required checkbox/label pair (see Deviations below) — necessary for lint, no visual/behavioral change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's implicit-label-association assumption was wrong for Radix Checkbox**
- **Found during:** Task 1 (ModifierGroupEditor)
- **Issue:** The plan's `<action>` explicitly stated "Radix Checkbox.Root renders a labelable element, so implicit label association still works; no id/htmlFor needed here." This was incorrect — Radix `Checkbox.Root` renders a `<button role="checkbox">`, and ESLint's `jsx-a11y/label-has-associated-control` does not recognize a wrapped `button` as an associable control, so `npm run lint` failed with `A form label must be associated with a control` on the wrapping `<label>`.
- **Fix:** Added `id="group-is-required"` to the `Checkbox` and `htmlFor="group-is-required"` to the wrapping `<label>`. No markup restructuring, no behavior change — the label still wraps both the checkbox and the descriptive text.
- **Files modified:** `src/features/manage-modifier-groups/ui/ModifierGroupEditor.tsx`
- **Verification:** `npm run lint` exits 0 (previously 1 error); `npm run typecheck` unaffected (still the 2 documented pre-existing unrelated errors).
- **Committed in:** `0ff5fdc` (Task 1 commit, folded in — same file, same task, no separate commit needed)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for lint compliance (project CLAUDE.md/CI gate: `npm run lint` max-warnings 0). No scope creep — same file, same task, no new markup pattern introduced beyond what the per-modifier-row checkbox (Task 1's second checkbox) already used.

## Issues Encountered
- Worktree had no `node_modules` (fresh git worktree, gitignored deps not present). Resolved by creating a Windows junction (`mklink /J`) to the main repo's `node_modules` rather than reinstalling — avoided a full `npm ci` while keeping `typecheck`/`lint` runnable against the identical dependency tree. No package.json/package-lock.json changes made.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both files now fully conform to COMPONENT-02 (Checkbox primitive) — no known stubs, no remaining raw checkbox inputs anywhere in this plan's scope.
- `npm run typecheck` and `npm run lint` both exit 0 on the modified files (typecheck baseline: 2 pre-existing unrelated errors in `src/entities/tab/model/queries.ts` and `src/shared/lib/agent/rag.ts`, unchanged by this plan).
- No blockers for the remaining Phase 31 plans.

---
*Phase: 31-component-token-spacing-consistency-sweep*
*Completed: 2026-07-11*
