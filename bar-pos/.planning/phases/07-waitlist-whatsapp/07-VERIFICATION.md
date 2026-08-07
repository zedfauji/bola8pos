---
phase: 07-waitlist-whatsapp
verified: 2026-08-06T00:00:00Z
status: human_needed
score: 5/6 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "3/6 (truths table) — prior frontmatter stated 4/6, inconsistent with its own body text"
  gaps_closed:
    - "/waitlist page is accessible at runtime (route registered in router)"
    - "Seat-to-table flow shows real table names (pool_tables 'name' column must exist)"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "E2E 24-waitlist.spec.ts passes"
    test: "Run `npx playwright test e2e/24-waitlist.spec.ts` against a live dev server + Supabase instance (all 7 tests: T1 add, T2 notify, T3 seat, T4 no-show, T5 realtime, T6 seat-at-new-table, T7 new-table-action-absent)"
    expected: "All 7 tests pass — beforeEach's `page.goto('/waitlist')` now resolves to a real route (CR-01 fixed) and the table picker renders real `label`/`number` values (CR-02 fixed)"
    why_human: "Requires a running `npm run dev` server, a live Supabase instance, and a real browser session (Playwright config uses `headless: false, channel: 'chrome'` per project convention) — none of which are available in this verification sandbox. Code-level blockers are gone (route registered, columns correct, typecheck/lint clean) but nobody has actually run the suite since router.tsx/providers.tsx changed."
human_verification:
  - test: "Full add → notify → seat flow (07-HUMAN-UAT.md #1)"
    expected: "With dev server + live Supabase running — add a walk-in party, send notification (triggers pg_net → edge function → Realtime broadcast), observe WaitlistEntryCard status update, then seat the party by selecting a pool table shown as 'Table N – Label'"
    why_human: "Requires live dev server + Supabase; runtime behavior not visible via static inspection"
  - test: "WhatsApp message delivery (07-HUMAN-UAT.md #2)"
    expected: "With WASENDER_API_KEY set via `supabase secrets set` and a real phone number — notification action results in a WhatsApp message delivered to the party's phone"
    why_human: "Requires a real WasenderAPI key and a real phone number; external service side-effect"
  - test: "Tauri native notification, no-phone path (07-HUMAN-UAT.md #3)"
    expected: "Running `npm run tauri dev` — when notifying a party with no phone number, a native OS notification fires via the Tauri notification plugin"
    why_human: "Requires the Tauri desktop runtime; OS-level notification cannot be observed by grep/static analysis"
  - test: "E2E 24-waitlist.spec.ts full run"
    expected: "All 7 tests pass against a live server (see behavior_unverified_items above)"
    why_human: "Requires live dev server + Supabase + real browser session"
---

# Phase 7: Waitlist + WhatsApp Verification Report (RE-VERIFICATION)

**Phase Goal:** Walk-in queue with FIFO ordering, party size, and per-party WhatsApp notification on table-available events (fallback to Realtime pane + Tauri notification).
**Verified:** 2026-08-06
**Status:** human_needed
**Re-verification:** Yes — after gap closure (07-08-PLAN, commits bbd53d5 + b53481e, 2026-04-25). This report supersedes the 2026-04-25 `gaps_found` VERIFICATION.md.

---

## Why this re-verification happened

