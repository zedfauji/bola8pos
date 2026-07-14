# Phase 34: Visual Regression Baseline - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 7
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `playwright.visual.config.ts` (NEW) | config | request-response (browser automation config) | `playwright.config.ts` | exact (diverge on purpose per D-01) |
| `e2e/visual/45-visual-baseline.spec.ts` (NEW) | test | CRUD + request-response (seed via Supabase, navigate, screenshot) | `e2e/16-table-status.spec.ts` (seeding/table-id lookup) + `e2e/helpers/auth.ts` (role login) | role-match |
| `playwright.config.ts` (MODIFY) | config | — | itself | n/a — single-field addition |
| `package.json` (MODIFY) | config | — | existing `test:e2e`/`test:e2e:report` scripts | exact |
| `.gitignore` (MODIFY) | config | — | existing `e2e-results/` block | exact |
| `src/shared/ui/LiveTimeDisplay.tsx` (MODIFY) | component | transform (render clock) | itself — attribute-only add | exact |
| `src/widgets/KdsBoard/index.tsx` (MODIFY) | component | CRUD (renders realtime board) | itself — attribute-only add | exact |

## Pattern Assignments

### `playwright.visual.config.ts` (config, new file)

**Analog:** `D:\Projects\Code\POS\bola8pos-kiro\bar-pos\playwright.config.ts` (full file, 56 lines — already read in full)

**Full existing config for reference:**
```typescript
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 1,
  timeout: testTimeout,
  expect: { timeout: fastE2e ? 5_000 : 10_000 },
  globalTeardown: path.join(__dirname, 'e2e', 'global-teardown.ts'),
  reporter: [['blob', { outputDir: 'e2e-blob-reports' }], ['list'], ['json', { outputFile: 'e2e-results/results.json' }]],
  use: { baseURL: 'http://localhost:1420', trace: 'on', video: 'on', screenshot: 'on', headless: false, slowMo, ... },
  projects: [{ name: 'chromium', use: { channel: 'chrome', headless: false } }],
  webServer: { command: 'npm run dev', url: 'http://localhost:1420', reuseExistingServer: true, timeout: webServerTimeout },
});
```

**What to copy:** the `dotenv`/`__dirname` boilerplate (lines 1-8), the `defineConfig` shape, and `webServer` block verbatim (same dev server, same reuse behavior).

