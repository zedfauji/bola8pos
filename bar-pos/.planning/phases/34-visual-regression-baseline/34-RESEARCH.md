# Phase 34: Visual Regression Baseline - Research

**Researched:** 2026-07-14
**Domain:** Playwright visual regression (`toHaveScreenshot`), config isolation, dynamic-region masking
**Confidence:** HIGH (all findings verified by direct repo inspection; Playwright API facts cross-checked against playwright.dev)

## Summary

This phase adds zero new dependencies — `@playwright/test@^1.59.1` (already installed) ships `toHaveScreenshot()` natively. The real work is (1) a second, fully isolated Playwright config, (2) a masking strategy for every genuinely dynamic region the codebase contains, and (3) getting route/role sequencing right so the 17-route + role-subset capture actually produces deterministic baselines.

The single highest-risk finding in this research is **test-file collision**: `playwright.config.ts` has no `testMatch`/`testIgnore`, so its default recursive glob under `testDir: './e2e'` will *also* pick up `e2e/visual/45-visual-baseline.spec.ts` unless the functional config is explicitly told to ignore the `visual/` subfolder. Without this fix, `npm run test:e2e` will try to run the visual spec headed with `slowMo:400` and `channel:'chrome'` — wrong environment, and it will attempt to diff against a baseline never seeded under those settings. This is a concrete, required task, not an edge case.

The second major finding is a **codebase-wide dynamic-region inventory** that goes beyond what CONTEXT.md's decisions literally named: `/pool-tables` (the grid, not just the detail page) renders a live elapsed-minutes counter *and* a live-charge SVG overlay on any occupied table card; `/pos` renders an `active-promotions-banner` (happy-hour countdown) and a wall-clock-driven promo-availability recompute; `/staff` renders live shift-duration text for clocked-in staff; both KDS pages render a `LiveTimeDisplay` clock in the page header *in addition to* the KDS board itself, and each KDS card shows a relative "age" label (`"2 min"`, `"just now"`) that has no stable selector. Each of these needs either masking or a seed-state choice that avoids triggering them.

Third, CONTEXT.md's D-05 example route list for the bartender role is **wrong for `/waitlist`**: `rbac.ts` shows `manage_waitlist` lives only in `MANAGER_EXTRA`, not `BARTENDER_ACTIONS` — a bartender hitting `/waitlist` is redirected to `/home` by `WaitlistRoute`, not shown the waitlist page. The research below gives the corrected, code-verified route × role access matrix.

**Primary recommendation:** Build `playwright.visual.config.ts` as a from-scratch `defineConfig()` (do not import/spread the functional config — the two diverge on nearly every `use` field), scope its own `testDir: './e2e/visual'`, add `testIgnore: /visual\//` to the functional `playwright.config.ts`, set `expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01 } }` globally, and mask every dynamic region found below via `data-testid` locators (adding 2-3 new `data-testid`s where none exist).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Visual-regression test execution & config | Test tooling (Playwright, outside `src/`) | — | Config lives at repo root, specs in `e2e/visual/`; no FSD layer applies — this is infrastructure, not app code |
| Screenshot capture / diffing | Browser (Chromium, bundled) | Test tooling | `toHaveScreenshot()` runs in the Node test process but drives the actual rendered DOM in a real browser tab |
| Dynamic-region masking selectors | Frontend/Client (`src/shared/ui`, `src/entities/*/ui`, `src/widgets/*`) | Test tooling | Masking targets are existing/new `data-testid` attributes on React components; the mask *locators* are defined in the spec, but the selectors they target are owned by component code |
| Role-gated route behavior being captured | Frontend Server-side routing (`src/app/*-route.tsx`, React Router client-side) | API/Backend (RBAC source of truth in `profiles.role`) | All redirect logic (`<Navigate to="/home" replace />`) is client-side; the underlying permission truth (`rbac.ts` `ROLE_SET`) is a static client-bundled table, not a server call |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | `1.59.1` (installed, `npm view` not needed — confirmed in `package.json` devDependencies) [VERIFIED: package.json] | `toHaveScreenshot()` visual assertions, second `defineConfig()` | Already the project's E2E framework; native visual regression, zero new dependency surface |

No new packages this phase. **Package Legitimacy Audit: N/A — no external packages are installed in this phase.**

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright's built-in `toHaveScreenshot()` | Chromatic / Percy / Applitools | Rejected in `research/SUMMARY.md` and `REQUIREMENTS.md`'s Out of Scope — "no new design-system tooling"; `@chromatic-com/storybook` is an unused existing devDependency, explicitly staying unused |

