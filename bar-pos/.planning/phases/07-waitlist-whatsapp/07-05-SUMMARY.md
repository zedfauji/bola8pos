---
phase: 07-waitlist-whatsapp
plan: "05"
subsystem: features/waitlist
tags: [waitlist, feature-slice, toast, tanstack-query, phone-validation, sheet, fsd]
dependency_graph:
  requires:
    - "07-04 (entities/waitlist — useMutationAddWaitlistEntry, useMutationUpdateWaitlistStatus, waitlistKeys)"
    - "07-02 (shared/lib/phone.ts toE164, shared/lib/tauri-notify.ts sendManagerNotification)"
  provides:
    - "useAddWaitlistEntry — consumed by AddWaitlistEntryForm and WaitlistQueue widget (07-06)"
    - "useNotifyWaitlist — consumed by NotifyButton and WaitlistEntryCard notifySlot (07-06)"
    - "useSeatWaitlistParty — consumed by SeatPartySheet and WaitlistQueue (07-06)"
    - "useMarkNoShow — consumed by WaitlistEntryCard confirm action (07-06)"
    - "useMarkCancelled — consumed by WaitlistEntryCard confirm action (07-06)"
    - "AddWaitlistEntryForm — consumed by WaitlistQueue header CTA (07-06)"
    - "NotifyButton — consumed by WaitlistEntryCard notifySlot (07-06)"
    - "SeatPartySheet — consumed by WaitlistQueue (07-06)"
  affects:
    - "bar-pos/src/features/ (5 new feature folders)"
tech_stack:
  added: []
  patterns:
    - "feature hook wraps entity mutation + toast (useAddWaitlistEntry)"
    - "useMutation direct pattern for status-update features (notify, seat, no-show, cancel)"
    - "useReducer with RESET action for Sheet forms (AddWaitlistEntryForm)"
    - "blur-only phone validation via toE164() — not on keystroke"
    - "inline pool_tables query in SeatPartySheet (no pool-table entity in this worktree)"
    - "pre-regen cast: const db = supabase as any with file-level eslint-disable"
key_files:
  created:
    - bar-pos/src/features/add-waitlist-entry/model/useAddWaitlistEntry.ts
    - bar-pos/src/features/add-waitlist-entry/ui/AddWaitlistEntryForm.tsx
    - bar-pos/src/features/notify-waitlist/model/useNotifyWaitlist.ts
    - bar-pos/src/features/notify-waitlist/ui/NotifyButton.tsx
    - bar-pos/src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts
    - bar-pos/src/features/seat-waitlist-party/ui/SeatPartySheet.tsx
    - bar-pos/src/features/mark-waitlist-no-show/model/useMarkNoShow.ts
    - bar-pos/src/features/mark-waitlist-entry-cancelled/model/useMarkCancelled.ts
  modified: []
decisions:
  - "Inline pool_tables query in SeatPartySheet — no pool-table entity in this worktree branch; avoids missing @entities/pool-table import; mirrors Plan 04 WaitlistRealtimeListener pattern"
  - "useNotifyWaitlist uses direct useMutation (not useMutationUpdateWaitlistStatus) — needs notified_at field which entity mutation accepts but plan specified direct DB update pattern for clarity"
  - "logger-instance.ts import used — worktree uses @shared/lib/logger-instance (matching entities/waitlist/model/queries.ts pattern from Plan 04)"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-25"
  tasks_completed: 2
  files_created: 8
  files_modified: 0
---

# Phase 7 Plan 05: Waitlist Feature Slices Summary

**One-liner:** Five waitlist feature hooks and three UI components with toast orchestration, blur-only phone validation, and table selection grid.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Feature hooks (add, notify, seat, no-show, cancel) | `644fafd` | 5 model hooks |
| 2 | Feature UI components (AddWaitlistEntryForm, NotifyButton, SeatPartySheet) | `4710092` | 3 UI components |

## What Was Built

### Feature Hooks (Task 1)

**`useAddWaitlistEntry`** — wraps `useMutationAddWaitlistEntry` from `@entities/waitlist`. On success: `"{name} added to the waitlist."` toast. On error: generic connection toast.

**`useNotifyWaitlist`** — direct `useMutation` that UPDATEs `status='notified'` + `notified_at`. When `hasPhone=false`, fires `sendManagerNotification('Party ready', ...)` as Tauri desktop fallback. Toast copy varies by channel presence. Invalidates `waitlistKeys.lists()`.

**`useSeatWaitlistParty`** — direct `useMutation` that UPDATEs `status='seated'` + `table_id` + `seated_at`. Toast: `"{name} seated at {tableName}."`. Invalidates lists + waitingCount.

**`useMarkNoShow`** — UPDATEs `status='no_show'`. Toast: `"{name} marked as no-show."` Invalidates lists + waitingCount.

