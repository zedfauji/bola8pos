---
phase: 26-floating-tables-is-temp
verified: 2026-07-29T17:34:09Z
status: human_needed
score: 12/13 must-haves verified
behavior_unverified: 1
overrides_applied: 0
human_verification:
  - test: "Run `npx playwright test e2e/04-pool-timer.spec.ts` (or manually start/stop a pool session for a non-floating table via the running app) once `e2e/helpers/supabase.ts`'s `resetTestState()` and the ~9-10 other e2e specs still calling `.from('pool_tables')` are fixed to target `resources`."
    expected: "All Pool Timer E2E cases pass, proving start/stop/billing for a normal (non-floating) table is unaffected by the rename end-to-end, not just at the unit/live-DB level."
    why_human: "Confirmed by direct execution in this verification session: `resetTestState()` (e2e/helpers/supabase.ts:58) still calls `.from('pool_tables')`, which silently no-ops since that relation no longer exists (Supabase JS does not throw on an unchecked `.update()` error here). This leaves prior test runs' resources stuck in `status='occupied'` across the whole shared Supabase Cloud project, so `e2e/04-pool-timer.spec.ts`'s `Start Session` button never renders and every case times out. Live DB query confirmed all 5 non-floating resources were left `occupied` after this session's runs. This is a test-harness defect (not an application-code regression — `stop_pool_session`'s `pg_proc.prosrc` is clean, `usePoolTimer.test.ts` is 8/8 green, and a real user hitting `/pool-tables` sees live `resources` data per `e2e/24-waitlist.spec.ts`'s own passing run), but it means SC-4's full user-journey proof cannot currently execute to a pass/fail verdict. Already tracked as WINDOWS.md items #1 and #2 (open, not waived) — surfaced here as a human-verification item per this agent's mandate rather than silently absorbed into a passing score."
---

# Phase 26: Floating Tables (`is_temp`) Verification Report

**Phase Goal:** Generalize `pool_tables` into a broader `resources` concept with a `FLOATING` type for temporary/ad-hoc tables (`is_temp`), an auto-deactivate trigger when no longer needed, and an auto-create flow from the waitlist.
**Verified:** 2026-07-29T17:34:09Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Verification Method

