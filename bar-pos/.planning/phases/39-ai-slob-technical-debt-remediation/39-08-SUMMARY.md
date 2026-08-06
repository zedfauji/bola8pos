---
phase: 39-ai-slob-technical-debt-remediation
plan: 08
subsystem: technical-debt-remediation
tags: [knip, dead-code, fsd-barrels, architecture-decision, deletion-sweep]

requires:
  - phase: 39-03
    provides: "10 confirmed-dead file deletions, and the RappiOrderBadge.tsx/index.ts barrel-pair deferral (T-39-12) this plan resolves"
provides:
  - "One human decision (hybrid/Option C) resolving all 445 FSD barrel findings uniformly instead of 445 individual calls"
  - "12 whole-dead FSD barrels deleted (sanity-checked), including the RappiOrderBadge pair deferred from 39-03"
  - "293 of 433 barrel re-export lines pruned (underlying declaration also independently dead); 140 kept (underlying still live)"
  - "Fresh post-decision knip baseline + three explicit working sets for plans 39-09, 39-10, 39-11"
affects: ["39-09", "39-10", "39-11"]

actuals:
  tokens: 18434
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Hybrid barrel-pruning rule: for each flagged re-export, resolve its `from` specifier (relative or @alias) to the underlying file and check whether that file independently flags the same symbol name as dead; prune only when both are dead"
    - "Pruning a dead re-export can promote its underlying file from 'N unused exports, still reachable' to a whole-file-dead finding once nothing reaches it via any path — a real, expected knip reclassification, not a bug"

key-files:
  created:
    - ".planning/phases/39-ai-slob-technical-debt-remediation/39-08-LEDGER.md"
  modified:
    - "38 FSD barrel `index.ts`/`index.tsx` files across src/entities, src/features, src/widgets (293 re-export lines pruned)"
  deleted:
    - "src/entities/combo/model/index.ts"
    - "src/entities/promotion/model/index.ts"
    - "src/features/add-item-to-tab/model/index.ts"
    - "src/features/add-item-to-tab/ui/index.ts"
    - "src/features/open-tab/index.ts"
    - "src/features/open-tab/ui/index.ts"
    - "src/features/print-precheque/index.ts"
    - "src/features/remove-item-from-tab/index.ts"
    - "src/features/remove-tab-item/index.ts"
    - "src/features/stop-and-move-table/index.ts"
    - "src/shared/lib/index.ts"
    - "src/widgets/RappiOrderBadge/index.ts"
    - "src/widgets/RappiOrderBadge/RappiOrderBadge.tsx"

key-decisions:
  - "Hybrid (Option C) selected by human at the checkpoint: delete the 12 whole-dead barrels; prune a re-export only where the underlying declaration is also independently dead; keep live re-exports even if reached only via deep-path; no knip.json changes"
  - "Measured import ratio (252 barrel-style vs 241 deep-path, 0.96:1) contradicted the plan's planning-time assumption that deep-path imports dominate — the barrel convention has not eroded, it's followed almost as often as bypassed"

patterns-established:
  - "Barrel-pruning cross-file liveness check: never delete a re-export based on the barrel's own finding alone — always resolve to the underlying declaration and check its independent liveness first"

requirements-completed: [D-01, D-07]

coverage:
  - id: D1
    description: "Barrel inventory built and import ratio measured with fresh evidence (Task 1)"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "test -f 39-08-LEDGER.md && grep -qiE 'barrel|index\\.ts' 39-08-LEDGER.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hybrid decision applied uniformly across all 64 barrels: 12 whole-dead deleted, 293/433 re-exports pruned, 140 kept"
    requirement: "D-07"
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint && npm run test"
        status: pass
    human_judgment: false
  - id: D3
    description: "Post-decision knip baseline republished with three explicit working sets for 39-09/10/11"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "npx knip --reporter json + --production --reporter json, distinct export/type count 918->603"
        status: pass
    human_judgment: false

duration: "~15 min active execution (plus a mid-plan human decision pause)"
completed: "2026-08-06"
status: complete
---

# Phase 39 Plan 08: FSD Barrel Decision Summary

**One recorded decision (hybrid/Option C) resolved all 445 FSD barrel findings: 12 whole-dead barrels deleted, 293 of 433 re-exports pruned where genuinely unreachable, 140 kept where still live via deep-path — republishing a fresh knip baseline that drops the distinct export/type count from 918 to 603 and hands plans 39-09/10/11 three explicit working sets to execute against.**

## Performance

- **Duration:** ~15 min active execution (commits span 13:21–15:33 local time, including a mid-plan pause for the human decision checkpoint)
- **Tasks:** 3 (Task 1 inventory, Task 2 apply-decision, Task 3 republish-baseline), plus one `checkpoint:decision` between Tasks 1 and 2
- **Files changed:** 52 (1 doc created, 38 modified, 13 deleted)