**`useMarkCancelled`** — UPDATEs `status='cancelled'`. Toast: `"Entry for {name} cancelled."` Invalidates lists + waitingCount.

### Feature UI (Task 2)

**`AddWaitlistEntryForm`** — Sheet (`side="right"`, `max-w-md`). State via `useReducer` with `RESET` on close. Fields: name (required), partySize Select 1–20 (default 1), phoneRaw (optional tel input). Phone validation fires only on BLUR (`PHONE_BLUR` action) using `toE164()`. Error: "Not a valid MX or US phone number." with `role="alert"`. Submit disabled when `!isValid || isPending`.

**`NotifyButton`** — Inline button with `BellRing` icon. Label adapts to `hasPhone`: "Notify via WhatsApp" / "Notify manager". `aria-label` matches. `LoadingSpinner` during pending.

**`SeatPartySheet`** — Sheet (`side="right"`, `max-w-md`). Queries `pool_tables` inline (no pool-table entity in worktree). Available tables: `aria-pressed` button with `border-pos-accent bg-pos-accent/10` highlight on selection. Occupied tables: `disabled` button with "Occupied" label. Empty state: "No tables available right now." Submit disabled when no table selected or pending.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed logger import path**
- **Found during:** Task 1
- **Issue:** Plan template used `@shared/lib/logger` but worktree uses `@shared/lib/logger-instance` (matching the entities/waitlist pattern from Plan 04)
- **Fix:** Changed all hooks to import from `@shared/lib/logger-instance`
- **Files modified:** useNotifyWaitlist.ts, useSeatWaitlistParty.ts, useMarkNoShow.ts, useMarkCancelled.ts

**2. [Rule 2 - Missing critical functionality] Fixed import ordering and void expression lint errors**
- **Found during:** Task 2 lint run
- **Issue:** ESLint `import/order` violations and `@typescript-eslint/no-confusing-void-expression` in SeatPartySheet.tsx
- **Fix:** Reordered imports (`@tanstack/react-query` before `lucide-react` before `react`), added braces to void arrow functions
- **Files modified:** SeatPartySheet.tsx

### Inline pool_tables Query
- **Found during:** Task 2
- **Issue:** Plan references `usePoolTables()` from `@entities/pool-table` but that entity does not exist in the worktree branch (matches Plan 04 decision documented in 07-04-SUMMARY.md)
- **Fix:** Inlined `useQuery` with direct `pool_tables` DB query inside SeatPartySheet
- **Impact:** Functionally equivalent; when pool-table entity is added to the worktree, this can be replaced with the entity hook

## Verification

- `npm run typecheck` — PASSED (no errors)
- `npm run lint` — PASSED for new files (4 pre-existing errors in Plan 04 files: `entities/waitlist/model/queries.ts:132` and `entities/waitlist/ui/WaitlistEntryCard.tsx:15,23,26` — out of scope per deviation rules)
- `sendManagerNotification` present in useNotifyWaitlist — VERIFIED
- `status: 'notified'` in useNotifyWaitlist — VERIFIED
- `status: 'seated'` in useSeatWaitlistParty — VERIFIED
- `aria-pressed` in SeatPartySheet — VERIFIED
- `BellRing` in NotifyButton — VERIFIED
- `side="right"` in AddWaitlistEntryForm — VERIFIED
- `PHONE_BLUR` / `phoneBlurred` in AddWaitlistEntryForm — VERIFIED
- `status: 'no_show'` in useMarkNoShow — VERIFIED
- `status: 'cancelled'` in useMarkCancelled — VERIFIED

## Known Stubs

None. All feature hooks and UI components have their data sources wired (entity mutations, inline queries). No placeholder text or hardcoded empty data flows to UI.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input_validation | AddWaitlistEntryForm.tsx | Phone input validated via toE164() on blur before submission — only E.164 stored per T-7-14 mitigation |

## Self-Check

- [x] `bar-pos/src/features/add-waitlist-entry/model/useAddWaitlistEntry.ts` — EXISTS
- [x] `bar-pos/src/features/add-waitlist-entry/ui/AddWaitlistEntryForm.tsx` — EXISTS
- [x] `bar-pos/src/features/notify-waitlist/model/useNotifyWaitlist.ts` — EXISTS
- [x] `bar-pos/src/features/notify-waitlist/ui/NotifyButton.tsx` — EXISTS
- [x] `bar-pos/src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts` — EXISTS
- [x] `bar-pos/src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` — EXISTS
- [x] `bar-pos/src/features/mark-waitlist-no-show/model/useMarkNoShow.ts` — EXISTS
- [x] `bar-pos/src/features/mark-waitlist-entry-cancelled/model/useMarkCancelled.ts` — EXISTS
- [x] Commit `644fafd` — EXISTS
- [x] Commit `4710092` — EXISTS

## Self-Check: PASSED
