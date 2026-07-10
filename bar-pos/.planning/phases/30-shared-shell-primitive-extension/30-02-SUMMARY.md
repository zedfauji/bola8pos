# Plan 30-02 Summary

**Plan:** 30-02 — Migrate 7 existing-PageContainer pages off `BackToHomeButton`
**Status:** Complete
**Tasks:** 1/1

## What was built

Swapped the standalone `<BackToHomeButton />` for the new `backTo="/home"` prop on `PageContainer` (added in 30-01) across the 7 pages that already render `<PageContainer>`:

- `src/pages/kds/index.tsx`
- `src/pages/kds-bar/index.tsx`
- `src/pages/kitchen-prep/index.tsx`
- `src/pages/pool-tables/index.tsx`
- `src/pages/rappi/index.tsx`
- `src/pages/rbac/index.tsx`
- `src/pages/waitlist/index.tsx`

Each was a mechanical swap: drop the `BackToHomeButton` import + its JSX line, add `backTo="/home"` to the page's existing `<PageContainer>` call.

## Commits

- `822e6f8`: feat(30-02): swap BackToHomeButton for PageContainer backTo prop on 7 pages

## Verification

- `grep -rl "BackToHomeButton"` on the 7 files: zero matches
- `npm run typecheck`: only the 2 pre-existing unrelated errors (`tab/model/queries.ts`, `agent/rag.ts`)
- `npm run lint`: exit 0
- `npm run test`: 1212 passed / 1 pre-existing unrelated failure (`useCloseTab.test.ts:95`) / 15 todo

## Deviations

Worktree branch was stale at spawn time (predated Phase 30-01's `PageContainer`/`SectionHeader` changes) — fast-forward merged `main` into the worktree branch before editing; no conflicts (30-01 touched only `PageContainer.tsx`/`SectionHeader.tsx`/its own test file, disjoint from this plan's 7 page files). Local-only worktree environment fixes (node_modules junction, `.env.local` copy) — neither committed, both gitignored.

## Requirements

SHELL-01 (partial — 7 of 15 caller migrations)