This report is based on: (1) reading all 4 PLAN.md/SUMMARY.md pairs and 26-CONTEXT.md, (2) live queries against the actual Supabase Cloud project (not trusting SUMMARY-reported query results), (3) fresh, independent runs of `npm run typecheck`/`lint`/`test`, the SC-2 integration test, the SC-3 E2E case, and an attempt at the SC-4 E2E case, all executed directly in this session — not read from prior logs. All Task commit hashes cited in the four SUMMARYs (`67b02e4`, `a3cda03`, `dc1b22d`, `f2c56be`, `891ea74`, `f8c2a75`, `459e880`, `5e506eb`, `d6cc420`, `c4394ce`) are present in `git log` on `main`, consistent with the execution note that all 4 plans landed directly on `main` with no worktree merge step outstanding.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `resources` relation exists; `pool_tables` does not (D-01) | ✓ VERIFIED | Live query: `to_regclass('public.resources')` → `resources`; `to_regclass('public.pool_tables')` → `null`. |
| 2 | `stop_pool_session`, `transfer_tab`, `transfer_pool_session` recreated clean and functional post-rename (SC-4, Pitfall 3) | ✓ VERIFIED | Live `pg_proc.prosrc` check: `stop_pool_session` and `transfer_tab` have zero `pool_table` references; `transfer_pool_session`'s only match is the unchanged `p_to_pool_table_id` *parameter name* (intentionally preserved per the plan's fixed-signature rule — every query inside its body correctly references `resources`/`resource_transfers`). Full function body read and confirmed. |
| 3 | Realtime publication covers the renamed relation | ✓ VERIFIED | Live `pg_publication_tables` query: `resources` is a member of `supabase_realtime`, including the new `is_temp` column in its replicated column list. |
| 4 | Application (`src/`) typechecks, lints, and passes its unit suite against the renamed schema (SC-1) | ✓ VERIFIED | Independently re-ran: `npm run typecheck` → exit 0 (no output = clean); `npm run lint` → exit 0 at max-warnings 0; `npm run test` → 1331 passed, 15 todo, 2 skipped (145 files), matching Plan 04's reported baseline exactly. |
| 5 | Zero residual `pool_tables` references in `src/` outside documented exceptions | ✓ VERIFIED | `grep -rn 'pool_tables' src` after excluding the two settings-key literals and the RBAC bogus-string returns exactly the 5 hits the SUMMARY documents as the intentional D-02 AI-agent-tool-name exception (`list_pool_tables`/`find_pool_table` in `posTools.ts` and the matching dispatch case in `agent/tools/index.ts`) — no undocumented survivors. |
| 6 | `resources.is_temp` column and 4-value `table_type` CHECK (incl. `'floating'`) are live, and every pre-existing row is unaffected (SC-1) | ✓ VERIFIED | Live query: `is_temp boolean not null default false`; `resources_table_type_check` CHECK expression lists all 4 values (`pool`, `carom`, `consumption`, `floating`). |
| 7 | A floating resource is soft-deleted the instant its session stops; disappears from client reads but remains in the DB (SC-2, D-04) | ✓ VERIFIED | Trigger `deactivate_floating_resource_on_session_stop` confirmed live: `AFTER UPDATE ON pool_sessions`, function `SECURITY DEFINER` with `search_path=public` pinned. Function body read directly — guards on `NEW.stopped_at IS NOT NULL AND OLD.stopped_at IS NULL`, narrows the `UPDATE resources` by `is_temp = TRUE AND is_deleted = FALSE`, never issues `DELETE`. |
| 8 | A non-floating resource is untouched by the identical session-stop event (SC-2, SC-4) | ✓ VERIFIED | Same trigger body's `is_temp = TRUE` predicate is the only path into the retiring UPDATE; independently confirmed via a fresh run of the 5-case integration test (see below), which includes this exact no-regression case. |
| 9 | SC-2 is covered by an automated integration test exercising both directions, soft-delete persistence, RLS invisibility, and idempotence | ✓ VERIFIED | Freshly re-ran `npx vitest run src/entities/resource/model/deactivate-floating-resource.integration.test.ts` against live Supabase Cloud in this session: **5/5 pass.** All 5 named cases present and exercised (retire, soft-delete-not-hard-delete via service-role client, RLS invisibility via anon client, non-floating no-regression, idempotence on repeated stop). |
| 10 | The seat-party sheet offers an explicit, staff-clicked action to seat at a new temporary table only when nothing is free (SC-3, D-05) | ✓ VERIFIED | Code inspection of `SeatPartySheet.tsx`: the action renders only inside the `availableTables.length === 0` branch, alongside (not replacing) the existing "no tables" message; wired to `useSeatAtNewTable` via exactly one `onClick`. Freshly re-ran `npx playwright test e2e/24-waitlist.spec.ts -g "Waitlist floating-table seating"` in this session (fresh process, not reusing Plan 04's prior run): **2/2 pass** (T6 positive case, T7 negative case), 53.9s. |
| 11 | The created resource's number/rate follow the admin add-table flow's rules verbatim (D-03, D-06) | ✓ VERIFIED | `useSeatAtNewTable` in `useSeatWaitlistParty.ts`: `Math.max(0, ...input.tables.map(t => t.number)) + 1` and `input.tables[input.tables.length - 1]?.ratePerHour ?? DEFAULT_RATE_PER_HOUR` (`= 12`) — byte-identical expressions to `PoolTablesSettingsTab.tsx`'s `handleAddTable` (`Math.max(0, ...sortedTables.map(...)) + 1` / `?? 12`). No reserved range, no rate tier. |
| 12 | A floating resource is visually distinguishable at a glance | ✓ VERIFIED | `ResourceCard.tsx`'s `TABLE_TYPE_VARIANT` map: `floating: 'destructive'`, distinct from `pool: 'default'`, `carom: 'secondary'`, `consumption: 'outline'` — all 4 variants now used, no collision. Confirmed rendered in the T6 E2E run (`table-type-badge` filtered to "Floating" was asserted visible and the test passed). |
| 13 | Existing pool-table timer/billing flows unaffected, proven end-to-end (SC-4) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Underlying logic is present and proven at the unit/live-DB level (truths #2, #4 above; `usePoolTimer.test.ts` re-run fresh in this session: 8/8 pass). However, a fresh, independent attempt to run `npx playwright test e2e/04-pool-timer.spec.ts` in this session **failed all 10 cases** — root-caused (not just repeated from the SUMMARY) to `e2e/helpers/supabase.ts:58`'s `resetTestState()` still calling `.from('pool_tables')`, which silently no-ops and leaves resources stuck `occupied` across runs (confirmed via a live query showing all 5 non-floating resources `occupied` after this session's test activity). This is a test-harness defect, not an app regression — see Human Verification. |

**Score:** 12/13 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260728000001_rename_pool_tables_to_resources.sql` | Rename DDL + 3 function recreations | ✓ VERIFIED | Present; live DB matches its intent exactly (see truths 1-3). |
| `supabase/migrations/20260728000002_resources_is_temp_floating.sql` | `is_temp` column + 4-value CHECK | ✓ VERIFIED | Present; live DB matches (truth 6). |
| `supabase/migrations/20260728000003_deactivate_floating_resource_trigger.sql` | Trigger function + trigger | ✓ VERIFIED | Present; full body read, matches live `pg_proc`/`pg_trigger` state exactly (truth 7). |
| `src/entities/resource/` (moved from `src/entities/pool-table/`) | Renamed entity folder | ✓ VERIFIED | `src/entities/pool-table/` absent; `src/entities/resource/` present with `index.ts`, `model/`, `ui/`. |
| `src/entities/resource/model/deactivate-floating-resource.integration.test.ts` | 5-case integration test | ✓ VERIFIED | Present; 5/5 passing on fresh run against live DB. |
| `src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` (`useSeatAtNewTable`) | Composed create-and-seat mutation | ✓ VERIFIED | Present, wired, reused verbatim numbering/rate logic confirmed by direct read. |
| `src/entities/resource/ui/ResourceCard.tsx` | 4th `floating` lookup entries | ✓ VERIFIED | Both `TABLE_TYPE_LABEL_KEY`/`TABLE_TYPE_VARIANT` have exactly 4 entries. |
| `e2e/24-waitlist.spec.ts` | SC-3 positive + D-05 negative E2E cases | ✓ VERIFIED | Both cases present and passing on a fresh, independent run in this session. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `pool_sessions.table_id` (UPDATE) | `resources` | `deactivate_floating_resource()` trigger | ✓ WIRED | Live `pg_trigger`: exactly one trigger for this function, on `pool_sessions`, none on `tabs`. |
| Entity query layer | `resources` | PostgREST embed hint `fk_resources_current_session` | ✓ WIRED | Confirmed present in `src/entities/resource/model/queries.ts`; constraint exists live (renamed via `ALTER TABLE...RENAME CONSTRAINT`, not dropped/recreated). |
| `SeatPartySheet`'s inline query cache key | Entity layer `resourceKeys.all` | Literal `['resources']` shared cache key | ✓ WIRED | Both use the literal `'resources'` query key — confirmed by direct read of both files. |
| `useSeatAtNewTable` | `useMutationAddResource` → `seatParty` | Composed mutation, `table.id` flows into the seat call | ✓ WIRED | Direct read of `useSeatAtNewTable`: create failure short-circuits before any seat call; the created `table.id`/`table.number`/`table.label` are threaded into `seatParty`'s input. |
| `e2e/04-pool-timer.spec.ts` / `e2e/helpers/supabase.ts` | `resources` | `.from('pool_tables')` (stale) | ✗ NOT_WIRED | 10 files under `e2e/` (incl. the shared helper) still target the pre-rename relation name; confirmed by grep and by a live failing test run in this session. |

### Behavioral Spot-Checks / Fresh Test Runs (this session)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| App-layer schema sync (types + shim) | `npm run typecheck && npm run lint && npm run test` | 0 / 0 / 1331 passed, 15 todo, 2 skip | ✓ PASS |
| Trigger retires floating, spares non-floating, idempotent, soft-delete, RLS-hidden (SC-2) | `npx vitest run src/entities/resource/model/deactivate-floating-resource.integration.test.ts` | 5/5 pass | ✓ PASS |
| Pool-timer billing math unaffected (SC-4, unit level) | `npx vitest run src/entities/resource/model/usePoolTimer.test.ts` | 8/8 pass | ✓ PASS |
| Waitlist floating-table seat flow, positive + negative (SC-3, D-05) | `npx playwright test e2e/24-waitlist.spec.ts -g "Waitlist floating-table seating"` | 2/2 pass, 53.9s | ✓ PASS |
| Pool-timer full E2E journey (SC-4, full-journey level) | `npx playwright test e2e/04-pool-timer.spec.ts` | 10/10 failed | ✗ FAIL (root-caused to e2e-harness `pool_tables` residue, not app code — see truth #13 / Human Verification) |

### Requirements Coverage

No formal REQUIREMENTS.md IDs exist for this phase (source doc `POS-COMPARISON.md §26` no longer present). Coverage is assessed against ROADMAP.md's SC-1..SC-4 and 26-CONTEXT.md's D-01..D-06, per the phase's own documented spec-less fallback.

| Item | Description | Status | Evidence |
|------|-------------|--------|----------|
| SC-1 | `resources` generalization supports `FLOATING`/`is_temp` without breaking existing consumers | ✓ SATISFIED (app-layer); ⚠️ partial at e2e-consumer layer | Schema + app code fully migrated and green; `e2e/` consumers of `pool_tables` (10 files) remain broken — tracked, not remediated by this phase's plans. |
| SC-2 | Auto-deactivate trigger retires floating tables | ✓ SATISFIED | Live trigger + 5/5 integration test, fresh run. |
| SC-3 | Waitlist can auto-create a floating table when nothing is free | ✓ SATISFIED | Fresh E2E run, 2/2 pass. |
| SC-4 | Existing pool-table timer/billing flows unaffected | ✓ SATISFIED at unit/DB level; ⚠️ UNVERIFIED at full E2E-journey level | See truth #13. |
| D-01 | Full rename (relation, enum, transfers table, indexes, constraints, trigger, 5 RLS policies) | ✓ SATISFIED | Live catalog confirms `resource_status` enum, `resource_transfers` table/columns/policies, all renamed objects present. |
| D-02 | User-facing routes/nav/copy unchanged | ✓ SATISFIED | `router.tsx` still registers `/pool-tables`; no route/nav/i18n-value diffs reported by any plan and none found on inspection. |
| D-03 | No reserved number range | ✓ SATISFIED | `Math.max(0, ...) + 1`, verbatim admin-flow logic, no offset constant present. |
| D-04 | Event-driven trigger, soft-delete only | ✓ SATISFIED | Confirmed live; zero `DELETE FROM resources` in either migration. |
| D-05 | Explicit staff click required, no implicit auto-create | ✓ SATISFIED | Exactly one invocation site (button `onClick`); T7 negative case passes. |
| D-06 | Same default rate as admin flow | ✓ SATISFIED | `DEFAULT_RATE_PER_HOUR = 12`, matches `handleAddTable`'s `?? 12`. |

### Anti-Patterns Found

None in the phase's own source changes. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the files this phase created or modified. The one open debt item (`e2e/` still referencing `pool_tables`) is tracked via the repo's own broken-windows ledger (`.planning/WINDOWS.md`, items #1 and #2, both `open`), not left as an undocumented code comment.

### Pre-existing, Out-of-Scope Findings (not phase 26 must-haves)

- `src/entities/staff/model/queries.clock.test.ts > useMutationClockOut > optimistically sets clockOut then commits server shift` fails when run in isolation (`expected false to be true`) but passes when run as part of the full suite — appears order/timing-dependent (flaky), not a regression. Confirmed via `git diff 7d55b1c HEAD -- <the two files>` — zero diff, so phase 26 did not touch either file. Not scored against this phase.
- `.planning/WINDOWS.md` currently lists 2 open items, both attributable to phase 26's rename but explicitly out of the 4 plans' file scope: (1) `e2e/04-pool-timer.spec.ts` not run to a verdict during Plan 02 (dev-server issue at the time); (2) the same spec plus ~9 other e2e files and `e2e/helpers/supabase.ts` still query `.from('pool_tables')`. This verification independently reproduced and root-caused item #2: `resetTestState()` silently no-ops its `pool_tables` update, leaving resources stuck `occupied` across test runs and causing `e2e/04-pool-timer.spec.ts` to time out waiting for a "Start Session" button that never appears (not because pool sessions are broken, but because no table is ever "available").
- This verification's own fresh test runs (T6 in `24-waitlist.spec.ts`, and the failed attempts at `04-pool-timer.spec.ts`) left all 5 non-floating `resources` rows in `status='occupied'` on the shared Supabase Cloud project. A cleanup UPDATE was attempted but blocked by this session's tool-permission policy; a human or a subsequent test run with working `resetTestState()` should restore these to `available`.

### Human Verification Required

1. **Pool-timer E2E full-journey verdict (SC-4).**
   **Test:** Fix `e2e/helpers/supabase.ts`'s `resetTestState()` (and the ~9 other e2e spec files still on `.from('pool_tables')`) to target `resources`, then run `npx playwright test e2e/04-pool-timer.spec.ts`.
   **Expected:** All 10 cases pass, giving an end-to-end (not just unit/DB-level) proof that starting, stopping, and billing a normal pool session is unaffected by the D-01 rename.
   **Why human:** This verification confirmed the current failure is a test-harness defect (stale relation name silently no-oping a state reset), not application code — the actual billing RPC, trigger, and UI data path are all independently proven correct. But no automated check in this repo currently closes that last gap, and the fix touches ~10 files outside this phase's plan scope, so it needs a deliberate decision on where that remediation lands (a new todo, a phase 26 follow-up plan, or folded into a future e2e-hygiene phase).

## Gaps Summary

No must-have was found to be missing, stubbed, or unwired. All schema changes (D-01 rename, D-04 trigger, is_temp/floating) are live and independently confirmed against the real database in this session, not just read from SUMMARY claims. The application source tree is fully migrated and green. The waitlist auto-create flow (SC-3) and the auto-deactivate trigger (SC-2) both have fresh, passing automated proof captured directly in this session.

The one open item is SC-4's full end-to-end proof: `e2e/04-pool-timer.spec.ts` cannot currently reach a pass verdict because its own harness (`e2e/helpers/supabase.ts`) was never updated to the renamed relation — a gap that predates and is broader than this phase's 4 plans (10 files, none of which were in any plan's file list except the one file Plan 04 did touch, `e2e/24-waitlist.spec.ts`, correctly). This is not a defect in the code this phase wrote; it is a real, currently-reproducible verification gap for a roadmap-level success criterion, already tracked in `.planning/WINDOWS.md` as open items #1 and #2. Per this agent's mandate it is surfaced here as a human-verification item rather than folded into a clean "passed" score.

---

*Verified: 2026-07-29T17:34:09Z*
*Verifier: Claude (gsd-verifier)*
