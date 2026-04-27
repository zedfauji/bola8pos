---
phase: 09-auto-updater
plan: "04"
subsystem: shared/ui
tags: [dialog, updater, progress, storybook, unit-tests, tdd]
dependency_graph:
  requires:
    - 09-03 (useAppUpdater hook + UpdaterState discriminated union)
  provides:
    - UpdateAvailableDialog component (4 states: available/downloading/restart-ready/error)
    - Progress shadcn component (bar-pos/src/shared/ui/progress.tsx)
    - UpdateAvailableDialog.stories.tsx (4 stories)
    - UpdateAvailableDialog.test.tsx (7 unit tests, GREEN)
  affects:
    - 09-05 (wires UpdateAvailableDialog + useAppUpdater into app/providers.tsx)
tech_stack:
  added:
    - "@radix-ui/react-progress ^1.1.8"
  patterns:
    - AlertDialog with onOpenChange guard to block dismiss during downloading
    - whitespace-pre-wrap plain text for changelog (XSS prevention, ASVS V5)
    - data-testid="update-dialog-state" + data-testid="update-progress" for RTL/E2E
    - Loader2 spinner in disabled Install button during downloading state
key_files:
  created:
    - bar-pos/src/shared/ui/progress.tsx
    - bar-pos/src/shared/ui/UpdateAvailableDialog.tsx
    - bar-pos/src/shared/ui/UpdateAvailableDialog.stories.tsx
    - bar-pos/src/shared/ui/UpdateAvailableDialog.test.tsx
  modified:
    - bar-pos/src/shared/ui/index.ts
    - bar-pos/package.json
    - bar-pos/package-lock.json
decisions:
  - "progress.tsx created manually (Radix UI primitive) instead of via shadcn CLI — equivalent output, avoids FSD move step since @radix-ui/react-progress installed directly"
  - "dangerouslySetInnerHTML appears only in a JSX comment as a prohibition reminder — actual changelog rendered as {state.changelog} plain text node inside whitespace-pre-wrap <p>"
  - "ScrollArea import placed before alert-dialog to satisfy ESLint import/order rule (case-insensitive alphabetical: S before a)"
  - "React import omitted from UpdateAvailableDialog.tsx — not needed with Vite/JSX transform; strict tsc TS6133 would flag it"
metrics:
  duration: "8 min"
  completed: "2026-04-27T19:53:00Z"
  tasks: 2
  files: 7
---

# Phase 09 Plan 04: UpdateAvailableDialog Component Summary

**One-liner:** Four-state update dialog (available/downloading/restart-ready/error) with Progress bar, changelog plain-text rendering, and 7 RTL unit tests covering UPD-03/04/05/08.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add shadcn Progress component | a902443 | bar-pos/src/shared/ui/progress.tsx, package.json, package-lock.json |
| 2 | Implement UpdateAvailableDialog + stories + tests + index.ts | dbf3064 | UpdateAvailableDialog.tsx, .stories.tsx, .test.tsx, index.ts |

## What Was Built

`UpdateAvailableDialog` is a controlled React component (`shared/ui/UpdateAvailableDialog.tsx`) that:

- **Accepts `state: UpdaterState`** — discriminated union from `useAppUpdater`; renders nothing when `state.phase === 'idle'` (dialog closed)
- **Four states with distinct layouts:**
  - `available` — title "Update Available", version Badge, changelog ScrollArea (whitespace-pre-wrap), "Remind Later" + "Install Now" buttons
  - `downloading` — title "Downloading Update", Progress bar with `value={percent}`, "Downloading N%" label, both buttons disabled, Loader2 spinner, dialog non-dismissible
  - `restart-ready` — title "Ready to Restart", "Later" + "Restart Now" buttons, dialog dismissible
  - `error` — title "Update Failed", "Close" button only
- **XSS prevention (T-9-04-01):** changelog rendered as `<p className="whitespace-pre-wrap">{state.changelog}</p>` — never `dangerouslySetInnerHTML`
- **Dismiss guard (T-9-04-03):** `onOpenChange` no-ops when `isDownloading` is true — Escape and backdrop both blocked
- **Test hooks:** `data-testid="update-dialog-state"` (hidden div, `data-state={phase}`) and `data-testid="update-progress"` on Progress bar

