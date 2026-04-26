---
phase: 07-waitlist-whatsapp
verified: 2026-04-25T00:00:00Z
status: gaps_found
score: 4/6 must-haves verified
overrides_applied: 0
gaps:
  - truth: "/waitlist page is accessible at runtime (route registered in router)"
    status: failed
    reason: "router.tsx has no import or Route entry for WaitlistPage, WaitlistRoute, or WaitlistRealtimeListener. Navigating to /waitlist renders a blank screen."
    artifacts:
      - path: "bar-pos/src/app/router.tsx"
        issue: "No lazy import for WaitlistPage, no import of WaitlistRoute, no <Route path=\"/waitlist\"> block"
      - path: "bar-pos/src/app/WaitlistRealtimeListener.tsx"
        issue: "Defined but never mounted — not imported in router.tsx or App.tsx"
    missing:
      - "Add lazy import: const WaitlistPage = lazy(() => import('../pages/waitlist'));"
      - "Add import: import { WaitlistRoute } from './waitlist-route';"
      - "Add Route block inside <Routes>: <Route path=\"/waitlist\" element={<ProtectedRoute><WaitlistRoute><WaitlistPage /></WaitlistRoute></ProtectedRoute>} />"
      - "Mount <WaitlistRealtimeListener /> inside Router function alongside <HelpSheet />"

  - truth: "Seat-to-table flow shows real table names (pool_tables 'name' column must exist)"
    status: failed
    reason: "All three pool_tables queries select 'id, name, status' and order by 'name'. PoolTableSchema in domain.ts defines 'label' and 'number' — no 'name' column exists. PostgREST will return an error at runtime, causing blank table names in SeatPartySheet and PoolTableOccupancyPanel and preventing table selection."
    artifacts:
      - path: "bar-pos/src/features/seat-waitlist-party/ui/SeatPartySheet.tsx"
        issue: "Line 39: .select('id, name, status'), line 40: .order('name'). 'name' column does not exist on pool_tables."
      - path: "bar-pos/src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx"
        issue: "Line 34: .select('id, name, status'), line 35: .order('name'). Same wrong column."
      - path: "bar-pos/src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx"
        issue: "Line 23: .select('id, name, status'), line 24: .order('name'). Same wrong column."
    missing:
      - "Change all three .select() calls to: .select('id, label, number, status')"
      - "Change all three .order() calls to: .order('number', { ascending: true })"
      - "Update PoolTable type in each file: add 'label: string' and 'number: number', remove 'name: string'"
      - "Update display expressions from {table.name} to: Table {table.number} – {table.label}"
      - "Update tableName argument in handleSeat: tableName: 'Table ' + String(table.number) + ' – ' + table.label"
---

# Phase 7: Waitlist + WhatsApp Verification Report

**Phase Goal:** Walk-in queue with FIFO ordering, party size, and per-party WhatsApp notification on table-available events (fallback to Realtime pane + Tauri notification).
**Verified:** 2026-04-25T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `waitlist_entries` + `waitlist_notifications` schema live (SQL migrations created) | VERIFIED | `20260501000001_waitlist_entries.sql`, `20260501000002_waitlist_notifications.sql`, `20260501000003_waitlist_notify_trigger.sql`, `20260501000004_waitlist_trigger_url.sql` all exist with correct DDL, RLS, indexes |
| 2 | `send-waitlist-notification` edge function integrates WasenderAPI via supabase secrets | VERIFIED | `supabase/functions/send-waitlist-notification/index.ts` reads `WASENDER_API_KEY` from `Deno.env.get()`, calls `https://www.wasenderapi.com/api/send-message`, falls back to manager channel if key absent |
| 3 | `/waitlist` page + Home tile + Realtime manager pane | FAILED | Page exists (`src/pages/waitlist/index.tsx`), Home tile exists (HomeDashboard imports `useWaitlistWaitingCount` and renders tile with badge). BUT `/waitlist` route is NOT registered in `router.tsx` — no import, no `<Route>`. `WaitlistRealtimeListener` also never mounted. |
| 4 | Auto-notify trigger fires on `status → 'notified'` | VERIFIED | `20260501000003_waitlist_notify_trigger.sql` creates `trg_waitlist_notify` AFTER UPDATE OF status, guarded by `NEW.status = 'notified' AND OLD.status IS DISTINCT FROM 'notified'`; calls `net.http_post` to edge function |
| 5 | Seat-to-table flow assigns `table_id` and clears entry | FAILED | `useSeatWaitlistParty` correctly updates `status='seated'`, `table_id`, `seated_at` in DB. BUT the table picker UI queries `pool_tables` with `.select('id, name, status')` — `name` is not a column in `pool_tables` (schema has `label` + `number`). PostgREST returns an error at runtime; the table list renders blank and the seat action passes `tableName: undefined` to the toast. |
| 6 | E2E `24-waitlist.spec.ts` passes | FAILED (cannot pass) | Spec exists and is substantive (5 tests covering add/notify/seat/no-show/realtime). Test `beforeEach` navigates to `/waitlist` — this route is unregistered, so all 5 tests fail with a blank page. CR-02 would also cause T3 to fail even if the route were fixed. |

