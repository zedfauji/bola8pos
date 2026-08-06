---
phase: 39-ai-slob-technical-debt-remediation
plan: 09
subsystem: technical-debt-remediation
tags: [knip, dead-code, zod, domain-types, edge-functions, supabase]

requires:
  - phase: 39-08
    provides: "Post-decision knip baseline and the exact 196-finding working set for domain.ts/edge-function-contracts.ts (155 + 41)"
provides:
  - "Per-export disposition of all 196 flagged domain.ts / edge-function-contracts.ts findings, with search evidence, hit count, and pairing classification for each"
  - "21 dead declarations deleted (2 domain.ts type aliases, 19 edge-function-contracts.ts symbols) with zero schema/type pair broken and zero deployed-endpoint contract touched"
  - "Discovery and removal of a vestigial 12-symbol close-shift/generate-report contract cluster describing edge functions that never existed in this repo, superseded by close_caja_session RPC and the Phase 24 report RPCs"
  - "Two duplicate-export pairs (ModifierGroupItemSchema/CreateSchema, ProductModifierGroupSchema/CreateSchema) investigated and deferred with a recorded reason, not corrected"
  - "Registry-scoped knip delta 196 -> 175; full-repo delta 652 -> 631"
affects: []

actuals:
  tokens: 19884
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Task-2-specific edge-function-contract liveness gate: cross-reference every EDGE_FUNCTIONS registry key against ls supabase/functions/ before trusting a nonzero self-referential hit count as evidence of liveness — every contract family in this file shows the same internal-only hit pattern (own type alias + own .parse() call + own registry entry) whether or not the underlying function is deployed, so directory existence, not hit count, is the discriminator for this file"
    - "Schema/type pair deletion rule confirmed at scale: only the type-alias half (export type X = z.infer<typeof XSchema>) is ever a safe standalone deletion when zero-hit; the schema half staying zero-hit alongside its type never occurred across 196 findings in this codebase"

key-files:
  created:
    - ".planning/phases/39-ai-slob-technical-debt-remediation/39-09-LEDGER.md"
  modified:
    - "src/shared/lib/domain.ts"
    - "src/shared/lib/edge-function-contracts.ts"

key-decisions:
  - "Deleted the close-shift/generate-report contract cluster (12 symbols + 2 EDGE_FUNCTIONS registry entries) despite nonzero grep hit counts, because those hits were purely self-referential within the file's own dead registry entry — the plan's Task 2 gate (directory existence under supabase/functions/, confirmed absent via git log --all showing the directories never existed) is the correct discriminator here, not raw hit count, since every other contract family in the file shows the identical internal-only reference pattern regardless of whether it's actually deployed"
  - "Kept both duplicate-export pairs (ModifierGroupItemSchema/CreateSchema, ProductModifierGroupSchema/CreateSchema) rather than consolidating — both names in each pair are independently referenced by live consumers (tests use the base schema directly, the domain registry object uses the Create alias), and the Create alias equaling its base schema is a deliberate naming-convention completeness case (these join-table rows have no id/createdAt field to omit), not a copy-paste defect"

patterns-established:
  - "Directory-existence gate for edge-function contract liveness: for a Supabase edge-function contracts file, `ls supabase/functions/` cross-referenced against every request/response schema's target function name is a stronger liveness signal than repo-wide grep hit count, because self-referential in-file wiring (a registry object mapping every contract) produces the same nonzero hit count whether or not the target function is actually deployed"

requirements-completed: [D-01, D-07]

