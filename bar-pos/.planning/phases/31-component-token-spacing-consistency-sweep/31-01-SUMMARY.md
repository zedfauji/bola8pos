---
phase: 31-component-token-spacing-consistency-sweep
plan: 01
subsystem: ui
tags: [react, shadcn, button, tailwind, fsd]

requires:
  - phase: 30-shared-shell-primitive-extension
    provides: shared PageContainer/SectionHeader shell primitives (unrelated but confirms shared/ui conventions used here)
provides:
  - 6 leaf-button files converted from raw `<button>` to shared/ui `Button` primitive
affects: [31-02, 31-03, 31-04, 31-05, 31-06, 31-07]

tech-stack:
  added: []
  patterns:
    - "Raw <button> -> shared/ui Button, variant chosen by role (ghost=icon/hover, outline=pill/chip, link=underlined text) with full existing className preserved verbatim via cn() merge"

key-files:
  created: []
  modified:
    - src/features/agent-chat/ui/AgentButton.tsx
    - src/features/agent-chat/ui/CommandChips.tsx
    - src/features/agent-chat/ui/FileDropZone.tsx
    - src/features/import-ingredients-csv/ui/CsvImportSheet.tsx
    - src/widgets/ManageIngredientsTab/index.tsx
    - src/widgets/PINLoginForm/PINLoginForm.tsx

key-decisions:
  - "Followed 31-UI-SPEC.md variant mapping exactly: ghost for AgentButton FAB + FileDropZone mic/send icons, outline for CommandChips pill, link for the 3 text links"
  - "Import-order violations surfaced by ESLint (case-sensitive alphabetical) in ManageIngredientsTab/index.tsx and PINLoginForm.tsx were auto-fixed via `eslint --fix` (Rule 3 - blocking lint error)"

patterns-established:
  - "Button swap preserves className verbatim; Button's own variant classes are superseded by the bespoke className via tailwind-merge in cn()"

requirements-completed: [COMPONENT-01]

duration: ~35min
completed: 2026-07-11
---

# Phase 31 Plan 01: Agent-Chat & Text-Link Button Swap Summary

**Replaced 6 raw `<button>` elements (agent-chat FAB/chip/mic/send + 3 underlined text links) with the shared/ui `Button` primitive, zero behavior change.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-11T19:54:15Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments
- `AgentButton.tsx`, `CommandChips.tsx`, `FileDropZone.tsx` (agent-chat global chrome, D-03) now render via `Button` (`variant="ghost"`/`variant="outline"`), with every `aria-label`, `className`, `disabled`, and `onClick` preserved byte-for-byte.
- `CsvImportSheet.tsx`'s "Download template", `ManageIngredientsTab/index.tsx`'s "Record adjustment", and `PINLoginForm.tsx`'s "Not you? Go back" links now render via `Button variant="link"`, with visible copy and handlers unchanged.
- Zero raw `<button>` elements remain in any of the 6 plan files (`rg '<button'` returns no matches).
- `npm run typecheck` and `npm run lint` both clean (only the 2 pre-existing, unrelated errors documented in STATE.md: `src/entities/tab/model/queries.ts:778`, `src/shared/lib/agent/rag.ts:60`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap agent-chat raw buttons to Button (D-03)** - `cfd65af` (feat)
2. **Task 2: Swap the 3 text-link raw buttons to Button variant=link** - `66c7863` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `src/features/agent-chat/ui/AgentButton.tsx` - Floating FAB, raw button -> `Button variant="ghost"`, `rounded-full` className preserved
- `src/features/agent-chat/ui/CommandChips.tsx` - Pill chips, raw button -> `Button variant="outline"`
- `src/features/agent-chat/ui/FileDropZone.tsx` - Mic toggle + send icons, raw buttons -> `Button variant="ghost" size="icon"` (x2)
- `src/features/import-ingredients-csv/ui/CsvImportSheet.tsx` - "Download template" link -> `Button variant="link"` (already imported `Button`, no new import needed)
- `src/widgets/ManageIngredientsTab/index.tsx` - "Record adjustment" link -> `Button variant="link"`, new `Button` import added
- `src/widgets/PINLoginForm/PINLoginForm.tsx` - "Not you? Go back" link -> `Button variant="link"`, new `Button` import added

## Decisions Made
- Import placement for the two new `Button` imports followed the project's case-sensitive ESLint `import/order` rule exactly as auto-fixed (uppercase-named imports sort before lowercase `@shared/ui/button` in this codebase's config) rather than guessing placement manually.
- Did not touch `POSButton` anywhere in this plan — per UI-SPEC, all 6 files are icon/chip/text-link controls, never form-CTA controls, so `Button` (not `POSButton`) was the correct target throughout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ESLint import/order violations from new `Button` imports**
- **Found during:** Task 2 verification (`npm run lint`)
- **Issue:** Adding `import { Button } from '@shared/ui/button';` to `ManageIngredientsTab/index.tsx` and `PINLoginForm.tsx` violated the project's case-sensitive alphabetical `import/order` ESLint rule (both files placed the new import out of order relative to existing `@shared/ui/*` imports)
- **Fix:** Ran `npx eslint --fix` on both files to reorder imports; no logic changed
- **Files modified:** `src/widgets/ManageIngredientsTab/index.tsx`, `src/widgets/PINLoginForm/PINLoginForm.tsx`
- **Verification:** `npm run lint` exits clean after the fix
- **Committed in:** `66c7863` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking lint fix)
**Impact on plan:** Cosmetic import-ordering fix only; no scope creep, no behavior change.

## Issues Encountered
- The worktree's `node_modules` was incomplete/corrupted at session start (missing the `typescript` package and containing a stray nested `node_modules/node_modules` duplicate-React copy that broke `vitest`'s hook resolution). Repaired by removing and rebuilding the worktree's `node_modules` via native Windows commands (not tracked by git, no impact on the plan's file changes). Confirmed `npm run typecheck`, `npm run lint`, and the 2 affected unit test files (`CsvImportSheet.test.tsx`, `PINLoginForm.test.tsx`, 14 tests) all pass after the repair.
- `.env.local` (gitignored, required by `src/test/global-setup.ts` for live-Supabase-backed unit tests) was missing from the worktree; copied from the main checkout to run the affected test files. Confirmed still gitignored (`git check-ignore` passes) and not staged.

## Next Phase Readiness
- Pattern proven for the remaining 31-02..31-07 plans in this phase (other button/input/token conformance sweeps use the same `Button`-variant-by-role approach).
- No blockers. Payment-critical files (`pos/index.tsx`, `CartPanel.tsx`, `PaymentForm.tsx`, `TabPaymentCard.tsx`) were not touched, per D-01/COMPONENT-04 boundary.

---
*Phase: 31-component-token-spacing-consistency-sweep*
*Completed: 2026-07-11*
