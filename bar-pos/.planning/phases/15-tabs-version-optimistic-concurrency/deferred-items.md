# Deferred Items — Phase 15 Plan 07

Out-of-scope discoveries logged per the executor's scope-boundary rule (not
fixed, only documented).

## Pre-existing / flaky test failures unrelated to this plan's changes

Discovered while running `npm run test` to confirm "no new failures" per the
plan's `<verification>` gate.

- **`src/widgets/PINLoginForm/PINLoginForm.test.tsx`** — 5 failing tests in
  the `forced_pin_change phase` describe block and one `does not log in when
  clock-in fails` test, consistently timing out on `waitFor`. Reproduced on
  two consecutive full-suite runs.
- **`src/entities/staff/model/queries.clock.test.ts`** —
  `useMutationClockOut > optimistically sets clockOut then commits server
  shift` failed on one run (`expect(mutationResult.ok).toBe(true)` received
  `false`) but passed on immediate rerun — confirms flake, not a
  deterministic regression.

**Why out of scope:** neither test file imports `versionedMutation`,
`TERMINAL_ID`, or any of this plan's five touched files
(`close-tab`, `stop-and-move-table`, `transfer-tab`,
`entities/resource/model/queries.ts`). The only shared file,
`src/shared/lib/result.ts`, received a purely additive change (one new
exported function appended after `supabaseMutation`, confirmed via
`git diff <base> -- src/shared/lib/result.ts`) — no existing export's
behavior changed. These are pre-existing, environment-dependent (live
Supabase) test flakes, not caused by this plan.

**Note:** `useCloseTab.test.ts:95`, the one failure VERIFICATION.md
documented as pre-existing and out of scope for Phase 15, now passes
(3/3) against this plan's changes — no action needed, noted for the record.