**What must diverge (per D-01/RESEARCH Pattern 1) — do NOT import/spread this file:**
- `testDir: './e2e/visual'` (not `'./e2e'`)
- `headless: true`, no `slowMo`, `projects: [{ name: 'chromium', use: {} }]` — no `channel: 'chrome'`
- `trace: 'off'`, `video: 'off'`, `screenshot: 'off'` (the mechanism is `toHaveScreenshot`, not on-failure screenshot)
- No `globalTeardown` (that script's `SUITE_MAP` regexes are functional-suite-specific — will never match `e2e/visual/*`)
- `expect.toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01 }`
- `reporter: [['list']]` only (no blob/json — manual/local per D-02)
- `retries: 0` (a visual diff should never silently pass on retry)

RESEARCH.md's Pattern 1 already contains a complete drafted file — use it directly as the implementation starting point.

---

### `e2e/visual/45-visual-baseline.spec.ts` (test, new file)

**Analog 1 — role login + seeded-table-id lookup pattern:** `e2e/16-table-status.spec.ts` lines 1-80 (read above)

**Imports pattern** (lines 19-27):
```typescript
import { expect, test, type Page } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import {
  getOccupiedPoolTableIds,
  getServiceClient,
  openCaja,
  resetTestState,
} from './helpers/supabase';
```
Note: the new spec lives one directory deeper (`e2e/visual/`), so relative imports become `'../fixtures'`, `'../helpers/auth'`, `'../helpers/supabase'`.

**Seeded table-id lookup pattern** (lines 65-71) — reuse directly for D-06/D-14:
```typescript
async function navigateToFirstOccupiedStatusPage(page: Page): Promise<string> {
  const occupied = await getOccupiedPoolTableIds();
  if (occupied.length === 0) throw new Error('No occupied table found – seeding may have failed.');
  const { tableId } = occupied[0]!;
  await page.goto(`/pool-tables/${tableId}`);
  return tableId;
}
```
`getOccupiedPoolTableIds()` and `seedOccupiedTableDirect()` already exist in `e2e/helpers/supabase.ts` (lines 281-294 and 77+) — reuse as-is, do not reimplement.

**Analog 2 — role login helper:** `e2e/helpers/auth.ts` (full file, already read — reuse unmodified)
```typescript
import { loginAs } from '../helpers/auth';
await loginAs(page, 'admin');   // or 'bartender' | 'manager'
```
`loginAs` lands on `/home` or `/pos` after PIN entry + optional opening-cash dialog — safe to call once per role block, then `page.goto(route)` for each route in that role's subset.

**Analog 3 — direct Supabase seeding (D-14, since `setup:dev` is broken):** `e2e/helpers/supabase.ts` — reuse existing exports directly, do not write new seed scripts:
- `getServiceClient()` (lines 22-26) — base client for any ad-hoc seed query
- `getOccupiedPoolTableIds()` (lines 281-294) — pool table id lookup
- `seedKdsFoodOrder(tabId, routing)` (lines 612-665) — seed 1-2 pending KDS items per D-16 (routing `'KITCHEN'` for `/kds`, `'BAR'` for `/kds-bar`)
- `resetTestState()` (lines 54-125) — call in `test.beforeAll`/`afterAll` for a clean baseline run, same as every existing spec

**Masking + fullPage + font-ready pattern (from RESEARCH.md Code Examples, directly reusable):**
```typescript
await page.evaluate(() => document.fonts.ready);   // Pitfall 8
await expect(page).toHaveScreenshot('admin-pool-table-status-occupied.png', {
  fullPage: true,
  mask: [
    page.getByTestId('elapsed-minutes'),          // confirmed existing testid
    page.locator('[data-sonner-toaster]'),         // toast container, defensive (D-10)
  ],
});
```

**Denied-route pattern (D-15) — URL assertion, not screenshot, for all except `/audit`:**
```typescript
await page.goto('/kds');   // bartender/manager — client redirects before paint
await expect(page).toHaveURL(/\/home$/);
// /audit is the exception — DOES get toHaveScreenshot() because a sonner toast renders first
```

---

### `playwright.config.ts` (MODIFY — add one line)

**Location:** inside the `defineConfig({...})` object, alongside `testDir`/`outputDir` (lines 16-17).
**Change:** add `testIgnore: /visual\//,` — required so `npm run test:e2e`'s recursive glob under `testDir: './e2e'` does not also pick up `e2e/visual/45-visual-baseline.spec.ts` (Pitfall 1). This is the only change to this file.

---

### `package.json` (MODIFY — add one script)

**Analog:** existing `test:e2e` / `test:e2e:report` entries (lines 28-29):
```json
"test:e2e": "playwright test",
"test:e2e:report": "playwright show-report",
```
**Add, following the same naming convention (D-03):**
```json
"test:e2e:visual": "playwright test --config=playwright.visual.config.ts",
```

---

### `.gitignore` (MODIFY — add one entry)

**Analog:** existing "Test / CI outputs" block (lines 34-40):
```
# Test / CI outputs (keep clones lean)
coverage/
artifacts/
e2e-results/
e2e-blob-reports/
playwright-report/
verification-artifacts/
```
**Add, per D-12 (local-only baselines, never committed):**
```
e2e/visual/**/*-snapshots/
```
(Playwright's default snapshot path template is `{testFilePath}-snapshots/{arg}-{projectName}-{platform}.png`, so this glob matches `e2e/visual/45-visual-baseline.spec.ts-snapshots/`.)

---

### `src/shared/ui/LiveTimeDisplay.tsx` (MODIFY — attribute-only)

**Full current file already read (43 lines).** Single change: add `data-testid="live-time-display"` to the root `<span>` (currently line 36-39):
```typescript
<span
  data-testid="live-time-display"
  className={cn('text-muted-foreground text-sm tabular-nums', className)}
  suppressHydrationWarning
>
```
No other change — className, children, hooks untouched (per UI-SPEC Test-Hook Contract).

---

### `src/widgets/KdsBoard/index.tsx` (MODIFY — attribute-only)

**Root element located at line 238:** `<div className="grid gap-6 p-6 md:grid-cols-2">`. Existing per-card testids at line 39 (`data-testid="kds-card"`) confirm the file's testid convention (plain string literal, no dynamic interpolation for the container).

**Change:**
```typescript
<div data-testid="kds-board" className="grid gap-6 p-6 md:grid-cols-2">
```
No other change. Only needed if the KDS queue is non-empty at capture time (D-16); the empty state (`"No active {stationLabel} orders"`, line 209) is fully static and needs no mask.

---

## Shared Patterns

### Role login for every route capture
**Source:** `e2e/helpers/auth.ts` `loginAs(page, role)` (lines 70-73), `logout(page)` (lines 101-154)
**Apply to:** all `test()` blocks in `45-visual-baseline.spec.ts`. Reuse unmodified — no new auth helper needed. `/login` baseline (Pitfall 7) needs a fresh unauthenticated context or an explicit `logout(page)` call before navigating.

### Direct Supabase seeding (no `setup:dev` dependency)
**Source:** `e2e/helpers/supabase.ts` (full file read, 815 lines) — `getServiceClient()`, `getOccupiedPoolTableIds()`, `seedKdsFoodOrder()`, `resetTestState()` all reusable as-is.
**Apply to:** pool-table-id lookup (D-06/D-14), KDS non-empty seeding (D-16), general test isolation (`beforeAll`/`afterAll` reset).

### Masking dynamic regions
**Source:** RESEARCH.md Pattern 2 + confirmed selectors: `data-testid="elapsed-minutes"` (existing, `src/pages/pool-table-status/index.tsx`), `data-testid="active-promotions-banner"` (existing, `src/widgets/OrderPanel/HappyHourBanner.tsx`), `[data-sonner-toaster]` (library-provided), plus the 2 new testids this phase adds (`live-time-display`, `kds-board`).
**Apply to:** every `toHaveScreenshot()` call — pass the route-appropriate subset via the `mask` array, per RESEARCH.md's route-by-route inventory (Pitfalls 2-5).

### Font-ready wait before every screenshot
**Source:** RESEARCH.md Pitfall 8 — `await page.evaluate(() => document.fonts.ready);` before each `toHaveScreenshot()` call (self-hosted `@fontsource-variable/geist`, no prior pattern in the codebase for this — new to this spec).

## No Analog Found

None — every file in scope has a direct or attribute-only-modify analog in the existing codebase.

## Metadata

**Analog search scope:** `bar-pos/` root (`playwright.config.ts`, `package.json`, `.gitignore`), `bar-pos/e2e/` (helpers, `16-table-status.spec.ts`), `bar-pos/src/shared/ui/LiveTimeDisplay.tsx`, `bar-pos/src/widgets/KdsBoard/index.tsx`
**Files scanned:** 7 target files + 4 analog source files (all read in full or targeted grep+read, zero re-reads)
**Pattern extraction date:** 2026-07-14
