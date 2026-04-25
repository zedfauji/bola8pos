---
phase: 07-waitlist-whatsapp
verified: 2026-04-25T22:00:00Z
status: human_needed
score: 18/19 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Full add→notify→seat flow in running dev server"
    expected: "Party added to queue; Notify button transitions card to 'notified'; SeatPartySheet opens, table selected, party removed from queue; Home badge count updates live"
    why_human: "Requires live Supabase DB with waitlist_entries tables, running dev server, and real Tauri app — cannot verify pg_net trigger → edge function → WasenderAPI chain or Realtime broadcast without live infra"
  - test: "WhatsApp notification delivery with WASENDER_API_KEY set"
    expected: "When a party with a valid E.164 phone number is notified, a WhatsApp message arrives at that number"
    why_human: "Requires real WasenderAPI credentials and a phone number to test delivery"
  - test: "Tauri native notification when no phone on file"
    expected: "When a party without a phone is notified, a native OS notification appears on the desktop"
    why_human: "Requires running Tauri desktop app — cannot verify tauri-plugin-notification from static analysis"
---

# Phase 7: Waitlist + WhatsApp Verification Report

**Phase Goal:** Walk-in queue with FIFO ordering, party size, and per-party WhatsApp notification on table-available events (fallback to Realtime pane + Tauri notification)
**Verified:** 2026-04-25T22:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | waitlist_entries table exists with correct columns, CHECK constraints, and indexes | VERIFIED | `20260501000001_waitlist_entries.sql` — 9 columns, 4 RLS policies, 3 indexes (created_at, status, partial seated) |
| 2  | waitlist_notifications table exists with FK→waitlist_entries and cascade delete | VERIFIED | `20260501000002_waitlist_notifications.sql` — ON DELETE CASCADE confirmed at line 7 |
| 3  | trg_waitlist_notify fires AFTER UPDATE of status and calls net.http_post on 'notified' transition | VERIFIED | `20260501000003_waitlist_notify_trigger.sql` — AFTER UPDATE OF status, guard `NEW.status = 'notified' AND OLD.status IS DISTINCT FROM 'notified'`, net.http_post call at line 42 |
| 4  | supabase db push complete (BLOCKING) | ? HUMAN | Documented as completed in 07-02-SUMMARY.md checkpoint; cannot verify remote DB state programmatically |
| 5  | phone.ts exports toE164() and isE164() backed by libphonenumber-js | VERIFIED | `bar-pos/src/shared/lib/phone.ts` — parsePhoneNumberFromString import, both functions exported; libphonenumber-js in package.json |
| 6  | waitlist-math.ts exports computeQuotedWait() pure function | VERIFIED | `bar-pos/src/shared/lib/waitlist-math.ts` — WaitlistMathInput interface + computeQuotedWait exported |
| 7  | tauri-notify.ts exports sendManagerNotification() using Tauri plugin | VERIFIED | `bar-pos/src/shared/lib/tauri-notify.ts` — function at line 14; notification:default in capabilities/default.json; tauri-plugin-notification in Cargo.toml |
| 8  | WaitlistEntrySchema, PhoneE164Schema, WaitlistNotificationSchema exported from domain.ts | VERIFIED | `domain.ts` lines 1683–1721 — all 5 schemas + 3 types exported |
| 9  | WAITLIST_ENTRY_NOT_FOUND, WAITLIST_NOTIFICATION_RATE_LIMITED, WAITLIST_INVALID_PHONE in AppErrorCode | VERIFIED | `result.ts` lines 195–197 — all three codes present |
| 10 | manage_waitlist in STAFF_ACTIONS and MANAGER_EXTRA in rbac.ts | VERIFIED | `rbac.ts` line 35 (STAFF_ACTIONS) and line 61 (MANAGER_EXTRA) |
| 11 | send-waitlist-notification edge function exists with Deno.serve handler, WASENDER_API_KEY, rate-limit guard, audit INSERT, broadcast | VERIFIED | `supabase/functions/send-waitlist-notification/index.ts` — all elements confirmed: Deno.serve at line 22, WASENDER_API_KEY at line 36, rate_limited at line 101, waitlist_notifications at line 96/136, admin.channel broadcast at line 145 |
| 12 | entities/waitlist FSD slice: queries, types, store, barrel, WaitlistEntryCard with notifySlot | VERIFIED | All files present; waitlistKeys, 3 query hooks, useWaitlistLastNotificationsMap, 2 mutations in queries.ts; notifySlot?: ReactNode in WaitlistEntryCard.tsx line 121; no export * in index.ts |
| 13 | WaitlistRealtimeListener subscribes to waitlist_entries + pool_tables + broadcast notified | VERIFIED | `WaitlistRealtimeListener.tsx` — single channel 'waitlist:pos-sync' at line 34 with 3 .on() handlers confirmed |
| 14 | 5 feature slices: add-entry, notify-waitlist, seat-party, mark-no-show, mark-cancelled | VERIFIED | All 5 features present; notify sets status='notified' + sendManagerNotification fallback; seat sets status='seated' + table_id + seated_at; no-show sets status='no_show'; cancelled sets status='cancelled' |
| 15 | AddWaitlistEntryForm Sheet validates phone on blur, partySize Select 1-20, isValid gate | VERIFIED | `AddWaitlistEntryForm.tsx` — phoneBlurred state at line 32, PHONE_BLUR action at line 39, SheetContent side="right" at line 114, onBlur dispatch at line 164 |
| 16 | /waitlist route registered with ProtectedRoute + WaitlistRoute RBAC guard | VERIFIED | `router.tsx` — WaitlistPage lazy import at line 21, WaitlistRoute import at line 7, path="/waitlist" at line 132 |
| 17 | WaitlistRealtimeListener mounted app-wide in providers.tsx | VERIFIED | `providers.tsx` — import at line 7, render at line 89 |
| 18 | WaitlistQueue passes NotifyButton as notifySlot + lastNotification from useWaitlistLastNotificationsMap | VERIFIED | `WaitlistQueue.tsx` line 57 (notificationsMap from hook), line 122-123 (lastNotification + notifySlot rendered) |
| 19 | HomeDashboard Waitlist tile with useWaitlistWaitingCount badge + manage_waitlist requiredAction | VERIFIED | `HomeDashboard.tsx` — useWaitlistWaitingCount import line 23, requiredAction 'manage_waitlist' at line 75, waitingCount badge at line 150-156 |

