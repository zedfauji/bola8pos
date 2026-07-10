# Plan 30-04 Summary

**Plan:** 30-04 — Special-case page migration (`pos`/`payments` full-bleed + `pool-table-status` non-default `backTo`)
**Status:** Complete
**Tasks:** 2/2

## What was built

- Task 1: `src/pages/pos/index.tsx`, `src/pages/payments/index.tsx` — full-height horizontal split-view layouts migrated onto `PageContainer` with a `className` override neutralizing the default `max-w-[1400px]/p-6/space-y-6`, keeping the edge-to-edge layout while gaining the shared back-nav header.
- Task 2: `src/pages/pool-table-status/index.tsx` — adopts `PageContainer` with `backTo="/pool-tables"` and `backLabel="Pool Tables"` (deliberately NOT the generic `/home` default — this page's back target is the pool table grid).

## Commits

- `18369d4`: feat(30-04): migrate pos and payments to PageContainer with backTo
- `ebc896d`: feat(30-04): pool-table-status adopts backTo=/pool-tables via PageContainer

## Verification

- `PaymentsPage.test.tsx` — 2/2 pass
- `npm run typecheck`: only the 2 pre-existing unrelated errors
- `npm run lint`: exit 0
- `grep -rn "BackToHomeButton"` across all 3 files: zero matches
- `pool-table-status` confirmed using `backTo="/pool-tables" backLabel="Pool Tables"` (not `/home`)

## Deviations

Worktree branch was stale at the phase-19/20 commit, predating `main`'s 30-01 commits — fixed via `git merge main` (clean fast-forward, no conflicts, none of this plan's 3 files touched by intervening commits). Local-only worktree environment fixes (node_modules junction, `.env.local` copy) — neither committed.

## Requirements

SHELL-01 (partial — 3 of 15 caller migrations; completes all 15 across 30-02/03/04)
