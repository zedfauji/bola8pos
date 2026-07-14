---
phase: 34-visual-regression-baseline
reviewed: 2026-07-14T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - bar-pos/.gitignore
  - bar-pos/e2e/visual/45-visual-baseline.spec.ts
  - bar-pos/package.json
  - bar-pos/playwright.config.ts
  - bar-pos/playwright.visual.config.ts
  - bar-pos/src/shared/ui/LiveTimeDisplay.tsx
  - bar-pos/src/widgets/KdsBoard/index.tsx
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-07-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the new Playwright visual-regression suite (`playwright.visual.config.ts`, `e2e/visual/45-visual-baseline.spec.ts`), the isolation changes to the functional config (`playwright.config.ts`'s `testIgnore`), the `.gitignore`/`package.json` updates, and the two attribute-only `data-testid` additions to `LiveTimeDisplay.tsx` and `KdsBoard/index.tsx`.

Config isolation between the functional (`playwright.config.ts`) and visual (`playwright.visual.config.ts`) suites is correct: `testIgnore: /visual\//` on the functional config reliably excludes everything under `e2e/visual/`, the two configs use disjoint `outputDir`s, and `.gitignore` correctly excludes both the new `e2e-results-visual/` directory and the per-spec `*-snapshots/` directories that will hold the (deliberately untracked) baseline PNGs. The two `data-testid` additions are genuinely attribute-only — verified via `git diff` against the parent commit — and carry no styling or behavioral risk.

The one substantive problem is in the new spec itself: the masking scheme built around the new `live-time-display` test id is incomplete. `LiveTimeDisplay` is mounted in four page headers (`/kds`, `/kds-bar`, `/pool-tables`, `/rappi`), but the spec's mask logic only masks it on the two KDS routes. The `/pool-tables` idle-grid capture and the `/rappi` capture (for all three roles) will screenshot a real, ticking wall-clock string with no mask, which directly contradicts the suite's own documented goal (the `masksFor` doc comment states masking must produce a "two-run zero-diff gate" pass) and will produce non-deterministic diffs whenever a re-run crosses a minute boundary from the baseline run.

## Critical Issues

### CR-01: `live-time-display` mask is missing on `/pool-tables` and `/rappi`, defeating the suite's own zero-diff goal

**File:** `bar-pos/e2e/visual/45-visual-baseline.spec.ts:134-154` (mask table) and `:283-289` (pool-tables idle capture)

**Issue:** `LiveTimeDisplay` (a `setInterval`-driven wall clock, confirmed via `git diff` to be the exact component this phase added `data-testid="live-time-display"` to) is rendered in the page header of four routes, not two:

- `src/pages/kds/index.tsx` and `src/pages/kds-bar/index.tsx` — masked by `masksFor()` (`live-time-display` branch, line 142-144).
- `src/pages/pool-tables/index.tsx:8` — `<PageContainer ... actions={<LiveTimeDisplay />}>` — **not masked**. The idle-grid capture at line 283-289 hardcodes `mask: [toastMask(page)]` and never calls `masksFor()`, so the live clock is captured unmasked for admin, bartender, and manager.
- `src/pages/rappi/index.tsx:8` — same `<PageContainer ... actions={<LiveTimeDisplay />}>` pattern — **not masked**. `/rappi` is captured via `captureRoute()` → `masksFor(page, '/rappi')`, which falls through to the generic `return [toast];` branch (line 153), so the live clock is also unmasked here for all three roles' `*-rappi.png` baselines.

Since the baseline PNGs are (correctly) gitignored, this manifests as flaky, non-reproducible diffs: any re-run of the suite that lands in a different minute than the one that produced the checked-in baseline will show a pixel diff in the header region of `admin-pool-tables.png`, `bartender-pool-tables.png`, `manager-pool-tables.png`, `admin-rappi.png`, `bartender-rappi.png`, and `manager-rappi.png` — undermining the exact "two-run zero-diff gate" the file's own comments (lines 119-133) say this masking exists to satisfy. `retries: 0` in `playwright.visual.config.ts` means there's no retry safety net to paper over this.

**Fix:** Extend `masksFor()` to cover `/pool-tables` and `/rappi`, and route the idle-grid capture through the same helper instead of hardcoding its own mask array:

```typescript
function masksFor(page: Page, route: string): Locator[] {
  const toast = toastMask(page);
  const liveClock = page.getByTestId('live-time-display');
  if (route === '/pos') {
    return [toast, page.getByTestId('active-promotions-banner')];
  }
  if (route === '/pool-tables' || route === '/rappi') {
    return [toast, liveClock];
  }
  if (route.startsWith('/pool-tables/')) {
    return [toast, page.getByTestId('elapsed-minutes')];
  }
  if (route === '/kds' || route === '/kds-bar') {
    return [toast, page.getByTestId('kds-board'), liveClock];
  }
  ...
  return [toast];
}
```

And in the idle-grid test:

```typescript
await expect.soft(page).toHaveScreenshot(`${role}-pool-tables.png`, {
  fullPage: true,
  mask: masksFor(page, '/pool-tables'),
});
```

## Warnings

### WR-01: `waitForPageReady`'s stabilization poll can never converge on routes with continuously-changing text, silently burning the full 15s budget

**File:** `bar-pos/e2e/visual/45-visual-baseline.spec.ts:172-184`

**Issue:** `waitForPageReady` polls `document.body.innerText.trim().length` every 500ms up to 30 times, breaking only when the length is stable between two consecutive polls. This is a reasonable heuristic for "has the SPA finished rendering," but on routes with a per-second ticking widget (e.g. `HappyHourBanner`'s 1s `setInterval` on `/pos`, or `LiveTimeDisplay`'s minute-boundary tick), `innerText.length` can flip between two different values indefinitely if the ticking text's character count changes (e.g. `"9:59 AM"` (7 chars) → `"10:00 AM"` (8 chars) or a promo countdown's digit count changing) — the loop will never see two equal consecutive lengths and will always burn the full 15s (30 × 500ms) before falling through, rather than exiting early once the DOM has genuinely settled. This doesn't currently break correctness (the loop still terminates and proceeds), but it silently maximizes the per-route wait for `/pos`, and worse, it means the loop provides no actual signal that the masked live elements have "settled" before the screenshot's mask locators are captured — a length that stays two-different-values-oscillating instead of stabilizing is exactly the situation this heuristic was designed to detect and can't distinguish from "the page is still loading."