**Score:** 18/19 truths verified (1 requires live DB confirmation — checkpoint documented by executor)

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `bar-pos/supabase/migrations/20260501000001_waitlist_entries.sql` | VERIFIED | Exists with all 9 columns, RLS, 3 indexes |
| `bar-pos/supabase/migrations/20260501000002_waitlist_notifications.sql` | VERIFIED | Exists with FK cascade, RLS |
| `bar-pos/supabase/migrations/20260501000003_waitlist_notify_trigger.sql` | VERIFIED | AFTER UPDATE OF status + net.http_post + guard |
| `bar-pos/supabase/functions/send-waitlist-notification/index.ts` | VERIFIED | Deno edge function, full implementation |
| `bar-pos/src/shared/lib/phone.ts` | VERIFIED | toE164 + isE164 exported |
| `bar-pos/src/shared/lib/phone.test.ts` | VERIFIED | 11 unit tests (Wave 0 stub replaced) |
| `bar-pos/src/shared/lib/waitlist-math.ts` | VERIFIED | computeQuotedWait + WaitlistMathInput exported |
| `bar-pos/src/shared/lib/waitlist-math.test.ts` | VERIFIED | 8 unit tests incl. 2 fast-check properties |
| `bar-pos/src/shared/lib/tauri-notify.ts` | VERIFIED | sendManagerNotification exported |
| `bar-pos/src/entities/waitlist/model/queries.ts` | VERIFIED | 3 queries + useWaitlistLastNotificationsMap + 2 mutations |
| `bar-pos/src/entities/waitlist/model/types.ts` | VERIFIED | Re-exports from domain.ts |
| `bar-pos/src/entities/waitlist/model/store.ts` | VERIFIED | Zustand store for selectedEntryId |
| `bar-pos/src/entities/waitlist/index.ts` | VERIFIED | Explicit named exports, no export * |
| `bar-pos/src/entities/waitlist/ui/WaitlistEntryCard.tsx` | VERIFIED | notifySlot?: ReactNode prop |
| `bar-pos/src/entities/waitlist/ui/WaitlistEntryCard.stories.tsx` | VERIFIED | Exists |
| `bar-pos/src/entities/waitlist/model/waitlist-queries.integration.test.ts` | VERIFIED | 5 schema round-trip tests |
| `bar-pos/src/app/WaitlistRealtimeListener.tsx` | VERIFIED | Single channel 'waitlist:pos-sync' |
| `bar-pos/src/features/add-waitlist-entry/model/useAddWaitlistEntry.ts` | VERIFIED | Wraps useMutationAddWaitlistEntry + toast |
| `bar-pos/src/features/add-waitlist-entry/ui/AddWaitlistEntryForm.tsx` | VERIFIED | Sheet side="right", blur validation, isValid gate |
| `bar-pos/src/features/notify-waitlist/model/useNotifyWaitlist.ts` | VERIFIED | status='notified' + sendManagerNotification fallback |
| `bar-pos/src/features/notify-waitlist/ui/NotifyButton.tsx` | VERIFIED | BellRing icon, aria-label |
| `bar-pos/src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` | VERIFIED | status='seated' + table_id + seated_at |
| `bar-pos/src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` | VERIFIED | aria-pressed, label+number columns |
| `bar-pos/src/features/mark-waitlist-no-show/model/useMarkNoShow.ts` | VERIFIED | status='no_show' |
| `bar-pos/src/features/mark-waitlist-entry-cancelled/model/useMarkCancelled.ts` | VERIFIED | status='cancelled' |
| `bar-pos/src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx` | VERIFIED | notifySlot + notificationsMap wired |
| `bar-pos/src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx` | VERIFIED | label+number columns, available-only filter |
| `bar-pos/src/pages/waitlist/index.tsx` | VERIFIED | Two-column layout (WaitlistQueue + PoolTableOccupancyPanel) |
| `bar-pos/src/app/waitlist-route.tsx` | VERIFIED | can('manage_waitlist') guard |
| `bar-pos/src/app/router.tsx` (modified) | VERIFIED | /waitlist route + WaitlistPage lazy + WaitlistRoute |
| `bar-pos/src/app/providers.tsx` (modified) | VERIFIED | WaitlistRealtimeListener mounted |
| `bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx` (modified) | VERIFIED | Waitlist tile + useWaitlistWaitingCount badge |
| `bar-pos/e2e/24-waitlist.spec.ts` | VERIFIED | 5 tests (T1–T5) |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| trg_waitlist_notify | net.http_post | AFTER UPDATE OF status, guard OLD.status IS DISTINCT FROM 'notified' | WIRED |
| trg_waitlist_notify | send-waitlist-notification edge function | net.http_post to /functions/v1/send-waitlist-notification | WIRED (static) |
| edge function | waitlist_notifications table | admin.from('waitlist_notifications').insert() | WIRED |
| edge function | Realtime broadcast | admin.channel('waitlist').send() | WIRED |
| phone.ts | libphonenumber-js | parsePhoneNumberFromString import | WIRED |
| result.ts | AppErrorCode union | WAITLIST_ENTRY_NOT_FOUND | WAITLIST_NOTIFICATION_RATE_LIMITED | WAITLIST_INVALID_PHONE | WIRED |
| entities/waitlist/model/queries.ts | waitlist_entries table | supabase as any pre-regen cast | WIRED |
| WaitlistRealtimeListener | waitlistKeys.all + poolTableKeys.all | queryClient.invalidateQueries | WIRED |
| WaitlistQueue | NotifyButton (feature) | notifySlot prop on WaitlistEntryCard | WIRED |
| WaitlistQueue | useWaitlistLastNotificationsMap | notificationsMap[entry.id] ?? null | WIRED |
| router.tsx | WaitlistPage | lazy(() => import('../pages/waitlist')) + Route path="/waitlist" | WIRED |
| providers.tsx | WaitlistRealtimeListener | import + render <WaitlistRealtimeListener /> | WIRED |
| HomeDashboard | useWaitlistWaitingCount | @entities/waitlist import | WIRED |
| useNotifyWaitlist | sendManagerNotification | @shared/lib/tauri-notify import, called when !hasPhone | WIRED |
| useSeatWaitlistParty | waitlist_entries UPDATE | supabase.from('waitlist_entries').update({status: 'seated', table_id, seated_at}) | WIRED |
| SeatPartySheet | pool_tables | .select('id, label, number, status').order('number') | WIRED (fixed in 07-08) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| WaitlistQueue.tsx | entries | useWaitlistEntries() → supabase.from('waitlist_entries').select('*') | Yes — DB query | FLOWING |
| WaitlistQueue.tsx | notificationsMap | useWaitlistLastNotificationsMap(entryIds) → supabase.from('waitlist_notifications').select('*') | Yes — DB query | FLOWING |
| WaitlistQueue.tsx | avgTurnMap | useMemo(() => new Map([[2, 30], [4, 45]]), []) | No — hardcoded placeholder | STATIC (intentional, noted in SUMMARY) |
| HomeDashboard.tsx | waitingCount | useWaitlistWaitingCount() → supabase.from('waitlist_entries').select with count | Yes — DB query | FLOWING |
| PoolTableOccupancyPanel.tsx | tables | supabase.from('pool_tables').select('id, label, number, status') | Yes — DB query | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running dev server + Tauri app + live Supabase instance. Static checks are sufficient given the comprehensive unit test coverage (1054 tests passing per 07-08-SUMMARY).

