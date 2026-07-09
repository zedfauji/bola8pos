---
phase: 19-tip-distribution-config
plan: 05
subsystem: ui
tags: [react, settings, reports, tip-distribution, fsd, shadcn]

# Dependency graph
requires:
  - phase: 19-tip-distribution-config
    provides: "Plan 01's computeTipDistribution + TipDistributionSettingsSchema/TipDistributionEntrySchema"
  - phase: 19-tip-distribution-config
    provides: "Plan 04's useSettings().data.tipDistribution + useMutationUpdateSetting + useTipDistributionEntry(cajaSessionId)"
provides:
  - "Admin-only 'Tip Split' Settings tab (TipDistributionSettingsTab) — edits floor/bar/kitchen %, warns-but-allows on non-100 sums (D-01), shows a live $100 example preview, persists via useMutationUpdateSetting + best-effort settings.update audit"
  - "'Tip Split' Reports tab (TipBucketDistributionPanel) — per-caja-session floor/bar/kitchen breakdown via useTipDistributionEntry, distinct from the existing per-staff 'Tip Distribution' tab"
affects: [19-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TipDistributionSettingsTab clones GeneralSettingsTab's dirty-flag/useEffect-sync/ProtectedAction shape, adding a non-blocking sum-warning line (D-01) that never gates the Save button"
    - "TipBucketDistributionPanel clones CajaReportPanel's session-selector <select> shell exactly, swapping useCajaReport for useTipDistributionEntry"
    - "record_audit best-effort pattern (settings.update) mirrors useMutationTogglePermission/staff.role_change: p_user_id: null, cast `as never` since the generated Args type omits null from the optional string"

key-files:
  created:
    - src/widgets/SettingsTabsPanel/tabs/TipDistributionSettingsTab.tsx
    - src/widgets/SettingsTabsPanel/tabs/TipDistributionSettingsTab.test.tsx
    - src/widgets/TipBucketDistributionPanel/TipBucketDistributionPanel.tsx
    - src/widgets/TipBucketDistributionPanel/index.ts
  modified:
    - src/widgets/SettingsTabsPanel/index.tsx
    - src/pages/reports/index.tsx

key-decisions:
  - "Both the Settings tab and Reports tab use the label 'Tip Split' (tab key 'tip-split') per the plan's Claude's-Discretion naming decision, avoiding collision with the existing per-staff 'Tip Distribution' report tab (Pitfall 2)"
  - "record_audit's p_user_id passed as null with an `as never` cast, matching the existing staff.role_change/permission.toggle convention rather than threading a real user id through (no established pattern in this codebase does so yet)"

requirements-completed: [SC-1, SC-3, SC-4]

# Metrics
duration: 55min
completed: 2026-07-09
---

# Phase 19 Plan 05: Tip Split Settings Tab + Reports Panel Summary

**Admin-only "Tip Split" Settings tab (3-way percentage editor with warn-but-allow sum validation + $100 live preview) and a separate "Tip Split" Reports tab (per-caja-session floor/bar/kitchen breakdown), both deliberately named apart from the pre-existing per-staff "Tip Distribution" tab.**

## Performance

- **Duration:** ~55 min (including recovering two missing prerequisite waves and an environment repair)
- **Tasks:** 3/3

## Accomplishments

- `TipDistributionSettingsTab.tsx`: admin-gated (`ProtectedAction action="manage_settings"`) 3-input percentage form (Floor/Bar/Kitchen), non-blocking amber warning when the sum isn't 100% (D-01 — Save button disable expression only checks `!dirty || isPending`, never the sum), a `computeTipDistribution(100, form)` live example preview, save via `useMutationUpdateSetting({key:'tip_distribution', value: form})` followed by a best-effort `supabase.rpc('record_audit', {p_action:'settings.update', ...})` call (logged via `logger.warn` on failure, never blocks the save)
- Registered as `'Tip Split'` in `SettingsTabsPanel`'s admin-only (`canManageSettings`) tab group
- 4 RTL tests (`TipDistributionSettingsTab.test.tsx`): pre-filled 34/33/33 render, edit-enables-Save + correct `mutateAsync` payload, non-100-sum (90%) shows the warning while Save stays enabled (the key SC-3/D-01 assertion), save-failure keeps local form state + error toast
- `TipBucketDistributionPanel.tsx`: self-contained widget cloning `CajaReportPanel`'s caja-session `<select>` shell (`useCajaList`), reading the selected session's split via `useTipDistributionEntry`; renders total tips + 3 bucket cards (pct + `MoneyDisplay` amount) or an `EmptyState` when no entry exists yet for that session
- New `'tip-split'` Reports tab renders the panel as a sibling to (not a replacement of) the existing `value="tips"` "Tip Distribution" trigger — that trigger, its `TipDistributionPanel` import, and its `TabsContent` are all byte-for-byte unchanged (D-07)

## Task Commits

1. **Task 1: TipDistributionSettingsTab (admin form + sum warning + preview + save-with-audit) + register** - `d6ab095` (feat)
2. **Task 2: RTL tests for TipDistributionSettingsTab (SC-3)** - `85bce52` (test)
3. **Task 3: TipBucketDistributionPanel widget + Reports page 'Tip Split' tab** - `1f137dc` (feat)

## Files Created/Modified

- `src/widgets/SettingsTabsPanel/tabs/TipDistributionSettingsTab.tsx` - admin-gated 3-percentage form + warn-but-allow sum message + $100 preview + save-with-audit
- `src/widgets/SettingsTabsPanel/tabs/TipDistributionSettingsTab.test.tsx` - 4 RTL tests incl. the D-01/SC-3 non-100-sum-still-enabled assertion
- `src/widgets/SettingsTabsPanel/index.tsx` - imports + registers the new `'tip-split'` tab in the admin-only group
- `src/widgets/TipBucketDistributionPanel/TipBucketDistributionPanel.tsx` - caja-session selector + total tips + floor/bar/kitchen bucket cards, read-only (D-04)
- `src/widgets/TipBucketDistributionPanel/index.ts` - barrel
- `src/pages/reports/index.tsx` - new `TipBucketDistributionPanel` import + `'tip-split'` `TabsTrigger`/`TabsContent`, existing `'tips'` tab untouched

## Decisions Made

- Followed the plan's explicit "Tip Split" naming decision for both the Settings tab and the Reports tab (resolves 19-RESEARCH.md Pitfall 2 / Open Question 1).
- `record_audit`'s `p_user_id` is passed as `null` with an `as never` cast on the call object, exactly mirroring the existing `staff.role_change`/`permission.toggle` best-effort audit convention (no codebase precedent yet threads an authenticated user id into this RPC).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree was missing Wave 2 (Plans 19-03/19-04) entirely**
- **Found during:** Task 1's `<read_first>` step — `src/entities/settings`/`src/entities/caja` had no `tipDistribution`/`useTipDistributionEntry` symbols, and `.planning/phases/19-tip-distribution-config/` only contained 19-01/19-02 summaries.
- **Issue:** This worktree's `HEAD`/`main` sat at commit `77f04a3` ("update tracking after wave 1"). The orchestrator's stale-branch note assumed Wave 2 was already merged, but it was not yet on `main` — instead it existed, complete, on a separate integration branch (`worktree-phase-19-execute`, tip `4324ce0` "update tracking after wave 2", itself fast-forwardable from `main`) plus an individual executor branch (`worktree-agent-a790e82a6d56e08fc`) that had done 19-04 alone. Neither had been merged into `main` yet at the time this plan was spawned.
- **Fix:** Located `worktree-phase-19-execute` via `git for-each-ref` + `git log --grep`, confirmed `git merge-base --is-ancestor main worktree-phase-19-execute` was true (clean fast-forward, no divergent commits), and ran `git merge worktree-phase-19-execute --ff-only`. This brought in 19-03 (supabase.types.ts extension + remote DB push, already applied per its SUMMARY) and 19-04 (settings/caja entity hooks) — no rebase, no rewritten history, no conflicts.
- **Verification:** Post-merge, `grep -n "useTipDistributionEntry" src/entities/caja/model/queries.ts` and `grep -n "tipDistribution" src/entities/settings/model/queries.ts` both found the expected symbols; `19-03-SUMMARY.md`/`19-04-SUMMARY.md` were present on disk.
- **Committed in:** Not a code commit — clean fast-forward merge of already-committed work from a sibling worktree, landed before Task 1's first edit.

**2. [Rule 3 - Blocking] Worktree node_modules/main-checkout node_modules were both broken/incomplete**
- **Found during:** Task 1's verification step — `npx tsc`/`npx eslint` failed outright (`node_modules` absent in the worktree; the main checkout's `node_modules` existed but had no `.bin` directory and was missing `@babel/core`, breaking `eslint-plugin-react-hooks`).
- **Issue:** The worktree checkout never had `node_modules` (untracked by git, consistent with prior Phase 19 plans' documented finding). The main checkout's `node_modules` was itself partially installed (missing `.bin` symlinks and several packages already declared in `package-lock.json`).
- **Fix:** Created a Windows junction (`New-Item -ItemType Junction`) from the worktree's `node_modules` to the main checkout's, then ran `npm install` in the main checkout (matching the existing `package-lock.json` — no new/unvetted packages introduced) to repair the missing `.bin` entries and `@babel/core`. Also copied `.env.local` from the main checkout into the worktree (gitignored, required by `src/test/global-setup.ts` for the Vitest Supabase connectivity check).
- **Verification:** `npx tsc --noEmit`, `npx eslint`, and `npx vitest run` all executed successfully afterward with only pre-existing, documented, out-of-scope errors remaining (`tab/model/queries.ts`, `agent/rag.ts`, `agent/brain.ts`, `agent/vision.ts` — all predate this plan, all @anthropic-ai/sdk-module-missing or pre-existing type errors unrelated to tip distribution).
- **Committed in:** Not a code commit — local dev-environment plumbing only (`node_modules` junction, `npm install` against the existing lockfile, `.env.local` copy). No files were staged or committed for this step.

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking environment/prerequisite issues, no code-behavior changes)
**Impact on plan:** Both fixes were required just to reach a working state to execute Task 1; neither touched the plan's actual deliverables. No scope creep — the three tasks were executed exactly as specified once the environment and prerequisite waves were in place.