coverage:
  - id: D1
    description: "Every domain.ts finding (155) individually dispositioned with a repository-wide search, hit count, and schema/type pairing classification; 2 dead type aliases deleted, 153 kept as false positives, 2 duplicate-export pairs deferred with reason"
    requirement: "D-07"
    verification:
      - kind: other
        ref: "test -f 39-09-LEDGER.md && grep -c 'domain.ts' 39-09-LEDGER.md"
        status: pass
      - kind: unit
        ref: "npm run typecheck && npm run test (domain.test.ts and all Zod-dependent suites pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every edge-function-contracts.ts finding (41) individually dispositioned; 7 standalone type aliases deleted, 22 kept as false positives with a confirmed-existing supabase/functions/ directory or genuine external use"
    requirement: "D-07"
    verification:
      - kind: unit
        ref: "npm run typecheck && npm run test (edge-function-contracts.test.ts passes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Discovered and deleted the close-shift/generate-report contract cluster (12 symbols + 2 registry entries) — a larger, non-mechanical deletion beyond the plan's typical single-line-type-alias scope, justified by three independent evidence lines (zero external callers, no git history of the directory ever existing, superseded by a documented different architecture)"
    requirement: "D-07"
    verification:
      - kind: other
        ref: "git log --oneline --all -- supabase/functions/close-shift supabase/functions/generate-report (zero results); grep -rn callCloseShift|callGenerateReport src/ e2e/ scripts/ excluding edge-function-contracts.ts (zero results)"
        status: pass
    human_judgment: true
    rationale: "This deletion goes beyond the plan's typical scope (a single flagged export/type line) to a coherent 12-symbol subsystem removal, justified by inference (never deployed + never called + superseded architecture) rather than a single deterministic signal. The evidence is strong and independently corroborated three ways, but a human sanity-check that no external system (e.g. a scheduled job, a different client, or a not-yet-merged branch) still expects a close-shift/generate-report edge function is prudent before this ships."
  - id: D4
    description: "Registry-scoped knip delta re-measured and recorded: 196 -> 175 findings (-21), full-repo delta 652 -> 631, with the residual 175 findings each attributable to a recorded false-positive or deferral decision"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "npx knip --reporter json + --production --reporter json, registry-scoped export/type union count 196->175"
        status: pass
    human_judgment: false

duration: "~50 min active execution"
completed: "2026-08-06"
status: complete
---

# Phase 39 Plan 09: Registry File Review (domain.ts / edge-function-contracts.ts) Summary

**Per-export review of all 196 flagged findings across the phase's two highest-false-positive-risk registry files deleted 21 genuinely dead declarations (2 orphaned type aliases in domain.ts, 19 in edge-function-contracts.ts) while surfacing and removing a vestigial 12-symbol close-shift/generate-report edge-function contract cluster that described functions never deployed in this repo, superseded by the close_caja_session RPC and the Phase 24 report RPCs.**

## Performance

- **Duration:** ~50 min active execution
- **Tasks:** 3 (Task 1 domain.ts review, Task 2 edge-function-contracts.ts review, Task 3 delta re-measurement)
- **Files modified:** 2 source files + 1 new ledger

## Accomplishments

