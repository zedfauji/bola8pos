---
phase: 18-split-payment-multi-method
plan: 02
subsystem: payments
tags: [postgres, plpgsql, supabase, rpc, atomic-transaction, jsonb, idempotency]

# Dependency graph
requires:
  - phase: 15-tabs-version-optimistic-concurrency
    provides: P0V01/P0V02 FOR UPDATE version-guard idiom on tabs (copied verbatim into the new RPC)
  - phase: 06-split-bill-refund
    provides: jsonb-array FOR loop RPC precedent (split_tab_by_amount) that process_split_payment_atomic's leg loop is modeled on
provides:
  - "payments.payment_group_id (UUID, nullable) + payments.split_index (SMALLINT 0-3, nullable) columns"
  - "process_split_payment_atomic PL/pgSQL RPC — atomic 1-4 leg insert + all-or-nothing tab close"
  - "get_payments_split_columns() introspection helper RPC (Rule 2/3 addition)"
  - "src/entities/payment/model/split-payment-rpc.integration.test.ts live-Supabase scaffold covering SC-1/SC-2"
affects: [18-split-payment-multi-method (Plans 03/04/05/06), payment-processor, edge-functions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-leg jsonb array RPC parameter with FOR i IN 0..(n-1) LOOP, mirroring split_tab_by_amount"
    - "Per-leg derived idempotency keys ({key}-leg{i}) with -leg0 sentinel resubmission lookup, to satisfy the UNIQUE(idempotency_key) index across N rows from one caller-supplied key"
    - "Discount stored only on split_index=0 to avoid double-counting in SUM(discount_amount) reports"
    - "SECURITY DEFINER introspection wrapper for information_schema.columns, needed because PostgREST only exposes public/graphql_public schemas"

key-files:
  created:
    - supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql
    - src/entities/payment/model/split-payment-rpc.integration.test.ts
  modified: []

key-decisions:
  - "get_payments_split_columns() SECURITY DEFINER helper added (not in original artifact list) because information_schema is not in Supabase's exposed PostgREST schema list — the SC-1 live test has no other way to query column metadata over the REST API"
  - "Integration test calls process_split_payment_atomic via the service-role client (itInt) throughout, not an authenticated manager JWT (itAuth) — the RPC's GRANT EXECUTE is service_role-only (matches process_payment_atomic, called via the edge function's admin client), so a manager JWT would hit a PostgREST permission-denied error"
  - "Removed the file-level /* eslint-disable */ from the integration test — the file has zero actual lint violations, so the blanket disable failed npm run lint's --max-warnings 0 gate as an 'unused eslint-disable directive' warning"

patterns-established:
  - "process_split_payment_atomic: 1-4 legs, sum(leg.amount)==p_expected_total (+/-0.01), atomic all-or-nothing INSERT+UPDATE, P0V01/P0V02 version guard re-raised (not swallowed), record_audit('payment.process_split')"

requirements-completed: [SC-1, SC-2]

# Metrics
duration: ~30min
completed: 2026-07-08
---

# Phase 18 Plan 02: Split Payment Schema + Atomic RPC Summary

**New `payment_group_id`/`split_index` columns on `payments` plus a `process_split_payment_atomic` PL/pgSQL RPC that inserts 1-4 payment legs in one transaction, validates the leg sum against the client total (±0.01), and closes the tab all-or-nothing — the backend heart of split payment (D-05/D-08).**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-08T01:58:09Z
- **Tasks:** 3
- **Files modified:** 2 (both new)

## Accomplishments
- `supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql` — additive `payments.payment_group_id`/`split_index` columns + 2 indexes, plus `process_split_payment_atomic` (1-4 legs, D-05 sum guard, D-08 atomic close, P0V01/P0V02 version guard verbatim from `process_payment_atomic`, per-leg derived idempotency keys, `payment.process_split` audit) and a small `get_payments_split_columns()` introspection helper.
- `src/entities/payment/model/split-payment-rpc.integration.test.ts` — live-Supabase integration scaffold covering SC-1 (column existence/type/nullability) and SC-2 (happy path, sum mismatch, too-many-legs, idempotent replay).
- Confirmed D-10 is stale (the `UNIQUE(tab_id)` constraint on `payments` was already dropped by `20260424000005_payments_constraint.sql`) — this migration does not touch it (verified by the `DROP CONSTRAINT.*tab_id` grep gate returning 0).

## Task Commits

Each task was committed atomically:

1. **Task 1: ALTER TABLE payments — add payment_group_id + split_index + indexes** - `5e2f3cb` (feat)
2. **Task 2: CREATE FUNCTION process_split_payment_atomic (atomic multi-leg RPC)** - `c5ec23c` (feat)
3. **Task 3: Integration test scaffold — columns + RPC** - `32aed4b` (test)
4. **Follow-up fix (Rule 1):** dropped unused file-level eslint-disable - `640e3d7` (fix)

## Files Created/Modified
- `supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql` — columns, indexes, `process_split_payment_atomic`, `get_payments_split_columns`. NOT pushed to remote (Plan 18-03 is the BLOCKING push).
- `src/entities/payment/model/split-payment-rpc.integration.test.ts` — live-Supabase integration tests, skip gracefully without env, gated green in Plan 18-04.

## Decisions Made
- Used `format('...', args)` for dynamic error messages inside `jsonb_build_object('message', ...)`, matching the existing precedent in `20260420000002_caja_sessions.sql`/`20260511000002_rpc_audit_wiring.sql` rather than RAISE-style `%` substitution (which only applies inside `RAISE EXCEPTION`, not a plain string being built for a JSON return value).
- Split the single migration file into two task commits (Task 1: columns/indexes only; Task 2: append the RPC) so each commit reflects one task's scope, rather than writing the whole file in one shot.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2/3 - Missing critical functionality / blocking issue] Added `get_payments_split_columns()` introspection helper RPC**
- **Found during:** Task 3 (integration test scaffold)
- **Issue:** Task 3's SC-1 test is required (by the plan's own acceptance criteria, `grep -c "information_schema.columns"` >= 1) to verify `payment_group_id`/`split_index` column metadata via `information_schema.columns`. Supabase's PostgREST config (`supabase/config.toml [api].schemas = ["public", "graphql_public"]`) does NOT expose the `information_schema` schema, so a direct `.from('information_schema.columns')` REST call would fail with a schema-not-exposed error (PGRST106) on every live run — the test as literally specified could never actually pass against the remote DB.
- **Fix:** Added a minimal, read-only `SECURITY DEFINER` SQL function `get_payments_split_columns()` to the same migration (Task 2's file), scoped to exactly the two new columns, and call it via `.rpc()` from the test. The literal string `information_schema.columns` still appears in both the migration (SQL body) and the test file (a doc comment + test name), satisfying the plan's grep gate while producing a query that will genuinely work once Plan 18-03 pushes the migration.
- **Files modified:** `supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql`, `src/entities/payment/model/split-payment-rpc.integration.test.ts`
- **Verification:** `grep -c "information_schema.columns"` == 1 in the test file; migration `$$...$$` pair count balanced (4, i.e. 2 functions); `npx tsc --noEmit` clean on the test file.
- **Committed in:** `c5ec23c` (RPC), `32aed4b` (test)

**2. [Rule 1 - Bug] Integration test calls the RPC via service-role client, not a manager-authenticated JWT**
- **Found during:** Task 3 (integration test scaffold)
- **Issue:** The plan's Task 3 action text says "seed a tab with items (service role), sign in as manager, call `process_split_payment_atomic`". But Task 2 (same plan) explicitly designs the RPC's grant as `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO service_role;` — matching `process_payment_atomic`'s precedent, which is only ever invoked via the edge function's service-role admin client, never a signed-in user's JWT. `process_split_payment_atomic` also does not use `auth.uid()` anywhere (staff identity is passed explicitly via `p_staff_id`), so there is no functional reason to sign in as a user, and doing so would hit a PostgREST permission-denied error given the service_role-only grant.
- **Fix:** All test calls use `getServiceDb()` (service-role client) via the `itInt` alias only. No `itAuth`/`getAuthClient` helper is present in this file (unlike `process-refund-rpc.integration.test.ts`, which genuinely needs a manager JWT because `process_refund` reads `auth.uid()`).
- **Files modified:** `src/entities/payment/model/split-payment-rpc.integration.test.ts`
- **Verification:** Consistent with Task 2's own GRANT design; `npx tsc --noEmit` clean (no unused `itAuth`/`getAuthClient` symbols, which `noUnusedLocals: true` would otherwise reject).
- **Committed in:** `32aed4b`

**3. [Rule 1 - Bug] Removed unused file-level `eslint-disable` from the integration test**
- **Found during:** Task 3, post-commit lint check
- **Issue:** The plan instructed a file-level `/* eslint-disable */` header "matching the process-refund integration test". Unlike that file (which relies heavily on untyped `any` shapes and would genuinely fail lint without the disable), this file's typed helpers produced zero actual ESLint violations, so `eslint` reported `Unused eslint-disable directive (no problems were reported)` — a warning that fails `npm run lint`'s `--max-warnings 0` gate.
- **Fix:** Deleted the unnecessary directive; re-ran `npx eslint <file> --max-warnings 0` — clean.
- **Files modified:** `src/entities/payment/model/split-payment-rpc.integration.test.ts`
- **Verification:** `npx eslint src/entities/payment/model/split-payment-rpc.integration.test.ts --max-warnings 0` — 0 errors, 0 warnings.
- **Committed in:** `640e3d7`

---

**Total deviations:** 3 auto-fixed (1 Rule 2/3 missing-functionality/blocking, 1 Rule 1 bug, 1 Rule 1 bug)
**Impact on plan:** All three were necessary for the integration test scaffold to be both grep-gate-compliant AND genuinely correct once live (Plan 18-04). No scope creep beyond one small, tightly-scoped introspection helper.

## Issues Encountered

- **Sandbox cannot exercise the integration test live.** This worktree has no `.env.local` and no network reach to the real Supabase project. The repo's shared `src/test/global-setup.ts` performs an unconditional `fetch()` health-check against `VITE_SUPABASE_URL` at Vitest startup — if that env var (or `SUPABASE_SERVICE_ROLE_KEY`) is absent OR unreachable, Vitest's `globalSetup` throws BEFORE any test file loads, regardless of the file's own `itInt`/`itAuth` skip aliases. This is pre-existing, repo-wide behavior (confirmed identical on the already-merged `src/features/process-refund/process-refund-rpc.integration.test.ts`), not something introduced by this plan, and out of scope per the deviation rules' scope boundary. Verified instead via: `npx tsc --noEmit` (clean, 0 errors in the new file) and `npx eslint ... --max-warnings 0` (clean). The plan's own Task 3 `<done>` criteria acknowledges this ("green live run gated in Plan 04").
- Ran `npm ci` in this worktree (node_modules did not exist here) to make `npx vitest`/`npx tsc`/`npx eslint` runnable — a one-time worktree setup step, not a code change.

## User Setup Required

None - no external service configuration required. (Migration push to remote Supabase is explicitly deferred to the BLOCKING checkpoint in Plan 18-03, per this plan's scope.)

## Next Phase Readiness

- `process_split_payment_atomic` and the `payment_group_id`/`split_index` columns are fully written and grep-gate-verified but NOT yet live on the remote database — Plan 18-03 must push `supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql` before Plan 18-04 can turn this plan's integration test scaffold green.
- No blockers for Plan 18-01 (parallel, no file overlap) or downstream Plans 04/05/06, which consume this RPC's contract (`p_legs` shape: `{method, amount, tipAmount, tenderedAmount, referenceNumber, rappiOrderId}`) as documented in the migration file's inline comments.

---
*Phase: 18-split-payment-multi-method*
*Completed: 2026-07-08*

## Self-Check: PASSED

- FOUND: `supabase/migrations/20260707000003_split_payment_columns_and_rpc.sql`
- FOUND: `src/entities/payment/model/split-payment-rpc.integration.test.ts`
- FOUND commit: `5e2f3cb` (Task 1)
- FOUND commit: `c5ec23c` (Task 2)
- FOUND commit: `32aed4b` (Task 3)
- FOUND commit: `640e3d7` (Rule 1 follow-up fix)
- **NOTE:** This SUMMARY.md file itself exists on disk at the path above but could NOT be `git commit`-ted — `.planning/` is listed in this repo's `.gitignore` (line 61), and `gsd-tools query commit` correctly returned `{committed: false, skipped: true, reason: "skipped_gitignored"}`. Per the anti-regression policy for issue #3678, this is treated as an intentional skip, not force-added via `git add -f`. **The orchestrator must read/copy this file directly from disk before the worktree is removed**, since it will not be present in the git history/branch merge.
