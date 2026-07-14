---
phase: 34-visual-regression-baseline
plan: 01
subsystem: testing
tags: [playwright, visual-regression, e2e, config-isolation, data-testid]

# Dependency graph
requires:
  - phase: 30-shared-shell-primitive-extension
    provides: PageContainer/SectionHeader shell primitives now stable across all 17 routes
  - phase: 33-payment-critical-page-sweep-isolated
    provides: touch-target/focus-visible/component conformance sweep complete on all pages, incl. KDS
provides:
  - Isolated playwright.visual.config.ts (headless, bundled Chromium, no slowMo/channel, no globalTeardown)
  - testIgnore isolation on the functional playwright.config.ts so it never picks up e2e/visual/
  - test:e2e:visual npm script
  - .gitignore entry keeping baseline PNGs local-only/untracked
  - data-testid="live-time-display" mask hook (LiveTimeDisplay, both KDS headers)
  - data-testid="kds-board" mask hook (KdsBoard root grid)
affects: [34-02 (visual baseline spec + capture)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second Playwright defineConfig() built from scratch (not imported/spread) when its `use` block diverges from the primary config on nearly every field"
    - "testIgnore regex on the primary config to fence off a test subfolder owned by a second config, preventing default recursive testMatch glob collision"

key-files:
  created:
    - playwright.visual.config.ts
  modified:
    - playwright.config.ts
    - package.json
    - .gitignore
    - src/shared/ui/LiveTimeDisplay.tsx
    - src/widgets/KdsBoard/index.tsx

key-decisions:
  - "playwright.visual.config.ts is a from-scratch defineConfig() — does not import or spread playwright.config.ts, per D-01 (fields diverge on headless/channel/slowMo/trace/video/screenshot/globalTeardown)"
  - "No globalTeardown on the visual config — the functional suite's global-teardown.ts writes a report keyed to SUITE_MAP regexes that never match e2e/visual/*"
  - "retries: 0 on the visual config — a visual diff failure must never silently pass on an automatic retry"

patterns-established:
  - "Isolated second Playwright config pattern: copy only dotenv/__dirname boilerplate + webServer block verbatim; diverge every use/project field explicitly"

requirements-completed: [VISUAL-01, VISUAL-03]

coverage:
  - id: D1
    description: "playwright.visual.config.ts exists, isolated from the functional config (headless, bundled Chromium, no slowMo/channel/globalTeardown)"
    requirement: "VISUAL-01"
    verification:
      - kind: other
        ref: "grep-based acceptance criteria: testDir './e2e/visual', headless:true, animations:'disabled', maxDiffPixelRatio present; channel/slowMo/globalTeardown/playwright.config absent"
        status: pass
    human_judgment: false
  - id: D2
    description: "Functional playwright.config.ts excludes e2e/visual/ via testIgnore; npm run test:e2e never enumerates the visual spec"
    requirement: "VISUAL-01"
    verification:
      - kind: other
        ref: "npx playwright test --list 2>&1 | grep -c 'e2e/visual/' == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "test:e2e:visual npm script and .gitignore snapshot-dir entry present"
    requirement: "VISUAL-01"
    verification:
      - kind: other
        ref: "grep test:e2e:visual package.json; grep snapshots/ .gitignore"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two mask test-hooks (live-time-display, kds-board) added attribute-only, zero className/behavior change, typecheck/lint clean beyond the 2 pre-existing baseline errors"
    requirement: "VISUAL-03"
    verification:
      - kind: other
        ref: "grep data-testid checks; npm run typecheck (2 pre-existing errors only); npx eslint on both touched files (0 errors)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-07-14
status: complete
---

# Phase 34 Plan 01: Visual Regression Harness Setup Summary

**Isolated `playwright.visual.config.ts` (headless, bundled Chromium) plus the config-collision fix and two `data-testid` mask hooks that Plan 02's baseline spec depends on.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-14T20:22:01Z
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- Created `playwright.visual.config.ts` as a from-scratch config diverging from the functional suite on every field D-01 requires (headless, bundled Chromium, no slowMo, no on-failure trace/video/screenshot, no functional-suite `globalTeardown`)
- Added `testIgnore: /visual\//` to `playwright.config.ts` so the functional suite never picks up the new `e2e/visual/` subfolder (verified via `npx playwright test --list`)
- Wired `test:e2e:visual` npm script and gitignored `e2e/visual/**/*-snapshots/` for local-only baseline PNGs
- Added `data-testid="live-time-display"` (LiveTimeDisplay root span, covers both `/kds` and `/kds-bar` headers) and `data-testid="kds-board"` (KdsBoard root grid div) — both attribute-only, zero style/behavior change

## Task Commits

Each task was committed atomically:

1. **Task 1: Create isolated visual config + isolate functional config + npm script + gitignore** - `b1325b5` (feat)
2. **Task 2: Add the two mask test-hooks (attribute-only)** - `104fe97` (feat)

_Note: no plan-metadata commit yet — this SUMMARY/STATE/ROADMAP commit follows below._

## Files Created/Modified
- `playwright.visual.config.ts` - new isolated visual-regression config (headless, bundled Chromium, testDir `./e2e/visual`, `retries: 0`, `expect.toHaveScreenshot` with `animations: 'disabled'` + `maxDiffPixelRatio: 0.01`)
- `playwright.config.ts` - added `testIgnore: /visual\//` (single line, only change)
- `package.json` - added `test:e2e:visual` script
- `.gitignore` - added `e2e/visual/**/*-snapshots/` entry
- `src/shared/ui/LiveTimeDisplay.tsx` - added `data-testid="live-time-display"` to root `<span>`
- `src/widgets/KdsBoard/index.tsx` - added `data-testid="kds-board"` to root grid `<div>`

## Decisions Made
None beyond what CONTEXT.md/RESEARCH.md already locked (D-01, D-03, D-12, Pitfalls 1/3/4) — plan executed exactly as written.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02 can now write `e2e/visual/45-visual-baseline.spec.ts` against a fully isolated, verified environment: the config exists and diverges correctly from the functional suite, the functional suite provably excludes `e2e/visual/` (0 matches in `--list` output), and both mask hooks (`live-time-display`, `kds-board`) exist for the KDS-page/board masking Plan 02's spec needs (Pitfalls 3 & 4). No blockers.

---
*Phase: 34-visual-regression-baseline*
*Completed: 2026-07-14*

## Self-Check: PASSED

All created/modified files confirmed on disk (`playwright.visual.config.ts`, `LiveTimeDisplay.tsx`, `KdsBoard/index.tsx`); both task commits (`b1325b5`, `104fe97`) confirmed in `git log`.
