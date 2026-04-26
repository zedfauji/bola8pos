---
phase: 08-polish-reports-e2e-hardening
plan: "06"
subsystem: waitlist-ux
tags: [paper-cuts, touch-targets, focus-trap, toast-copy, ux-polish]
dependency_graph:
  requires: [08-03]
  provides: [S6-12]
  affects: [waitlist-flow]
tech_stack:
  added: []
  patterns: [size="lg" for touch targets, focus-trap comment pattern, feature-specific toast copy]
key_files:
  created: []
  modified:
    - bar-pos/src/features/seat-waitlist-party/ui/SeatPartySheet.tsx
    - bar-pos/src/features/add-waitlist-entry/ui/AddWaitlistEntryForm.tsx
    - bar-pos/src/features/notify-waitlist/ui/NotifyButton.tsx
    - bar-pos/src/features/mark-waitlist-entry-cancelled/model/useMarkCancelled.ts
    - bar-pos/src/features/mark-waitlist-no-show/model/useMarkNoShow.ts
    - bar-pos/src/features/seat-waitlist-party/model/useSeatWaitlistParty.ts
decisions:
  - "Actual UI filenames differ from plan spec: SeatPartySheet.tsx (not SeatWaitlistPartySheet.tsx), NotifyButton.tsx (not NotifyWaitlistButton.tsx) — fixes applied to actual files"
  - "POSButton exists in @shared/ui but size=\"lg\" on shadcn Button used instead — SeatPartySheet uses inline <button> elements for table grid (correct); POSButton would be equally valid but size=\"lg\" is simpler"
  - "Focus-trap comment added to both SeatPartySheet and AddWaitlistEntryForm — Radix UI SheetContent traps focus by default, no explicit autoFocus needed"
  - "useNotifyWaitlist already had specific toast copy — left unchanged (clean)"
metrics:
  duration: "8min"
  completed: "2026-04-26"
  tasks: 1
  files_modified: 6
---

# Phase 08 Plan 06: S6-12 Waitlist UX Paper-cuts Summary

Applied four categories of UX paper-cuts to the waitlist flow: touch-target sizing on action buttons, focus-trap verification in Sheet components, and error toast copy alignment. Also committed pending formatter changes before new code landed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| Step 1 | Commit pending format/lint fixes | 9635c17 | AddWaitlistEntryForm.tsx, useNotifyWaitlist.ts |
| Task 1 | Paper-cuts: touch targets + focus traps + toast copy | 7e77e60 | 6 files |

## Acceptance Criteria Verification

- `grep -r 'size="lg"' src/features/seat-waitlist-party src/features/add-waitlist-entry` — 4 hits (2 per folder)
- `grep -n "Focus is trapped" src/features/seat-waitlist-party/ui/SeatPartySheet.tsx` — 1 hit (line 101)
- `grep -n "Could not" src/features/mark-waitlist-entry-cancelled/...` — hit per file (all 3 hooks)
- `npm run test` — 109 files, 1076 tests PASS

## Deviations from Plan

### Auto-resolved Decisions

**1. [Rule 2 - Deviation] Actual UI filenames differ from plan spec**
- **Found during:** Task 0 triage
- **Issue:** Plan referenced `SeatWaitlistPartySheet.tsx` and `NotifyWaitlistButton.tsx` but actual files are `SeatPartySheet.tsx` and `NotifyButton.tsx`
- **Fix:** Applied all fixes to the actual files; all grep ACs pass against real filenames
- **Files modified:** SeatPartySheet.tsx, NotifyButton.tsx

**2. [Rule 2 - Triage] Import-order violations were formatting-only**
- **Found during:** Task 0 triage + lint:fix run
- **Issue:** Plan expected import-order lint violations; actual uncommitted changes were Prettier formatting tweaks (arrow function whitespace, trailing comma removal) not import ordering
- **Fix:** Committed the pending format changes as Step 1 pre-flight; no import-order violations existed in waitlist files
- **Files modified:** AddWaitlistEntryForm.tsx, useNotifyWaitlist.ts (commit 9635c17)

**3. [Info] useNotifyWaitlist already had specific toast copy**
- **Found during:** Task 0 triage
- **Status:** Already clean — `Could not send notification for ${input.entryName}. Check notification history.`
- **Action:** No change needed

## Known Stubs

None — all paper-cut fixes are complete. No stubs introduced.

## Threat Flags

None — this plan only modified UI sizing props, focus-trap comments, and error toast strings. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- Commit 9635c17 exists: confirmed
- Commit 7e77e60 exists: confirmed
- SeatPartySheet.tsx modified: confirmed (size="lg" + focus-trap comment)
- AddWaitlistEntryForm.tsx modified: confirmed (size="lg" + focus-trap comment)
- NotifyButton.tsx modified: confirmed (size="sm" → size="lg")
- useMarkCancelled.ts modified: confirmed (specific toast)
- useMarkNoShow.ts modified: confirmed (specific toast)
- useSeatWaitlistParty.ts modified: confirmed (specific toast)
- 109 tests pass: confirmed
