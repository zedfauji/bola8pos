---
phase: 15-tabs-version-optimistic-concurrency
plan: 08
subsystem: payments
tags: [zod, supabase-edge-functions, deno, optimistic-concurrency, tanstack-query]

# Dependency graph
requires:
  - phase: 15-tabs-version-optimistic-concurrency
    provides: "version column + bump_version_on_update trigger + P0V01/P0V02 SQLSTATE + process_payment_atomic's p_expected_version RPC param (all shipped, RPC param already null-tolerant)"
provides:
  - "Optional expectedVersion field on ProcessPaymentRequestSchema (renderer) and the Deno process-payment edge function's BodySchema, forwarded conditionally to process_payment_atomic as p_expected_version"
  - "processCashPayment/processCardPayment/processRappiPayment accept a trailing optional expectedVersion; PaymentForm supplies tab.version on all three call sites"
affects: [15-09-plan (edge function deployment + live E2E checkpoint), process-payment edge function, payment-processor, PaymentForm]

# Actuals (#2632)
actuals:
  tokens: 2772
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Conditional RPC-param spread: `...(value !== undefined ? { p_param: value } : {})` — omits the key entirely rather than passing null, preserving byte-identical RPC calls for callers that don't supply the value (mirrors src/entities/resource/model/queries.ts:359-376)"

key-files:
  created: []
  modified:
    - src/shared/lib/edge-function-contracts.ts
    - src/shared/lib/edge-function-contracts.test.ts
    - supabase/functions/process-payment/index.ts
    - src/shared/lib/payment-processor.ts
    - src/shared/lib/payment-processor.test.ts
    - src/widgets/PaymentModal/ui/PaymentForm.tsx
    - src/widgets/PaymentModal/ui/PaymentForm.test.tsx
    - src/widgets/PaymentModal/PaymentModal.test.tsx

key-decisions:
  - "Two independent Zod schemas (renderer v4, Deno edge function v3.23.8) both needed the field added by hand — Zod strips unknown keys at each boundary, so mirroring is mandatory, not optional polish."
  - "Trailing optional parameter on all three processor functions (not a positional insert) keeps rappi-order/store.ts, useSplitTab.ts, and PaymentModal.stories.tsx compiling with zero edits."
  - "Split-payment path (processSplitPayment / process_split_payment_atomic) deliberately left unguarded — out of this gap's scope per 15-CONTEXT.md D-02 and the plan's carry_forward_notes."

patterns-established:
  - "expectedVersion?: number trailing parameter shape for any future processor function that needs an optional version guard"

requirements-completed: [D-02]

coverage:
  - id: D1
    description: "ProcessPaymentRequestSchema accepts an optional expectedVersion integer and rejects negative/non-integer values"
    requirement: "D-02"
    verification:
      - kind: unit
        ref: "src/shared/lib/edge-function-contracts.test.ts#ProcessPaymentRequestSchema — expectedVersion 0/7/-1/1.5 cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "process-payment edge function forwards expectedVersion to process_payment_atomic as p_expected_version, omitting the key when not supplied"
    requirement: "D-02"
    verification:
      - kind: unit
        ref: "grep -c 'p_expected_version' supabase/functions/process-payment/index.ts == 1 (conditional spread present)"
        status: pass
    human_judgment: true
    rationale: "Edge function source cannot be exercised by a Deno runtime in this sandbox (no supabase functions deploy in this plan — that's plan 15-09's blocking checkpoint); confirmed by grep/read only, not by invoking the function."
  - id: D3
    description: "PaymentForm supplies tab.version on cash, card, and rappi payment call sites"
    requirement: "D-02"
    verification:
      - kind: unit
        ref: "src/widgets/PaymentModal/ui/PaymentForm.test.tsx, src/widgets/PaymentModal/PaymentModal.test.tsx — updated toHaveBeenCalledWith assertions confirming the trailing tab.version argument"
        status: pass
    human_judgment: false
  - id: D4
    description: "Existing callers with no tab in scope (rappi-order store, useSplitTab) keep compiling unchanged"
    requirement: "D-02"
    verification:
      - kind: unit
        ref: "npm run typecheck (exit 0); git diff confirms zero edits to src/entities/rappi-order/model/store.ts, src/features/split-tab/model/useSplitTab.ts, src/widgets/PaymentModal/PaymentModal.stories.tsx"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-08-07