The 2026-04-25 VERIFICATION.md reported `status: gaps_found` with two blocking gaps (CR-01: `/waitlist` route not registered; CR-02: three components querying a non-existent `pool_tables.name` column). A same-day gap-closure plan (07-08) claimed both were fixed, but the VERIFICATION.md was never re-run, so STATE.md's deferred-items ledger has been carrying a stale `gaps_found` status for over three months of unrelated work (i18n migration, Tailwind v4 upgrade, touch-target sweep, and — critically — a `20260728000001_rename_pool_tables_to_resources.sql` migration that renamed the entire `pool_tables` table to `resources`). This pass independently re-verifies both original gaps against current source and checks for regressions introduced by that later work.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `waitlist_entries` + `waitlist_notifications` schema live | ✓ VERIFIED | Unchanged since original pass. `20260501000001_waitlist_entries.sql`, `20260501000002_waitlist_notifications.sql`, `20260501000003_waitlist_notify_trigger.sql`, `20260501000004_waitlist_trigger_url.sql` all present with correct DDL/RLS/indexes. |
| 2 | `send-waitlist-notification` edge function integrates WasenderAPI via supabase secrets | ✓ VERIFIED | Unchanged. `supabase/functions/send-waitlist-notification/index.ts` still present, reads `WASENDER_API_KEY` via `Deno.env.get()`, calls `https://www.wasenderapi.com/api/send-message`. |
| 3 | `/waitlist` page + Home tile + Realtime manager pane | ✓ VERIFIED (was FAILED — CR-01 now closed) | `router.tsx` line 12 imports `WaitlistRoute`, line 28 lazy-imports `WaitlistPage`, lines 161–170 register `<Route path="/waitlist">` wrapped in `<ProtectedRoute><WaitlistRoute>`. `providers.tsx` line 7 imports and line 114 mounts `<WaitlistRealtimeListener />` app-wide (alongside `<PoolRealtimeListener />`, not route-scoped). `HomeDashboard.tsx` still has the `/waitlist` tile with `useWaitlistWaitingCount()` live badge (lines 28, 77–80, 129, 189). |
| 4 | Auto-notify trigger fires on `status → 'notified'` | ✓ VERIFIED | Unchanged. `trg_waitlist_notify` AFTER UPDATE OF status, guarded correctly, calls `net.http_post`. |
| 5 | Seat-to-table flow assigns `table_id` and clears entry, with real table names | ✓ VERIFIED (was FAILED — CR-02 now closed) | `SeatPartySheet.tsx`, `WaitlistQueue.tsx`, `PoolTableOccupancyPanel.tsx` all query `.from('resources').select('id, label, number, status[, ...])`.order('number', ...)`. Local `PoolTable`/`PoolTableRow`/`PoolTableStatus` types all use `label: string; number: number`. Display uses `t('...tableLabel', { number: table.number, label: table.label })` (i18n-driven, e.g. SeatPartySheet.tsx:114/196/218/225). Phantom `'idle'`/`'free'` status comparisons are gone (grep clean). `useSeatWaitlistParty` (unchanged) correctly sets `status='seated'`, `table_id`, `seated_at`. |
| 6 | E2E `24-waitlist.spec.ts` passes | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Spec exists, now 7 tests (T1–T7, expanded since original — T6/T7 added for a later `seat-at-new-table` feature). `beforeEach` navigates to `/waitlist`, which now resolves to a real route. Code-level blockers (CR-01, CR-02) are gone and `npx tsc --noEmit` / targeted ESLint are clean. But no dev server + live Supabase instance is available in this sandbox to actually run the suite — nobody has executed it since router.tsx/providers.tsx changed. Presence + wiring is not the same as a passing run. |

**Score:** 5/6 truths verified, 1 present-behavior-unverified (routed to human verification below)

**Additional regression check (not in original 6 truths):** Between the original verification (2026-04-25) and now, `20260728000001_rename_pool_tables_to_resources.sql` renamed `pool_tables` → `resources` DB-wide. All three waitlist components query `resources` (not the old `pool_tables` name), matching `supabase.types.ts`'s current generated types (`resources` table present, `pool_tables` absent as a base table). `WaitlistRealtimeListener` subscribes to `{ table: 'resources' }` (not `pool_tables`) and invalidates `resourceKeys.all`, which equals the exact `['resources']` queryKey used by all three inline hooks (`entities/resource/model/queries.ts:28`). No stale references to the old table/column names found anywhere in the waitlist feature area — the rename was correctly propagated, not a regression.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bar-pos/src/app/router.tsx` | `/waitlist` Route registered | ✓ VERIFIED | Import + lazy import + Route block present (lines 12, 28, 161–170) |
| `bar-pos/src/app/providers.tsx` | `WaitlistRealtimeListener` mounted | ✓ VERIFIED | Imported line 7, rendered line 114, app-wide (not router-scoped, matching PoolRealtimeListener pattern) |
| `bar-pos/src/app/WaitlistRealtimeListener.tsx` | Realtime listener | ✓ VERIFIED (was ORPHANED) | Now mounted; subscribes to `waitlist_entries` + `resources` (updated from `pool_tables`) + `notified` broadcast |
| `bar-pos/src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` | Seat party sheet | ✓ VERIFIED (was STUB/partial) | Queries `resources` with correct `label`/`number` columns; table names render correctly |
| `bar-pos/src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx` | Queue widget | ✓ VERIFIED (was STUB/partial) | Same fix applied; available table count now correct |
| `bar-pos/src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx` | Occupancy panel | ✓ VERIFIED (was STUB/partial) | Same fix applied |
| `bar-pos/src/pages/waitlist/index.tsx` | Waitlist page | ✓ VERIFIED (was ORPHANED) | Now reachable via registered route |
| `bar-pos/src/app/waitlist-route.tsx` | WaitlistRoute guard | ✓ VERIFIED (was ORPHANED) | Now referenced by router.tsx; gates on `manage_waitlist` RBAC action (confirmed still defined in `rbac.ts` lines 36, 66) |
| `bar-pos/e2e/24-waitlist.spec.ts` | E2E spec | ✓ VERIFIED (file), ⚠️ unexecuted | 437 lines, 7 tests (T1–T7); substantive; not run in this sandbox (no live server) |
| `bar-pos/src/shared/lib/phone.test.ts`, `waitlist-math.test.ts`, `waitlist-queries.integration.test.ts` | Unit/integration tests from 07-07 | ✓ VERIFIED (exist) | Present; could not execute in this sandbox — Vitest's `globalSetup` requires live `VITE_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (no `.env.local` in this worktree) and fails before collecting even the pure-logic `phone.test.ts`/`waitlist-math.test.ts` files. This is an environment limitation (project convention per CLAUDE.md: "Tests require .env.local E2E credentials"), not a code defect — 07-08-SUMMARY.md's claim of "1054/1054 pass" was made from the main checkout where credentials existed. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| HomeDashboard tile | /waitlist page | `path: '/waitlist'` | ✓ WIRED | Route now resolves; no longer a dead link |
| router.tsx | WaitlistPage | lazy import + Route | ✓ WIRED (was NOT_WIRED) | Confirmed at lines 28, 161–170 |
| providers.tsx | WaitlistRealtimeListener | import + render | ✓ WIRED (was NOT_WIRED) | Confirmed at lines 7, 114 |
| useSeatWaitlistParty | resources.table_id | `.update({ table_id: ... })` | ✓ WIRED | Unchanged, correct column name |
| SeatPartySheet | resources | `.select('id, label, number, status, ...')` | ✓ WIRED (was BROKEN) | Correct columns; matches current schema |
| WaitlistQueue | resources | `.select('id, label, number, status')` | ✓ WIRED (was BROKEN) | Same fix |
| PoolTableOccupancyPanel | resources | `.select('id, label, number, status')` | ✓ WIRED (was BROKEN) | Same fix |
| useNotifyWaitlist | send-waitlist-notification | DB trigger (pg_net) | ✓ WIRED | Unchanged |
| send-waitlist-notification | WasenderAPI | `fetch(...)` | ✓ WIRED | Unchanged |
| WaitlistRealtimeListener | resources Realtime | `.on('postgres_changes', { table: 'resources' })` | ✓ WIRED (was ORPHANED) | Mounted + correctly updated to track the `pool_tables`→`resources` rename; invalidates `resourceKeys.all` which equals `['resources']`, the exact queryKey used by all three consuming components |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| WaitlistQueue | `entries` | `useWaitlistEntries()` → Supabase `waitlist_entries` SELECT | Yes | FLOWING |
| WaitlistQueue | `tables` | `usePoolTablesCount()` → `.from('resources').select('id, label, number, status')` | Yes — correct columns, real query | FLOWING (was DISCONNECTED) |
| PoolTableOccupancyPanel | `tables` | `usePoolTables()` → same corrected query | Yes | FLOWING (was DISCONNECTED) |
| SeatPartySheet | `tables` | `usePoolTables()` → same corrected query (+ rate_per_hour, table_type) | Yes | FLOWING (was DISCONNECTED) |
| HomeDashboard Waitlist tile | `waitingCount` | `useWaitlistWaitingCount()` → Supabase count query | Yes | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly across the whole project (post gap-closure + post-rename) | `npx tsc --noEmit` | Exit 0, no output | ✓ PASS |
| ESLint clean on all waitlist-feature-area files (router, providers, listener, 3 components, page, route guard, form, notify button, no-show/cancel hooks, entry card) | `npx eslint <14 files> --max-warnings 0` | Exit 0, only unrelated tooling warnings (boundaries legacy-selector notice) | ✓ PASS |
| No stale phantom status values or old column names remain | `grep -rn "status === 'idle'\|status === 'free'\|.from('pool_tables')"` across the 3 fixed files | No matches | ✓ PASS |
| Unit tests for phone.ts / waitlist-math.ts | `npx vitest run src/shared/lib/phone.test.ts src/shared/lib/waitlist-math.test.ts` | Vitest's `globalSetup` throws `Missing Supabase credentials` before collecting any tests (no `.env.local` in this worktree) | ? SKIP — environment limitation, not a code defect |
| E2E `24-waitlist.spec.ts` | `npx playwright test e2e/24-waitlist.spec.ts` | Not run — requires live dev server + Supabase + real browser session, none available here | ? SKIP — routed to human verification |

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or found for this phase. N/A.

