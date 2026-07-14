---
phase: "07-waitlist-whatsapp"
plan: "06"
subsystem: "waitlist-ui-wiring"
status: "checkpoint"
tags: ["waitlist", "routing", "widgets", "home-dashboard", "rbac"]
dependency_graph:
  requires:
    - "07-05"  # feature slices (NotifyButton, AddWaitlistEntryForm, SeatPartySheet, useMarkNoShow, useMarkCancelled)
    - "07-04"  # entities (WaitlistEntryCard, useWaitlistEntries, useWaitlistLastNotificationsMap)
  provides:
    - "/waitlist route accessible to manager+"
    - "WaitlistQueue widget"
    - "PoolTableOccupancyPanel widget"
    - "WaitlistPage two-column layout"
    - "HomeDashboard Waitlist tile with live badge"
    - "WaitlistRealtimeListener mounted in app tree"
  affects:
    - "bar-pos/src/app/router.tsx"
    - "bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx"
tech_stack:
  added: []
  patterns:
    - "FSD slot pattern: widget passes <NotifyButton /> as notifySlot to entity card"
    - "Inline pool_tables query (no @entities/pool-table entity yet — mirrors SeatPartySheet)"
    - "Lazy route registration with RBAC guard component (WaitlistRoute)"
    - "Waiting-count badge overlay on HomeDashboard tile using absolute positioning"
key_files:
  created:
    - bar-pos/src/widgets/WaitlistQueue/index.ts
    - bar-pos/src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx
    - bar-pos/src/widgets/PoolTableOccupancyPanel/index.ts
    - bar-pos/src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx
    - bar-pos/src/pages/waitlist/index.tsx
    - bar-pos/src/app/waitlist-route.tsx
  modified:
    - bar-pos/src/app/router.tsx
    - bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx
decisions:
  - "Used inline pool_tables TanStack Query in WaitlistQueue and PoolTableOccupancyPanel (no @entities/pool-table entity exists); mirrors SeatPartySheet pattern"
  - "Used CardSkeleton (3x) instead of non-existent LoadingSkeletons component for loading state in WaitlistQueue"
  - "PoolTableOccupancyPanel treats status 'available', 'idle', and 'free' as available — mirrors SeatPartySheet availability check"
  - "WaitlistRealtimeListener mounted before Suspense in Router component (app-level, always active)"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-04-25"
  tasks_completed: 2
  tasks_total: 3
  files_created: 6
  files_modified: 2
---

# Phase 07 Plan 06: Waitlist UI Wiring Summary

**One-liner:** /waitlist route wired with two-column layout (WaitlistQueue + PoolTableOccupancyPanel), RBAC guard, Realtime listener, and HomeDashboard tile with live waiting-count badge.

## Status: CHECKPOINT REACHED (Task 3 — human-verify)

Tasks 1 and 2 are committed. Task 3 is a `checkpoint:human-verify` gate requiring the user to verify the UI flows in a running dev server.

## Tasks Completed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Widgets, Page, Route Guard, Router registration | e54d0da | Done |
| 2 | HomeDashboard Waitlist tile with waiting-count badge | a857ffa | Done |
| 3 | Human verify: add → notify → seat flow | — | Awaiting human |

## What Was Built

### Task 1 — WaitlistQueue + PoolTableOccupancyPanel + WaitlistPage + Route

**`bar-pos/src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx`**
- FIFO entry list from `useWaitlistEntries()`
- Each `WaitlistEntryCard` receives `notifySlot=<NotifyButton entryId=... entryName=... hasPhone=... />` (FSD slot pattern — widget owns the feature, entity card renders the slot)
- `lastNotification={notificationsMap[entry.id] ?? null}` — driven by `useWaitlistLastNotificationsMap(entryIds)`, never hardcoded null
- "Add to waitlist" CTA opens `AddWaitlistEntryForm` Sheet
- "Seat party" button opens `SeatPartySheet`
- No-show / cancel handlers call `useMarkNoShow` / `useMarkCancelled`
- Loading state: 3× `CardSkeleton` (h-80); Empty state: `EmptyState` with Users icon

**`bar-pos/src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx`**
- Available/occupied count summary row with `role="status"`
- 2-column table grid — available: `border-pos-accent/50 bg-pos-accent/5`; occupied: `border-pos-danger/50 bg-pos-danger/5 opacity-75`
- Treats `available | idle | free` statuses as available (mirrors SeatPartySheet)
- Empty state: `EmptyState` with Table2 icon

**`bar-pos/src/pages/waitlist/index.tsx`**
- `flex h-screen flex-col` layout with `BackToHomeButton`
- `PageContainer title="Waitlist"` wrapping two-column layout
- Left column (`flex-1`): `WaitlistQueue`; Right column (`min-w-[200px]`): `PoolTableOccupancyPanel`
- Stacks vertically on `< md`, side-by-side on `md+` (`flex-col gap-8 md:flex-row`)

