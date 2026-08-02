# Deferred Items — Phase 28 (money-formatter-utility)

## From Plan 28-06

- **`src/features/process-refund/process-refund-rpc.integration.test.ts` — `after_payment_insert_check_parent_close trigger: parent auto-closes when all sub-tabs paid`**
  Fails deterministically in this worktree (`expected 'split' to be 'paid'`), both as part of the
  full suite and run in isolation. The failure is in a DB-trigger integration test unrelated to
  money formatting — it asserts a `tabs.status` transition (`split` → `paid`) driven by a
  Postgres trigger, not by any code this plan touched. `git status --short` on
  `src/features/process-refund/` shows only `RefundSheet.tsx` (the file this plan edited)
  modified; the integration test file itself is untouched.
  Most likely cause: six sibling worktree-executor agents (plans 28-02 through 28-05, 28-07) run
  concurrently against the same live remote Supabase project, and this test's split/payment
  fixture data collides with another agent's concurrent split-tab test run (28-06's own Task 3
  touches `SplitTabSheet`, and split-tab integration/E2E coverage is plausibly running in a
  sibling worktree at the same time). Out of scope per the executor's SCOPE BOUNDARY rule — not
  fixed here. Re-run in isolation (no concurrent sibling agents hitting the same DB) to confirm.