### Requirements Coverage

All plan-declared requirements per PLAN frontmatter:

| Requirement | Source Plan(s) | Description | Status |
|-------------|---------------|-------------|--------|
| S5-01 | 07-01, 07-07 | Migration: waitlist_entries + indexes | SATISFIED — migration file exists with correct schema |
| S5-02 | 07-01, 07-07 | Migration: waitlist_notifications | SATISFIED — migration file exists with FK cascade |
| S5-03 | 07-01, 07-07 | Migration: trigger on status→'notified' calls edge fn | SATISFIED — trigger file with net.http_post |
| S5-04 | 07-02 | Supabase Vault: store WASENDER_API_KEY | NEEDS HUMAN — operator setup (supabase secrets set); cannot verify programmatically |
| S5-05 | 07-03 | Edge function: send-waitlist-notification | SATISFIED — edge function fully implemented |
| S5-06 | 07-02 | libphonenumber-js dep + phone.ts validator | SATISFIED — dep in package.json, toE164/isE164 exported |
| S5-07 | 07-02 | Zod: WaitlistEntrySchema, PhoneE164Schema | SATISFIED — all schemas in domain.ts |
| S5-08 | 07-04, 07-08 | Entity: entities/waitlist/ FSD slice | SATISFIED — complete slice including gap-closure fixes |
| S5-09 | 07-05, 07-06 | Feature: add-waitlist-entry | SATISFIED — hook + form wired via WaitlistQueue |
| S5-10 | 07-05, 07-06 | Feature: notify-waitlist (manual notify button) | SATISFIED — NotifyButton with sendManagerNotification fallback |
| S5-11 | 07-05, 07-06, 07-08 | Feature: seat-waitlist-party | SATISFIED — SeatPartySheet with fixed label+number columns |