## Issues Encountered

- The plan's acceptance-criteria grep counts for `computeTipDistribution` (`== 1`) and `value="tips"` (`== 1`) are stricter than what any correct implementation produces: `computeTipDistribution` necessarily appears twice (the import line + the one call site), and the existing Reports page already has `value="tips"` on both its `TabsTrigger` and `TabsContent` (2 occurrences), neither of which this plan touched. Verified both are false-positive count mismatches, not real defects — the underlying intent (one call site; the existing per-staff tab left untouched, D-07) is satisfied.
- `.env.local` and `node_modules` are both absent from fresh worktree checkouts (gitignored/untracked) — this is the third consecutive Phase 19 plan to hit this; documented again here for anyone auditing the pattern.

## User Setup Required

None.

## Next Phase Readiness

- Plan 06 (E2E/UAT) can now exercise: an admin editing the Tip Split percentages in Settings (with the warn-but-allow non-100 message) and, after closing a caja session, viewing the computed floor/bar/kitchen breakdown in the new Reports "Tip Split" tab.
- No new write surface introduced beyond what Plan 04 already covered (`tip_distribution` key upsert via existing admin-scoped settings RLS); `TipBucketDistributionPanel` is read-only.

---
*Phase: 19-tip-distribution-config*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: src/widgets/SettingsTabsPanel/tabs/TipDistributionSettingsTab.tsx
- FOUND: src/widgets/SettingsTabsPanel/tabs/TipDistributionSettingsTab.test.tsx
- FOUND: src/widgets/SettingsTabsPanel/index.tsx
- FOUND: src/widgets/TipBucketDistributionPanel/TipBucketDistributionPanel.tsx
- FOUND: src/widgets/TipBucketDistributionPanel/index.ts
- FOUND: src/pages/reports/index.tsx
- FOUND commit: d6ab095 (Task 1)
- FOUND commit: 85bce52 (Task 2)
- FOUND commit: 1f137dc (Task 3)
- FOUND commit: 515a86d (SUMMARY.md)
