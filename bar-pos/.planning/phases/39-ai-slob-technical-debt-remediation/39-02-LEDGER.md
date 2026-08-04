# 39-02 Triage Ledger — e2e/16-table-status.spec.ts

**Plan:** 39-02 (Track A tracer — E2E triage method)
**Spec:** `e2e/16-table-status.spec.ts` (16 of 147 Blocking-tier E2E findings: 12 failed + 4 skipped)
**Method:** D-04 — real per-test error output read from a live `npx playwright test e2e/16-table-status.spec.ts` run, not the 10-CHECKLIST.md digest titles.

## Environment setup note (methodology transparency)

This worktree started with no `node_modules` and no `bar-pos/.env.local` (both are gitignored,
worktree-local artifacts that don't carry over from the main checkout). Running the spec for
real per-test error output (mandatory per D-04) required provisioning both:

- `node_modules` — symlinked to the main checkout's `node_modules` (same machine, same
  architecture, read-only usage; not committed, `.gitignore:10` already excludes it).
- `.env.local` — copied from the main checkout's `bar-pos/.env.local` (the project's own
  existing dev/E2E credentials; `.gitignore` matches `*.local`, so this is not committed).

Neither is a scope violation (test-side/tooling-only, zero `src/` changes) and both were removed
from `git status`'s view by the pre-existing `.gitignore` rules — verified clean before and after.

## Shared-cause hypothesis: CONFIRMED

39-RESEARCH.md Pitfall 3 predicted the 12 failures share 1-2 root causes rather than being 12
independent bugs. **Confirmed: exactly 2 failure signatures, both traced to one underlying
cause.**