**`bar-pos/src/app/waitlist-route.tsx`**
- Mirrors `KitchenPrepRoute` exactly
- `can('manage_waitlist')` → redirect to `/home` if false

**`bar-pos/src/app/router.tsx`**
- `WaitlistPage` lazy import added
- `WaitlistRoute` and `WaitlistRealtimeListener` imports added
- `<WaitlistRealtimeListener />` mounted before `<Suspense>` (app-level, always active)
- `/waitlist` route: `<ProtectedRoute><WaitlistRoute><WaitlistPage /></WaitlistRoute></ProtectedRoute>`

### Task 2 — HomeDashboard Waitlist Tile

**`bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx`**
- `ListOrdered` icon imported from lucide-react
- `useWaitlistWaitingCount` imported from `@entities/waitlist`
- Waitlist entry added to `ITEMS` array after Kitchen Prep: `{ path: '/waitlist', label: 'Waitlist', icon: ListOrdered, requiredAction: 'manage_waitlist', managerLabel: 'Manager' }`
- `const { data: waitingCount = 0 } = useWaitlistWaitingCount()` called at component top level
- Badge overlay inside icon `<div className="relative">` — `variant="destructive"`, `absolute -right-1 -top-1`, shows only when `waitingCount > 0`, `aria-label="Waitlist: {N} parties waiting"`, caps at `99+`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No `@entities/pool-table` entity exists**
- **Found during:** Task 1 (WaitlistQueue + PoolTableOccupancyPanel both need pool table data)
- **Issue:** Plan referenced `usePoolTables` from `@entities/pool-table` but this entity doesn't exist in the codebase
- **Fix:** Inlined the pool_tables query directly in both widgets — same approach used by `SeatPartySheet.tsx` (pre-existing pattern). Query uses `supabase as any` cast with ESLint disable comment per CLAUDE.md convention
- **Files modified:** WaitlistQueue.tsx, PoolTableOccupancyPanel.tsx

**2. [Rule 1 - Bug] `LoadingSkeletons` not exported from `@shared/ui`**
- **Found during:** Task 1 typecheck
- **Issue:** Plan specified `<LoadingSkeletons count={3} />` but `shared/ui/index.ts` exports individual skeletons (`CardSkeleton`, `TabListSkeleton`, etc.) — no `LoadingSkeletons` aggregate
- **Fix:** Used `<CardSkeleton height={80} />` × 3 wrapped in a flex column for equivalent loading state
- **Files modified:** WaitlistQueue.tsx

**3. [Rule 3 - Blocking] Missing `PoolTableOccupancyPanel/index.ts` barrel**
- **Found during:** Task 1 typecheck (`@widgets/PoolTableOccupancyPanel` not found)
- **Issue:** `WaitlistPage` imports `@widgets/PoolTableOccupancyPanel` but the barrel `index.ts` wasn't in the plan's file list
- **Fix:** Created `bar-pos/src/widgets/PoolTableOccupancyPanel/index.ts` — standard FSD widget barrel

## Known Stubs

- `avgTurnMap` in `WaitlistQueue.tsx` uses a placeholder `Map([[2, 30], [4, 45]])` instead of real rolling average data from `useWaitlistAvgTurnBySize`. The `computeQuotedWait()` function will use 30 min default for all party sizes until a real hook is wired. This is intentional per plan (no avg-turn hook was specified for this phase). Quoted wait will show accurate relative ordering but not calibrated minutes.

## Threat Surface

T-7-15 mitigated: `WaitlistRoute` redirects to `/home` when `can('manage_waitlist')` is false. Server-side RLS is second line of defense.

T-7-16 accepted: `useWaitlistWaitingCount` in `HomeDashboard` is non-sensitive; all authenticated users can see count.

## Self-Check

- [x] `bar-pos/src/widgets/WaitlistQueue/index.ts` — FOUND
- [x] `bar-pos/src/widgets/WaitlistQueue/ui/WaitlistQueue.tsx` — FOUND
- [x] `bar-pos/src/widgets/PoolTableOccupancyPanel/index.ts` — FOUND
- [x] `bar-pos/src/widgets/PoolTableOccupancyPanel/ui/PoolTableOccupancyPanel.tsx` — FOUND
- [x] `bar-pos/src/pages/waitlist/index.tsx` — FOUND
- [x] `bar-pos/src/app/waitlist-route.tsx` — FOUND
- [x] `bar-pos/src/app/router.tsx` — modified (verified)
- [x] `bar-pos/src/widgets/HomeDashboard/ui/HomeDashboard.tsx` — modified (verified)
- [x] Commit e54d0da — FOUND
- [x] Commit a857ffa — FOUND
- [x] `npm run typecheck` passes (verified against main repo with all new files)

## Self-Check: PASSED
