# Deferred Items — Phase 15 (gap-closure)

Out-of-scope discoveries logged per the executor's scope-boundary rule (not
fixed, only documented).

## Pre-existing / flaky test failures unrelated to plan changes

Discovered independently by both plan 15-07 and plan 15-08 while running
`npm run test` to confirm "no new failures" per each plan's `<verification>`
gate. Both executors reached the same conclusion independently, which
strengthens confidence this is a genuine pre-existing environment flake
rather than something introduced by either plan.

- **`src/widgets/PINLoginForm/PINLoginForm.test.tsx`** — 5 failing tests in
  the `forced_pin_change phase` describe block, plus one `does not log in
  when clock-in fails` test, consistently timing out on `waitFor`.
  Reproduced on multiple runs, both in the full suite and in isolation
  (`npx vitest run src/widgets/PINLoginForm/PINLoginForm.test.tsx`). The
  file is fully self-mocked (mocks `@shared/lib/supabase`,
  `@entities/staff/model/queries`, `sonner`) and has zero dependency on
  either plan's touched files (`close-tab`, `stop-and-move-table`,
  `transfer-tab`, `entities/resource/model/queries.ts`,
  `edge-function-contracts.ts`, `payment-processor.ts`, `PaymentForm.tsx`).
  Not investigated further per the scope-boundary rule. Track as a
  follow-up outside this gap-closure phase.
- **`src/entities/staff/model/queries.clock.test.ts`** —
  `useMutationClockOut > optimistically sets clockOut then commits server
  shift` failed on one run (`expect(mutationResult.ok).toBe(true)` received
  `false`) but passed on immediate rerun (plan 15-07 only) — confirms
  flake, not a deterministic regression.

**Why out of scope (15-07):** neither test file imports `versionedMutation`,
`TERMINAL_ID`, or any of plan 15-07's five touched files. The only shared
file, `src/shared/lib/result.ts`, received a purely additive change (one new
exported function appended after `supabaseMutation`) — no existing export's
behavior changed.

**Note:** `useCloseTab.test.ts:95`, the one failure `VERIFICATION.md`
documented as pre-existing and out of scope for Phase 15, now passes
(3/3) against plan 15-07's changes — no action needed, noted for the record.
