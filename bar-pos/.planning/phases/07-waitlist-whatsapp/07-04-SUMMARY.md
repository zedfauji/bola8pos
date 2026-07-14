---
phase: 07-waitlist-whatsapp
plan: "04"
subsystem: entities/waitlist
tags: [waitlist, tanstack-query, realtime, entity-slice, storybook, wave-0-stubs]
dependency_graph:
  requires:
    - "07-02 (WaitlistEntry schemas in domain.ts — applied as deviation in this plan)"
    - "07-03 (edge function — consumed by broadcast event handler in WaitlistRealtimeListener)"
  provides:
    - "waitlistKeys query key factory — consumed by 07-05 features and 07-06 widgets"
    - "useWaitlistEntries, useWaitlistEntry, useWaitlistWaitingCount — consumed by 07-05 and 07-06"
    - "useWaitlistLastNotificationsMap — consumed by WaitlistQueue widget (07-06)"
    - "useMutationAddWaitlistEntry, useMutationUpdateWaitlistStatus — consumed by 07-05 features"
    - "WaitlistEntryCard (notifySlot render prop) — consumed by WaitlistQueue widget (07-06)"
    - "WaitlistRealtimeListener — registered in app router (07-06)"
    - "Wave 0 integration test stubs — filled in by 07-07"
  affects:
    - "bar-pos/src/shared/lib/domain.ts (extended)"
    - "bar-pos/src/shared/lib/result.ts (extended)"
tech_stack:
  added: []
  patterns:
    - "pre-regen cast: const db = supabase as any with file-level eslint-disable"
    - "notifySlot ReactNode render prop — FSD-safe cross-layer composition"
    - "waitlistKeys factory with lists/detail/waitingCount/lastNotifications factories"
    - "Wave 0 integration test stub (it.todo blocks)"
key_files:
  created:
    - bar-pos/src/entities/waitlist/model/types.ts
    - bar-pos/src/entities/waitlist/model/queries.ts
    - bar-pos/src/entities/waitlist/model/store.ts
    - bar-pos/src/entities/waitlist/model/waitlist-queries.integration.test.ts
    - bar-pos/src/entities/waitlist/ui/WaitlistEntryCard.tsx
    - bar-pos/src/entities/waitlist/ui/WaitlistEntryCard.stories.tsx
    - bar-pos/src/entities/waitlist/index.ts
    - bar-pos/src/app/WaitlistRealtimeListener.tsx
  modified:
    - bar-pos/src/shared/lib/domain.ts
    - bar-pos/src/shared/lib/result.ts
decisions:
  - "notifySlot ReactNode instead of onNotify/isNotifying props — entity layer cannot import features; widget owns the slot"
  - "poolTableKeys inline as ['pool_tables'] in WaitlistRealtimeListener — no pool-table entity exists in this worktree; avoids missing import"
  - "domain.ts + result.ts extended in Task 1 as deviation — 07-02 code commits were not merged into this branch, only the SUMMARY was"
  - "WaitlistEntryCard does not use shadcn Card component — follows PrepOnHandCard pattern using plain div for full border/bg control"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-25"
  tasks_completed: 2
  files_created: 8
  files_modified: 2
---

# Phase 7 Plan 04: entities/waitlist FSD Slice Summary

**One-liner:** Complete entities/waitlist FSD slice — 5 TanStack Query hooks, useWaitlistLastNotificationsMap, WaitlistEntryCard with notifySlot render prop, 6 Storybook stories, WaitlistRealtimeListener (single channel, 3 handlers), and Wave 0 integration test stubs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | entities/waitlist model layer (types, queries, store, barrel) | 762b014 | types.ts, queries.ts, store.ts, index.ts, domain.ts, result.ts |
| 2 | WaitlistEntryCard + stories + WaitlistRealtimeListener + integration stub | 36bf41d | WaitlistEntryCard.tsx, WaitlistEntryCard.stories.tsx, WaitlistRealtimeListener.tsx, waitlist-queries.integration.test.ts |

## What Was Built

### Task 1: entities/waitlist model layer

**`src/shared/lib/domain.ts`** — 5 new schemas appended:
- `WaitlistEntryStatusSchema` — enum: waiting | notified | seated | no_show | cancelled
- `PhoneE164Schema` — regex `/^\+[1-9]\d{6,14}$/`
- `WaitlistEntrySchema` — full row shape with nullable phoneE164, tableId, seatedAt, notifiedAt
- `WaitlistEntryCreateSchema` — omits server-generated fields
- `WaitlistNotificationSchema` — notification log with channel (whatsapp | manager) and status (sent | failed | pending)

**`src/shared/lib/result.ts`** — 3 new AppErrorCodes:
- `WAITLIST_ENTRY_NOT_FOUND`
- `WAITLIST_NOTIFICATION_RATE_LIMITED`
- `WAITLIST_INVALID_PHONE`

**`src/entities/waitlist/model/types.ts`** — pure re-export barrel from domain.ts