**Score:** 3/6 truths verified (SC-1, SC-2, SC-4 pass; SC-3, SC-5, SC-6 fail)

Note: SC-5 is partially implemented — the DB mutation in `useSeatWaitlistParty` is correct, but the UI layer that feeds `tableId` to it is broken by the CR-02 column name bug. Scored as FAILED because the user-facing flow cannot complete.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bar-pos/supabase/migrations/20260501000001_waitlist_entries.sql` | waitlist_entries table DDL | VERIFIED | Correct schema, RLS, indexes |
| `bar-pos/supabase/migrations/20260501000002_waitlist_notifications.sql` | waitlist_notifications table DDL | VERIFIED | Correct schema, RLS, FK to waitlist_entries |
| `bar-pos/supabase/migrations/20260501000003_waitlist_notify_trigger.sql` | pg_net trigger | VERIFIED | `trg_waitlist_notify` correct guard logic |
| `bar-pos/supabase/functions/send-waitlist-notification/index.ts` | Deno edge function | VERIFIED | WasenderAPI integration, rate-limit guard, audit insert, broadcast |
| `bar-pos/src/shared/lib/domain.ts` | WaitlistEntry/Notification Zod schemas | VERIFIED | All types defined at lines 1669–1721 |
| `bar-pos/src/shared/lib/phone.ts` | E.164 phone utility | VERIFIED | File exists, used by AddWaitlistEntryForm |
| `bar-pos/src/shared/lib/waitlist-math.ts` | FIFO wait-time computation | VERIFIED | File exists, used by WaitlistQueue |
| `bar-pos/src/shared/lib/tauri-notify.ts` | Tauri notification fallback | VERIFIED | File exists, called by useNotifyWaitlist |
| `bar-pos/src/entities/waitlist/model/queries.ts` | TanStack Query hooks | VERIFIED | All hooks present: useWaitlistEntries, useWaitlistWaitingCount, useWaitlistLastNotificationsMap, mutations |
| `bar-pos/src/entities/waitlist/ui/WaitlistEntryCard.tsx` | Entry card component | VERIFIED | Exists and is non-trivial |
| `bar-pos/src/entities/waitlist/index.ts` | Barrel export | VERIFIED | Exports all hooks and types |
| `bar-pos/src/app/WaitlistRealtimeListener.tsx` | Realtime listener | ORPHANED | File exists and is substantive, but never imported or mounted anywhere in the app |
| `bar-pos/src/features/add-waitlist-entry/ui/AddWaitlistEntryForm.tsx` | Add entry form | VERIFIED | Full form with reducer, phone validation, wired to useAddWaitlistEntry |
| `bar-pos/src/features/notify-waitlist/model/useNotifyWaitlist.ts` | Notify mutation hook | VERIFIED | Updates status to 'notified', triggers edge function via DB trigger |
| `bar-pos/src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` | Seat party sheet | STUB (partial) | Table picker queries non-existent 'name' column; UI will show blank table names at runtime |
| `bar-pos/src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` | Seat mutation hook | VERIFIED | Correctly sets status, table_id, seated_at |
| `bar-pos/src/features/mark-waitlist-no-show/model/useMarkNoShow.ts` | No-show mutation | VERIFIED | Sets status='no_show', invalidates queries |
| `bar-pos/src/features/mark-waitlist-entry-cancelled/model/useMarkCancelled.ts` | Cancel mutation | VERIFIED | Sets status='cancelled', invalidates queries |
| `bar-pos/src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx` | Queue widget | STUB (partial) | Pool table query uses 'name' column (does not exist); available table count and SeatPartySheet will be broken |
| `bar-pos/src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx` | Occupancy panel | STUB (partial) | Same 'name' column bug; table grid shows blank names |
| `bar-pos/src/pages/waitlist/index.tsx` | Waitlist page | ORPHANED | Page exists and renders WaitlistQueue + PoolTableOccupancyPanel. Not routable — no Route entry in router.tsx |
| `bar-pos/src/app/waitlist-route.tsx` | WaitlistRoute guard | ORPHANED | Exists, checks 'manage_waitlist' permission, but never referenced by router.tsx |
| `bar-pos/src/app/router.tsx` | Route registration | MISSING entries | No WaitlistPage import, no WaitlistRoute import, no /waitlist Route block |
| `bar-pos/e2e/24-waitlist.spec.ts` | E2E spec | VERIFIED (file) | Substantive 5-test spec exists but cannot pass due to unregistered route |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| HomeDashboard tile | /waitlist page | `path: '/waitlist'` in nav config | PARTIAL | Tile navigates to /waitlist, but route is unregistered — navigation leads to blank screen |
| router.tsx | WaitlistPage | lazy import + Route | NOT_WIRED | No import or Route entry exists in router.tsx |
| router.tsx | WaitlistRealtimeListener | import + render | NOT_WIRED | Never imported; never rendered |
| useSeatWaitlistParty | pool_tables.table_id | `.update({ table_id: ... })` | WIRED | Correct column name used in mutation |
| SeatPartySheet | pool_tables | `.select('id, name, status')` | BROKEN | 'name' column does not exist — PostgREST error at runtime |
| WaitlistQueue | pool_tables | `.select('id, name, status')` | BROKEN | Same 'name' column bug |
| PoolTableOccupancyPanel | pool_tables | `.select('id, name, status')` | BROKEN | Same 'name' column bug |
| useNotifyWaitlist | send-waitlist-notification | DB trigger (pg_net) | WIRED | Updates status='notified'; trigger fires net.http_post |
| send-waitlist-notification | WasenderAPI | `fetch('https://www.wasenderapi.com/api/send-message')` | WIRED | Correct URL, auth, payload |
| WaitlistRealtimeListener | waitlist_entries Realtime | `.on('postgres_changes', ...)` | ORPHANED | Component code correct but never mounted |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| WaitlistQueue | `entries` | `useWaitlistEntries()` → Supabase `waitlist_entries` SELECT | Yes — real DB query with .not filter + ORDER BY | FLOWING |
| WaitlistQueue | `tables` | `usePoolTablesCount()` → `.select('id, name, status')` | No — 'name' column missing, PostgREST error | DISCONNECTED |
| PoolTableOccupancyPanel | `tables` | `usePoolTables()` → `.select('id, name, status')` | No — same column error | DISCONNECTED |
| SeatPartySheet | `tables` | `usePoolTables()` → `.select('id, name, status')` | No — same column error | DISCONNECTED |
| HomeDashboard Waitlist tile | `waitingCount` | `useWaitlistWaitingCount()` → Supabase count query | Yes — real COUNT query | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — cannot test without running server. All checks require a live Supabase instance and dev server. Route is also unregistered, making all browser-based checks non-functional.

---

### Requirements Coverage

No REQUIREMENTS.md found at the project or bar-pos level. Requirement IDs S5-01 through S5-11 are referenced in ROADMAP.md plans but the source spec file (S5-waitlist.md) was not found in the planning directory. Coverage is mapped from ROADMAP.md plan annotations:

| Requirement | Source Plan | Description (from ROADMAP annotations) | Status | Evidence |
|-------------|-------------|----------------------------------------|--------|---------|
| S5-01 | 07-01-PLAN.md | waitlist_entries table | SATISFIED | Migration 20260501000001 exists with correct DDL |
| S5-02 | 07-01-PLAN.md | waitlist_notifications table | SATISFIED | Migration 20260501000002 exists |
| S5-03 | 07-01-PLAN.md | pg_net notify trigger | SATISFIED | Migration 20260501000003 exists |
| S5-04 | 07-02-PLAN.md | supabase db push + shared utilities | SATISFIED | phone.ts, waitlist-math.ts, tauri-notify.ts all exist |
| S5-05 | 07-03-PLAN.md | Edge function WasenderAPI + rate-limit | SATISFIED | Edge function exists and is substantive |
| S5-06 | 07-02-PLAN.md | Zod schemas | SATISFIED | WaitlistEntrySchema, WaitlistNotificationSchema in domain.ts |
| S5-07 | 07-02-PLAN.md | RBAC manage_waitlist action | SATISFIED | 'manage_waitlist' in rbac.ts at lines 35, 61 |
| S5-08 | 07-04-PLAN.md | entities/waitlist FSD slice + WaitlistRealtimeListener | PARTIAL | Entity slice exists; WaitlistRealtimeListener defined but never mounted |
| S5-09 | 07-05-PLAN.md | add-waitlist-entry feature | SATISFIED | Feature hook + form exist and are wired |
| S5-10 | 07-05-PLAN.md | notify-waitlist feature | SATISFIED | Feature hook + NotifyButton exist and are wired |
| S5-11 | 07-05-PLAN.md | seat-waitlist-party + no-show + cancelled features | PARTIAL | Mutation hooks are correct; SeatPartySheet UI broken by CR-02 column bug |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/router.tsx` | — | WaitlistPage + WaitlistRoute + WaitlistRealtimeListener never imported or mounted | BLOCKER | /waitlist route unreachable; Realtime invalidation never fires |
| `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` | 39–40 | `.select('id, name, status').order('name')` — 'name' column does not exist on pool_tables | BLOCKER | Table picker fails with PostgREST error; seat flow cannot complete |
| `src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx` | 34–35 | `.select('id, name, status').order('name')` — same wrong column | BLOCKER | Available table count wrong; SeatPartySheet receives broken data |
| `src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx` | 23–24 | `.select('id, name, status').order('name')` — same wrong column | BLOCKER | Panel renders blank table names or PostgREST error |
| `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` | 88 | `tableName: table.name` — 'name' undefined at runtime | BLOCKER | Toast shows "García seated at undefined" |
| `src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx` | 59 | `status === 'idle' \|\| status === 'free'` — phantom status values | WARNING | Dead code; not a runtime error since 'available' still works |
| `src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` | 72–73 | Same phantom 'idle'/'free' status values | WARNING | Dead code |
| `src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx` | 39, 75 | Same phantom 'idle'/'free' status values | WARNING | Dead code |
| `src/app/WaitlistRealtimeListener.tsx` | — | Defined but never mounted | BLOCKER | No Realtime invalidation for waitlist_entries or pool_tables changes |