- Reproduced 39-08's published 196-finding working set exactly (155 `domain.ts` + 41 `edge-function-contracts.ts`) via a fresh knip regeneration, confirming no drift.
- Ran a repository-wide bare-identifier search (not import-graph reachability) for every one of the 196 flagged names across `src/`, `supabase/functions/`, `e2e/`, and `scripts/`, classifying each by schema/type pairing before any deletion decision.
- `domain.ts`: deleted 2 dead type aliases (`SplitPaymentLeg`, `ComboSlotType`) — the type-alias half of a live schema/type pair in both cases. The remaining 153 findings are knip false positives on this intentionally wide-surface registry (reached via deep-path imports, the `domain` namespace object, or test-only consumers) and were kept.
- Investigated both `domain.ts` duplicate-export pairs (`ModifierGroupItemSchema`/`CreateSchema`, `ProductModifierGroupSchema`/`CreateSchema`) and determined both are a deliberate naming-convention completeness case (no `id`/`createdAt` field for these join-table rows to `.omit()`, so the Create variant legitimately equals its base) rather than a defect — deferred, both names kept.
- `edge-function-contracts.ts`: deleted 7 standalone dead type aliases with zero repo-wide hits.
- Applied the plan's Task-2-specific gate — cross-referencing every `EDGE_FUNCTIONS` registry entry against `ls supabase/functions/` — and discovered `close-shift` and `generate-report` are the only two of twelve registry entries with no matching directory. Independently corroborated with three lines of evidence (zero external callers anywhere in `src/`/`e2e/`/`scripts/`, `git log --all` showing the directories never existed in this repo's history, and CLAUDE.md/Phase 24 evidence that shift-close and report-generation are now implemented via `close_caja_session` and the operational-reports-suite RPCs respectively) before deleting the full 12-symbol cluster plus its 2 `EDGE_FUNCTIONS` registry entries.
- Spot-checked every other contract family (`void-order`, `rappi-sync-menu`, `send-receipt-email`, `settings-backup`/`restore`/`email-status`/`test-email`, `get-server-time`, `process-payment`, `process-split-payment`) against the same directory-existence gate — all confirmed live, all kept.
- Re-measured the registry-scoped knip delta: 196 → 175 findings (−21), matching the ledger tally exactly. Full-repo delta (39-01's whole method): 652 → 631, with unused-files count and duplicate-export count both unchanged, confirming no cascade effect into other files.
- `npm run typecheck && npm run lint && npm run test` clean after every batch — final full-suite run: 151 test files passed + 2 skipped, 1391 tests passed + 15 todo, exact match to the 39-08 baseline.

## Task Commits

Each task was committed atomically:

1. **Task 1: Review and disposition the domain.ts findings** - `84a834c` (chore)
2. **Task 2: Review and disposition the edge-function-contracts.ts findings** - `be1710e` (chore)
3. **Task 3: Re-measure and record the registry delta** - `741ba8e` (docs)

## Files Created/Modified

- `src/shared/lib/domain.ts` — 2 dead type-alias lines removed (`SplitPaymentLeg`, `ComboSlotType`); every remaining flagged export/type confirmed live and kept
- `src/shared/lib/edge-function-contracts.ts` — 279 lines removed: 7 standalone dead type aliases plus the full 12-symbol close-shift/generate-report contract cluster (request/response schemas, type aliases, caller functions) and its 2 `EDGE_FUNCTIONS` registry entries
- `.planning/phases/39-ai-slob-technical-debt-remediation/39-09-LEDGER.md` — one row per flagged finding (196 total) with search command, hit count, pairing classification, and outcome; the close-shift/generate-report investigation narrative; the duplicate-export-pair deferral narrative; and the before/after delta measurement

## Decisions Made

- **Deleted the close-shift/generate-report cluster despite nonzero grep hit counts.** Every contract family in `edge-function-contracts.ts` shows the same internal-only self-reference pattern (own type alias, own `.parse()` call, own `EDGE_FUNCTIONS` registry entry) whether or not the target function is actually deployed, so hit count alone cannot distinguish live from dead in this file. The plan's Task 2 gate (directory existence under `supabase/functions/`) is the correct discriminator, and it cleanly isolated exactly two orphaned registry entries out of twelve — corroborated by `git log --all` showing the directories never existed and by CLAUDE.md/Phase 24 documentation of the architecture that superseded them.
- **Kept both duplicate-export pairs, deferred rather than corrected.** `ModifierGroupItemCreateSchema`/`ProductModifierGroupCreateSchema` are bare re-assignments of their base schema (`X = XSchema;`, no `.omit()`), which knip flags as duplicate exports. Investigation showed this is the file's established convention applied consistently — join-table rows with no `id`/`createdAt` field genuinely have an identical Create variant — and both names in each pair are independently referenced (base schema by tests, Create alias by the `domain` registry object). Consolidating would touch the widely-consumed `domain` namespace object's shape for no dead-code benefit, so both were left as-is with the rationale recorded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `/tmp` scratch-file collision with parallel sibling worktree agents**

- **Found during:** Task 1, initial evidence-gathering pass
- **Issue:** The plan's search evidence was first written to `/tmp/search-results.json`, which is shared across the host machine — not per-worktree. A sibling agent executing plan 39-10 or 39-11 concurrently in its own worktree overwrote this plan's `/tmp` state mid-run (truncated to 148 of 196 rows, silently, no error). Caught before it reached any deletion decision by a sanity check noticing the recovered rows referenced `PhoneE164Schema`/`waitlist` names outside this plan's scope.
- **Fix:** Re-ran all knip regeneration and search-evidence gathering from scratch inside a worktree-local `.scratch-39-09/` directory instead of `/tmp/`, eliminating cross-agent collision. Deleted before the final commit (confirmed via `git status --short` showing no untracked scratch artifacts).
- **Files affected:** None (tooling/process only, no source files touched by the bug)
- **Verification:** Re-ran the full 196-row search from the worktree-local scratch directory and cross-checked the row count (196) and a handful of known values against the original manual reads of `domain.ts`/`edge-function-contracts.ts`
- **Committed in:** Not committed (scratch directory deleted before any commit; no artifact of the bug reached git history)

**2. [Rule 1 - Bug] Registry-scoped delta measurement initially inflated by the plan's own scratch scripts**

- **Found during:** Task 3, delta re-measurement
- **Issue:** The first "after" knip regeneration showed unused-files count rising from 43 to 47 — an unexpected +4 that would have implied a cascade effect from this plan's deletions into unrelated files. Investigation traced all 4 newly-flagged files to `.scratch-39-09/*.cjs` — this plan's own tooling scripts, picked up by knip's repo-wide scan because they weren't excluded.
- **Fix:** Excluded `.scratch-39-09/` from the delta-measurement script's file-count aggregation and re-ran; confirmed the corrected before/after unused-files counts are identical (43 → 43), with zero real cascade effect.
- **Files affected:** None (measurement-script correction only)
- **Verification:** Diffed the before/after whole-file-dead sets explicitly; confirmed all 4 discrepancies were `.scratch-39-09/*.cjs` paths and nothing else changed
- **Committed in:** Not committed (the corrected measurement is what appears in 39-09-LEDGER.md; the scratch directory itself was never committed)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 tooling-collision, 1 Rule 1 measurement-correction). **Impact on plan:** Both deviations were process/tooling issues caught and corrected before they could affect any deletion decision or the published delta numbers. No source-code deviation, no scope creep beyond the close-shift/generate-report cluster discovery already documented above as a key decision (not a bug fix).

