# Deferred Items — Plan 39-05

Out-of-scope discoveries logged per the executor's scope-boundary protocol (fix only
what the current task's changes directly caused).

## Flaky unit test — `src/entities/staff/model/queries.clock.test.ts`

`npm run test` (full suite) reported 1 failure:

```
FAIL  |unit| src/entities/staff/model/queries.clock.test.ts > useMutationClockOut > optimistically sets clockOut then commits server shift
AssertionError: expected false to be true
```

Not caused by this plan — zero `src/` files were modified by 39-05 (`git diff --name-only -- src/` is empty). Re-running the same file in isolation (`npx vitest run src/entities/staff/model/queries.clock.test.ts`) passes cleanly (6/6), confirming this is an order-dependent/test-pollution flake in the full-suite run, not a genuine regression. Left unfixed — out of this plan's scope (E2E triage only, `src/` changes prohibited).