status: complete
---

# Phase 15 Plan 08: expectedVersion end-to-end through process-payment Summary

**Wired the last unguarded conflict-prone path from Phase 15's original goal: `expectedVersion` now flows from `PaymentForm`'s cached `tab.version` through both `ProcessPaymentRequestSchema` (renderer) and the Deno `process-payment` edge function's `BodySchema`, into `process_payment_atomic` as `p_expected_version`.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-07T06:44:00Z (approx.)
- **Completed:** 2026-08-07T07:11:16Z
- **Tasks:** 2
- **Files modified:** 8 (5 planned + 3 test files updated as a mechanical consequence)

## Accomplishments
- `ProcessPaymentRequestSchema` and the Deno edge function's `BodySchema` both gained an optional, non-negative-integer `expectedVersion` field (added independently to each — Zod strips unknown keys at each schema boundary, so a renderer-only field would never have reached the edge function).
- The edge function's `admin.rpc('process_payment_atomic', {...})` call now forwards `p_expected_version: body.expectedVersion` via a conditional spread, only when the caller supplied a value — a request without it produces a byte-identical RPC call to before this plan.
- `processCashPayment`, `processCardPayment`, and `processRappiPayment` each gained a trailing optional `expectedVersion?: number` parameter, forwarded into the `callProcessPayment` request object.
- `PaymentForm.runPayment` now passes `tab.version` as the new trailing argument on all three call sites (cash, card, rappi). When the cached tab predates the version column, `tab.version` is `undefined` and the RPC falls back to today's unguarded behavior — the documented graceful degradation, not a defect.
- Split-payment path (`processSplitPayment` / `process_split_payment_atomic`) intentionally untouched — confirmed out of scope by 15-CONTEXT.md D-02 and the plan's `carry_forward_notes`.

## Task Commits

Each task was committed atomically. Task 1 followed the plan's TDD instruction (RED test commit, then GREEN implementation commit):

1. **Task 1 (RED): expectedVersion test cases** - `2cd14e3` (test)
2. **Task 1 (GREEN): thread expectedVersion through both wire schemas into the RPC** - `277fc4a` (feat)
3. **Task 2: supply cached tab.version from PaymentForm through payment-processor** - `8662e3e` (feat)

**Plan metadata:** (this commit, docs — SUMMARY.md + deferred-items.md)

## Files Created/Modified
- `src/shared/lib/edge-function-contracts.ts` - added optional `expectedVersion: z.number().int().nonnegative().optional()` to `ProcessPaymentRequestSchema`'s inner object literal
- `src/shared/lib/edge-function-contracts.test.ts` - 5 new `ProcessPaymentRequestSchema` cases for `expectedVersion` (absent / 0 / 7 / -1 / 1.5)
- `supabase/functions/process-payment/index.ts` - mirrored `expectedVersion` field on `BodySchema`; conditional `p_expected_version` spread in the `process_payment_atomic` RPC call
- `src/shared/lib/payment-processor.ts` - trailing optional `expectedVersion?: number` param + forward on all three processor functions
- `src/shared/lib/payment-processor.test.ts` - regression test: forwards `expectedVersion` when supplied, omits it (`undefined`) when not
- `src/widgets/PaymentModal/ui/PaymentForm.tsx` - `tab.version` passed as the trailing argument at all three `runPayment` call sites
- `src/widgets/PaymentModal/ui/PaymentForm.test.tsx` - updated 2 stale `toHaveBeenCalledWith` assertions to account for the new trailing argument
- `src/widgets/PaymentModal/PaymentModal.test.tsx` - updated 3 stale `toHaveBeenCalledWith` assertions to account for the new trailing argument

