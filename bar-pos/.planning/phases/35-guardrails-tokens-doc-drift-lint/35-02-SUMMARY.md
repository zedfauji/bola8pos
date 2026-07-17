---
phase: 35-guardrails-tokens-doc-drift-lint
plan: 02
subsystem: ui
tags: [eslint, tailwindcss, react, fsd, lint]

# Dependency graph
requires:
  - phase: 35-guardrails-tokens-doc-drift-lint
    provides: "35-01's design-tokens generator + docs:tokens script"
provides:
  - "PromotionAvailabilityEditor.tsx's day-toggle now renders the shared Button component (raw-button category fully conformant, D-16)"
  - "eslint-plugin-tailwindcss@3.18.3 staged as an exact-pinned devDependency, ready for plan 35-03 to wire into eslint.config.js"
affects: [35-guardrails-tokens-doc-drift-lint-03]

# Tech tracking
tech-stack:
  added: ["eslint-plugin-tailwindcss@3.18.3 (exact pin, devDependency, not yet wired into eslint.config.js)"]
  patterns: []

key-files:
  created:
    - .planning/phases/35-guardrails-tokens-doc-drift-lint/deferred-items.md
  modified:
    - src/features/manage-promotions/ui/PromotionAvailabilityEditor.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "npm wrote a caret range (^3.18.3) for the install; edited package.json to the exact string 3.18.3 and re-ran npm install to sync package-lock.json, per the plan's explicit exact-pin requirement"
  - "Package-legitimacy checkpoint (SUS-flagged due to inspecting the 4.x latest tag) approved by user after confirming the pinned 3.18.3 line is a 3-month-old, ~1.44M-weekly-download release from the real francoismassart repo"

patterns-established: []

requirements-completed: [LINT-01]

coverage:
  - id: D1
    description: "PromotionAvailabilityEditor.tsx's day-of-week toggle swapped from a native button element to the shared Button component (variant=outline), mirroring the already-fixed ComboAvailabilityEditor sibling"
    requirement: "LINT-01"
    verification:
      - kind: unit
        ref: "npm run typecheck (exit 0) + npm run lint (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "eslint-plugin-tailwindcss installed as an exact-pinned (3.18.3, not ^ or latest) devDependency, unwired, ready for plan 35-03"
    requirement: "LINT-01"
    verification:
      - kind: unit
        ref: "node -e check of package.json devDependencies['eslint-plugin-tailwindcss'] === '3.18.3' + require.resolve('eslint-plugin-tailwindcss') (both pass)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-07-17
status: complete
---

# Phase 35 Plan 2: Raw-Button Cleanup + eslint-plugin-tailwindcss Staging Summary

**Removed the last live undocumented raw button (PromotionAvailabilityEditor day-toggle) and staged eslint-plugin-tailwindcss@3.18.3 as an exact-pinned devDependency behind an approved package-legitimacy checkpoint.**

## Performance

- **Duration:** ~10 min (Task 2 continuation; Task 1 executed in a prior session)
- **Completed:** 2026-07-17
- **Tasks:** 2 (1 auto + 1 blocking-human checkpoint, both complete)
- **Files modified:** 3 (PromotionAvailabilityEditor.tsx, package.json, package-lock.json)

## Accomplishments
- PromotionAvailabilityEditor.tsx's day-of-week toggle now renders the shared `Button` (`variant="outline"`), removing the last previously-undocumented raw button in the pages/widgets/features zone (D-16)
- `eslint-plugin-tailwindcss@3.18.3` installed and exact-pinned in `package.json` devDependencies — package-legitimacy checkpoint (SUS-flagged on the unrelated 4.x latest tag) explicitly approved by the user before install
- `eslint.config.js` deliberately left untouched — wiring is scoped to plan 35-03

## Task Commits

1. **Task 1: Fix the undocumented raw day-toggle button in PromotionAvailabilityEditor (D-16)** - `0c6cc93` (fix)
2. **Checkpoint: Package legitimacy gate for eslint-plugin-tailwindcss@3.18.3** - approved by user, no code change (gate only)
3. **Task 2: Install eslint-plugin-tailwindcss@3.18.3 (exact pin)** - `94df922` (chore)

_Note: no plan-metadata commit hash yet — issued separately after this SUMMARY is written._

## Files Created/Modified
- `src/features/manage-promotions/ui/PromotionAvailabilityEditor.tsx` - day-toggle chip now uses shared `Button` component instead of a raw `<button>`
- `package.json` - `eslint-plugin-tailwindcss` added to devDependencies, pinned to exact `3.18.3`
- `package-lock.json` - lockfile updated to match the exact pin
- `.planning/phases/35-guardrails-tokens-doc-drift-lint/deferred-items.md` - logs 2 pre-existing, out-of-scope `npm run typecheck` failures found while verifying Task 2 (unrelated files, not touched by this plan)

## Decisions Made
- npm's default install wrote a caret range; corrected to the plan-mandated exact pin (`3.18.3`) by editing package.json directly and re-running `npm install` to regenerate the lockfile consistently
- Confirmed via package-lock.json diff that only `eslint-plugin-tailwindcss` and its own transitive deps were added — no `typescript`/`@types/*` version drift, ruling out this install as the cause of the 2 pre-existing typecheck errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm wrote a caret range instead of the mandated exact pin**
- **Found during:** Task 2 (installing eslint-plugin-tailwindcss)
- **Issue:** `npm install -D eslint-plugin-tailwindcss@3.18.3` recorded `"^3.18.3"` in package.json by default; the plan requires an exact pin (no caret/range) since the 4.x line requires Tailwind v4 and would break this Tailwind-v3 repo
- **Fix:** Edited package.json to the exact string `"3.18.3"`, then re-ran `npm install` to regenerate package-lock.json against the corrected pin
- **Files modified:** package.json, package-lock.json
- **Verification:** `node -e` check confirms `devDependencies['eslint-plugin-tailwindcss'] === '3.18.3'`; `require.resolve('eslint-plugin-tailwindcss')` succeeds
- **Committed in:** `94df922` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — pin correction, explicitly anticipated by the plan's own acceptance criteria)
**Impact on plan:** No scope creep — the plan itself flagged the caret-vs-exact-pin risk and specified this exact correction.

## Issues Encountered
- `npm run typecheck` surfaces 2 pre-existing errors (`src/entities/tab/model/queries.ts:780`, `src/shared/lib/agent/rag.ts:60`) unrelated to this plan — both files last modified at commits `a435f7f` and `45e2c0b` respectively, well before Phase 35, and the package-lock.json diff for this install touches only the new plugin's own dependency tree. Logged to `deferred-items.md`, not fixed (out of scope per the executor's scope-boundary rule). `npm run lint` (the plan's actual verify gate) exits 0 with no regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 35-03 is unblocked: the pages/widgets/features zone is now fully conformant on the raw-button category, and `eslint-plugin-tailwindcss@3.18.3` is installed and ready to be wired into `eslint.config.js`
- The 2 pre-existing typecheck errors remain open (tracked in deferred-items.md across multiple phases) — not a blocker for 35-03

---
*Phase: 35-guardrails-tokens-doc-drift-lint*
*Completed: 2026-07-17*

## Self-Check: PASSED
- FOUND: src/features/manage-promotions/ui/PromotionAvailabilityEditor.tsx
- FOUND: .planning/phases/35-guardrails-tokens-doc-drift-lint/deferred-items.md
- FOUND: .planning/phases/35-guardrails-tokens-doc-drift-lint/35-02-SUMMARY.md
- FOUND commit: 0c6cc93
- FOUND commit: 94df922