**`src/entities/waitlist/model/queries.ts`**:
- `waitlistKeys` factory: all, lists(), detail(id), waitingCount(), lastNotifications(entryIds)
- `useWaitlistEntries()` — FIFO-ordered, excludes seated/cancelled
- `useWaitlistEntry(id)` — single entry by id
- `useWaitlistWaitingCount()` — count query for Home tile badge
- `useWaitlistLastNotificationsMap(entryIds)` — Record<string, WaitlistNotification> keyed by entry id; deduplicates to most recent per entry
- `useMutationAddWaitlistEntry()` — inserts with Result<WaitlistEntry> return
- `useMutationUpdateWaitlistStatus()` — updates status/tableId/timestamps with Result<WaitlistEntry> return

**`src/entities/waitlist/model/store.ts`** — minimal Zustand store (selectedEntryId)

**`src/entities/waitlist/index.ts`** — explicit named exports (no `export *`)

### Task 2: UI components + Realtime + test stub

**`src/entities/waitlist/ui/WaitlistEntryCard.tsx`**:
- `notifySlot?: ReactNode` render prop — FSD-correct, widget passes `<NotifyButton />` as slot
- 5 status states: waiting (full action row), notified (seat + no-show only), seated/no_show/cancelled (no actions, muted)
- Status badge: custom notified badge (`bg-pos-accent/20 text-pos-accent border-pos-accent/30`), destructive for no_show, secondary otherwise
- Phone indicator: `<Phone />` + "WhatsApp" or `<PhoneOff />` + "No phone" with `aria-hidden`
- Party size: "{N} guest" singular / "{N} guests" plural
- Quoted wait: `~{N} min wait` (floor 5) / ">2 hr wait" (cap 120)
- Notification status row: only when status === 'notified' — shows channel + sent/failed/manager indicator
- WCAG: aria-labels on all action buttons, aria-hidden on decorative icons

**`src/entities/waitlist/ui/WaitlistEntryCard.stories.tsx`** — 6 variants:
`Waiting`, `WaitingWithPhone`, `Notified`, `NotificationFailed`, `Seated`, `NoShow`
Imports from `@storybook/react-vite`

**`src/app/WaitlistRealtimeListener.tsx`**:
- Single channel `waitlist:pos-sync`
- 3 `.on()` handlers: `waitlist_entries` postgres_changes, `pool_tables` postgres_changes, broadcast `notified` event
- Invalidates `waitlistKeys.all` + `waitlistKeys.waitingCount()` on waitlist events
- Invalidates `['pool_tables']` on pool table events

**`src/entities/waitlist/model/waitlist-queries.integration.test.ts`**:
- 4 describe blocks, 8 `it.todo()` tests — Wave 0 stub for Plan 07-07

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] domain.ts waitlist schemas not present**
- **Found during:** Task 1 — `grep` showed no WaitlistEntry in domain.ts
- **Issue:** Plan 07-02 code commits (feat commits for domain.ts, result.ts, phone.ts, etc.) were never merged into this branch. Only the 07-02 SUMMARY commit was present at `457b308`.
- **Fix:** Added all 5 waitlist schemas + PhoneE164Schema to domain.ts; added 3 AppErrorCodes to result.ts
- **Files modified:** `bar-pos/src/shared/lib/domain.ts`, `bar-pos/src/shared/lib/result.ts`
- **Commit:** 762b014

**2. [Rule 3 - Blocking Issue] poolTableKeys not defined in this codebase**
- **Found during:** Task 2 — no `entities/pool-table/` directory exists in this worktree
- **Issue:** WaitlistRealtimeListener plan referenced `poolTableKeys` from `@entities/pool-table/model/queries`, which doesn't exist
- **Fix:** Used inline `['pool_tables']` array constant instead of importing from missing module
- **Files modified:** `bar-pos/src/app/WaitlistRealtimeListener.tsx`
- **Commit:** 36bf41d

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| 8 `it.todo()` tests | `src/entities/waitlist/model/waitlist-queries.integration.test.ts` | Wave 0 — intentional; Plan 07-07 fills in full integration test cases |

## Threat Flags

No new threat surface beyond what the plan's threat model already covers:
- T-7-12: RLS UPDATE policy enforced at DB level; `useMutationUpdateWaitlistStatus` returns SUPABASE_ERROR on policy rejection

## Self-Check: PASSED

- `bar-pos/src/entities/waitlist/model/types.ts` — FOUND
- `bar-pos/src/entities/waitlist/model/queries.ts` — FOUND
- `bar-pos/src/entities/waitlist/model/store.ts` — FOUND
- `bar-pos/src/entities/waitlist/model/waitlist-queries.integration.test.ts` — FOUND
- `bar-pos/src/entities/waitlist/ui/WaitlistEntryCard.tsx` — FOUND
- `bar-pos/src/entities/waitlist/ui/WaitlistEntryCard.stories.tsx` — FOUND
- `bar-pos/src/entities/waitlist/index.ts` — FOUND
- `bar-pos/src/app/WaitlistRealtimeListener.tsx` — FOUND
- Commit 762b014 — FOUND
- Commit 36bf41d — FOUND
- `npm run typecheck` — PASSED (no errors)
- `npm run lint` — PASSED (no warnings)