**Fix:** Not blocking, but consider comparing a masked/normalized text sample (e.g. strip digits) or capping/short-circuiting the wait when only a known-live testid's subtree differs, so the 15s ceiling isn't paid on every `/pos` capture.

### WR-02: `KdsBoard`'s `data-testid="kds-board"` mask blanks the entire board including non-live content, hiding real KDS regressions from the suite

**File:** `bar-pos/src/widgets/KdsBoard/index.tsx:238` / `bar-pos/e2e/visual/45-visual-baseline.spec.ts:143`

**Issue:** The mask for `/kds` and `/kds-bar` blacks out the entire `kds-board` container (line 143: `page.getByTestId('kds-board')`), not just the live-timer text inside each card (`formatAge()` in `KdsBoard/index.tsx:11-17`, which changes every minute). Since the whole board is masked, this visual-regression suite provides zero coverage of the actual KDS card layout, combo badges, routing badges, and status colors — the parts of the page most likely to regress — for both KDS routes. This is a scope/quality gap rather than a functional bug (the suite still won't flake on these routes), but it means "the KDS page is visually verified" is currently false for two of the phase's most complex screens.

**Fix:** Consider a narrower mask (e.g. add a `data-testid="kds-item-age"` to the `formatAge()` span and mask only that) so the rest of the board layout is actually regression-tested. Out of scope for a required fix in this phase, but worth tracking.

## Info

### IN-01: `suppressHydrationWarning` on a CSR-only (Vite, non-SSR) component is dead weight

**File:** `bar-pos/src/shared/ui/LiveTimeDisplay.tsx:39`

**Issue:** `suppressHydrationWarning` only has an effect when React hydrates server-rendered markup (`hydrateRoot`). This app is a Tauri/Vite SPA rendered client-side only (`createRoot`), so the prop is a no-op here. Pre-existing (not part of this phase's diff — confirmed via `git diff`), noted for awareness only, not a regression introduced by this phase.

**Fix:** No action needed for this phase; flagging for a future cleanup pass if `LiveTimeDisplay.tsx` is touched again.

### IN-02: `seedOccupiedTableDirect` selects `number` but never uses it

**File:** `bar-pos/e2e/visual/45-visual-baseline.spec.ts:34-39`

**Issue:** `.select('id, number')` fetches `number` from `pool_tables`, but only `tableRow.id` is read anywhere in the function. Harmless (test-only helper, no perf concern in scope), but is unused surface area copied from the source helper (`e2e/16-table-status.spec.ts`) that the file's own comment (lines 24-27) says was intentionally re-declared here.

**Fix:** `.select('id')` would be sufficient; not worth a follow-up on its own.

---

_Reviewed: 2026-07-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