## Decisions Made
- Placed `expectedVersion` immediately after `discountAmount` (renderer) / `rappiOrderId` (edge function) in each object literal, matching the plan's explicit placement instruction — keeps both schemas easy to diff against each other.
- No `.superRefine` cross-field rule added for `expectedVersion` — it is independently optional, unrelated to the existing cash/card/rappi conditional validation.
- Followed the plan's TDD instruction literally for Task 1 (tracer, tdd="true"): wrote and ran the 5 new schema test cases first (confirmed all 4 new-behavior cases RED), then implemented, then confirmed GREEN — separate `test(...)` and `feat(...)` commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 5 stale `toHaveBeenCalledWith` assertions in PaymentForm.test.tsx and PaymentModal.test.tsx**
- **Found during:** Task 2 verification (`npx vitest run src/shared/lib/payment-processor.test.ts src/widgets/PaymentModal`)
- **Issue:** Widening `processCashPayment`/`processCardPayment`/`processRappiPayment` with a new trailing parameter (as the plan's Task 2 explicitly instructs) made 5 pre-existing exact-arity `toHaveBeenCalledWith(...)` assertions fail — they asserted the old 4/5-argument call shape and now received an extra trailing `undefined` (the test fixtures' `Tab` objects have no `version` set).
- **Fix:** Added the expected trailing `undefined` argument to each assertion (2 in `PaymentForm.test.tsx`, 3 in `PaymentModal.test.tsx`), matching the now-correct call shape. No behavior changed — these are call-shape assertions catching up to the plan's own intended signature change.
- **Files modified:** `src/widgets/PaymentModal/ui/PaymentForm.test.tsx`, `src/widgets/PaymentModal/PaymentModal.test.tsx`
- **Verification:** `npx vitest run --project unit src/shared/lib/payment-processor.test.ts src/widgets/PaymentModal` — 57/57 pass
- **Committed in:** `8662e3e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 mechanical test-assertion update, Rule 1)
**Impact on plan:** No scope creep — a direct, unavoidable consequence of Task 2's own instructed signature change. No behavior changed outside what the plan specified.

## Issues Encountered
- **Fresh worktree had no `node_modules`.** Ran `npm ci` per the repo layout note before any test/typecheck/lint command would resolve.
- **No `.env.local` in the worktree** — `src/test/global-setup.ts` requires `VITE_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` to run any Vitest suite (pings live Supabase before tests start). Copied the (gitignored) `.env.local` from the main checkout at `/mnt/ai/bola8pos-kiro/bar-pos/.env.local` into the worktree root — confirmed gitignored (`git check-ignore -v .env.local`), never staged/committed.
- **Pre-existing unrelated test failures discovered during the plan's full `npm run test` gate**, logged to `.planning/phases/15-tabs-version-optimistic-concurrency/deferred-items.md` per the scope-boundary rule rather than fixed:
  - `src/widgets/PINLoginForm/PINLoginForm.test.tsx` — 5 failing tests (`forced_pin_change phase` suite + `does not log in when clock-in fails`). Confirmed unrelated: the file has zero dependency on any file this plan touches, is fully self-mocked, and fails identically in isolation (`npx vitest run src/widgets/PINLoginForm/PINLoginForm.test.tsx`) — a pre-existing environment issue, not a regression from this plan.
  - The documented pre-existing `useCloseTab.test.ts:95` failure (VERIFICATION.md carry-forward #4) did **not** reproduce in this run (`src/features/close-tab/tests/useCloseTab.test.ts` — 3/3 pass in isolation) — noted for the record, not investigated further (out of this plan's scope either way).

## User Setup Required

None — no external service configuration required. Deploying the edge function (`npx supabase functions deploy process-payment`) is explicitly out of scope for this plan; it is folded into the blocking human checkpoint in plan 15-09 per the plan's `carry_forward_notes`.

## Next Phase Readiness
- `expectedVersion` is now threaded end-to-end from `PaymentForm` through both wire schemas into `process_payment_atomic`'s `p_expected_version` — the edge function's version guard will fire on the next deploy.
- Plan 15-09's blocking checkpoint must (a) deploy `supabase/functions/process-payment/index.ts` and (b) run the live `e2e/39-concurrent-edits.spec.ts` E2E check — this plan does not deploy or E2E-verify the edge function change itself.
- The `PINLoginForm.test.tsx` failures logged in `deferred-items.md` are unrelated to Phase 15 and should be triaged as a separate follow-up (not blocking this plan or 15-09).

---
*Phase: 15-tabs-version-optimistic-concurrency*
*Completed: 2026-08-07*
