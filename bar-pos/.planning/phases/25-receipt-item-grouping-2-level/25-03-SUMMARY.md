---
phase: 25-receipt-item-grouping-2-level
plan: 03
subsystem: ui
tags: [kds, react, i18n, vitest, react-testing-library]

# Dependency graph
requires:
  - phase: 25-receipt-item-grouping-2-level
    provides: "formatModifierLines from src/shared/lib/groupOrderItemsForReceipt.ts (plan 01)"
provides:
  - "KdsCard consuming the shared formatModifierLines convention, matching the pre-cheque's indented modifier format"
  - "First unit test file for src/widgets/KdsBoard/"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Widget components exported by name (not just default/closure-local) purely to make them directly renderable in RTL tests, with zero runtime behavior change"

key-files:
  created:
    - src/widgets/KdsBoard/KdsCard.test.tsx
  modified:
    - src/widgets/KdsBoard/index.tsx

key-decisions:
  - "Exported KdsCard (was module-private) so the test can render it directly with props instead of mocking useKdsItems/useKdsRealtimeBridge — smaller diff, no behavior change, matches the plan's stated preference."
  - "Deferred e2e/40-kds-bar.spec.ts execution to phase UAT: this plan runs as a parallel worktree sub-agent alongside sibling agents (25-02, 25-04) that may also be running `npm run dev` — starting a second `headless: false` Playwright run bound to the same port 1420 risked cross-agent interference. The spec was inspected and does not reference the changed `kds-item-modifiers` markup directly, so no regression is expected."

patterns-established:
  - "KdsCard renders one <p className=\"... whitespace-pre\"> per formatModifierLines() line inside a data-testid=\"kds-item-modifiers\" wrapper div, mirroring the pre-cheque/thermal-receipt indented modifier convention from plan 01."

requirements-completed: [SC-2]

coverage:
  - id: D1
    description: "KdsCard renders one distinct indented line per modifier via the shared formatModifierLines formatter, replacing the old slash-joined string"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/widgets/KdsBoard/KdsCard.test.tsx#renders one distinct line per modifier via the shared formatter"
        status: pass
      - kind: unit
        ref: "src/widgets/KdsBoard/KdsCard.test.tsx#does not join modifier names with a slash separator"
        status: pass
    human_judgment: false
  - id: D2
    description: "An item with no modifiers renders no modifier block; an item with notes still renders the existing notes paragraph unchanged"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "src/widgets/KdsBoard/KdsCard.test.tsx#renders no modifier block when there are no modifiers"
        status: pass
      - kind: unit
        ref: "src/widgets/KdsBoard/KdsCard.test.tsx#still renders the notes paragraph unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "KDS board layout, ComboKdsCard, and category clustering remain untouched (D-04 — cards stay one-per-item, no category grouping on this surface)"
    requirement: "SC-2"
    verification:
      - kind: other
        ref: "grep -c groupByCategory src/widgets/KdsBoard/index.tsx (0 matches) + git diff ComboKdsCard (0 changed lines)"
        status: pass
    human_judgment: false
  - id: D4
    description: "e2e/40-kds-bar.spec.ts still passes against the new markup"
    verification: []
    human_judgment: true
    rationale: "Deferred to phase UAT — running a headless:false Playwright session on shared port 1420 risked colliding with sibling parallel worktree agents (25-02, 25-04) also possibly running dev servers during this wave."

# Metrics
duration: 25min
completed: 2026-07-26
status: complete
---

# Phase 25 Plan 03: KDS Card Modifier Formatting Summary

**KdsCard (shared by `/kds` and `/kds-bar`) now renders one indented modifier line per name via plan 01's `formatModifierLines`, replacing the old `modifierNames.join(' / ')` string, with the widget's first unit test file.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 1/1 completed (TDD: RED → GREEN)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `KdsCard`'s modifier block now calls `formatModifierLines(item.modifierNames)` (from plan 01's `groupOrderItemsForReceipt.ts`) and renders one `<p>` per returned line inside a `data-testid="kds-item-modifiers"` wrapper `<div>`, instead of joining names with `' / '` in a single `<p>`.
- Each modifier line keeps the existing `text-sm opacity-80` typography and adds `whitespace-pre` so the formatter's leading `  + ` indent survives HTML whitespace collapsing.
- `KdsBoard`'s board layout, `ComboKdsCard`, and notes rendering are byte-for-byte unchanged — D-04's "no category clustering on the KDS surface" constraint held (zero `groupByCategory` references).
- First unit test file for `src/widgets/KdsBoard/`: `KdsCard.test.tsx`, 4 tests covering the 2-modifier split-line case, no-slash-separator, empty-modifiers (no block), and notes-unchanged.
- `KdsCard` changed from a module-private function to a named export — the smallest diff to make it directly testable with props, per the plan's explicit guidance, with zero runtime behavior change (still only used internally by `KdsBoard`'s `renderItem`).

