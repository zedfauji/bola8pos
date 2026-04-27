---
phase: 09-auto-updater
plan: "03"
subsystem: shared/lib
tags: [updater, hook, react, polling, tdd]
dependency_graph:
  requires:
    - 09-02 (tauri-plugin-updater + tauri-plugin-process wired in Rust; global vi.mock in test-setup.ts)
  provides:
    - useAppUpdater hook (UpdaterState discriminated union + all 5 phases)
    - useAppUpdater.test.ts (7 unit tests, GREEN)
  affects:
    - 09-04 (UpdateAvailableDialog consumes useAppUpdater state)
    - 09-05 (wiring in app/ uses useAppUpdater return)
tech_stack:
  added: []
  patterns:
    - vi.advanceTimersByTimeAsync(0) to flush initial mount promise without triggering setInterval
    - useRef for mutable update object across re-renders
    - Discriminated union state (5 phases) via useState<UpdaterState>
key_files:
  created:
    - bar-pos/src/shared/lib/useAppUpdater.ts
    - bar-pos/src/shared/lib/useAppUpdater.test.ts
  modified: []
decisions:
  - vi.advanceTimersByTimeAsync(0) used instead of vi.runAllTimersAsync() — the latter triggers the 4h setInterval repeatedly causing "Aborting after 10000 timers" infinite loop; advanceByTime(0) flushes the initial async runCheck() promise only
  - relaunch exported as thin wrapper around tauriRelaunch to keep the return interface stable and mockable in Plan 09-04/05 tests
  - setState({ phase: 'restart-ready' }) called both inside Finished event callback AND after downloadAndInstall resolves — belt-and-suspenders; the callback fires first, the post-await setState is a no-op if already in restart-ready
metrics:
  duration: "3 min"
  completed: "2026-04-27T19:45:23Z"
  tasks: 2
  files: 2
---

# Phase 09 Plan 03: useAppUpdater Hook Summary

**One-liner:** React hook with 5-phase discriminated union state orchestrating Tauri 2 update lifecycle — startup check, 4h polling, progress tracking, and silent failure handling.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useAppUpdater.test.ts stub (RED) | 5ddaf81 | bar-pos/src/shared/lib/useAppUpdater.test.ts |
| 2 | Implement useAppUpdater.ts + fill tests (GREEN) | 931b2aa | bar-pos/src/shared/lib/useAppUpdater.ts, bar-pos/src/shared/lib/useAppUpdater.test.ts |

## What Was Built

`useAppUpdater` is a single-file React hook (`shared/lib/useAppUpdater.ts`) that:

- **Exports `UpdaterState`** — discriminated union with 5 phases: `idle | available | downloading | restart-ready | error`
- **Exports `useAppUpdater()`** — returns `{ state, startInstall, dismissUpdate, relaunch }`
- **Startup check (UPD-01):** `void runCheck()` called in `useEffect` on mount
- **4h polling (UPD-02):** `setInterval(() => void runCheck(), FOUR_HOURS_MS)` with `clearInterval` cleanup
- **Silent failure (UPD-07):** `null` return stays `idle`; thrown errors caught, logged via `logger.warn`, state stays `idle`
- **Download progress (UPD-08):** `downloadAndInstall` callback handles `Started` (set `contentLength`), `Progress` (accumulate `downloaded`, compute `percent`), `Finished` (transition to `restart-ready`)
- **Dismiss (UPD-05):** `dismissUpdate()` resets state to `{ phase: 'idle' }`

## TDD Gate Compliance

- RED gate commit: `5ddaf81` — `test(09-03): add failing test stubs for useAppUpdater hook`
- GREEN gate commit: `931b2aa` — `feat(09-03): implement useAppUpdater hook with full test coverage`
- 7/7 tests pass; no REFACTOR pass needed (code is already clean)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.runAllTimersAsync() causes infinite timer loop**
- **Found during:** Task 2 GREEN verification
- **Issue:** The plan's test template used `vi.runAllTimersAsync()` which exhausts 10,000 timer iterations because the 4h `setInterval` fires indefinitely in fake timers mode
- **Fix:** Replaced with `vi.advanceTimersByTimeAsync(0)` for mount flush (drains microtask queue without advancing clock); used `vi.advanceTimersByTimeAsync(FOUR_HOURS_MS)` for the UPD-02 interval test
- **Files modified:** bar-pos/src/shared/lib/useAppUpdater.test.ts
- **Commit:** 931b2aa

## Known Stubs

None — the hook is fully implemented and all 5 state phases are exercised by tests.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. The hook consumes `@tauri-apps/plugin-updater` (already inventoried in plan threat model T-9-03-01 through T-9-03-04).

## Self-Check: PASSED

- [x] `bar-pos/src/shared/lib/useAppUpdater.ts` exists
- [x] `bar-pos/src/shared/lib/useAppUpdater.test.ts` exists
- [x] Commit `5ddaf81` exists (RED)
- [x] Commit `931b2aa` exists (GREEN)
- [x] 7/7 unit tests pass
- [x] `npm run typecheck` exits 0