---

### Requirements Coverage

No REQUIREMENTS.md at project or bar-pos level. Traceability from ROADMAP.md Phase 7 annotations (`**Requirements:** S5-01..S5-11`) and each plan's `requirements:` frontmatter.

| Requirement | Source Plan | Description (ROADMAP annotation) | Status | Evidence |
|-------------|-------------|-----------------------------------|--------|---------|
| S5-01 | 07-01-PLAN.md | waitlist_entries table | ✓ SATISFIED | Migration 20260501000001 |
| S5-02 | 07-01-PLAN.md | waitlist_notifications table | ✓ SATISFIED | Migration 20260501000002 |
| S5-03 | 07-01-PLAN.md | pg_net notify trigger | ✓ SATISFIED | Migration 20260501000003 |
| S5-04 | 07-02-PLAN.md | supabase db push + shared utilities | ✓ SATISFIED | phone.ts, waitlist-math.ts, tauri-notify.ts all present |
| S5-05 | 07-03-PLAN.md | Edge function WasenderAPI + rate-limit | ✓ SATISFIED | Edge function present, substantive |
| S5-06 | 07-02-PLAN.md | Zod schemas | ✓ SATISFIED | WaitlistEntrySchema/WaitlistNotificationSchema in domain.ts |
| S5-07 | 07-02-PLAN.md | RBAC manage_waitlist action | ✓ SATISFIED | Present in rbac.ts (lines 36, 66) |
| S5-08 | 07-04-PLAN.md, 07-08 | entities/waitlist FSD slice + WaitlistRealtimeListener | ✓ SATISFIED (was PARTIAL) | Entity slice present; listener now mounted in providers.tsx |
| S5-09 | 07-05-PLAN.md | add-waitlist-entry feature | ✓ SATISFIED | Feature hook + form present, wired |
| S5-10 | 07-05-PLAN.md | notify-waitlist feature | ✓ SATISFIED | Feature hook + NotifyButton present, wired |
| S5-11 | 07-05-PLAN.md, 07-08 | seat-waitlist-party + no-show + cancelled features | ✓ SATISFIED (was PARTIAL) | Mutation hooks correct; SeatPartySheet UI now fixed (CR-02 closed) |