`progress.tsx` — Radix UI Progress primitive with correct shadcn styling (`bg-muted` track, `bg-primary` indicator, `h-2` height, `transition-all`). Uses `ComponentRef` (not deprecated `ElementRef`).

## TDD Gate Compliance

- Task 1 created the stub test file (RED gate implicit — stubs are `/* STUB */`)
- Task 2 implemented the component and filled tests (GREEN gate: 7/7 pass)
- Commit `a902443` = progress.tsx (prerequisite)
- Commit `dbf3064` = component + filled tests GREEN

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused `import * as React` caused TS6133 error**
- **Found during:** Task 2 typecheck
- **Issue:** `import * as React from 'react'` was included per ConfirmDialog analog but not needed with Vite JSX transform
- **Fix:** Removed the import
- **Files modified:** bar-pos/src/shared/ui/UpdateAvailableDialog.tsx
- **Commit:** dbf3064

**2. [Rule 1 - Bug] ESLint import/order violations in new files**
- **Found during:** Task 2 lint check
- **Issue:** `./ScrollArea` needed to precede `./alert-dialog` (case-insensitive alphabetical); `@shared/lib/test-utils` needed to precede type import of `@shared/lib/useAppUpdater`; `@radix-ui/react-progress` needed to precede `react` in progress.tsx
- **Fix:** Reordered imports in all three affected files
- **Files modified:** UpdateAvailableDialog.tsx, UpdateAvailableDialog.test.tsx, progress.tsx
- **Commit:** dbf3064

**3. [Rule 1 - Bug] Deprecated `ElementRef` in progress.tsx**
- **Found during:** Task 2 lint check
- **Issue:** shadcn template uses `React.ElementRef` which is deprecated; ESLint `@typescript-eslint/no-deprecated` flags it
- **Fix:** Replaced with `React.ComponentRef<typeof ProgressPrimitive.Root>`
- **Files modified:** bar-pos/src/shared/ui/progress.tsx
- **Commit:** a902443

**4. [Rule 1 - Bug] Template literal `restrict-template-expressions` in progress.tsx**
- **Found during:** Task 2 lint check
- **Issue:** `translateX(-${100 - (value ?? 0)}%)` — number in template literal is disallowed
- **Fix:** Wrapped with `.toString()`: `(100 - (value ?? 0)).toString()`
- **Files modified:** bar-pos/src/shared/ui/progress.tsx
- **Commit:** a902443

## Known Stubs

None — all 7 tests are fully implemented and GREEN.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. Dialog consumes `UpdaterState` from `useAppUpdater` (already inventoried in plan threat model). All T-9-04-xx mitigations confirmed present:

| Threat ID | Mitigation | Verified |
|-----------|------------|---------|
| T-9-04-01 | `whitespace-pre-wrap` plain text, no `dangerouslySetInnerHTML` | confirmed (grep returns only comment) |
| T-9-04-02 | Version Badge renders `{version}` as React text child | confirmed |
| T-9-04-03 | `onOpenChange` checks `isDownloading` before any close handler | confirmed |
| T-9-04-04 | Version badge is display-only; semver verification done in Rust | confirmed (no comparison logic in component) |

## Self-Check: PASSED

- [x] `bar-pos/src/shared/ui/progress.tsx` exists
- [x] `bar-pos/src/shared/ui/UpdateAvailableDialog.tsx` exists
- [x] `bar-pos/src/shared/ui/UpdateAvailableDialog.stories.tsx` exists
- [x] `bar-pos/src/shared/ui/UpdateAvailableDialog.test.tsx` exists
- [x] Commit `a902443` exists (progress.tsx)
- [x] Commit `dbf3064` exists (dialog + tests GREEN)
- [x] 7/7 unit tests pass
- [x] `npm run typecheck` exits 0
- [x] No `dangerouslySetInnerHTML` in implementation (only in JSX comment)
- [x] `whitespace-pre-wrap` present in changelog paragraph
- [x] `data-testid="update-dialog-state"` and `data-testid="update-progress"` present
- [x] `UpdateAvailableDialog`, `UpdateAvailableDialogProps`, `Progress` exported from `index.ts`