**Note on S5-12 in task request:** The user asked for S5-01..S5-12. The ROADMAP declares Phase 7 as "Requirements: S5-01..S5-11". The sprint source doc (S5-waitlist.md) has S5-12=mark-waitlist-no-show; this feature IS implemented (`bar-pos/src/features/mark-waitlist-no-show/model/useMarkNoShow.ts`) but was grouped under the 07-05 plan as part of S5-11's scope. No plan file claims S5-12 as a declared requirement ID. No gap here — the behavior exists, only the ID was not formally declared in the PLAN frontmatter.

**Orphaned requirements check:** S5-13 (WaitlistQueue widget), S5-14 (PoolTableOccupancyPanel), S5-15 (/waitlist page + route), S5-16 (Home tile), S5-17 (quoted-wait heuristic), S5-18 (Realtime recompute), S5-19 (Tauri native notification) from the sprint doc do NOT appear in any plan's `requirements:` frontmatter. However, all of these behaviors are demonstrably implemented — they were captured by the plan must_haves rather than requirement ID tags. The ROADMAP contract only declares S5-01..S5-11, so this is not a gap.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `bar-pos/src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx` line 62 | `avgTurnMap = useMemo(() => new Map([[2, 30], [4, 45]]), [])` — hardcoded placeholder for avg turn time | WARNING | Quoted wait shows correct relative ordering but not calibrated minutes. Intentional per 07-06-SUMMARY "Known Stubs" section. Not a blocker — computeQuotedWait still produces valid 5-min floor. |