## Issues Encountered

Transient test-suite flakiness during Task 2's verification: four consecutive `npm run test` runs each showed exactly 1 unrelated, different test failing (`queries.clock.test.ts`, `CajaDashboard.test.tsx`, a staff-shift mutation test, `groupOrderItemsForReceipt.test.ts`) — none touching `domain.ts` or `edge-function-contracts.ts`, and each passing cleanly when re-run in isolation. Attributed to CPU/resource contention from the three sibling parallel-wave worktree agents (39-09/39-10/39-11) all running `npm run test` concurrently on the same physical machine during this session. Resolved by re-running until a clean full-suite pass was obtained (151 files / 1391 tests, exact match to the 39-08 baseline); not a code regression.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- No downstream plan depends on this one (`affects: []` — this plan's registry cleanup is self-contained within the two files it owns).
- The `close-shift`/`generate-report` cluster deletion (D3 in the coverage block above) is flagged `human_judgment: true` — a human sanity-check that no external system still expects these two edge functions (a scheduled job, a different client, a not-yet-merged branch) is recommended before this ships, though the evidence gathered (zero callers, no git history, documented superseding architecture) is strong.
- No blockers for the rest of the phase.

## Self-Check

- FOUND: `.planning/phases/39-ai-slob-technical-debt-remediation/39-09-LEDGER.md`
- FOUND: `.planning/phases/39-ai-slob-technical-debt-remediation/39-09-SUMMARY.md`
- CONFIRMED: `src/shared/lib/domain.ts` no longer contains `SplitPaymentLeg` or `ComboSlotType` type aliases (spot-checked via grep)
- CONFIRMED: `src/shared/lib/edge-function-contracts.ts` no longer contains `callCloseShift`, `callGenerateReport`, or any close-shift/generate-report symbol (spot-checked via grep)
- FOUND: commit `84a834c` (Task 1)
- FOUND: commit `be1710e` (Task 2)
- FOUND: commit `741ba8e` (Task 3)

## Self-Check: PASSED

---
*Phase: 39-ai-slob-technical-debt-remediation*
*Completed: 2026-08-06*
