---
phase: 34-visual-regression-baseline
fixed_at: 2026-07-14T00:00:00Z
review_path: .planning/phases/34-visual-regression-baseline/34-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 1
skipped: 2
status: partial
---

# Phase 34: Code Review Fix Report

**Fixed at:** 2026-07-14T00:00:00Z
**Source review:** .planning/phases/34-visual-regression-baseline/34-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01, WR-01, WR-02 — `fix_scope: critical_warning`)
- Fixed: 1
- Skipped: 2

## Fixed Issues

### CR-01: `live-time-display` mask is missing on `/pool-tables` and `/rappi`, defeating the suite's own zero-diff goal

**Files modified:** `bar-pos/e2e/visual/45-visual-baseline.spec.ts`
**Commit:** `c68fce2`
**Applied fix:** Extended `masksFor()` with a shared `liveClock = page.getByTestId('live-time-display')` locator and a new `route === '/pool-tables' || route === '/rappi'` branch returning `[toast, liveClock]`, reusing the same `liveClock` reference in the existing `/kds`/`/kds-bar` branch. Updated the pool-tables idle-grid capture (`test('pool-tables idle grid — admin, bartender, manager — then seed shared fixtures', ...)`) to call `mask: masksFor(page, '/pool-tables')` instead of the hardcoded `mask: [toastMask(page)]`, so it now routes through the same shared helper rather than a parallel masking mechanism. `/rappi` is captured via the existing `captureRoute()` → `masksFor(page, route.path)` path, so no separate change was needed there beyond the new branch. Verified: re-read the modified sections (Tier 1) and ran `tsc --noEmit` scoped to the project's `tsconfig.json` from a worktree with the main repo's `node_modules` linked in (Tier 2) — zero errors reference `45-visual-baseline.spec.ts`.

## Skipped Issues

### WR-01: `waitForPageReady`'s stabilization poll can never converge on routes with continuously-changing text, silently burning the full 15s budget

**File:** `bar-pos/e2e/visual/45-visual-baseline.spec.ts:172-184`
**Reason:** The review's own Fix section explicitly labels this non-blocking ("Not blocking, but consider...") and offers an open-ended, exploratory direction (strip digits from the text sample, or short-circuit the wait for known-live testid subtrees) rather than a concrete patch. This doesn't change correctness — the loop still terminates and the suite still passes — only wait-time efficiency on `/pos`. Applying a guessed implementation here risked introducing a real bug (e.g. under-waiting and reintroducing the blank-frame flakiness the heuristic was built to prevent) for a finding the reviewer did not mark as required. Left for a deliberate follow-up rather than forced now.
**Original issue:** `document.body.innerText.trim().length` can oscillate indefinitely on routes with per-second ticking widgets (e.g. `HappyHourBanner` on `/pos`), so the stabilization loop always burns its full 15s budget on those routes instead of detecting genuine settle.

### WR-02: `KdsBoard`'s `data-testid="kds-board"` mask blanks the entire board including non-live content, hiding real KDS regressions from the suite

**File:** `bar-pos/src/widgets/KdsBoard/index.tsx:238` / `bar-pos/e2e/visual/45-visual-baseline.spec.ts:143`
**Reason:** The review's Fix section explicitly states "Out of scope for a required fix in this phase, but worth tracking." Applying it would require adding a new `data-testid="kds-item-age"` to `formatAge()`'s span in production component code (`KdsBoard/index.tsx`) and reworking the `/kds`/`/kds-bar` mask branch — a scope expansion the reviewer explicitly deferred, not a same-shape fix to the spec file already touched by CR-01. Left as-is per the reviewer's own scoping call.
**Original issue:** The `/kds` and `/kds-bar` masks black out the entire `kds-board` container rather than just the live-timer text, so the suite currently provides zero visual-regression coverage of KDS card layout, combo badges, routing badges, and status colors on those two routes.

---

## Post-fix baseline re-verification (orchestrator, same session)

The CR-01 code fix (`c68fce2`) only changes the spec's masking logic — it does not by itself
regenerate the already-seeded baseline PNGs. Re-running `npm run test:e2e:visual -- --update-snapshots`
after the fix landed did **not** actually rewrite the `admin/bartender/manager-pool-tables-*.png`
or `*-rappi-*.png` files, even across three separate re-seed attempts: Playwright's `--update-snapshots`
only rewrites a snapshot when the new capture differs from the existing baseline beyond its default
comparison tolerance, and the previously-unmasked clock text apparently fell inside that tolerance
across runs. The 6 affected PNGs (3× `pool-tables`, 3× `rappi`) were still the **original, unmasked**
captures from before the fix, silently defeating VISUAL-03 despite the source-code fix being correct
and committed.

**Also discovered and corrected in the same pass:** an interim manual re-seed attempt used `-g` to
scope `--update-snapshots` to a subset of the 5 tests. Because the spec uses `test.describe.serial`
with a shared, file-scoped `poolTableId` fixture seeded only by the first test
(`'pool-tables idle grid — ... then seed shared fixtures'`), running later tests in isolation via `-g`
skipped that seed step, causing `/pool-tables/:tableId` requests to fire with `tableId=undefined` and
a resulting Supabase 400 error rendered into the `admin-pool-table-status` baseline. **Lesson: this
suite's shared-state design requires the full spec file to run in order for `--update-snapshots`
re-seeds — partial `-g` filtering breaks the fixture chain and must not be used for baseline updates.**

**Resolution:** deleted the 6 stale `pool-tables`/`rappi` PNGs (forcing Playwright to always create them
fresh, since missing snapshots are unconditionally written), ran a full unfiltered
`--update-snapshots` pass, then re-ran the two-consecutive-run zero-diff gate
(`npm run test:e2e:visual` twice, no `-u`) — both passed clean. Visually confirmed
`admin-pool-tables-chromium-win32.png` now shows a masked (magenta) clock box instead of live text,
and `admin-pool-table-status-chromium-win32.png` shows the correct active-session detail view rather
than the earlier Supabase-error state.

No new commit was needed — the source fix (`c68fce2`) was already correct and committed; only the
local, gitignored baseline artifacts (per D-12) required regeneration.

---

_Fixed: 2026-07-14T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
_Post-fix baseline re-verification: Claude (orchestrator), same session_
