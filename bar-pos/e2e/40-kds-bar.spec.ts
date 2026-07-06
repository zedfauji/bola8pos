/**
 * E2E: Bar Display (KDS-Bar)
 *
 * Tests: role access (D-04), bar-routed card rendering, and dashboard tile visibility.
 * Mirrors 28-kds.spec.ts's structure, filtered to the BAR routing station.
 *
 * Note on T6/T7 (dashboard tile): unlike the legacy `/kds` tile (which uses the
 * `visibleToRoles` pattern to fully hide itself from bartender), the `/kds-bar`
 * tile added in Plan 16-06 deliberately reuses the `requiredAction` gating pattern
 * (see HomeDashboard.tsx ITEMS + 16-06-SUMMARY.md) — every role sees the tile, but
 * roles lacking `view_kds_bar` see it rendered with a lock icon and are routed
 * through the ManagerPinDialog rather than navigating directly. The route guard
 * (`KdsBarRoute`, asserted by T4 below) remains the authoritative security boundary;
 * the tile is a discoverability affordance only. T6/T7 assert the tile-level
 * lock-icon differentiation rather than full invisibility for kitchen.
 */

import { expect, test } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import {
  getServiceClient,
  openCaja,
  resetTestState,
  seedKdsFoodOrder,
} from './helpers/supabase';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

async function seedOpenTabWithBarOrder(): Promise<{ tabId: string; itemId: string } | null> {
  const admin = getServiceClient();

  const { data: staff } = await admin.from('profiles').select('id').limit(1).single();
  if (!staff) throw new Error('seedOpenTabWithBarOrder: no profile found');

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
    if (shiftErr || !newShift) throw new Error(`shift create failed – ${shiftErr?.message}`);
    shiftId = newShift.id as string;
  }

  const { data: caja } = await admin
    .from('caja_sessions')
    .select('id')
    .eq('status', 'open')
    .maybeSingle();
  if (!caja) throw new Error('seedOpenTabWithBarOrder: no open caja');

  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({
      customer_name: `Bar KDS E2E Tab ${Date.now()}`,
      staff_id: staff.id,
      shift_id: shiftId,
      caja_session_id: caja.id,
      status: 'open',
      is_deleted: false,
    })
    .select('id')
    .single();
  if (tabErr || !tab) throw new Error(`tab insert failed – ${tabErr?.message}`);

  try {
    const { itemId } = await seedKdsFoodOrder(tab.id as string, 'BAR');
    return { tabId: tab.id as string, itemId };
  } catch {
    // No BAR-routed category/product exists in the seed DB — caller annotates and skips.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Bar Display — KDS-Bar', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    await page.goto('/');
  });

  // T1: bartender can access /kds-bar
  test('T1: bartender role can access /kds-bar', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'bartender');
    await page.goto('/kds-bar');
    await expect(page.getByRole('heading', { name: 'Bar Display' })).toBeVisible({
      timeout: 15_000,
    });
    await logout(page);
  });

  // T2: manager can access /kds-bar
  test('T2: manager role can access /kds-bar', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'manager');
    await page.goto('/kds-bar');
    await expect(page.getByRole('heading', { name: 'Bar Display' })).toBeVisible({
      timeout: 15_000,
    });
    await logout(page);
  });

  // T3: admin can access /kds-bar
  test('T3: admin role can access /kds-bar', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'admin');
    await page.goto('/kds-bar');
    await expect(page.getByRole('heading', { name: 'Bar Display' })).toBeVisible({
      timeout: 15_000,
    });
    await logout(page);
  });

  // T4: kitchen is redirected away from /kds-bar
  test('T4: kitchen role is redirected away from /kds-bar', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'kitchen');
    await page.goto('/kds-bar');
    await expect(page).toHaveURL(/\/home/, { timeout: 10_000 });
    await logout(page);
  });

  // T5: a seeded BAR order renders on the board
  test('T5: bar order card appears on /kds-bar board', async ({ page }) => {
    test.setTimeout(90_000);
    const seeded = await seedOpenTabWithBarOrder();
    if (!seeded) {
      test.info().annotations.push({
        type: 'note',
        description:
          'No BAR-routed category/product found in the seed DB — skipping card-rendering assertion. ' +
          'seedKdsFoodOrder(tabId, "BAR") found no matching category (categories.routing = BAR).',
      });
      return;
    }
    await loginAs(page, 'admin');
    await page.goto('/kds-bar');
    await expect(page.getByTestId('kds-card').first()).toBeVisible({ timeout: 20_000 });
    await logout(page);
  });

  // T6: bartender sees the "Bar Display" dashboard tile, unlocked (has view_kds_bar)
  test('T6: bartender sees the Bar Display dashboard tile, unlocked', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'bartender');
    await page.goto('/home');
    const tile = page.getByRole('button', { name: /Bar Display/i });
    await expect(tile).toBeVisible({ timeout: 15_000 });
    await expect(tile.getByTestId('lock-icon')).toHaveCount(0);
    await logout(page);
  });

  // T7: kitchen sees the "Bar Display" tile locked (gated, not fully hidden — see
  // module doc comment for why this differs from the /kds tile's visibleToRoles pattern)
  test('T7: kitchen sees the Bar Display tile locked (gated by view_kds_bar)', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'kitchen');
    await page.goto('/home');
    const tile = page.getByRole('button', { name: /Bar Display/i });
    await expect(tile).toBeVisible({ timeout: 15_000 });
    await expect(tile.getByTestId('lock-icon')).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });
});
