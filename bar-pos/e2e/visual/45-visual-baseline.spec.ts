/**
 * e2e/visual/45-visual-baseline.spec.ts
 *
 * Visual regression baseline: photographs the post-Phase-33.1 UI.
 * Admin — all 17 registered routes (router.tsx). Bartender/Manager — their own
 * router-gate-true accessible subset (RESEARCH.md Pattern 3, NOT CONTEXT.md D-05's
 * illustrative example — /waitlist is manager+, /kds is admin/kitchen only).
 *
 * Run in isolation via `npm run test:e2e:visual` (playwright.visual.config.ts —
 * headless, bundled Chromium, no slowMo/channel; see Plan 34-01).
 *
 * Seeding: direct Supabase service-role inserts via getServiceClient(), same
 * pattern as e2e/16-table-status.spec.ts. The repo's dev-seed npm scripts are
 * broken (D-14) — this spec does not depend on them.
 */

import type { Locator } from '@playwright/test';
import { expect, test, type Page } from '../fixtures';
import { gotoAuthed, loginAs, logout, type StaffRole } from '../helpers/auth';
import { requireIntegrationEnv } from '../helpers/requireEnv';
import { getServiceClient, openCaja, resetTestState, seedKdsFoodOrder } from '../helpers/supabase';

// ---------------------------------------------------------------------------
// Seed helper (D-06/D-14) — copied from e2e/16-table-status.spec.ts's
// `seedOccupiedTableDirect`, not exported from helpers/supabase.ts, so
// re-declared locally rather than duplicating it there for a single caller.
// ---------------------------------------------------------------------------

async function seedOccupiedTableDirect(
  customerName: string
): Promise<{ tableId: string; tabId: string }> {
  const admin = getServiceClient();

  const { data: tableRow, error: tErr } = await admin
    .from('pool_tables')
    .select('id, number')
    .eq('status', 'available')
    .limit(1)
    .single();
  if (tErr || !tableRow) {
    throw new Error(`seedOccupiedTableDirect: no available table – ${tErr?.message}`);
  }

  const { data: staff, error: sErr } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .single();
  if (sErr || !staff) throw new Error(`seedOccupiedTableDirect: no staff profile – ${sErr?.message}`);

  let shiftId: string;
  const { data: existingShift } = await admin
    .from('shifts')
    .select('id')
    .eq('staff_id', staff.id)
    .is('clock_out', null)
    .limit(1)
    .maybeSingle();
  if (existingShift) {
    shiftId = existingShift.id as string;
  } else {
    const { data: newShift, error: shiftErr } = await admin
      .from('shifts')
      .insert({ staff_id: staff.id, opening_cash: 0 })
      .select('id')
      .single();
    if (shiftErr || !newShift) {
      throw new Error(`seedOccupiedTableDirect: shift create failed – ${shiftErr?.message}`);
    }
    shiftId = newShift.id as string;
  }

  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({
      customer_name: customerName,
      status: 'open',
      staff_id: staff.id,
      shift_id: shiftId,
      is_deleted: false,
    })
    .select('id')
    .single();
  if (tabErr || !tab) throw new Error(`seedOccupiedTableDirect: tab insert failed – ${tabErr?.message}`);

  const { data: session, error: sessErr } = await admin
    .from('pool_sessions')
    .insert({
      table_id: tableRow.id,
      tab_id: tab.id,
      started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      billed_minutes: null,
      total_charge: null,
      stopped_at: null,
    })
    .select('id')
    .single();
  if (sessErr || !session) {
    throw new Error(`seedOccupiedTableDirect: session insert failed – ${sessErr?.message}`);
  }

  const { error: updateErr } = await admin
    .from('pool_tables')
    .update({ status: 'occupied', current_session_id: session.id })
    .eq('id', tableRow.id);
  if (updateErr) throw new Error(`seedOccupiedTableDirect: table update failed – ${updateErr.message}`);

  return { tableId: tableRow.id as string, tabId: tab.id as string };
}