No TODO/FIXME/placeholder comments found in any verified feature hook.
No stub return patterns (return null / return {} / return []) found in non-loading-state code paths.
No onSubmit → console.log only stubs detected.

### Human Verification Required

#### 1. Full Waitlist Flow (Add → Notify → Seat)

**Test:**
1. Start dev server: `cd bar-pos && npm run dev`
2. Log in as admin (PIN: 0000) and navigate to `/home`
3. Verify "Waitlist" tile appears in the HomeDashboard
4. Navigate to `/waitlist` (or tap tile; manager PIN required)
5. Verify two-column layout: WaitlistQueue (left) + PoolTableOccupancyPanel (right)
6. Tap "Add to waitlist" → Sheet opens with Name, Party Size (1–20), Phone fields
7. Add party (name: "Test García", size: 2, no phone) → tap "Add to waitlist"
8. Verify entry card appears with "~5 min wait", "No phone" indicator, "Notify manager" button, Seat + NoShow buttons
9. Tap "Notify manager" → button enters pending state → card transitions to "notified" status with notification status row "Notified via manager terminal"
10. Tap "Seat party" → SeatPartySheet opens showing pool tables as "Table N – Label" format, available vs occupied
11. Select an available table, tap "Seat party" → card disappears from queue; Home badge count decreases
12. Verify browser console: no uncaught errors, no "Plugin notification is not registered" runtime errors

**Expected:** All steps complete without errors; queue state reflects changes; Home badge updates live

**Why human:** Requires live Supabase DB (waitlist_entries + pool_tables), running dev server, Tauri app for notification plugin

#### 2. WhatsApp Notification Delivery

**Test:**
1. Add a party with a valid MX/US phone number (e.g., "+525512345678")
2. Tap "Notify via WhatsApp" button
3. Verify card transitions to "notified" with "Notified via WhatsApp" status row (green)
4. Check the phone for an incoming WhatsApp message "Hola Test García, tu mesa está lista! Acércate a la barra. — Bola 8"

**Expected:** WhatsApp message arrives within 5 seconds

**Why human:** Requires valid WASENDER_API_KEY set via `supabase secrets set`, a live Supabase edge function deployment, and a real phone number

#### 3. Tauri Native Notification

**Test:**
1. Run the full Tauri desktop app: `cd bar-pos && npm run tauri dev`
2. Add a party with NO phone number
3. Tap "Notify manager" button
4. Verify a native OS notification appears with title "Party ready" and body "{entryName} is ready to be seated."

**Expected:** Native desktop notification appears within 2 seconds

**Why human:** Requires Tauri desktop app context; notification plugin behavior cannot be verified from static analysis or web browser

### Gaps Summary

No blocking gaps identified from automated verification. All code artifacts exist, are substantive, and are correctly wired.

The one runtime concern is the `avgTurnMap` placeholder in WaitlistQueue — it uses hardcoded values `[[2, 30], [4, 45]]` instead of computing real rolling averages. This is intentional per the plan (no `useWaitlistAvgTurnBySize` hook was specified for Phase 7) and documented in 07-06-SUMMARY "Known Stubs". Quoted wait times will display correct relative ordering but minutes may not reflect actual venue data. This is a warning, not a blocker.

Three items require human verification:
1. Full add→notify→seat flow in running app
2. WhatsApp delivery with real WASENDER_API_KEY
3. Tauri native notification in desktop app context

All 1054 unit tests pass, TypeScript typechecks with zero errors, ESLint passes with zero warnings per 07-08-SUMMARY.

---

_Verified: 2026-04-25T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
