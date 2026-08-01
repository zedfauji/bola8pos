---
phase: 27-one-shot-inventory-cigarette-box-pattern
plan: 07
subsystem: ui
tags: [react, i18n, rbac, manager-pin-gate, open-units, tanstack-query]

# Dependency graph
requires:
  - phase: 27-one-shot-inventory-cigarette-box-pattern
    provides: "27-05's entities/open-unit hooks (useMutationOpenOpenUnit/useMutationCorrectOpenUnit/useMutationVoidOpenUnit); 27-04's live open_open_unit/correct_open_unit/void_open_unit RPCs"
provides:
  - "src/features/open-open-unit/ — useOpenOpenUnit + OpenUnitButton, bartender+, no PIN gate (D-11)"
  - "src/features/correct-open-unit/ — useCorrectOpenUnit + CorrectOpenUnitDialog, manager-PIN-gated (D-12)"
  - "src/features/void-open-unit/ — useVoidOpenUnit + VoidOpenUnitDialog, manager-PIN-gated (D-12)"
  - "featMgmt.json openOpenUnit/correctOpenUnit/voidOpenUnit key blocks in both locales"
affects: ["27-08 (the admin Open-Units tab composes these three finished features)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useManageModifierInventoryRules wrapper shape reused for all three new hooks: mutateAsync -> toast.error(result.error.message) on failure (raw RPC message, no per-code substitution) -> toast.success(i18n.t(...)) on success"
    - "Correct/void dialogs set local pinOpen state on submit instead of dispatching directly; the mutation fires only from ManagerPinDialog's onSuccess — the PIN dialog is UX, the RPC's own manager-role guard (27-04) is the actual control"
    - "requiredAction=\"adjust_inventory\" used deliberately for both manager-gated dialogs, per 27-RESEARCH.md Pitfall 4, rather than copying CartPanel's requiredAction=\"void_order\" precedent"

key-files:
  created:
    - src/features/open-open-unit/index.ts
    - src/features/open-open-unit/model/useOpenOpenUnit.ts
    - src/features/open-open-unit/ui/OpenUnitButton.tsx
    - src/features/correct-open-unit/index.ts
    - src/features/correct-open-unit/model/useCorrectOpenUnit.ts
    - src/features/correct-open-unit/ui/CorrectOpenUnitDialog.tsx
    - src/features/correct-open-unit/ui/CorrectOpenUnitDialog.test.tsx
    - src/features/void-open-unit/index.ts
    - src/features/void-open-unit/model/useVoidOpenUnit.ts
    - src/features/void-open-unit/ui/VoidOpenUnitDialog.tsx
  modified:
    - src/shared/lib/i18n/locales/es-MX/featMgmt.json
    - src/shared/lib/i18n/locales/en-US/featMgmt.json

key-decisions:
  - "All correctOpenUnit/voidOpenUnit/openOpenUnit i18n keys were added to both locale files in the same edit pass, before Task 2's feature files existed — a minor commit-atomicity slip (Task 1's commit contains unused JSON keys for Task 2's not-yet-built features). Harmless: unused JSON keys don't affect typecheck/lint/tests, so checking out Task 1's commit alone stays green. Documented here per the same pattern 27-05 flagged for its own atomicity slip."
  - "Test assertions against translated button/label text use locale-agnostic regexes (e.g. /correct|corregir/i) because the app's i18n singleton defaults to es-MX in the Vitest environment, not en-US — English-only regexes silently failed against the rendered Spanish strings."
  - "The mocked ManagerPinDialog stub is queried with screen.getByText, not screen.getByRole('button', ...), because Radix's open Dialog primitive marks sibling body content aria-hidden while it is modal-open; the raw <button> stub isn't itself a recognized dialog root, so role-based queries (which respect the accessibility tree) can't see it even though it renders in the DOM. getByText ignores aria-hidden and finds it reliably."

requirements-completed: [SC-3]

coverage:
  - id: D1
    description: "open-open-unit feature: bartender+ action, no PIN gate of any kind, surfacing the RPC's D-08 duplicate-unit message verbatim"
    verification:
      - kind: other
        ref: "grep -qE '<ProtectedAction|canAccess\\(|usePermissions\\(' OpenUnitButton.tsx (absent); grep -q result.error.message useOpenOpenUnit.ts; ! grep -q DUPLICATE_ENTRY useOpenOpenUnit.ts — all pass"
        status: pass
      - kind: other
        ref: "npm run lint && npm run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "correct-open-unit and void-open-unit features: manager-PIN-gated (requiredAction=\"adjust_inventory\"), reason required, correction bounded to 0..unitsPerPackage, void states the piece count and offers no restock control, mutation dispatches only after PIN success"
    verification:
      - kind: unit
        ref: "src/features/correct-open-unit/ui/CorrectOpenUnitDialog.test.tsx (10 tests) — reason/count validation, PIN-before-dispatch ordering, requiredAction assertion, success/failure toast paths"
        status: pass
      - kind: other
        ref: "grep -c requiredAction=\"adjust_inventory\" across both dialogs == 2; ! grep -qiE 'restock|returnToStock|return_to_stock' VoidOpenUnitDialog.tsx; each mutation call site appears exactly once, inside the PIN-success handler"
        status: pass
      - kind: other
        ref: "npm run test (full unit suite): 148 files passed, 2 skipped, 1362 tests passed, 15 todo, 0 failed. npm run lint && npm run typecheck clean."
        status: pass
    human_judgment: false

# Metrics
duration: ~40min
completed: 2026-07-31
status: complete
---

# Phase 27 Plan 07: Open-Units Feature Actions (open/correct/void) Summary

**Three self-contained `features/` folders — `open-open-unit` (bartender+, no PIN), `correct-open-unit` and `void-open-unit` (manager-PIN-gated via `adjust_inventory`) — each wrapping one of plan 27-05's RPC-backed mutation hooks with a toast/error-passthrough wrapper and one UI trigger, ready for plan 27-08's Open-Units tab to compose.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-31
- **Tasks:** 2 of 2 complete
- **Files modified:** 12 total (10 new, 2 locale files)

## Accomplishments

- `open-open-unit`: `useOpenOpenUnit()` wraps `useMutationOpenOpenUnit`, passing the RPC's error message through unmodified (D-08's interpolated remaining-count text survives to the toast verbatim) and toasting a translated success message otherwise. `OpenUnitButton` is a `POSButton` with `touchSize="large"`, carrying no role gate of any kind (no `ProtectedAction`, no `canAccess`/`usePermissions` call) with a code comment citing D-11.
- `correct-open-unit`: `useCorrectOpenUnit()` wraps `useMutationCorrectOpenUnit`. `CorrectOpenUnitDialog` renders a `FormField`-wrapped number input (pre-filled with `currentCount`, bounded to `0..unitsPerPackage` with an inline error when out of range) and a `FormField`-wrapped reason input; its submit button is disabled until the reason is non-blank/non-whitespace and the count is in range. Clicking submit does **not** dispatch — it opens `ManagerPinDialog` with `requiredAction="adjust_inventory"` (deliberate per 27-RESEARCH.md Pitfall 4, not `CartPanel`'s `void_order` precedent); the mutation fires only from the PIN dialog's `onSuccess`.
- `void-open-unit`: `useVoidOpenUnit()` wraps `useMutationVoidOpenUnit`. `VoidOpenUnitDialog` states the exact piece count being written off (interpolated from `currentCount`), uses a `destructive`-variant primary button, the same reason-required/PIN-before-dispatch gating as the correction dialog, and offers no restock affordance — voiding does not credit inventory back (D-10), so no UI element should imply otherwise.
- `CorrectOpenUnitDialog.test.tsx` (10 tests, TDD RED→GREEN): mocks `@entities/open-unit`'s mutation hook and stubs `ManagerPinDialog` with a "Grant PIN" control, directly proving the mutation mock is never called between submit and PIN success. Per the plan, `VoidOpenUnitDialog` shares the tested shape and gets no separate suite (`skipped: VoidOpenUnitDialog test suite, add when its shape diverges from CorrectOpenUnitDialog`).
- `openOpenUnit`/`correctOpenUnit`/`voidOpenUnit` key blocks added to both `featMgmt.json` locale files — identical key sets in es-MX and en-US, with `{{name}}`/`{{max}}`/`{{count}}` interpolations where the plan specified them.
- Ran the full unit suite: **148 files passed, 2 skipped, 1362 tests passed, 15 todo, 0 failed.** `npm run typecheck` and `npm run lint` (including the `i18next/no-literal-string` gate on `features/`) both clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: open-open-unit feature — bartender+, no PIN gate (D-11)** - `58fa4d0` (feat)
2. **Task 2 (RED): failing test for CorrectOpenUnitDialog** - `fcd3a4a` (test)
3. **Task 2 (GREEN): correct-open-unit and void-open-unit features (D-12)** - `a2cb14d` (feat)

**Plan metadata:** this SUMMARY.md commit (pending)

## Files Created/Modified

- `src/features/open-open-unit/model/useOpenOpenUnit.ts` - toast/error-passthrough wrapper over `useMutationOpenOpenUnit`
- `src/features/open-open-unit/ui/OpenUnitButton.tsx` - ungated `POSButton` trigger, D-11 comment
- `src/features/open-open-unit/index.ts` - public feature surface
- `src/features/correct-open-unit/model/useCorrectOpenUnit.ts` - wrapper over `useMutationCorrectOpenUnit`
- `src/features/correct-open-unit/ui/CorrectOpenUnitDialog.tsx` - count+reason form, PIN-gated dispatch
- `src/features/correct-open-unit/ui/CorrectOpenUnitDialog.test.tsx` - 10-test coverage of the `<behavior>` block
- `src/features/correct-open-unit/index.ts` - public feature surface
- `src/features/void-open-unit/model/useVoidOpenUnit.ts` - wrapper over `useMutationVoidOpenUnit`
- `src/features/void-open-unit/ui/VoidOpenUnitDialog.tsx` - reason form + destructive confirm, PIN-gated dispatch, no restock control
- `src/features/void-open-unit/index.ts` - public feature surface
- `src/shared/lib/i18n/locales/es-MX/featMgmt.json` / `en-US/featMgmt.json` - `openOpenUnit`/`correctOpenUnit`/`voidOpenUnit` key blocks

## Decisions Made

See `key-decisions` in the frontmatter:
1. i18n keys for all three features were added in one edit pass ahead of Task 2's files existing — a minor, harmless commit-atomicity slip (unused JSON keys don't break typecheck/lint/tests at any commit boundary).
2. Test regexes for translated UI text are locale-agnostic (`/correct|corregir/i` etc.) because the test environment's i18n singleton renders es-MX by default.
3. The `ManagerPinDialog` stub in the test is queried via `getByText` rather than `getByRole('button', ...)`, because Radix's open `Dialog` aria-hides sibling body content and the raw stub button isn't itself a recognized dialog root — `getByRole` respects the (now aria-hidden) accessibility tree and can't find it, `getByText` doesn't check accessibility state and does.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `exactOptionalPropertyTypes` violation on `FormField`'s conditional `error`/`hint` props**
- **Found during:** Task 2, running `npm run typecheck` after building `CorrectOpenUnitDialog`.
- **Issue:** Passing `error={!countIsValid ? '...' : undefined}` to `FormField` (whose prop type is `error?: string`, not `error?: string | undefined`) is a TS2375 violation under this project's `exactOptionalPropertyTypes: true` — explicitly passing `undefined` is distinct from omitting the prop.
- **Fix:** Replaced the ternary-prop pattern with a conditional object spread (`{...(countIsValid ? { hint: ... } : { error: ... })}`) so the prop is omitted entirely rather than passed as `undefined`.
- **Files modified:** `src/features/correct-open-unit/ui/CorrectOpenUnitDialog.tsx`
- **Commit:** `a2cb14d`

**2. [Rule 1 - Bug] Removed the literal word "restock" from a code comment**
- **Found during:** Task 2, running the plan's own acceptance grep (`! grep -qiE 'restock|...' VoidOpenUnitDialog.tsx`).
- **Issue:** My own explanatory comment ("...this dialog offers no restock affordance") contained the literal string the grep gate is designed to catch, failing the check even though no restock *control* exists.
- **Fix:** Reworded the comment to convey the same D-10 rationale without using the word "restock".
- **Files modified:** `src/features/void-open-unit/ui/VoidOpenUnitDialog.tsx`
- **Commit:** `a2cb14d`

---

**Total deviations:** 2 (both Rule 1 auto-fixes), both isolated to this plan's own new files.
**Impact on plan:** No scope creep — both are small, self-contained corrections surfaced by the plan's own verification commands.

## Issues Encountered

- The test environment's i18n singleton defaults to es-MX (not en-US), which is not obvious from the codebase's English-first test conventions elsewhere. Discovered via failing `getByRole('button', { name: /correct/i })` queries against a rendered "Corregir conteo" button; fixed by using locale-agnostic regexes, matching the `/motivo|reason/i` pattern already established in `RemoveTabItemDialog.test.tsx`.
- Radix's `Dialog` primitive aria-hides sibling body content while modal-open, which hid the mocked `ManagerPinDialog` stub from `getByRole` queries (though it was present in the DOM). Real `ManagerPinDialog` usage is unaffected in production — this only surfaced because the test stub is a bare `<button>` rather than a real dialog root that Radix's focus-trap logic would recognize. Fixed by switching the stub-lookup queries to `getByText`.

## User Setup Required

None. All work is pure client-layer React/TypeScript against already-live backend RPCs (27-04) and already-built entity hooks (27-05) — no new migration, no live push required for this plan.

## Next Phase Readiness

Plan 27-07 is complete. `OpenUnitButton`, `CorrectOpenUnitDialog`, and `VoidOpenUnitDialog` (plus their hooks) are importable from `@features/open-open-unit`, `@features/correct-open-unit`, and `@features/void-open-unit` respectively. Plan 27-08 (the admin Open-Units tab) can now compose these three finished, individually-tested actions rather than building inline flows.

---

## Self-Check: PASSED

- `src/features/open-open-unit/model/useOpenOpenUnit.ts` — FOUND
- `src/features/open-open-unit/ui/OpenUnitButton.tsx` — FOUND
- `src/features/open-open-unit/index.ts` — FOUND
- `src/features/correct-open-unit/model/useCorrectOpenUnit.ts` — FOUND
- `src/features/correct-open-unit/ui/CorrectOpenUnitDialog.tsx` — FOUND
- `src/features/correct-open-unit/ui/CorrectOpenUnitDialog.test.tsx` — FOUND
- `src/features/correct-open-unit/index.ts` — FOUND
- `src/features/void-open-unit/model/useVoidOpenUnit.ts` — FOUND
- `src/features/void-open-unit/ui/VoidOpenUnitDialog.tsx` — FOUND
- `src/features/void-open-unit/index.ts` — FOUND
- Commit `58fa4d0` — FOUND in `git log --oneline`
- Commit `fcd3a4a` — FOUND in `git log --oneline`
- Commit `a2cb14d` — FOUND in `git log --oneline`
- `npx vitest run --project unit --reporter=dot src/features/correct-open-unit src/features/void-open-unit` — 10 passed, 0 failed — CONFIRMED
- `npm run test` (full unit suite) — 148/150 files (2 skipped), 1362/1377 tests passed, 15 todo, 0 failed — CONFIRMED
- `npm run typecheck` — clean — CONFIRMED
- `npm run lint` — clean — CONFIRMED

---
*Phase: 27-one-shot-inventory-cigarette-box-pattern*
*Completed: 2026-07-31*