// ---------------------------------------------------------------------------
// Masking (RESEARCH Pitfalls 2-5, D-08/D-09/D-10/D-16/D-17)
// ---------------------------------------------------------------------------

function toastMask(page: Page): Locator {
  return page.locator('[data-sonner-toaster]');
}

/**
 * Per-route mask array. `/staff` masks two additional regions beyond the plan's
 * original table (Rule 2 — required for Task 2's two-run zero-diff gate to pass,
 * not just cosmetic):
 *  - StaffDashboard's "Clock in"/"Shift duration" columns: loginAs() auto-starts
 *    a shift (opening-cash dialog) for whichever role is currently logged in when
 *    no open shift exists, so the just-logged-in role's row always shows a
 *    real, ticking `clock_in`/duration value that is freshly `now()` on every
 *    suite run — not something resetTestState() alone can neutralize, since it
 *    runs BEFORE this suite's own logins re-create the shift.
 *  - CajaDashboard's "Opened: <time>" line (StaffPage renders CajaDashboard above
 *    StaffDashboard): this suite's own openCaja() call stamps `opened_at = now()`
 *    on every run, so the printed timestamp differs between the seed run and any
 *    later verification run.
 */
function masksFor(page: Page, route: string): Locator[] {
  const toast = toastMask(page);
  if (route === '/pos') {
    return [toast, page.getByTestId('active-promotions-banner')];
  }
  if (route.startsWith('/pool-tables/')) {
    return [toast, page.getByTestId('elapsed-minutes')];
  }
  if (route === '/kds' || route === '/kds-bar') {
    return [toast, page.getByTestId('kds-board'), page.getByTestId('live-time-display')];
  }
  if (route === '/staff') {
    return [
      toast,
      page.getByText(/^Opened:/),
      page.locator('table tbody tr td:nth-child(3)'),
      page.locator('table tbody tr td:nth-child(4)'),
    ];
  }
  return [toast];
}

type RouteSpec = { path: string; slug: string };

async function captureRoute(page: Page, role: string, route: RouteSpec): Promise<void> {
  await gotoAuthed(page, route.path);
  await page.evaluate(() => document.fonts.ready);
  await expect.soft(page).toHaveScreenshot(`${role}-${route.slug}.png`, {
    fullPage: true,
    mask: masksFor(page, route.path),
  });
}

// ---------------------------------------------------------------------------
// Route × role matrix (RESEARCH.md Pattern 3 — corrects CONTEXT.md D-05)
// ---------------------------------------------------------------------------

// Every accessible role subset except /pool-tables (captured separately, idle,
// before any seeding — Anti-Pattern / Pitfall 2) and /login (unauthenticated).
const BARTENDER_ROUTES: RouteSpec[] = [
  { path: '/home', slug: 'home' },
  { path: '/pos', slug: 'pos' },
  { path: '/payments', slug: 'payments' },
  { path: '/rappi', slug: 'rappi' },
  { path: '/kds-bar', slug: 'kds-bar' },
  { path: '/inventory', slug: 'inventory' },
  { path: '/staff', slug: 'staff' },
  { path: '/settings', slug: 'settings' },
  { path: '/kitchen-prep', slug: 'kitchen-prep' },
];
const BARTENDER_DENIED = ['/reports', '/waitlist', '/kds', '/rbac'];

const MANAGER_ROUTES: RouteSpec[] = [
  ...BARTENDER_ROUTES,
  { path: '/reports', slug: 'reports' },
  { path: '/waitlist', slug: 'waitlist' },
  { path: '/audit', slug: 'audit' },
];
const MANAGER_DENIED = ['/kds', '/rbac'];

