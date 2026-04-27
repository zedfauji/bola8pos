---
phase: 09-auto-updater
plan: "05"
subsystem: app/providers
tags: [updater, providers, e2e-smoke, wiring, lint-fix]
dependency_graph:
  requires:
    - 09-03 (useAppUpdater hook + UpdaterState discriminated union)
    - 09-04 (UpdateAvailableDialog component)
  provides:
    - UpdaterProvider wired into app/providers.tsx (dialog available on all routes)
    - bar-pos/e2e/18-updater.spec.ts (E2E smoke spec, 2 tests)
  affects:
    - All app routes — UpdateAvailableDialog now renders at root when update available
tech_stack:
  added: []
  patterns:
    - Null-render-style component that returns dialog JSX (extends RappiRealtimeBridge pattern)
    - E2E console-error capture (NON-NEGOTIABLE per project memory)
    - requireIntegrationEnv() for graceful skip when .env.local absent
key_files:
  created:
    - bar-pos/e2e/18-updater.spec.ts
  modified:
    - bar-pos/src/app/providers.tsx
    - bar-pos/src/shared/lib/useAppUpdater.ts
    - bar-pos/src/shared/lib/useAppUpdater.test.ts
decisions:
  - "UpdaterProvider added as a local function in providers.tsx (not a separate file) per plan instructions"
  - "E2E spec uses ./fixtures import (not @playwright/test) to get page-error pageerror assertion from the extended test fixture"
  - "lint in agent/ subsystem (194+ errors) and ErrorBoundary.tsx/App.tsx are pre-existing from separate commit chain — out of scope per deviation scope boundary rule"
  - "useAppUpdater.ts: eslint-disable-next-line react-hooks/set-state-in-effect added — runCheck is async, setState fires after await resolution not synchronously"
metrics:
  duration: "12 min"
  completed: "2026-04-27T20:07:00Z"
  tasks: 2
  files: 4
---

# Phase 09 Plan 05: Updater Wiring + E2E Smoke Summary

**One-liner:** UpdaterProvider wired into app/providers.tsx — update check runs at boot, dialog available on all routes; E2E smoke spec asserts zero console errors and no spurious dialog on startup.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire UpdaterProvider into app/providers.tsx | 063c8f3 | bar-pos/src/app/providers.tsx |
| 2 | Create E2E smoke spec + fix lint in useAppUpdater files | abb10e3 | bar-pos/e2e/18-updater.spec.ts, useAppUpdater.ts, useAppUpdater.test.ts |

## What Was Built

**UpdaterProvider** — local component in `app/providers.tsx` that:
- Calls `useAppUpdater()` to start the update check cycle at app boot (UPD-01)
- Renders `<UpdateAvailableDialog>` with all four handler props wired (`onInstall`, `onRemindLater`, `onDismiss`, `onRestart`)
- Mounted before `{children}` in the `QueryClientProvider` tree — visible on all routes

**E2E smoke spec** (`e2e/18-updater.spec.ts`):
- Test 1: captures console errors, asserts zero errors on boot, asserts `data-testid="update-dialog-state"` not visible (UPD-01 / UPD-07)
- Test 2: asserts `[role="alertdialog"]` containing "Update Available" is not visible after 1s delay (UPD-07)
- Uses `./fixtures` import for page-error pageerror assertion (project NON-NEGOTIABLE)
- Skips gracefully via `requireIntegrationEnv()` when `.env.local` E2E credentials absent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing lint errors in useAppUpdater.ts from Plan 09-03**
- **Found during:** Task 2 (quality gate — npm run lint)
- **Issue:** `useAppUpdater.ts` had 4 errors: two `import/order` violations (tauri imports after react), `react-hooks/set-state-in-effect` on the async `void runCheck()` call, and an `@typescript-eslint/no-confusing-void-expression` on setInterval arrow
- **Fix:** Reordered imports (`@tauri-apps/plugin-process` → `@tauri-apps/plugin-updater` → `react`); added `eslint-disable-next-line react-hooks/set-state-in-effect` with justification comment; wrapped setInterval callback in braces; removed stale eslint-disable directives
- **Files modified:** bar-pos/src/shared/lib/useAppUpdater.ts
- **Commit:** abb10e3

**2. [Rule 1 - Bug] Pre-existing lint errors in useAppUpdater.test.ts from Plan 09-03**
- **Found during:** Task 2 (quality gate — npm run lint)
- **Issue:** `@tauri-apps/plugin-updater` import out of order; two `_result` destructures assigned but never used
- **Fix:** Moved tauri import before `@testing-library/react`; replaced `const { result: _result } = renderHook(...)` with bare `renderHook(...)` in two tests where only call-count side effects are asserted
- **Files modified:** bar-pos/src/shared/lib/useAppUpdater.test.ts
- **Commit:** abb10e3

### Out-of-Scope Pre-existing Lint Failures (Deferred)

**agent/ subsystem + ErrorBoundary.tsx / App.tsx — 212 errors total**
- `src/shared/lib/agent/` — 194+ errors (many `any`, import order, FSD boundary violations) from `feat(agent):` commit chain
- `src/shared/ui/ErrorBoundary.tsx` — 1 import/order error (telemetry before POSButton)
- `src/app/App.tsx` — 1 import/order error
- These predate Phase 9 (committed in `ecf717b chore: commit full codebase` and agent commits)
- Per deviation scope boundary: only fix issues directly caused by current task's changes
- Documented in `deferred-items.md` for future cleanup sprint

**Impact on quality gate:** `npm run lint` exits non-zero due to agent subsystem errors. Files created/modified in this plan (`providers.tsx`, `useAppUpdater.ts`, `useAppUpdater.test.ts`, `18-updater.spec.ts`) are all individually lint-clean.

## Quality Gate Results

| Gate | Result | Notes |
|------|--------|-------|
| `npm run typecheck` | PASS (exit 0) | No TypeScript errors |
| `npm run lint` | PARTIAL — plan files clean | 212 pre-existing errors in agent/ subsystem outside this plan's scope |
| `npm run test` | PARTIAL — Phase 9 tests GREEN | 14/14 Phase 9 tests pass; 1 pre-existing failure in agent/brain.test.ts |
| Phase 9 unit tests | PASS 14/14 | useAppUpdater (7) + UpdateAvailableDialog (7) |

## Known Stubs

None — UpdaterProvider is fully wired with real hook and dialog props.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. UpdaterProvider adds dialog rendering at app root; threat disposition for T-9-05-01 through T-9-05-04 confirmed acceptable per plan threat model.

## Self-Check: PASSED

- [x] `bar-pos/src/app/providers.tsx` modified — UpdaterProvider defined and mounted
- [x] `bar-pos/e2e/18-updater.spec.ts` exists
- [x] `grep "UpdaterProvider" bar-pos/src/app/providers.tsx` returns 2 lines (definition + JSX)
- [x] `grep "useAppUpdater" bar-pos/src/app/providers.tsx` returns import + usage
- [x] `grep "UpdateAvailableDialog" bar-pos/src/app/providers.tsx` returns import + JSX
- [x] `grep "consoleErrors" bar-pos/e2e/18-updater.spec.ts` returns console error capture
- [x] `grep "loginAs" bar-pos/e2e/18-updater.spec.ts` returns auth helper call
- [x] Commit `063c8f3` exists (providers.tsx)
- [x] Commit `abb10e3` exists (E2E spec + lint fixes)
- [x] `npm run typecheck` exits 0
- [x] 14/14 Phase 9 unit tests pass