**Installation:** None required.

## Architecture Patterns

### System Architecture Diagram

```
npm run test:e2e:visual
        │
        ▼
playwright.visual.config.ts  (testDir: e2e/visual, headless, bundled chromium)
        │
        ▼
webServer: reuse localhost:1420 (npm run dev, already running or auto-spawned)
        │
        ▼
e2e/visual/45-visual-baseline.spec.ts
        │
        ├─► loginAs(page, 'admin')  ──► for-each of 17 routes:
        │        page.goto(route) → wait fonts/network idle → mask dynamic locators → toHaveScreenshot()
        │
        ├─► loginAs(page, 'bartender') ──► for-each of bartender's accessible route subset
        │
        ├─► loginAs(page, 'manager')    ──► for-each of manager's accessible route subset
        │
        └─► role-denied routes (bartender→/rbac, bartender→/audit, etc.)
                 page.goto(deniedRoute) → client redirects to /home → screenshot lands on /home
                 (+ toast overlay, /audit only) → mask toast region → toHaveScreenshot()
        │
        ▼
e2e/visual/45-visual-baseline.spec.ts-snapshots/*.png   (gitignored, local-only baseline)
```

### Recommended Project Structure
```
bar-pos/
├── playwright.config.ts            # functional E2E — ADD testIgnore for visual/
├── playwright.visual.config.ts     # NEW — isolated visual config
├── e2e/
│   ├── *.spec.ts                   # existing 44 functional specs (untouched)
│   ├── helpers/                    # reused as-is (auth.ts, supabase.ts)
│   └── visual/
│       ├── 45-visual-baseline.spec.ts
│       └── 45-visual-baseline.spec.ts-snapshots/   # gitignored, created by --update-snapshots
```

### Pattern 1: Config isolation via `testIgnore` (not just a separate `testDir`)
**What:** A second `defineConfig()` file that does not import from the first. The critical detail is that Playwright's default `testMatch` is a recursive glob (`**/*.@(spec|test).?(c|m)[jt]s?(x)`) applied under `testDir`. Because the functional config's `testDir` is `'./e2e'` (the parent of `e2e/visual/`), it will match the new spec unless told not to.
**When to use:** Any time a subfolder-scoped second config is added under an existing config's `testDir`.
**Example:**
```typescript
// playwright.config.ts (functional) — ADD this line inside defineConfig({...})
testIgnore: /visual\//,

// playwright.visual.config.ts (new file)
import { defineConfig } from '@playwright/test';
// ... same dotenv-loading boilerplate as playwright.config.ts ...
export default defineConfig({
  testDir: './e2e/visual',
  outputDir: './e2e-results-visual',
  fullyParallel: true,           // navigation+screenshot only, no shared mutable state — discretion
  workers: undefined,            // default parallel workers (discretion; functional uses workers:1 because of shared DB state, visual specs are more independent)
  retries: 0,                    // a visual diff failure should NOT auto-retry and silently pass on attempt 2
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
      // no globalTeardown — that script is functional-suite-specific (writes VERIFICATION_REPORT.md
      // keyed to SUITE_MAP regexes like /^05-payments/, which will never match e2e/visual/*)
    },
  },
  reporter: [['list']],           // manual/local only — no blob/CI reporter needed (D-02)
  use: {
    baseURL: 'http://localhost:1420',
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'off',
    video: 'off',
    screenshot: 'off',            // toHaveScreenshot is the mechanism, not the on-failure screenshot option
  },
  projects: [{ name: 'chromium', use: {} }],   // NO channel:'chrome' — bundled Chromium only (D-01)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```
[ASSUMED: exact field values (workers, retries) are a reasonable default, not verified against an official "visual config" example — flag for planner discretion]

### Pattern 2: Masking dynamic regions
**What:** `toHaveScreenshot({ mask: [locator1, locator2, ...] })` paints a solid box (default `#FF00FF`, override via `maskColor`) over each locator's bounding box before the pixel diff runs. [CITED: playwright.dev via search — mask targets "timestamps, avatars, or any volatile content"]
**When to use:** Every route below that has a live-updating region.
**Example:**
```typescript
await expect(page).toHaveScreenshot('pool-table-status-occupied.png', {
  fullPage: true,
  mask: [
    page.getByTestId('elapsed-minutes'),               // confirmed existing testid
    page.locator('[data-sonner-toaster]'),              // toast container, defensive (D-10)
  ],
});
```

### Pattern 3: Route × role access matrix (code-verified, corrects CONTEXT.md D-05's example)
**What:** `src/app/router.tsx` route gates cross-referenced against `src/shared/lib/rbac.ts` `ROLE_SET`.