## Accomplishments

- Re-derived the 433-barrel-finding / 485-non-barrel-finding split fresh from a regenerated knip run — matched 39-RESEARCH.md's planning-time figures exactly (no drift).
- Measured the actual barrel-style vs. deep-path import ratio across `src/` (252 vs. 241, 0.96:1) — a genuinely new finding that **contradicts** the plan's planning-time assumption that deep-path imports dominate. The barrel convention has not eroded; it's followed almost exactly as often as bypassed.
- Human selected **hybrid (Option C)** at the decision checkpoint: delete only the 12 barrels nothing imports at all; prune a re-export only where its underlying declaration is *also* independently dead; keep everything still reachable via deep-path; no `knip.json` changes.
- Applied the decision uniformly across all 64 barrels: every one of the 12 whole-dead barrels individually sanity-checked with a repo-wide search before deletion (including `RappiOrderBadge.tsx` + its barrel, resolved together in one commit, closing out 39-03's T-39-12 deferral); 293 of 433 re-export lines pruned via a cross-file liveness check that resolves each re-export's `from` specifier (relative or `@entities`/`@features`/`@widgets`/`@shared` alias) and verifies the underlying declaration is *also* flagged dead before pruning.
- `npm run typecheck && npm run lint && npm run test` all green after the full change — 1391 passed, 15 todo, exact match to the pre-existing baseline, zero regression; `eslint-plugin-boundaries` reported no import-direction breakage.
- Republished the knip baseline: distinct export/type findings dropped 918 → 603 (−315); the full 39-01-style baseline (files+exports+types+dups) dropped 971 → 649 (−322), a 33% reduction phase-to-date from the original 982.
- Documented a real, expected byproduct: pruning re-exports promoted 6 files from "N unused exports, still reachable" to whole-file-dead once nothing reached them via any path at all — a simplification for the downstream plans that own them, not new dead code.
- Published three explicit, exhaustively-accounted-for working sets: 39-09 (`domain.ts` + `edge-function-contracts.ts`, 196 findings), 39-10 (`src/entities/` non-barrel, 148 findings + 7 whole-file candidates), 39-11 (`src/shared/`+`src/features/` non-barrel, 117 findings + 8 whole-file candidates) — coverage-checked against the full 463 non-barrel total.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the barrel inventory and measure import ratio** — `c8b2265` (docs)
2. **Task 2: Apply the hybrid decision uniformly** — `9e49f95` (feat)
3. **Task 3: Republish the knip baseline for 39-09/10/11** — `4017ccb` (docs)

_Checkpoint:decision (Task 2's gate) was resolved by the coordinator/human selecting `hybrid` between Task 1 and Task 2; no separate commit for the decision itself, recorded in the ledger._

## Files Created/Modified

- `.planning/phases/39-ai-slob-technical-debt-remediation/39-08-LEDGER.md` — the decision, its measured evidence base, the full per-barrel outcome table, and the post-decision baseline + working sets
- 38 FSD barrel `index.ts`/`index.tsx` files across `src/entities/`, `src/features/`, `src/widgets/` — 293 dead re-export lines removed, structure otherwise unchanged
- 13 files deleted: the 12 whole-dead barrels named in this plan's frontmatter, plus `src/widgets/RappiOrderBadge/RappiOrderBadge.tsx` (deleted alongside its barrel in the same commit)

## Decisions Made

- **Hybrid (Option C)**, selected by the coordinator/human at the Task 2 checkpoint after reviewing Task 1's measured evidence (see checkpoint details in the ledger and this session's transcript). Rationale given: delete only what's unambiguously dead at every level of the re-export chain; preserve the FSD public-API contract for anything still reachable, even by deep-path; avoid a `knip.json` config change.
- Barrel re-export liveness determined by resolving each finding's actual `from` specifier (not assumed from the barrel's own flag) and checking the underlying file's own independent knip status — this correctly distinguished, e.g., `entities/settings/index.ts`'s dead `BillingSettings` re-export (underlying `model/types.ts` declaration also dead) from `entities/settings/model/index.ts`'s live `BillingSettings` re-export (same symbol name, but reachable there via a deep-path import that bypasses only the *outer* barrel) — same-named symbol, correctly different disposition at each barrel level.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — corrected a measurement bug before it reached the decision] Raw grep over-counted barrel-style imports by including JSDoc example code**

