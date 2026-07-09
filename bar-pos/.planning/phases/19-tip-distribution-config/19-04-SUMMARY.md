---
phase: 19-tip-distribution-config
plan: 04
subsystem: entities
tags: [tanstack-query, settings, caja, tip-distribution, fsd]

# Dependency graph
requires:
  - phase: 19-tip-distribution-config
    provides: "Plan 01's TipDistributionSettingsSchema + TipDistributionEntrySchema + 'tip_distribution' SettingsKey (domain.ts)"
  - phase: 19-tip-distribution-config
    provides: "Plan 02's tip_distribution_entries table + close_caja_session tip computation (DB layer)"
provides:
  - "useSettings().data.tipDistribution — parsed {floorPct,barPct,kitchenPct} config, default 34/33/33"
  - "useMutationUpdateSetting accepts TipDistributionSettings for key='tip_distribution'"
  - "useTipDistributionEntry(cajaSessionId) — reads the immutable tip_distribution_entries row for a session"
affects: [19-05-settings-tab-report-panel, 19-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extended the existing generic settings-table entity pattern (parse* helper + SETTINGS_KEYS + SettingsSnapshot field) rather than introducing a new entity slice"
    - "useTipDistributionEntry mirrors useCajaEntries exactly (Result<T | null>, supabaseQuery, staleTime, enabled guard)"

key-files:
  created: []
  modified:
    - src/entities/settings/model/queries.ts
    - src/entities/settings/model/types.ts
    - src/entities/settings/model/index.ts
    - src/entities/settings/index.ts
    - src/entities/caja/model/queries.ts
    - src/entities/caja/model/index.ts
    - src/entities/caja/index.ts

key-decisions:
  - "Top-level src/entities/settings/index.ts barrel previously re-exported only types (no schema constants) — added TipDistributionSettingsSchema there anyway per plan's explicit instruction, introducing the first schema re-export at that barrel level"
  - "src/entities/caja/index.ts re-exports TipDistributionEntry as a type-only import directly from '@shared/lib/domain' (not re-routed through model/index.ts) since the type itself lives in domain.ts, not in a caja-local types.ts"

requirements-completed: [SC-1, SC-4]

# Metrics
duration: 20min
completed: 2026-07-09
---

# Phase 19 Plan 04: Tip Distribution Entity Layer Summary

**Extended the settings entity's existing generic-settings-table pattern with a `tipDistribution` snapshot field (default 34/33/33) and added a `useTipDistributionEntry(cajaSessionId)` read hook to the caja entity, mirroring `useCajaEntries` exactly.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2/2

## Accomplishments

- `src/entities/settings/model/queries.ts`: `DEFAULT_TIP_DISTRIBUTION` (34/33/33) + `parseTipDistribution()` helper (safeParse → data or default, mirroring `parseGeneral`/`parseBilling`); `'tip_distribution'` appended to `SETTINGS_KEYS` so `useSettings()`'s `.in('key', SETTINGS_KEYS)` fetches it; `SettingsSnapshot.tipDistribution` field wired into `toSnapshot()`; `TipDistributionSettings` added to `useMutationUpdateSetting`'s mutation-input value union
- All 3 settings barrels (`model/types.ts`, `model/index.ts`, `index.ts`) re-export `TipDistributionSettingsSchema` + `TipDistributionSettings`
- `src/entities/caja/model/queries.ts`: `tipDistributionKeys` (`all` / `bySession`) + `mapTipDistributionEntryRow` (snake_case → camelCase via `TipDistributionEntrySchema.parse`) + `useTipDistributionEntry(cajaSessionId: string | null)` — `useQuery` with `enabled: !!cajaSessionId`, `staleTime: 60_000`, reads `tip_distribution_entries` via `.maybeSingle()`, returns `Result<TipDistributionEntry | null>` (no row → `ok(null)`)
- Both caja barrels (`model/index.ts`, `index.ts`) re-export `useTipDistributionEntry` + `tipDistributionKeys`; top-level barrel also re-exports the `TipDistributionEntry` type directly from `@shared/lib/domain`

## Task Commits

1. **Task 1: Extend the settings entity — tipDistribution snapshot + write union + barrels** - `1a9ef80` (feat)
2. **Task 2: Add useTipDistributionEntry read hook to the caja entity** - `7b9d0b5` (feat)

## Files Created/Modified

- `src/entities/settings/model/queries.ts` - `DEFAULT_TIP_DISTRIBUTION`, `parseTipDistribution`, `SETTINGS_KEYS` +1, `SettingsSnapshot.tipDistribution`, `useMutationUpdateSetting` value union +1
- `src/entities/settings/model/types.ts` - re-export `TipDistributionSettingsSchema`/`TipDistributionSettings` from `@shared/lib/domain`
- `src/entities/settings/model/index.ts` - re-export `TipDistributionSettingsSchema`/`TipDistributionSettings` from `./types`
- `src/entities/settings/index.ts` - re-export `TipDistributionSettingsSchema`/`TipDistributionSettings` from `./model`
- `src/entities/caja/model/queries.ts` - `tipDistributionKeys`, `mapTipDistributionEntryRow`, `useTipDistributionEntry`
- `src/entities/caja/model/index.ts` - re-export `useTipDistributionEntry`/`tipDistributionKeys` from `./queries`
- `src/entities/caja/index.ts` - re-export `useTipDistributionEntry`/`tipDistributionKeys` from `./model` + `TipDistributionEntry` type from `@shared/lib/domain`

## Decisions Made

- Kept the value union member ordering/style consistent with the existing `GeneralSettings | BillingSettings | ... | ReceiptSettings` list in `useMutationUpdateSetting` — appended `TipDistributionSettings` immediately before the trailing `Record<string, unknown>` fallback.
- `useTipDistributionEntry` returns `err(unknownError('No caja session id.'))` inside the guarded `queryFn` branch (unreachable in practice since `enabled: !!cajaSessionId` prevents the query from running with a null id) purely to satisfy the function's `Result<TipDistributionEntry | null>` return-type contract — same defensive pattern already used by `useCajaEntries`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree was 26 commits behind main, missing Plan 01 + Plan 02's work entirely**
- **Found during:** Initial file discovery (Task 1's `<read_first>` step) — `src/shared/lib/domain.ts` had no `TipDistribution*` symbols and `.planning/phases/19-tip-distribution-config/` was completely absent from the worktree.
- **Issue:** This plan's worktree branch (`worktree-agent-a6fcba19ac65362bc`) was created at commit `97cddbc`, which predates Phase 17, 18, and all of Phase 19 (including this plan's hard dependency, `19-01`). `git merge-base HEAD main` confirmed `97cddbc` is a strict ancestor of `main` (`77f04a3`), i.e., the worktree branch had zero unique commits and was simply stale, not diverged.
- **Fix:** Ran `git merge main --ff-only` inside the worktree. This was a clean fast-forward (no rebase, no rewritten history, no conflicts) bringing in all of Phases 16–19's committed work, including Plan 01's `TipDistributionSettingsSchema`/`TipDistributionEntrySchema`/`'tip_distribution'` SettingsKey and Plan 02's `tip_distribution_entries` table + `close_caja_session` extension that this plan's `depends_on: [19-01]` requires.
- **Verification:** Post-merge, `grep -n "TipDistribution" src/shared/lib/domain.ts` found all 4 expected symbols; `.planning/phases/19-tip-distribution-config/19-01-SUMMARY.md` and `19-02-SUMMARY.md` were present; `git log --oneline -3` showed the worktree branch now at `77f04a3` (main's tip).
- **Committed in:** Not a code commit — this was a fast-forward merge of already-committed work, not new changes. No new commit was created by this step; the two task commits (`1a9ef80`, `7b9d0b5`) sit on top of the merged history.

## Issues Encountered

- **No `node_modules` in the worktree:** As with prior Phase 19 plans, this worktree checkout has no `node_modules` (untracked by git) and no `.env.local` (gitignored). Created a Windows directory junction (`mklink /J node_modules <main-checkout>/node_modules`) so `npx tsc`/`npx eslint` could resolve dependencies. Not part of any commit — local dev-environment plumbing only.
- **`.planning/` is gitignored:** Consistent with 19-01/19-02's documented finding — this SUMMARY.md is written to a gitignored path. Following the repo's established convention (see main-branch commits `efe41a1`, `0d58efa`), it will need to be force-added if it is to survive past this worktree's lifecycle; per the parallel-execution protocol for this run, it is committed as-is (force-added) so it is not lost.

## User Setup Required

None.

## Next Phase Readiness

- Plan 05 (Settings tab + report panel) can rely on: `useSettings().data.tipDistribution` (default 34/33/33), `useMutationUpdateSetting({ key: 'tip_distribution', value })`, and `useTipDistributionEntry(cajaSessionId)` — all importable from `@entities/settings` / `@entities/caja` respectively.
- No new write surface was introduced: `useTipDistributionEntry` is read-only (RLS-enforced manager+ SELECT); `useMutationUpdateSetting`'s existing admin-scoped RLS already covers the `tip_distribution` key with no additional client-side gating needed.

---
*Phase: 19-tip-distribution-config*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: src/entities/settings/model/queries.ts
- FOUND: src/entities/caja/model/queries.ts
- FOUND commit: 1a9ef80 (Task 1)
- FOUND commit: 7b9d0b5 (Task 2)