const ADMIN_ROUTES: RouteSpec[] = [
  { path: '/home', slug: 'home' },
  { path: '/pos', slug: 'pos' },
  { path: '/inventory', slug: 'inventory' },
  { path: '/staff', slug: 'staff' },
  { path: '/reports', slug: 'reports' },
  { path: '/settings', slug: 'settings' },
  { path: '/rappi', slug: 'rappi' },
  { path: '/payments', slug: 'payments' },
  { path: '/kds', slug: 'kds' },
  { path: '/kds-bar', slug: 'kds-bar' },
  { path: '/kitchen-prep', slug: 'kitchen-prep' },
  { path: '/waitlist', slug: 'waitlist' },
  { path: '/rbac', slug: 'rbac' },
  { path: '/audit', slug: 'audit' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe.serial('Visual regression baseline (Phase 34)', () => {
  let poolTableId: string;

  test.beforeEach(() => {
    requireIntegrationEnv();
  });

  test.beforeAll(async () => {
    await resetTestState();
    await openCaja(300);
  });

  test.afterAll(async () => {
    await resetTestState();
  });

  // Pitfall 7 — /login redirects to /home when already authenticated. Runs first
  // in a fresh, never-logged-in context (default Playwright per-test isolation).
  test('login page (unauthenticated)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /who are you/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await expect.soft(page).toHaveScreenshot('login.png', {
      fullPage: true,
      mask: [toastMask(page)],
    });
  });

  // Idle /pool-tables grid for every role, captured BEFORE any table is occupied
  // (Anti-Pattern / Pitfall 2) — avoids needing to mask per-card live timers.
  // Seeds the shared occupied-table + KDS fixtures (D-09/D-16) once at the end,
  // reused by every subsequent role's route captures below.
  test('pool-tables idle grid — admin, bartender, manager — then seed shared fixtures', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const roles: StaffRole[] = ['admin', 'bartender', 'manager'];
    for (const role of roles) {
      await loginAs(page, role);
      await gotoAuthed(page, '/pool-tables');
      await page.evaluate(() => document.fonts.ready);
      await expect.soft(page).toHaveScreenshot(`${role}-pool-tables.png`, {
        fullPage: true,
        mask: [toastMask(page)],
      });
      await logout(page);
    }

    const { tableId, tabId } = await seedOccupiedTableDirect('Visual Baseline Fixture');
    await seedKdsFoodOrder(tabId, 'KITCHEN');
    await seedKdsFoodOrder(tabId, 'BAR');
    poolTableId = tableId;
  });

  test('admin — remaining 15 routes', async ({ page }) => {
    test.setTimeout(300_000);
    await loginAs(page, 'admin');
    const routes: RouteSpec[] = [
      ...ADMIN_ROUTES,
      { path: `/pool-tables/${poolTableId}`, slug: 'pool-table-status' },
    ];
    for (const route of routes) {
      await captureRoute(page, 'admin', route);
    }
    await logout(page);
  });

  test('bartender — accessible routes + denied redirects + /audit denial', async ({ page }) => {
    test.setTimeout(300_000);
    await loginAs(page, 'bartender');
    const routes: RouteSpec[] = [
      ...BARTENDER_ROUTES,
      { path: `/pool-tables/${poolTableId}`, slug: 'pool-table-status' },
    ];
    for (const route of routes) {
      await captureRoute(page, 'bartender', route);
    }

    for (const denied of BARTENDER_DENIED) {
      await gotoAuthed(page, denied);
      await expect(page).toHaveURL(/\/home$/);
    }

    // /audit is the one denied route that IS screenshotted (D-15) — a distinguishing
    // sonner toast renders on top of /home before the redirect settles.
    await gotoAuthed(page, '/audit');
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => document.fonts.ready);
    await expect.soft(page).toHaveScreenshot('bartender-audit-denied.png', { fullPage: true });

    await logout(page);
  });

  test('manager — accessible routes + denied redirects', async ({ page }) => {
    test.setTimeout(300_000);
    await loginAs(page, 'manager');
    const routes: RouteSpec[] = [
      ...MANAGER_ROUTES,
      { path: `/pool-tables/${poolTableId}`, slug: 'pool-table-status' },
    ];
    for (const route of routes) {
      await captureRoute(page, 'manager', route);
    }

    for (const denied of MANAGER_DENIED) {
      await gotoAuthed(page, denied);
      await expect(page).toHaveURL(/\/home$/);
    }

    await logout(page);
  });
});