No orphaned requirements — all S5-01..S5-11 map to a plan.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found in the waitlist feature area (router.tsx, providers.tsx, WaitlistRealtimeListener.tsx, SeatPartySheet.tsx, WaitlistQueue.tsx, PoolTableOccupancyPanel.tsx, waitlist-route.tsx, pages/waitlist) | — | No `TBD`/`FIXME`/`XXX`/`TODO`/placeholder/hardcoded-empty patterns found. Both original BLOCKER anti-patterns (unregistered route, wrong column name) are resolved. |

---

### Human Verification Required

Carried forward from `07-HUMAN-UAT.md` (still fully pending, 0/3 — preserved, not discarded) plus one new item surfaced by this re-verification:

### 1. Full add → notify → seat flow
**Test:** With dev server + live Supabase running — add a walk-in party, send notification (triggers pg_net → edge function → Realtime broadcast), observe `WaitlistEntryCard` status update, then seat the party by selecting a pool table shown as "Table N – Label"
**Expected:** Full round trip completes; table names render correctly (this is the runtime confirmation that CR-02's fix actually renders as intended, beyond static code inspection)
**Why human:** Requires live dev server + Supabase; runtime behavior not visible via static inspection

### 2. WhatsApp message delivery
**Test:** With `WASENDER_API_KEY` set via `supabase secrets set` and a real phone number — notification action results in a WhatsApp message delivered to the party's phone
**Expected:** Message arrives on the target phone
**Why human:** Requires a real WasenderAPI key and a real phone number; external service side-effect

### 3. Tauri native notification (no-phone path)
**Test:** Running `npm run tauri dev` — when notifying a party with no phone number, a native OS notification fires via the Tauri notification plugin
**Expected:** Native OS notification appears
**Why human:** Requires the Tauri desktop runtime; OS-level notification cannot be observed by grep/static analysis

### 4. E2E 24-waitlist.spec.ts full run (new — surfaced by this re-verification)
**Test:** `npx playwright test e2e/24-waitlist.spec.ts` against a running `npm run dev` + live Supabase, real Chrome session
**Expected:** All 7 tests pass (T1–T7)
**Why human:** Requires live dev server + Supabase + real browser session, none available in this verification sandbox. This is the definitive confirmation that CR-01/CR-02 fixes hold at runtime, not just at the type/lint level.

---

### Gaps Summary

**No gaps found.** Both blocking gaps from the 2026-04-25 verification are independently confirmed closed:

- **CR-01 (route unregistered):** `router.tsx` now imports and registers `/waitlist` (lines 12, 28, 161–170); `providers.tsx` now mounts `WaitlistRealtimeListener` app-wide (lines 7, 114).
- **CR-02 (wrong column name):** `SeatPartySheet.tsx`, `WaitlistQueue.tsx`, `PoolTableOccupancyPanel.tsx` all query the correct `label`/`number` columns — and were further kept in sync with the later `pool_tables` → `resources` table rename (`20260728000001_rename_pool_tables_to_resources.sql`), which is not itself a phase-7 concern but could have silently broken these three components if they'd been missed. They were not missed.

**No regressions found** from the ~3 months of unrelated work (i18n migration, Tailwind v4 upgrade, touch-target sweep) that landed between the original verification and now: `npx tsc --noEmit` is clean, targeted ESLint (`i18next/no-literal-string` included) is clean on all 14 waitlist-feature-area files, and no stale references to the pre-rename `pool_tables` table or the old `name` column remain anywhere in the feature.

**Remaining work is exclusively human-verification territory**, unchanged in kind from the original pass's expectation, plus one item this re-verification surfaced: nobody has actually run `24-waitlist.spec.ts` against a live server since the router/providers fix landed. Code-level readiness is confirmed (typecheck + lint clean, route reachable, correct columns); the only thing this sandbox cannot do is spin up `npm run dev` + a live Supabase + a real Chrome session to execute the suite and the two live-service UAT scenarios (WhatsApp delivery, Tauri notification).

**Recommendation for STATE.md:** The deferred-items ledger's `verification_gap: gaps_found` for Phase 07 is now stale and should be updated to reflect this `human_needed` status; the `uat_gap: partial, 3 pending scenarios` entry should be updated to 4 pending scenarios (the 3 original + the E2E full-run confirmation).

---

_Verified: 2026-08-06_
_Verifier: Claude (gsd-verifier), re-verification pass_
