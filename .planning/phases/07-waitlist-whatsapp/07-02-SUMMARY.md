---
phase: 07-waitlist-whatsapp
plan: "02"
subsystem: shared-lib
tags: [waitlist, phone, domain, rbac, tauri-notify, wave-0-stubs]
dependency_graph:
  requires:
    - "07-01 (DB migrations live in remote)"
  provides:
    - "phone.ts toE164/isE164 — consumed by 07-03 add-to-waitlist feature"
    - "waitlist-math.ts computeQuotedWait — consumed by 07-04 WaitlistPane widget"
    - "tauri-notify.ts sendManagerNotification — consumed by 07-05 notify feature"
    - "WaitlistEntrySchema + types in domain.ts — consumed by 07-03 through 07-07"
    - "manage_waitlist RBAC action — consumed by 07-03 through 07-06"
    - "Wave 0 test stubs — filled in by 07-07"
  affects:
    - "src/shared/lib/domain.ts (extended)"
    - "src/shared/lib/result.ts (extended)"
    - "src/shared/lib/rbac.ts (extended)"
tech_stack:
  added:
    - "libphonenumber-js (phone parsing/E.164 conversion)"
    - "tauri-plugin-notification v2 (native desktop notifications)"
  patterns:
    - "Pure utility functions in shared/lib (no entity imports)"
    - "Wave 0 stubs: it.todo() test files created before implementation"
    - "fast-check import before vitest per ESLint import/order rule"
key_files:
  created:
    - bar-pos/src/shared/lib/phone.ts
    - bar-pos/src/shared/lib/phone.test.ts
    - bar-pos/src/shared/lib/waitlist-math.ts
    - bar-pos/src/shared/lib/waitlist-math.test.ts
    - bar-pos/src/shared/lib/tauri-notify.ts
  modified:
    - bar-pos/src/shared/lib/domain.ts
    - bar-pos/src/shared/lib/result.ts
    - bar-pos/src/shared/lib/rbac.ts
decisions:
  - "phoneE164 field uses .nullable() (not .optional()) in WaitlistEntryCreateSchema — exactOptionalPropertyTypes compliance requires explicit null, not field omission"
  - "manage_waitlist added to MANAGER_EXTRA only — bartenders excluded per PRD (waitlist is manager+ action)"
  - "tauri-notify.ts silently skips on permission denied — manager falls back to Realtime pane"
  - "toE164() tries MX first, falls back to US — consistent with PRD target market"
  - "computeQuotedWait returns 0 (not 5) when targetEntryId not found — intentional sentinel to distinguish 'party not in list' from '0 parties ahead'"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-25"
  tasks_completed: 2
  files_created: 5
  files_modified: 3
---

# Phase 7 Plan 02: Shared Utilities + Domain Types Summary

**One-liner:** Phone E.164 utilities (libphonenumber-js), quoted-wait heuristic, Tauri notification wrapper, 5 waitlist Zod schemas, 3 new AppErrorCodes, manage_waitlist RBAC action, and Wave 0 test stubs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 2 | phone.ts, waitlist-math.ts, tauri-notify.ts + Wave 0 stubs | 4aa0dae | phone.ts, phone.test.ts, waitlist-math.ts, waitlist-math.test.ts, tauri-notify.ts |
| 3 | Extend domain.ts, result.ts, rbac.ts | 9e2d8b7 | domain.ts, result.ts, rbac.ts |

## What Was Built

### Task 2: Shared Utility Libraries

**`src/shared/lib/phone.ts`**
- `toE164(raw: string): string | null` — parses user input to E.164 using libphonenumber-js; tries MX default, falls back to US
- `isE164(value: string): boolean` — validates an already-formatted E.164 string

**`src/shared/lib/waitlist-math.ts`**
- `computeQuotedWait(input: WaitlistMathInput): number` — quoted-wait heuristic: `max(5, avgTurn * ceil(partiesAhead / tables))`; returns 0 if entry not found
- `WaitlistMathInput` interface exported for downstream consumers

**`src/shared/lib/tauri-notify.ts`**
- `sendManagerNotification(title: string, body: string): Promise<void>` — wraps `@tauri-apps/plugin-notification`; requests permission on first call; silently skips if denied

**Wave 0 Test Stubs**
- `phone.test.ts`: 11 `it.todo()` cases across 2 describe blocks
- `waitlist-math.test.ts`: 8 `it.todo()` cases including 2 property-test stubs (fast-check import pre-placed)
- Both discovered by vitest with 0 failures, 19 todo

### Task 3: Domain Type Extensions

**`src/shared/lib/domain.ts`** — 5 new schemas appended under Phase 7 section:
- `WaitlistEntryStatusSchema` — enum: waiting | notified | seated | no_show | cancelled
- `PhoneE164Schema` — regex `/^\+[1-9]\d{6,14}$/`
- `WaitlistEntrySchema` — full row shape with nullable phoneE164, tableId, seatedAt, notifiedAt
- `WaitlistEntryCreateSchema` — omits server-generated fields (id, status, tableId, seatedAt, notifiedAt, createdAt)
- `WaitlistNotificationSchema` — notification log row with channel (whatsapp | manager) and status (sent | failed | pending)

**`src/shared/lib/result.ts`** — 3 new AppErrorCodes:
- `WAITLIST_ENTRY_NOT_FOUND`
- `WAITLIST_NOTIFICATION_RATE_LIMITED`
- `WAITLIST_INVALID_PHONE`

**`src/shared/lib/rbac.ts`** — `manage_waitlist` added to:
- `STAFF_ACTIONS` array
- `MANAGER_EXTRA` set (manager+ only; bartenders excluded)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| 11 `it.todo()` tests | `src/shared/lib/phone.test.ts` | Wave 0 — intentional; Plan 07-07 fills in full test cases |
| 8 `it.todo()` tests | `src/shared/lib/waitlist-math.test.ts` | Wave 0 — intentional; Plan 07-07 fills in full test cases |

These stubs are intentional per the Wave 0 TDD pattern. They will be filled in by Plan 07-07.

## Threat Flags

No new threat surface beyond what the plan's threat model already covers:
- `manage_waitlist` RBAC mitigation (T-7-05) is implemented
- `PhoneE164Schema` regex validation (T-7-06) is implemented
- `WASENDER_API_KEY` never appears in renderer code (T-7-04) — key is Supabase secret only

## Self-Check: PASSED

- `bar-pos/src/shared/lib/phone.ts` — FOUND
- `bar-pos/src/shared/lib/phone.test.ts` — FOUND
- `bar-pos/src/shared/lib/waitlist-math.ts` — FOUND
- `bar-pos/src/shared/lib/waitlist-math.test.ts` — FOUND
- `bar-pos/src/shared/lib/tauri-notify.ts` — FOUND
- Commit 4aa0dae — FOUND
- Commit 9e2d8b7 — FOUND
- `npm run typecheck` — PASSED (no errors)
- `npx vitest run phone.test.ts waitlist-math.test.ts` — 19 todo, 0 failures