| Route | Router-level gate | Bartender | Manager | Admin |
|-------|-------------------|-----------|---------|-------|
| `/login` | none (public) | ✓ (only unauthenticated — see Pitfall 7) | ✓ | ✓ |
| `/home` | `ProtectedRoute` only | ✓ | ✓ | ✓ |
| `/pos` | `ProtectedRoute` only | ✓ | ✓ | ✓ |
| `/pool-tables` | `ProtectedRoute` only | ✓ | ✓ | ✓ |
| `/pool-tables/:tableId` | `ProtectedRoute` only | ✓ | ✓ | ✓ |
| `/inventory` | `ProtectedRoute` only (no router-level RBAC gate — `adjust_inventory` only gates the physical-count feature *inside* the page) | ✓ (URL-navigable, degraded UI) | ✓ | ✓ |
| `/staff` | `ProtectedRoute` only (no router-level RBAC gate found) | ✓ (URL-navigable) | ✓ | ✓ |
| `/settings` | `ProtectedRoute` only (no router-level or page-level RBAC gate found in `pages/settings/index.tsx`) | ✓ (URL-navigable — CLAUDE.md's "admin only" note is aspirational/enforced elsewhere or not at all) | ✓ | ✓ |
| `/rappi` | `ProtectedRoute` only | ✓ | ✓ | ✓ |
| `/payments` | `ProtectedRoute` only | ✓ | ✓ | ✓ |
| `/kitchen-prep` | `ProtectedRoute` only (no router gate; `produce_prep_batch` gates the batch-production feature inside) | ✓ (URL-navigable, degraded UI — bartender lacks `produce_prep_batch`) | ✓ | ✓ |
| `/kds-bar` | `KdsBarRoute` → `view_kds_bar` | ✓ | ✓ | ✓ |
| `/reports` | `ReportsRoute` → `view_reports` | ✗ → redirect `/home` | ✓ | ✓ |
| `/waitlist` | `WaitlistRoute` → `manage_waitlist` | **✗ → redirect `/home`** (CONTEXT.md D-05 lists this in bartender's subset — that is incorrect per `rbac.ts`) | ✓ | ✓ |
| `/audit` | `AuditRoute` → `view_audit_log` (+ `toast.error(...)` on denial) | ✗ → redirect `/home` + toast | ✓ | ✓ |
| `/kds` | `KdsRoute` → `view_kds` | ✗ → redirect `/home` | **✗ → redirect `/home`** (manager also lacks `view_kds` — only `kitchen` role and `admin` have it) | ✓ |
| `/rbac` | `RbacRoute` → `manage_staff` | ✗ → redirect `/home` | ✗ → redirect `/home` | ✓ |

**Bartender's real "normally accessible" subset (router-gate-true):** `/home`, `/pos`, `/pool-tables`, `/pool-tables/:tableId`, `/payments`, `/rappi`, `/kds-bar`, `/inventory`, `/staff`, `/settings`, `/kitchen-prep` — 11 routes, NOT the 6 CONTEXT.md's example lists (and swap `/waitlist` for `/kds-bar` was already right, but `/waitlist` itself must be dropped).
**Manager's real subset:** everything bartender has, PLUS `/reports`, `/waitlist`, `/audit` — but NOT `/kds` and NOT `/rbac`.
**Denied-route captures (D-07) that are actually distinguishable from `/home` at all:** only `/audit` (shows a `sonner` toast momentarily over `/home`). All other denied routes (`/kds` for bartender+manager, `/rbac` for bartender+manager, `/reports`/`/waitlist` for bartender) redirect via a client-side `<Navigate>` effect that fires before Playwright's assertion timeout — the resulting screenshot is pixel-identical to a direct `/home` visit. See Pitfall 6 below; flag as an **Open Question** for the planner: capturing these as *separate* named baselines may just be redundant duplicates of the `/home` baseline (harmless, but low signal) unless the toast (audit only) or URL-assertion (not screenshot) is the actual differentiator wanted.

### Anti-Patterns to Avoid
- **Importing/spreading `playwright.config.ts`'s `use` block into the visual config:** they diverge on `headless`, `slowMo`, `channel`, `video`, `screenshot`, `trace` — every field D-01 requires to differ. A shared base risks one config's field silently leaking into the other on a future edit.
- **Seeding an active pool session before visiting `/pool-tables` (the grid):** any occupied `PoolTableCard` on the grid renders a live "N min" elapsed counter *and* an SVG timer/charge overlay with no stable selector (see Pitfall 2). Capture `/pool-tables` (idle grid) **before** starting the session used for `/pool-tables/:tableId`'s occupied-state shot (D-09) — this sidesteps needing to mask the grid entirely.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Freezing CSS transitions/animations before a screenshot | Manual `page.addStyleTag({content: '* {transition: none !important}'})` | `toHaveScreenshot`'s built-in `animations: 'disabled'` (settable globally in `expect.toHaveScreenshot`) | Already handles CSS transitions, CSS animations, and infinite `web-animations`; hand-rolled CSS injection misses the animation-frame-snap edge cases Playwright's version covers |
| Diffing dynamic regions | Cropping screenshots to exclude a region, or hiding elements with `display:none` before capture | `mask` option (paints a solid box, keeps layout intact) | CONTEXT.md D-08 already locked this — masking preserves layout-shift detection (a region resizing is still caught) where `display:none`/exclusion would not |

**Key insight:** Every "dynamic region" pitfall in this codebase is a `setInterval`-driven re-render (timer digits, relative-age labels, wall-clock displays) — there is no WebSocket/Supabase-Realtime push expected to fire during a navigate-only capture with no seeded live orders, so the realtime bridges themselves (`useKdsRealtimeBridge`) are not a masking concern unless a background writer mutates data mid-suite.

## Common Pitfalls

### Pitfall 1: Test-file collision between the two configs (see Pattern 1)
**What goes wrong:** `npm run test:e2e` silently starts running `e2e/visual/45-visual-baseline.spec.ts` too, headed, with `slowMo`, against a screenshot baseline it never seeded.
**How to avoid:** Add `testIgnore: /visual\//` to `playwright.config.ts` in the same commit that adds `e2e/visual/`.
**Warning signs:** `npm run test:e2e` run count increases by however many `test()` blocks the visual spec has; a Chromium window pops up mid-functional-suite running through role logins with no `slowMo` pacing on screenshot-only assertions.

### Pitfall 2: Live elapsed-time/SVG overlay on the `/pool-tables` grid itself, not just the detail page
**What goes wrong:** `PoolTableCard.tsx` (`src/entities/pool-table/ui/PoolTableCard.tsx:124`) renders `{Math.floor(timer.elapsedMinutes)} min` with no `data-testid`, and `PoolTableIllustration.tsx` renders a `font-mono` SVG timer+charge overlay (`formatSeconds(timer.totalSeconds)`) — also no `data-testid` — for any table with `status === 'occupied'`. Both are visible on `/pool-tables` (the grid), not only `/pool-tables/:tableId`.
**Why it happens:** CONTEXT.md D-09 only calls out masking the timer on the *detail* page; the grid page wasn't in scope of that decision.
**How to avoid:** Capture `/pool-tables` before seeding any occupied session (see Anti-Pattern above) — keep the grid baseline idle-state only. If the spec instead wants the grid's occupied-card visual state as its own baseline, add `data-testid="pool-table-elapsed"` to the minutes span and `data-testid="pool-table-timer-overlay"` to the SVG timer group, and mask both.
**Warning signs:** Two consecutive local runs of a `/pool-tables` baseline captured *after* a session was started differ only in that small text/overlay region.

### Pitfall 3: KDS board has no wrapping `data-testid`; per-card relative-age text has none either
**What goes wrong:** `KdsBoard` (`src/widgets/KdsBoard/index.tsx`) renders individual cards with `data-testid="kds-card"` / `data-testid="kds-combo-card"`, but there is no single container testid to mask "the whole board" in one locator per D-08's "mask the live board content region" language. Each card also renders `formatAge(item.createdAt)` (`"2 min"`, `"just now"`) via a bare `<span className="shrink-0 text-xs opacity-60">` with no selector, and this text drifts with wall-clock time between the baseline run and a later diff run even with zero realtime pushes.
**How to avoid:** Two options, in order of laziness:
  1. **Simplest — capture with an empty KDS queue.** Both KDS pages render a fully static `"No active {kitchen|bar} orders"` empty state when there are no pending/in-progress items (`KdsBoard`, lines ~206-212). If the dev-seed data leaves no open kitchen/bar orders at capture time, there is nothing to mask at all. Verify this against actual seed state before deciding to mask.
  2. **If items must be shown:** add `data-testid="kds-board"` to `KdsBoard`'s root `<div className="grid gap-6 p-6...">` and mask the entire region as one box (accepts losing pixel-diff coverage on the whole board, matches D-08's "region" framing, not per-item).
**Warning signs:** A snapshot fails to reproduce only in small text areas inside KDS cards, with the rest of the board pixel-identical.

### Pitfall 4: `LiveTimeDisplay` renders in BOTH KDS page headers, has no `data-testid`
**What goes wrong:** `KdsPage` and `KdsBarPage` both pass `actions={<LiveTimeDisplay />}` to `PageContainer` — a `setInterval`-driven wall-clock (`"3:42 PM"` style) that updates every 60s, rendered as a bare `<span className="text-muted-foreground text-sm tabular-nums">`.
**How to avoid:** Add `data-testid="live-time-display"` to the component (it's reused, one edit covers both routes) and mask it on `/kds` and `/kds-bar`.
**Warning signs:** Both KDS baselines fail to reproduce in the exact same small header region, at exactly the header's top-right corner.

### Pitfall 5: `active-promotions-banner` on `/pos` (happy-hour countdown) has a `data-testid`, but is easy to miss
**What goes wrong:** `HappyHourBanner.tsx` (rendered inside `OrderPanel/ProductGrid.tsx`) is a `setInterval`-driven countdown with `data-testid="active-promotions-banner"` (confirmed) — a genuinely dynamic, ticking region that will differ between the baseline run and any later diff run if a promotion is active at capture time.
**How to avoid:** `mask: [page.getByTestId('active-promotions-banner')]` on `/pos`. This selector already exists — no code change needed.
**Warning signs:** `/pos` baseline diffs only in a banner-shaped region, timing-dependent (only fails when a promo happens to be active).

### Pitfall 6: Role-denied routes redirect via a client-side `useEffect` before the screenshot fires — most produce a baseline identical to `/home`
**What goes wrong:** `<Navigate to="/home" replace />` triggers navigation inside React Router's own `useEffect`, which fires well before Playwright's `expect().toHaveScreenshot()` default timeout. For every denied route except `/audit`, the resulting capture is visually indistinguishable from a direct `/home` visit — there is no inline "Access Denied" UI anywhere in this codebase (see Pattern 3 table).
**How to avoid:** Either (a) don't screenshot denied routes as pixel baselines at all — assert the redirect via `expect(page).toHaveURL(/\/home$/)` (a URL check, not a screenshot) to satisfy D-07's intent without adding a redundant duplicate `.png`; or (b) if a distinct baseline file is still wanted per-role-per-denied-route for explicit UAT tracking, accept that they'll dedupe visually against the `/home` baseline (except `/audit`, which shows a `sonner` toast). This is a genuine open decision — flagged below.
**Warning signs:** N denied-route `.png` files that are byte-identical (or near-identical) to the `/home` baseline.

### Pitfall 7: `/login` redirects away when the current session is authenticated
**What goes wrong:** `LoginPage` does `if (isAuthenticated) return <Navigate to="/home" replace />;`. Since D-04 wants admin to snapshot all 17 routes including `/login`, navigating to `/login` while already logged in as admin produces an `/home` screenshot, not the login screen.
**How to avoid:** Capture `/login` either (a) as the very first navigation in a fresh, unauthenticated browser context before any `loginAs()` call, or (b) call the existing `logout(page)` helper from `e2e/helpers/auth.ts` immediately before navigating to `/login`, then log back in for the rest of the suite.
**Warning signs:** `/login` baseline is identical to `/home`.

### Pitfall 8: Webfont load timing (`@fontsource-variable/geist`)
**What goes wrong:** The app self-hosts a variable font (`@fontsource-variable/geist`, confirmed in `package.json` dependencies). If a screenshot fires before the webfont finishes loading, text renders in a fallback system font for that capture only, causing a spurious diff on re-run once the font is cached.
**How to avoid:** `await page.evaluate(() => document.fonts.ready);` before each `toHaveScreenshot()` call, or once per test after `page.goto()`. Font is self-hosted (no external network fetch), so this resolves fast and deterministically once cached by Chromium's disk cache across runs on the same machine — but the very first run per machine may still need this explicit wait.
**Warning signs:** Only the *first* local baseline run on a fresh machine/profile ever mismatches on text-heavy routes; subsequent runs are stable.

## Code Examples

### Reused seeded-table-id lookup (do NOT depend on `npm run setup:dev` for this — see Environment Availability)
```typescript
// Pattern from e2e/16-table-status.spec.ts (`seedOccupiedTableDirect` / `getOccupiedPoolTableIds`)
// Source: e2e/helpers/supabase.ts, e2e/16-table-status.spec.ts
import { getServiceClient } from '../helpers/supabase';

const admin = getServiceClient();
const { data: tables } = await admin
  .from('pool_tables')
  .select('id, number')
  .eq('status', 'available')
  .limit(1)
  .single();
// then start a session directly (service-role insert) or via UI, same as seedOccupiedTableDirect()
```

### Masking + fullPage + animation-disable together
```typescript
import { loginAs } from '../helpers/auth';
import { test, expect } from '../fixtures';

test('admin — /pool-tables/:tableId occupied state', async ({ page }) => {
  await loginAs(page, 'admin');
  // ... seed + start an active session (D-09), navigate to detail page ...
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('admin-pool-table-status-occupied.png', {
    fullPage: true,
    mask: [
      page.getByTestId('elapsed-minutes'),
      page.locator('[data-sonner-toaster]'),
    ],
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A | N/A | — | No prior visual-regression suite existed in this repo; this is greenfield for this project |

**Deprecated/outdated:** None applicable.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `workers`/`retries`/`fullyParallel` values suggested for `playwright.visual.config.ts` are reasonable defaults, not drawn from an official Playwright "second visual project" recipe | Pattern 1 | Low — these are tunable without touching the masking/isolation logic; wrong values just mean slower or flakier local runs, not incorrect baselines |
| A2 | Default `threshold` (0.2) is left unset/inherited rather than explicitly tuned for this POS's icon-font-heavy UI | Standard Stack / Pattern 1 | Low-Medium — if lucide-react SVG icons or the Geist variable font render with any sub-pixel AA variance across runs on the same machine (rare, since it's the same GPU/OS/browser build every time), a 0.2 threshold + 0.01 maxDiffPixelRatio should absorb it; if not, tighten per-route |
| A3 | Bartender/manager "normally accessible" route subset for D-05 baselining should track the router-gate-true matrix in Pattern 3, not CONTEXT.md's illustrative (and partly incorrect) example list | Pattern 3 | Medium — if the planner copies CONTEXT.md's example verbatim instead of the corrected matrix, the bartender suite will attempt to screenshot `/waitlist` and get redirected to `/home` unexpectedly, silently producing a duplicate `/home` baseline under a `/waitlist`-labeled filename |

## Open Questions

1. **Should denied-route (403/redirect) captures be pixel baselines at all, given most are visually identical to `/home`?**
   - What we know: Only `/audit`'s denial path shows any visible difference (a `sonner` toast) from a direct `/home` visit; all others (`/kds`, `/rbac`, `/reports`, `/waitlist` for the roles that lack them) redirect before paint with nothing left to diff.
   - What's unclear: Whether D-07's intent was "prove the redirect happens" (better served by a URL assertion) or "have a literal screenshot artifact per denied route for audit trail" (redundant but explicit).
   - Recommendation: Planner should decide during phase planning — either drop non-`/audit` denied-route screenshots in favor of URL assertions (fewer, more meaningful baselines) or keep them as intentionally-duplicate baselines (accept the redundancy, it's cheap).

2. **Does the KDS queue have seeded pending/in-progress items at capture time, or is it empty?**
   - What we know: `npm run setup:dev`'s underlying scripts (`scripts/setup-dev-users.ts`, `scripts/seed-dev-data.ts`) referenced in `package.json` **do not exist in this repo** (verified via `ls scripts/` — only `seed-combos.ts`, `seed-ingredients.ts`, `seed-prep.ts`, `seed-recipes.ts`, `seed-reports.ts`, `audit-ui-drift.ts`, `indexCodebase.ts`, plus two `.mjs` scripts are present). `npm run setup:dev` as currently wired will fail with a module-not-found error.
   - What's unclear: Whether this is a pre-existing, already-known gap (out of scope for this phase) or something the planner needs a workaround for regarding KDS/product seed data.
   - Recommendation: Flag to the planner as an **Environment Availability blocker unrelated to this phase's own scope** — do not silently assume `npm run setup:dev` works. The visual suite should seed via direct service-role Supabase calls (`getServiceClient()`, same pattern `e2e/16-table-status.spec.ts` already uses) rather than depending on the broken `setup:dev` script chain, consistent with how the *existing* functional E2E specs already seed their own state per-test.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@playwright/test` | Visual config + spec execution | ✓ | `1.59.1` [VERIFIED: package.json] | — |
| Bundled Chromium (Playwright-managed) | Headless capture (D-01) | Assumed ✓ (already required by the existing functional suite's `projects: [{ channel: 'chrome' }]`, which needs Playwright's browser install step too) | matches `@playwright/test@1.59.1`'s bundled build | `npx playwright install chromium` if missing |
| `.env.local` with `VITE_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `E2E_*_PIN` vars | `loginAs()`, service-role seeding | Not verified this session (file not read — treat as a precondition, same as the functional suite already requires per CLAUDE.md) | — | Suite cannot run without it; same precondition the functional E2E suite already documents |
| `npm run dev` (Vite dev server on :1420) | `webServer.reuseExistingServer: true` in both configs | Runtime precondition, not statically checkable | — | Both configs auto-spawn via `webServer.command` if not already running |
| `npm run setup:dev` (`setup:dev-users` + `seed:dev` scripts) | Seed data referenced by CONTEXT.md's integration-points note | **✗ — underlying script files do not exist** (`scripts/setup-dev-users.ts`, `scripts/seed-dev-data.ts` are absent from `scripts/`) | — | Use direct service-role seeding via `e2e/helpers/supabase.ts` (`getServiceClient()`), the pattern the existing functional specs already use instead of this script |

**Missing dependencies with no fallback:** None — the one missing item (`setup:dev`) has a documented, already-in-use fallback pattern.
**Missing dependencies with fallback:** `npm run setup:dev` → use `e2e/helpers/supabase.ts` direct seeding instead (see Open Question 2).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright `@playwright/test` v1.59.1, second config file |
| Config file | `playwright.visual.config.ts` (new) |
| Quick run command | `npx playwright test --config=playwright.visual.config.ts e2e/visual/45-visual-baseline.spec.ts` (single spec, once baseline exists) |
| Full suite command | `npm run test:e2e:visual` → `playwright test --config=playwright.visual.config.ts` |

### Phase Requirement → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| VISUAL-01 | `playwright.visual.config.ts` exists, headless/bundled-Chromium/no-slowMo, isolated from `playwright.config.ts` | config-check (manual read + `npx playwright test --config=playwright.visual.config.ts --list`) | `npx playwright test --config=playwright.visual.config.ts --list` | ❌ Wave 0 — config doesn't exist yet |
| VISUAL-02 | Baselines captured for all 17 routes (admin) + role subsets (bartender/manager), only after Phases 30-33.1 land | visual | `npm run test:e2e:visual -- --update-snapshots` (first run, seeds baseline) | ❌ Wave 0 — spec doesn't exist yet |
| VISUAL-03 | Dynamic regions masked (timers, KDS boards, toasts) — zero unintended diffs across 2 consecutive runs | visual | `npm run test:e2e:visual` run twice back-to-back, diff `git status`/exit code both times | ❌ Wave 0 — spec doesn't exist yet |

### Sampling Rate
- **Per task commit:** N/A for this phase — visual assertions are the deliverable itself, not a gate on other code changes; no other production code changes in this phase.
- **Per suite run (this phase's own gate):** `npm run test:e2e:visual` (first run with `--update-snapshots` to seed, second run without to prove zero diffs) — this two-run sequence **is** success criterion 4 and should be the phase's own verification step, run locally, not CI (D-02).
- **Phase gate:** Two consecutive local `npm run test:e2e:visual` runs (second run *without* `--update-snapshots`) both exit 0 with zero failing screenshot assertions.

### Wave 0 Gaps
- [ ] `playwright.visual.config.ts` — does not exist yet, this phase's core deliverable
- [ ] `e2e/visual/45-visual-baseline.spec.ts` — does not exist yet, this phase's core deliverable
- [ ] `testIgnore: /visual\//` addition to `playwright.config.ts` — required so the functional suite doesn't pick up the new spec (Pitfall 1)
- [ ] `.gitignore` entry for `e2e/visual/**/*-snapshots/` (or the exact `45-visual-baseline.spec.ts-snapshots/` path) — required per D-12 (local-only baselines)
- [ ] `data-testid="live-time-display"` on `src/shared/ui/LiveTimeDisplay.tsx` — needed to mask both KDS page headers (Pitfall 4)
- [ ] `data-testid="kds-board"` on `src/widgets/KdsBoard/index.tsx`'s root element — needed only if KDS queues are non-empty at capture time (Pitfall 3, option 2)
- [ ] `test:e2e:visual` npm script — does not exist yet (D-03)

## Security Domain

This phase adds no new authentication, authorization, session, or cryptography logic — it only *captures* existing already-implemented and already-RBAC-gated screens. No new ASVS surface is introduced.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Uses existing `loginAs()` PIN-login helper unchanged |
| V3 Session Management | No | No session logic touched |
| V4 Access Control | No (observational only) | This phase *verifies visually* that existing `ProtectedRoute`/`*Route` gates redirect correctly — it does not change access-control code |
| V5 Input Validation | No | No user input paths added |
| V6 Cryptography | No | N/A |

**One residual note (not a new threat, a data-hygiene one):** baseline `.png` files are local-only/gitignored per D-12, but they are still real screenshots of the app containing live-looking (seeded/test) customer names, PINs-in-progress, and dollar amounts. Since they never leave the local machine or get committed, this is not a disclosure vector — noted only so the planner doesn't accidentally relax D-12's gitignore requirement later.

## Sources

### Primary (HIGH confidence — direct repo inspection)
- `src/app/router.tsx` — canonical 17-route list + all role-gate wrapper usage
- `src/app/ProtectedRoute.tsx`, `src/app/kds-route.tsx`, `src/app/kds-bar-route.tsx`, `src/app/rbac-route.tsx`, `src/app/audit-route.tsx`, `src/app/waitlist-route.tsx`, `src/app/reports-route.tsx` — exact redirect behavior per route
- `src/shared/lib/rbac.ts` — `ROLE_SET`/`BARTENDER_ACTIONS`/`MANAGER_EXTRA`/`ADMIN_EXTRA` — ground truth for Pattern 3's matrix
- `src/pages/pool-table-status/index.tsx`, `src/widgets/TableStatusPanel/index.tsx` — `data-testid="elapsed-minutes"` confirmed
- `src/entities/pool-table/ui/PoolTableCard.tsx`, `src/entities/pool-table/ui/PoolTableIllustration.tsx` — grid-level live timer/overlay, no testid (Pitfall 2)
- `src/widgets/KdsBoard/index.tsx`, `src/pages/kds/index.tsx`, `src/pages/kds-bar/index.tsx`, `src/shared/ui/LiveTimeDisplay.tsx` — KDS dynamic-region inventory (Pitfalls 3, 4)
- `src/widgets/OrderPanel/HappyHourBanner.tsx`, `src/widgets/OrderPanel/ProductGrid.tsx` — `data-testid="active-promotions-banner"` confirmed (Pitfall 5)
- `src/widgets/StaffDashboard/StaffDashboard.tsx` — live shift-duration `setInterval`, no testid found
- `src/pages/login/index.tsx` — authenticated-redirect behavior (Pitfall 7)
- `node_modules/sonner/dist/index.mjs` — `data-sonner-toaster` / `data-sonner-toast` attribute confirmed by direct grep (D-10's masking target)
- `playwright.config.ts` — existing functional config's exact `use`/`projects`/`testDir` fields being diverged from
- `e2e/helpers/auth.ts`, `e2e/helpers/supabase.ts`, `e2e/16-table-status.spec.ts`, `e2e/global-teardown.ts`, `e2e/fixtures.ts` — reusable patterns + globalTeardown incompatibility finding
- `package.json` — confirmed `@playwright/test@^1.59.1`, confirmed `setup:dev-users`/`seed:dev` scripts reference nonexistent files
- `.gitignore` — confirmed no existing Playwright-snapshot ignore pattern
- `.planning/config.json` — `workflow.nyquist_validation: true` confirmed

### Secondary (MEDIUM confidence — web search, cross-checked against known stable Playwright API)
- `mask`/`animations`/`threshold`/`maxDiffPixelRatio` semantics — [CITED: playwright.dev via WebSearch, cross-checked against training knowledge of a long-stable API surface]
- Default snapshot path template `{testFilePath}-snapshots/{arg}-{projectName}-{platform}{ext}` — [CITED: playwright.dev / community sources via WebSearch]

### Tertiary (LOW confidence — flagged for validation)
- Exact numeric defaults for `threshold`/`maxDiffPixels` when unset — WebFetch of the official docs page did not return the literal default values; treat A2 above as unverified and confirm against the installed `@playwright/test` version's TypeScript types (`node_modules/@playwright/test`) at implementation time if precision matters

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, existing version confirmed in `package.json`
- Architecture (config isolation, route/role matrix): HIGH — directly read from source, not inferred
- Dynamic-region inventory / masking targets: HIGH for confirmed `data-testid`s (`elapsed-minutes`, `active-promotions-banner`, `data-sonner-toaster`); MEDIUM for regions flagged as needing a new `data-testid` (correct location identified, exact attribute name is this research's own recommendation, not yet implemented)
- Playwright API defaults (threshold/maxDiffPixels numeric values) — LOW, flagged in Tertiary sources

**Research date:** 2026-07-14
**Valid until:** 30 days (stable API surface, but the dynamic-region inventory should be re-verified if any of Phases 29-33.1's components are touched again before this phase executes)
