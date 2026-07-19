---
phase: 21-i18n-multi-language
plan: 12
subsystem: i18n
tags: [i18next, react-i18next, eslint-plugin-i18next, eslint-config, ci-gate]

requires:
  - phase: 21-i18n-multi-language
    provides: "21-06..21-11 — all five FSD layers (shared/ui, features, widgets, entities, pages) swept string-clean under the standalone eslint.i18n.config.js gate"
provides:
  - "eslint.config.js — committed, strict, no-grandfather i18next/no-literal-string:error block scoped to shared/ui + entities + features + widgets + pages (D-05)"
  - "npm run lint exits 0 repo-wide with the rule active — definitive proof of SC-4 (all existing strings migrated)"
  - "SC-3 smoke evidence: a deliberate hardcoded JSX string fails npm run lint, removal restores green"
affects: ["Phase 22+ inherits the committed rule automatically — any new hardcoded UI string in the 5 scoped layers now fails CI"]

tech-stack:
  added: []
  patterns:
    - "The committed eslint.config.js i18next block is copied verbatim from the now-deleted eslint.i18n.config.js (same file-scoping shape as the existing tailwindcss block) and deliberately omits 'no-restricted-syntax' to avoid the flat-config REPLACE gotcha already documented on that block"

key-files:
  created: []
  modified:
    - eslint.config.js
    - eslint.i18n.config.js (deleted)
    - package.json
    - src/shared/lib/i18n/index.ts

key-decisions:
  - "No stragglers found in Task 2 — npm run lint was already exit 0 repo-wide the moment the rule was committed in Task 1, confirming 21-06..21-11's sweeps left zero gaps; no source-file migrations were needed in this plan"
  - "SC-3 smoke test's first attempt (a hardcoded ALL_CAPS_WITH_UNDERSCORES literal) was a false negative — it matched the rule's own `words.exclude: ['^[A-Z_]{2,}$', ...]` pattern (meant for constant-like identifiers, not JSX text). Re-ran with a normal-case sentence, which correctly failed lint, confirming the rule fires on real UI copy rather than technical-looking strings"

requirements-completed: [SC-3, SC-4]

coverage:
  - id: D1
    description: "i18next/no-literal-string:error committed to eslint.config.js, scoped to the 5 FSD layers, mode:'all', no grandfather list"
    requirement: SC-3
    verification:
      - kind: other
        ref: "node -e \"import('./eslint.config.js')...\" — config loads without error"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm run lint exits 0 repo-wide with the rule active — proves the big-bang migration is complete"
    requirement: SC-4
    verification:
      - kind: other
        ref: "npm run lint"
        status: pass
      - kind: other
        ref: "npm run typecheck (2 pre-existing, documented-unrelated errors only)"
        status: pass
      - kind: unit
        ref: "npm run test (140 files / 1248 tests, 15 todo, 2 skipped)"
        status: pass
  - id: D3
    description: "SC-3 smoke: a hardcoded UI string fails lint; removal restores green"
    requirement: SC-3
    verification:
      - kind: manual
        ref: "npx eslint src/pages/home/index.tsx with a temporary <div>Delete me hardcoded string</div> — errored with i18next/no-literal-string; removed, re-ran, exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Standalone eslint.i18n.config.js + lint:i18n script removed — single source of enforcement is now the committed npm run lint gate"
    requirement: SC-3
    verification:
      - kind: other
        ref: "test ! -f eslint.i18n.config.js && node -e \"...p.scripts['lint:i18n']...\""
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-07-19
status: complete
---

# Phase 21 Plan 12: Commit Strict i18n Lint Gate Repo-Wide Summary

**Folded the reviewed `i18next/no-literal-string:error` block into the committed `eslint.config.js` (D-05), proved `npm run lint` is green repo-wide with zero stragglers, verified the SC-3 smoke (hardcoded string fails, removal passes), then deleted the standalone `eslint.i18n.config.js` helper and its `lint:i18n` script now that enforcement lives entirely in the main CI gate.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-19
- **Tasks:** 3/3
- **Files modified:** `eslint.config.js`, `package.json`, `src/shared/lib/i18n/index.ts`; `eslint.i18n.config.js` deleted

## Accomplishments

