# Deferred Items — Phase 15 (gap-closure)

## From plan 15-08

- **`src/widgets/PINLoginForm/PINLoginForm.test.tsx` — 5 failing tests (`forced_pin_change phase` suite + `does not log in when clock-in fails`)**, discovered during the plan's full `npm run test` gate. Out of scope: the file has zero dependency on anything this plan touches (`edge-function-contracts.ts`, `payment-processor.ts`, `PaymentForm.tsx`) — it is fully self-mocked (mocks `@shared/lib/supabase`, `@entities/staff/model/queries`, `sonner`) and fails identically both in the full suite and in isolation (`npx vitest run src/widgets/PINLoginForm/PINLoginForm.test.tsx`), confirming this is a pre-existing failure in this worktree/environment, not a regression introduced by this plan. Not investigated further per the scope-boundary rule (only auto-fix issues directly caused by the current task's changes). Track as a follow-up outside this gap-closure phase.