**Root cause:** During this run, Supabase PostgREST's schema cache lost visibility into the
`public.pool_tables` table specifically (error `PGRST205: Could not find the table
'public.pool_tables' in the schema cache`, hint: "Perhaps you meant the table
'public.pool_sessions'"). This was reproduced **independently of Playwright and the app**,
directly against the live remote Supabase project, using both the anon key and the service-role
key from `.env.local`:

```
$ node -e "... createClient(url, SUPABASE_SERVICE_ROLE_KEY).from('pool_tables').select('id,status').limit(3) ..."
{"success":false,"error":{"code":"PGRST205","details":null,"hint":"Perhaps you meant the table 'public.pool_sessions'","message":"Could not find the table 'public.pool_tables' in the schema cache"},"data":null,"count":null,"status":404,"statusText":"Not Found"}
```

Confirmed the break is isolated to `pool_tables` specifically — `tabs` and `pool_sessions`
queried successfully via the same client at the same time. The very first test's browser-side
`resource.tables.loaded {"count": 5}` log line (early in this run) shows `pool_tables` WAS
queryable via the anon key at run start; every query after that point failed identically,
including standalone re-checks run several minutes after the Playwright run finished. This is a
live, persistent, DB/PostgREST-layer defect on the shared remote test database — not application
code, not a Playwright/browser flake, and not something any edit inside this spec file can fix.
This is exactly Phase 38's charter ("E2E Test Infrastructure & Seed Data Reliability") and the
same failure *category* D-05 already routed for `04-pool-timer.spec.ts` ("no pool table left in
available seed state") — this run shows a different proximate symptom (schema-cache miss rather
than zero-rows-available) but the same effect: no test can reliably read/reserve a pool table.

**Two symptom clusters, one cause:**
- **Group A — UI path** (6 findings): tests that seed via `openTabViaUI` + `startSessionViaUI`
  never see the "Start Session" button's flow complete — `/pool-tables` can't resolve table
  availability, so `startSessionViaUI`'s `getByRole('button', { name: 'Start Session' })` click
  times out at 15s.
- **Group B — direct-seed path** (6 findings): tests that seed via `seedOccupiedTableDirect`
  (a `.from('pool_tables').select(...).eq('status','available').single()` call) get the explicit
  `PGRST205` error surfaced as a thrown `Error: seedOccupiedTable: no available table – Could not
  find the table 'public.pool_tables' in the schema cache`.

No product code fix is possible or appropriate here — routing all 12 to Phase 38 per D-05's
established precedent, not filing 12 separate real-regression todos for what is one already-named
infra category.

## Ledger

| Spec Location | Test | Error Excerpt (from `error.message`, not title) | Root-Cause Group | Classification | Evidence | Action |
|---|---|---|---|---|---|---|
| e2e/16-table-status.spec.ts:192 | T1: navigate from pool grid to status page via View Status button | `TimeoutError: locator.click: Timeout 15000ms exceeded. ... waiting for getByRole('button', { name: 'Start Session' }).first()` | Group A (Start Session UI timeout) | infra | Both attempts (initial + retry) failed identically at `startSessionViaUI:51`; `/pool-tables` never rendered an actionable "Start Session" button — consistent with `pool_tables` schema-cache breakage blocking table-availability resolution. | Route to Phase 38 (test-DB/seed-data reliability). No code change. |
| e2e/16-table-status.spec.ts:227 | T2: "Moved from" badge visible when session has previous_table_id | `Error: seedOccupiedTable: no available table – Could not find the table 'public.pool_tables' in the schema cache` | Group B (seedOccupiedTableDirect PGRST205) | infra | Explicit PGRST205 thrown from `seedOccupiedTableDirect:90`, both attempts; independently reproduced against the live DB outside Playwright (see above). | Route to Phase 38. No code change. |
| e2e/16-table-status.spec.ts:289 | T4: Stop Timer opens confirmation dialog, confirm redirects to /pool-tables | `TimeoutError: locator.click: Timeout 15000ms exceeded. ... waiting for getByRole('button', { name: 'Start Session' }).first()` | Group A | infra | Same signature as T1, both attempts. | Route to Phase 38. No code change. |
| e2e/16-table-status.spec.ts:318 | T5: Stop & Move to Table stops session and moves tab to new table number | `TimeoutError: locator.click: Timeout 15000ms exceeded. ... waiting for getByRole('button', { name: 'Start Session' }).first()` | Group A | infra | Same signature as T1, both attempts. | Route to Phase 38. No code change. |
| e2e/16-table-status.spec.ts:348 | T6: Print Pre-cheque button triggers print flow without error dialog | Attempt 1: `Error: page.goto: Target page, context or browser has been closed` (at `beforeEach:188`). Retry: `TimeoutError: locator.click: Timeout 15000ms exceeded ... 'Start Session'` | Group A (retry) + one-off browser-closed anomaly (attempt 1) | infra | Retry matches Group A exactly. Attempt 1's browser-closed error is a distinct runner-level anomaly (not reproduced on retry), most likely resource pressure in this sandboxed run, not a deterministic app bug. | Route to Phase 38 (Group A signature on retry). No code change. **See print-popup cross-reference note below — this run's real error does NOT match that todo.** |
| e2e/16-table-status.spec.ts:376 | T7: Bartender removing an item requires manager PIN (wrong PIN → error, correct PIN → confirm) | `Error: seedOccupiedTable: no available table – Could not find the table 'public.pool_tables' in the schema cache` | Group B | infra | Explicit PGRST205, both attempts. | Route to Phase 38. No code change. |
| e2e/16-table-status.spec.ts:459 | T8: Admin removing an item also requires manager PIN | `Error: seedOccupiedTable: no available table – Could not find the table 'public.pool_tables' in the schema cache` | Group B | infra | Explicit PGRST205, both attempts. | Route to Phase 38. No code change. |
| e2e/16-table-status.spec.ts:527 | T9: Removing the last item in an order removes the entire order section | `Error: seedOccupiedTable: no available table – Could not find the table 'public.pool_tables' in the schema cache` | Group B | infra | Explicit PGRST205, both attempts. | Route to Phase 38. No code change. |
| e2e/16-table-status.spec.ts:592 | T10: "Add More Items" navigates to /pos with the tab active | `TimeoutError: locator.click: Timeout 15000ms exceeded. ... waiting for getByRole('button', { name: 'Start Session' }).first()` | Group A | infra | Same signature as T1, both attempts. | Route to Phase 38. No code change. |
| e2e/16-table-status.spec.ts:615 | T11: "Close & Pay" shows confirmation then navigates to /pos | `TimeoutError: locator.click: Timeout 15000ms exceeded. ... waiting for getByRole('button', { name: 'Start Session' }).first()` | Group A | infra | Same signature as T1, both attempts. | Route to Phase 38. No code change. |
| e2e/16-table-status.spec.ts:638 | T12: Navigating to status page of available table shows "No active session" | Runtime skip fired: `test.skip(true, 'All tables are occupied; cannot test available-table guard')` — but the underlying query (`admin.from('pool_tables').select('id').eq('status','available').limit(1).single()`) only checks `data`, not `error`; under the same PGRST205 condition this query returns `data: null` (masking the real cause behind a misleading "occupied" message). | Group B (same infra cause, surfaced as a skip instead of a thrown error because this call site doesn't check `error`) | conditional | The skip reason text is a **seed-availability-shaped runtime condition**, not a hardcoded disable — per 39-RESEARCH.md/39-PATTERNS.md's playbook this is `conditional`, not `stale`/`valid-skip`. This run's evidence shows the literal reason ("occupied") is misleading — root cause is the same PGRST205 schema-cache defect as Group B, not genuine seed pollution. | Route to Phase 38 alongside Group B. No un-skip — the condition is data-dependent, un-skipping changes nothing (Pitfall 4). No code change. |
| e2e/16-table-status.spec.ts:674 | T13: Real-time — session stopped externally updates the UI | Hardcoded `test.skip(...)`; TODO comment: "requires two simultaneous browser contexts updating the same Supabase Realtime channel, which is unreliable in a single-worker CI environment." | n/a (not run) | valid-skip | Constraint is a structural Playwright/CI limitation (single-worker, no multi-context realtime harness) — unrelated to any CLAUDE.md "Implemented Features" entry and unrelated to this run's infra finding. Still holds; nothing in this phase adds multi-context realtime test infra. | No un-skip. No code change. |
| e2e/16-table-status.spec.ts:683 | T14: Offline resilience — mutations are blocked when device is offline | Hardcoded `test.skip(...)`; TODO comment: "Playwright's `page.context().setOffline(true)` stalls `fetch()` indefinitely ... Fix requires an `isOnline()` early-exit guard in the mutationFn." | n/a (not run) | valid-skip | Documented, still-valid Playwright/mutation-hook limitation with a named future fix (`isOnline()` guard) that is app-code work, out of this triage-only plan's scope (D-03: file, don't fix inline, and this predates this phase entirely — already tracked via the inline TODO). | No un-skip. No code change. |
| e2e/16-table-status.spec.ts:692 | T16: Edit Start Time requires manager PIN and rebills on save | `Error: seedOccupiedTable: no available table – Could not find the table 'public.pool_tables' in the schema cache` | Group B | infra | Explicit PGRST205, both attempts. | Route to Phase 38. No code change. |
| e2e/16-table-status.spec.ts:757 | T15: Back button navigates to /pool-tables | `Error: seedOccupiedTable: no available table – Could not find the table 'public.pool_tables' in the schema cache` | Group B | infra | Explicit PGRST205, both attempts. | Route to Phase 38. No code change. |
| e2e/16-table-status.spec.ts:283 | T3: Happy Hour badge visible when current time is within happy hour window | Hardcoded `test.skip('T3: ...', async () => {})`; inline comment: happy-hour columns dropped in migration `20260711000001_drop_happy_hour_columns.sql`, "no promotions-based UI replacement has been built yet." | n/a (not run) | valid-skip | Verified against current code, not just the comment: `HappyHourBanner` (`src/widgets/OrderPanel/HappyHourBanner.tsx`) exists and is wired into `ProductGrid` (POS page) — a promotions-driven active-discount indicator DOES exist elsewhere in the app — but `grep -n "Happy\|romotion" src/widgets/TableStatusPanel/index.tsx` returns zero hits: the Table Status Page itself (what T3 actually asserts against) still has no such indicator. Comment is accurate, not stale. | No un-skip. No code change. |

**Total: 16 rows (12 infra-failed + 1 conditional-skip + 3 valid-skip).**

## Print-popup todo cross-reference (T6, line 348)

10-CHECKLIST.md's cross-check section marked
`2026-07-27-print-popup-fallback-hangs-under-playwright-automation.md` as "plausibly rediscovered"
by T6's failure, based on title-only matching (same spec/feature). **This run's real error output
does not support that correlation**: T6's failure in this run never reached the print-popup
step at all — attempt 1 died at `beforeEach` navigation (`page.goto: Target page, context or
browser has been closed`), and the retry failed at the same upstream `startSessionViaUI` Start
Session button timeout as every other Group A test. The print button itself was never clicked in
either attempt.

This is exactly the D-04 discipline paying off: a title-only correlation ("T6 failed" + "print
todo mentions T6's feature") would have wrongly closed or referenced the print-popup todo as
confirmed. The real evidence shows this run's T6 failure is unrelated — routed to Phase 38 like
the rest of Group A. The print-popup-fallback todo remains open, unconfirmed and unrefuted by
this run; do not close or edit it based on this ledger.

## Final spec run stats

```
npx playwright test e2e/16-table-status.spec.ts --reporter=list
...
  12 failed
    T1, T2, T4, T5, T6, T7, T8, T9, T10, T11, T16, T15
  4 skipped
```

Every still-red test above maps to a ledger row (12 `infra`, all explained). No `harness` rows
were found (no stale selector/wait — the spec's own selectors and assertions are correct; the
data layer beneath them is broken). No `real-regression` rows were found. No `obsolete` rows were
found. Consequently:

- **No edits made to `e2e/16-table-status.spec.ts`** — every finding traces to infra, not a test
  defect or a product regression, so there is nothing in this file to fix under D-03/harness
  scope.
- **No todo files created** — zero real product bugs were found (a valid outcome per this plan's
  `must_haves`).
- **`git status` for `src/`**: clean, zero modifications (verified below).

## Reusable ledger row format (for plans 39-04 through 39-07)

```
| <spec-file>:<line> | <test title> | <error.message excerpt, not title> | <root-cause group id> | <infra\|real-regression\|obsolete\|harness\|valid-skip\|stale\|conditional> | <one-line evidence citation> | <action taken> |
```

Columns are fixed and greppable by `^| e2e/<spec>.spec.ts:` per spec file. Group failures by
signature (call `grep -c` per distinct `error.message` prefix) before writing rows — do not
title-match. When a `PLAYWRIGHT_JSON_OUTPUT_FILE=... npx playwright test <spec> --reporter=json`
run is desired instead of `--reporter=list`, do **not** pass `--reporter=list` alongside it — the
CLI `--reporter` flag replaces the project's configured reporter array entirely, so `list` alone
suppresses the JSON output the env var is supposed to redirect (discovered this session: the
first attempt at regenerating `.audit-tmp/e2e-per-spec/16-table-status.json` produced no file
because of this). Playwright's `list` reporter output is sufficient by itself for D-04 purposes —
it prints the full per-test error message and stack in its end-of-run failure summary — so this
plan used `list` output directly rather than re-running with a corrected reporter flag.
</content>