## Task Commits

1. **Task 1 (RED): add failing test for KDS card per-line modifier rendering** - `9f7b192` (test)
2. **Task 1 (GREEN): KDS card renders one modifier line via shared formatModifierLines** - `3c33bcd` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/widgets/KdsBoard/KdsCard.test.tsx` - new: 4 RTL tests for `KdsCard`'s modifier rendering, built from a local `buildKdsItem()` fixture matching `KdsOrderItemSchema`
- `src/widgets/KdsBoard/index.tsx` - `KdsCard` exported by name; modifier block rewired from `item.modifierNames.join(' / ')` to `formatModifierLines(item.modifierNames).map(...)`; added `formatModifierLines` import from `@shared/lib/groupOrderItemsForReceipt`

## Decisions Made

- Exported `KdsCard` rather than mocking `useKdsItems`/`useKdsRealtimeBridge` to reach it through `KdsBoard` — matches the plan's own stated preference ("a named export is the smaller diff and does not change any runtime behavior").
- Followed strict RED→GREEN TDD: committed the failing test (against the pre-change `join(' / ')` behavior) before the implementation commit.

## Deviations from Plan

None - plan executed exactly as written. The `KdsCard` export was explicitly anticipated and endorsed by the plan's own `<action>` text, not an unplanned deviation.

## Issues Encountered

- **Worktree had no `node_modules` and no `.env.local`** (both gitignored, not carried into a fresh worktree checkout — same issue plan 01's summary documented). Ran `npm ci` in the worktree and copied `.env.local` from the main checkout. Neither is tracked/committed (gitignored).
- **Pre-existing typecheck errors** in `src/entities/tab/model/queries.ts:791` and `src/shared/lib/agent/rag.ts:60` — same 2 errors already logged in `.planning/phases/25-receipt-item-grouping-2-level/deferred-items.md` by plan 01. Neither file is touched by this plan; not fixed (scope boundary).
- **Flaky property test observed once**: `src/shared/lib/groupOrderItemsForReceipt.test.ts > groupByCategory properties > total conservation` failed on one `npm run test` run with a random fast-check seed, then passed cleanly on immediate re-run and on the file's own isolated run. This file belongs to plan 01 and is not in this plan's `<files>` list — out of scope to fix here, noting for visibility since it surfaced during this plan's full-suite verification pass.
- **`e2e/40-kds-bar.spec.ts` not run**: deferred to phase UAT rather than starting a second `headless: false` Playwright session (bound to shared port 1420) while sibling parallel worktree agents (25-02, 25-04) may be running their own dev servers in the same wave. The spec was inspected and contains no references to `kds-item-modifiers`, so no regression is expected, but this is unverified by an actual run.

## Next Phase Readiness

- SC-2 (KDS surface) is complete: `KdsCard` consumes the shared `formatModifierLines`, holds no local modifier-string assembly, and `groupByCategory` is deliberately absent.
- No blockers for plan 04 (this plan touches only `src/widgets/KdsBoard/`, non-overlapping with plan 04's caja-report scope).
- Phase UAT should include a manual/e2e pass of `e2e/40-kds-bar.spec.ts` to close out the one deferred verification item (D4).

---
*Phase: 25-receipt-item-grouping-2-level*
*Completed: 2026-07-26*

## Self-Check: PASSED

Both claimed files found on disk (`src/widgets/KdsBoard/KdsCard.test.tsx`, `src/widgets/KdsBoard/index.tsx`); both task commits (`9f7b192`, `3c33bcd`) verified present in `git log --oneline --all`.