- Copied the reviewed 5-layer-scoped `i18next/no-literal-string: ['error', { mode: 'all', ... }]` block (jsx-attributes/callees/object-properties/words excludes) verbatim from `eslint.i18n.config.js` into `eslint.config.js`, mirroring the existing tailwindcss block's file-scoping shape and deliberately omitting `no-restricted-syntax` to avoid the flat-config REPLACE gotcha already documented there.
- Ran the full-repo `npm run lint` gate with the rule active: exit 0, zero `i18next/no-literal-string` violations across all 5 scoped layers — no stragglers, confirming plans 21-06 through 21-11's sweeps were complete. No source files needed migration in this plan.
- `npm run typecheck` and `npm run test` re-confirmed green (140 files / 1248 tests, 15 todo, 2 skipped; only the 2 pre-existing, already-documented `tab/model/queries.ts` + `agent/rag.ts` typecheck errors remain, both predate this plan).
- Ran the SC-3 smoke test on `src/pages/home/index.tsx`: added a temporary hardcoded `<div>Delete me hardcoded string</div>`, confirmed `npm run lint` failed with an `i18next/no-literal-string` error on that exact line, removed it, confirmed lint passed again with a clean `git diff --stat` on the file.
- Deleted `eslint.i18n.config.js` and removed the `"lint:i18n"` script from `package.json`. Left `eslint-plugin-i18next` in `devDependencies` (the committed config now uses it). Updated a stale comment in `src/shared/lib/i18n/index.ts` that referenced the now-removed `lint:i18n` script.

## Task Commits

1. **Task 1: Commit the i18next block into eslint.config.js** - `802ab15` (feat)
2. **Task 2: Full-repo lint gate — prove the migration is complete** - no commit (verification-only; zero stragglers found, no file changes needed)
3. **Task 3: SC-3 smoke + remove the standalone helper config & script** - `e9a7069` (feat)

## Files Created/Modified

- `eslint.config.js` — added `i18next/no-literal-string:error` block (5-layer scoped, mode:'all', no grandfather list); updated the `i18next` plugin-registration comment now that the rule is actually enabled
- `package.json` — removed the `"lint:i18n"` script
- `eslint.i18n.config.js` — deleted (superseded by the committed gate)
- `src/shared/lib/i18n/index.ts` — updated a comment referencing the removed `lint:i18n` script to instead reference the committed `eslint.config.js` rule

## Decisions Made

- No exclude-list additions were needed in Task 2 — the excludes copied verbatim from `eslint.i18n.config.js` in Task 1 already covered every real pattern across the whole repo; `npm run lint` was exit 0 immediately after committing the rule, with zero real or false-positive violations to reconcile.
- The SC-3 smoke test's first attempt used `DELETE_ME_HARDCODED` (all-caps with underscores), which was a false negative — it matched the rule's own `words.exclude: ['^[A-Z_]{2,}$', ...]` pattern (intended to exclude constant-like/enum identifiers appearing in code, not JSX render text). Re-ran with `Delete me hardcoded string` (normal sentence case), which correctly failed lint — this confirms the rule targets genuine UI copy and the exclude pattern is working as designed, not that the rule is broken.

## Deviations from Plan

None beyond the one auto-fixed comment update below — plan executed exactly as written otherwise.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale comment in `src/shared/lib/i18n/index.ts` referencing the removed `lint:i18n` script**
- **Found during:** Task 3, sweeping the repo for remaining references to `lint:i18n`/`eslint.i18n.config.js` after deletion
- **Issue:** A comment explaining the intentional lack of `declare module 'i18next'` t()-key type augmentation said "the runtime + lint:i18n rule enforce correctness instead" — inaccurate after this plan removes the `lint:i18n` script
- **Fix:** Reworded to reference the committed `eslint.config.js` rule instead
- **Files modified:** `src/shared/lib/i18n/index.ts`
- **Commit:** `e9a7069`

None of the above required user input — auto-fixed per Rule 1 and documented here per the deviation-tracking contract.

## Known Stubs

None.

## Threat Flags

None — this plan only moves an already-reviewed lint rule from one config file to another and deletes a helper; no new network endpoints, auth paths, file access, or schema changes.

## Issues Encountered

- The 2 pre-existing typecheck errors documented in 21-11-SUMMARY.md (`src/entities/tab/model/queries.ts(788,11)`, `src/shared/lib/agent/rag.ts(60,7)`) remain unchanged and out of scope for this i18n phase, confirmed unrelated to this plan's changes.

## Next Steps

- Phase 21's i18n multi-language migration is now fully gated: any new hardcoded UI string in `src/shared/ui`, `src/entities`, `src/features`, `src/widgets`, or `src/pages` will fail `npm run lint` going forward (SC-3), and the big-bang migration itself is proven complete by the green repo-wide gate (SC-4). Phase 22+ inherits this enforcement automatically with no further action needed.

## Self-Check

- [x] `eslint.config.js` contains `i18next/no-literal-string` — FOUND
- [x] `eslint.i18n.config.js` no longer exists — CONFIRMED
- [x] `package.json` has no `lint:i18n` script — CONFIRMED
- [x] Commit `802ab15` exists — FOUND
- [x] Commit `e9a7069` exists — FOUND
