---
phase: 02-combos
plan: 09
subsystem: features/add-combo-to-tab
tags: [test, gap-closure, nested-combo]
dependency_graph:
  requires: []
  provides: [NESTED_COMBO_FORBIDDEN integration test coverage]
  affects: [ComboBuilderSheet.test.tsx]
tech_stack:
  added: []
  patterns: [mockResolvedValueOnce for per-test mock override, dynamic import of mocked module for assertion]
key_files:
  created: []
  modified:
    - bar-pos/src/features/add-combo-to-tab/ComboBuilderSheet.test.tsx
decisions:
  - Assert via `toast.error` mock (dynamic import of sonner after render) rather than DOM text, consistent with sonner mocking pattern already in the file
metrics:
  duration: 3min
  completed_date: "2026-04-24T00:29:41Z"
  tasks: 1
  files_modified: 1
requirements:
  - S2-08
---

# Phase 02 Plan 09: Gap Closure — NESTED_COMBO_FORBIDDEN Test Summary

Added the 6th integration test to `ComboBuilderSheet.test.tsx` confirming that the `NESTED_COMBO_FORBIDDEN` RPC error surfaces as `toast.error('Nested combos are not allowed.')` in the rendered component context.

## What Was Built

Added one integration test to the existing `describe('ComboBuilderSheet', ...)` block. The test:
1. Overrides the default success mock with a `NESTED_COMBO_FORBIDDEN` error response for a single RPC call
2. Renders the sheet and selects a slot option to enable the "Add to Order" button
3. Clicks the button, triggering the mutation and the `onError` handler in `useAddComboToTab`
4. Asserts that `toast.error('Nested combos are not allowed.')` was called via the dynamic import of the mocked `sonner` module

## Verification

- `npx vitest run src/features/add-combo-to-tab/ComboBuilderSheet.test.tsx` — 6 tests pass
- `npm run typecheck` — exits 0
- Pre-commit lint-staged (ESLint + Prettier) — passed

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b314d3d | test(02-09): add NESTED_COMBO_FORBIDDEN integration test to ComboBuilderSheet |

## Self-Check: PASSED

- File exists: `bar-pos/src/features/add-combo-to-tab/ComboBuilderSheet.test.tsx` — confirmed (lint-staged processed it)
- Commit b314d3d exists: confirmed via `git rev-parse --short HEAD`
- 6 tests pass: confirmed via vitest output
- typecheck passes: confirmed