- **Found during:** Task 1
- **Issue:** The initial `grep -rhoE "from ['\"]@(entities|features|widgets)/..."` count (272 barrel-style / 245 deep-path) included false matches from barrel-file JSDoc headers documenting their own public API with a literal usage example (e.g. `` * Import from here: `import { useCategories } from '@entities/category'` `` inside a comment, not real code).
- **Fix:** Stripped block/line comments before matching and restricted the regex to actual `import`/`export ... from` statement syntax, giving a corrected 252/241 split before this fed the checkpoint's decision context.
- **Files affected:** None (analysis-only, no source files touched by this fix)
- **Verification:** Cross-checked the corrected count against a second independent grep pass; confirmed the only deltas were the 20 barrel-style + 4 deep-path JSDoc comment matches, all inside barrel-file header comments
- **Committed in:** `c8b2265` (Task 1 commit — the corrected numbers, with the correction documented, are what's in the ledger)

**2. [Rule 1 — resolver bugs found and fixed during the per-barrel liveness analysis] Three parser edge cases in the re-export-to-underlying-declaration resolver**

- **Found during:** Task 2 (building the cross-file liveness check before applying prunes)
- **Issue:** The initial resolver missed 5 of 433 findings: (a) mixed `export { a, type B, c } from '...'` statements where `type` prefixes individual names inline rather than the whole statement (`SettingsSnapshot` in two `entities/settings` barrels); (b) `@entities`/`@features`/`@widgets`/`@shared` tsconfig path aliases were not resolved, only relative `./` paths (`TipDistributionEntry` in `entities/caja/index.ts`, imported from `@shared/lib/domain`); (c) an indirect re-export pattern (`import type { X } from './y'` followed by a separate `export type { X };` with no `from` clause) in `widgets/PaymentModal/index.tsx`.
- **Fix:** Added inline-`type`-prefix stripping, alias-to-`src/*` path resolution matching `tsconfig.json`'s `paths` map, and import-then-plain-export tracking. The 6th case (`KdsCard` in `widgets/KdsBoard/index.tsx`) was not a resolver bug — it's a *locally declared* component in the barrel file itself, not a re-export at all (same shape as 39-03-adjudicated `close-tab/index.ts`/`TabDetail.tsx`); confirmed via direct grep it's a production-mode-only false positive exercised by `KdsCard.test.tsx`, and left un-pruned by design.
- **Files affected:** None (analysis-only)
- **Verification:** Re-ran the resolver after each fix; final pass resolved all 433 findings (432 to a definitive PRUNE/KEEP disposition via cross-file check, 1 — `KdsCard` — manually classified KEEP as a non-re-export)
- **Committed in:** `9e49f95` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — analysis-tooling correctness, not source-code behavior changes). **Impact on plan:** Both fixes were necessary to get an accurate barrel finding count and a correct prune/keep disposition per finding before any file was touched; neither changed the plan's scope or introduced anything beyond what Task 1/Task 2 already required. No scope creep.

## Issues Encountered

None beyond the two auto-fixed analysis-tooling issues above. `npm run typecheck && npm run lint && npm run test` passed cleanly on the first attempt after applying all 305 file changes (12 deletions + 1 pair-deletion + 38 partial edits), with zero iteration needed to reach green.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plans 39-09, 39-10, and 39-11 have exact, exhaustively-accounted-for working sets in `39-08-LEDGER.md` (196 / 148+7 / 117+8 findings respectively) computed from this plan's post-decision knip reports — they must use these, not 39-RESEARCH.md's pre-decision figures, per this plan's own instruction.
- The 6 newly-surfaced whole-file-dead candidates (5 for 39-10, 1 for 39-11) still need the standard repo-wide sanity check before deletion — they are candidates, not pre-cleared, exactly like every other whole-file finding in this phase.
- `src/entities/tab/ui/PoolChargeItem.tsx` and `TabDetail.tsx` remain in 39-10's whole-file list only because they still appear in the raw knip report; both are already adjudicated FALSE POSITIVE in 39-03-LEDGER.md (reachable via test/story) — 39-10 should carry that disposition forward rather than re-litigating it.
- No blockers for downstream plans.

## Self-Check

- FOUND: `.planning/phases/39-ai-slob-technical-debt-remediation/39-08-LEDGER.md`
- FOUND: `.planning/phases/39-ai-slob-technical-debt-remediation/39-08-SUMMARY.md`
- CONFIRMED DELETED: `src/features/open-tab/index.ts` (and the other 11 whole-dead barrels, spot-checked)
- CONFIRMED DELETED: `src/widgets/RappiOrderBadge/RappiOrderBadge.tsx`
- FOUND: commit `c8b2265` (Task 1)
- FOUND: commit `9e49f95` (Task 2)
- FOUND: commit `4017ccb` (Task 3)

## Self-Check: PASSED

---
*Phase: 39-ai-slob-technical-debt-remediation*
*Completed: 2026-08-06*