---

### Human Verification Required

No human verification items — all failures are definitively confirmed by code inspection.

---

### Gaps Summary

Two blocking gaps prevent the phase goal from being achieved:

**Gap 1: /waitlist route not registered (CR-01)**

`router.tsx` has no import for `WaitlistPage`, no import for `WaitlistRoute`, and no `<Route path="/waitlist">` entry. The `WaitlistRealtimeListener` component is also never mounted anywhere in the app. As a result:

- Navigating to `/waitlist` from the Home dashboard tile renders a blank screen (no 404 handler exists either)
- The Realtime subscription for `waitlist_entries` and `pool_tables` changes never fires
- The `WaitlistRoute` permission guard never executes
- All 5 E2E tests in `24-waitlist.spec.ts` fail in `beforeEach` because `page.goto('/waitlist')` finds no route

Fix: three additions to `router.tsx` (lazy import for WaitlistPage, import for WaitlistRoute, Route block for `/waitlist`) plus mounting `<WaitlistRealtimeListener />` inside the Router function.

**Gap 2: pool_tables query selects non-existent 'name' column (CR-02)**

Three components — `SeatPartySheet`, `WaitlistQueue`, and `PoolTableOccupancyPanel` — all query `pool_tables` with `.select('id, name, status').order('name', ...)`. The `pool_tables` schema (per `PoolTableSchema` in `domain.ts`) has `label` (string) and `number` (int), not `name`. This causes a runtime PostgREST error in all three components, resulting in:

- Blank table names in the seat party sheet
- Broken available table count display
- `tableName: undefined` passed to the success toast after seating
- E2E test T3 would fail even if gap 1 were fixed

Fix: change all three `.select()` calls to `'id, label, number, status'`, change `.order('name')` to `.order('number')`, update the `PoolTable` type definitions to use `label: string; number: number`, and update all display expressions from `{table.name}` to `Table {table.number} – {table.label}`.

These two gaps share a common root: the 07-06 wave (page/route/router wiring) and the CR-02 column name error were not caught before marking plans complete. Both are mechanical fixes requiring no architectural changes.

---

_Verified: 2026-04-25T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
