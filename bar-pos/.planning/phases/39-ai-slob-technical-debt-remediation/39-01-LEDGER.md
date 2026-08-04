# Phase 39 Plan 01 — Track B Baseline Ledger

**Generated:** 2026-08-04 (Wave 0 re-run, same repo state as 39-RESEARCH.md's 2026-08-03 snapshot — no drift detected)

## Baseline Regeneration

- `.audit-tmp/knip-report.json` regenerated via `npx knip --reporter json` — mtime advanced from `1785859487` to `1785859524`, no stderr output (config errors from the initial pre-`npm ci` run are gone now that `node_modules` is installed).
- `.audit-tmp/knip-production.json` regenerated via `npx knip --production --reporter json` — mtime `1785859529`, clean.
- Method: exact `(file, line, name)` set-union over `exports`/`types`, `file`-set union over `files`, and a `(file, json(duplicate))` union over `duplicates`, excluding any `src/shared/ui/` path (D-08), per 39-RESEARCH.md's Code Examples > "Diffing distinct dead-code count after a deletion wave". `dependencies`/`devDependencies` categories are read separately (`unlisted` only, per D-01/D-09) and are not folded into the four baseline categories below.

## Distinct High-Tier Baseline (excludes `src/shared/ui/**`, excludes deps/devDeps categories)

| Category | Default-mode | Production-mode | Union (distinct) | 39-RESEARCH.md figure | Verdict |
|---|---|---|---|---|---|
| Unused files | 42 | 61 | **61** | 61 | ✅ MATCH |
| Unused exports | 420 | 587 | **613** | 613 | ✅ MATCH |
| Unused types | 236 | 303 | **305** | 305 | ✅ MATCH |
| Duplicate-export pairs | 3 | 3 | **3** | 3 | ✅ MATCH |
| **Sum (distinct)** | — | — | **982** | 982 | ✅ MATCH |
| Distinct files touched (files+exports+types) | — | — | **198** | 198 | ✅ MATCH |

**Verdict:** No drift since the 2026-08-03 research snapshot — every number matches 39-RESEARCH.md's verified figures exactly. No commits landed between the Phase 10 audit and this Wave 0 re-run that shifted the dead-code surface.

## Blocking-Tier `unlisted` Findings (pre-fix)

| Mode | Count |
|---|---|
| Default-mode | 34 |
| Production-mode | 0 |

**Pre-fix `unlisted` total: 34** — matches 39-RESEARCH.md's expected 34 (`@testing-library/user-event` across 34 `*.test.tsx` files).

## Environment Note (not a baseline drift, but material to reproducing this ledger)

This worktree was spawned without `node_modules` present (git worktrees do not carry over gitignored/untracked directories from the main checkout). The first `npx knip` invocation failed to load `playwright.config.ts` / `vite.config.ts` / `vitest.config.ts` (`Cannot find module '@playwright/test'` etc.) because dependencies were not yet installed. Ran `npm ci` (1365 packages, clean install, husky `prepare` script no-ops per CLAUDE.md's documented "git hooks are inert" note) before regenerating the baseline. This is Rule 3 (blocking-issue auto-fix, standard `npm ci` — not a new/foreign package) — no deviation entry needed since it's pure environment setup with zero code impact, but recorded here for anyone reproducing this ledger in a fresh worktree.

A second environment gap surfaced at Task 2's `npm run test` verification step: the worktree also lacked `.env.local` (gitignored via `*.local`, so it does not carry over to a fresh worktree either), and `src/test/global-setup.ts` requires `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to reach the project's real cloud Supabase instance before any unit test can run at all. Copied the existing `.env.local` from the sibling main checkout (`/mnt/ai/bola8pos-kiro/bar-pos/.env.local`) — same machine, same user, same project's own dev credentials, not a new/external secret — into this worktree so `npm run test` could execute. Also Rule 3 (missing env var is an explicit Rule 3 example); the file stays gitignored and was never staged/committed.

## Task 2 Resolution — `@testing-library/user-event` (34 findings)

- `npm install --save-dev @testing-library/user-event@14.6.1` (installed at the exact already-resolved version so npm's default save-prefix behavior wrote `^14.6.1`, not the newer `^14.6.3` it would have written from a `^14.6.1` range request — the plan's zero-behavior-delta requirement).
- `package.json` `devDependencies["@testing-library/user-event"]` = `^14.6.1`; `npm ls @testing-library/user-event --all` confirms `14.6.1` resolved both directly and via `storybook` (deduped) — single resolved version, no dual-version risk.
- `npm run test`: **1391 passed, 15 todo** (153 test files, 151 passed + 2 skipped) — exact match to the pre-existing 1391-passing baseline, zero regression.
- Post-fix `npx knip --reporter json` `unlisted` count: **0** (down from 34 default-mode / 0 production-mode pre-fix).
- All 34 `unlisted` findings: **RESOLVED — declared directly**.

## Disposition Log

| Finding | Category | Disposition | Task | Notes |
|---|---|---|---|---|
| `@testing-library/user-event` unlisted, 34 findings across 34 `*.test.tsx` files | Blocking / unlisted | **RESOLVED — declared directly** | 2 | `^14.6.1` devDependency added; `npx knip` unlisted count now 0; `npm run test` unchanged at 1391 passing |
| `scripts/audit-ui-drift.ts` | High / unused file (both modes) | *pending — Task 3* | 3 | — |
