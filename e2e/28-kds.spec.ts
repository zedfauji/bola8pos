/**
 * E2E: Kitchen Display System (KDS)
 *
 * Tests: role access, card rendering, bump workflow, dashboard button visibility.
 */

import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import {
  getKdsItemStatus,
  getServiceClient,
  openCaja,
  resetTestState,
  seedKdsFoodOrder,
} from './helpers/supabase';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

async function seedOpenTabWithFoodOrder(): Promise<{ tabId: string; itemId: string }> {
  const admin = getServiceClient();

  const { data: staff } = await admin.from('profiles').select('id').limit(1).single();
  if (!staff) throw new Error('seedOpenTabWithFoodOrder: no profile found');

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
  if (!caja) throw new Error('seedOpenTabWithFoodOrder: no open caja');

  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({
      customer_name: `KDS E2E Tab ${Date.now()}`,
      staff_id: staff.id,
      shift_id: shiftId,
      caja_session_id: caja.id,
      status: 'open',
      is_deleted: false,
    })
    .select('id')
    .single();
  if (tabErr || !tab) throw new Error(`tab insert failed – ${tabErr?.message}`);

  const { itemId } = await seedKdsFoodOrder(tab.id as string);
  return { tabId: tab.id as string, itemId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('KDS — Kitchen Display System', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    await page.goto('/');
  });

  // T1: kitchen role can access /kds
  test('T1: kitchen role can access /kds', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'kitchen');
    await page.goto('/kds');
    await expect(page.getByRole('heading', { name: 'Kitchen Display' })).toBeVisible({
      timeout: 15_000,
    });
    await logout(page);
  });

  // T2: admin can access /kds
  test('T2: admin can access /kds', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'admin');
    await page.goto('/kds');
    await expect(page.getByRole('heading', { name: 'Kitchen Display' })).toBeVisible({
      timeout: 15_000,
    });
    await logout(page);
  });

  // T3: bartender is redirected from /kds
  test('T3: bartender is redirected away from /kds', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'bartender');
    await page.goto('/kds');
    await expect(page).toHaveURL(/\/home/, { timeout: 10_000 });
    await logout(page);
  });

  // T4: manager is redirected from /kds
  test('T4: manager is redirected away from /kds', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'manager');
    await page.goto('/kds');
    await expect(page).toHaveURL(/\/home/, { timeout: 10_000 });
    await logout(page);
  });

  // T5: seeded food order card appears on KDS
  test('T5: food order card appears on KDS board', async ({ page }) => {
    test.setTimeout(90_000);
    await seedOpenTabWithFoodOrder();
    await loginAs(page, 'admin');
    await page.goto('/kds');
    await expect(page.getByTestId('kds-card').first()).toBeVisible({ timeout: 20_000 });
    await logout(page);
  });

  // T6: bump pending → in_progress
  test('T6: Start button bumps pending card to in_progress', async ({ page }) => {
    test.setTimeout(90_000);
    const { itemId } = await seedOpenTabWithFoodOrder();
    await loginAs(page, 'admin');
    await page.goto('/kds');

    const pendingCard = page.locator('[data-kds-status="pending"]').first();
    await expect(pendingCard).toBeVisible({ timeout: 20_000 });
    await pendingCard.getByRole('button', { name: 'Start' }).click();

    // Card should transition to in_progress
    await expect(page.locator('[data-kds-status="in_progress"]').first()).toBeVisible({
      timeout: 15_000,
    });

    // Verify DB was updated
    const status = await getKdsItemStatus(itemId);
    expect(status).toBe('in_progress');

    await logout(page);
  });

  // T7: bump in_progress → done removes card from board
  test('T7: Done button bumps in_progress card to done and removes it from board', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const { itemId } = await seedOpenTabWithFoodOrder();
    await loginAs(page, 'admin');
    await page.goto('/kds');

    // First bump to in_progress
    const pendingCard = page.locator('[data-kds-status="pending"]').first();
    await expect(pendingCard).toBeVisible({ timeout: 20_000 });
    await pendingCard.getByRole('button', { name: 'Start' }).click();

    const inProgressCard = page.locator('[data-kds-status="in_progress"]').first();
    await expect(inProgressCard).toBeVisible({ timeout: 15_000 });

    const cardCountBefore = await page.locator('[data-testid="kds-card"]').count();

    // Bump to done
    await inProgressCard.getByRole('button', { name: 'Done' }).click();

    // Card count should decrease (done cards are hidden from the board)
    await expect(page.locator('[data-testid="kds-card"]')).toHaveCount(cardCountBefore - 1, {
      timeout: 15_000,
    });

    const status = await getKdsItemStatus(itemId);
    expect(status).toBe('done');

    await logout(page);
  });

  // T8: kitchen display button hidden from bartender on home dashboard
  test('T8: kitchen display button is hidden for bartender on home dashboard', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'bartender');
    await page.goto('/home');
    await expect(page.getByRole('button', { name: /Kitchen Display/i })).toHaveCount(0);
    await logout(page);
  });

  // T9: admin can see kitchen display button on home dashboard
  test('T9: admin sees Kitchen Display button on home dashboard', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'admin');
    await page.goto('/home');
    await expect(page.getByRole('button', { name: /Kitchen Display/i })).toBeVisible({
      timeout: 15_000,
    });
    await logout(page);
  });

  // T10: kitchen role can see kitchen display button on home dashboard
  test('T10: kitchen role sees Kitchen Display button on home dashboard', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'kitchen');
    await page.goto('/home');
    await expect(page.getByRole('button', { name: /Kitchen Display/i })).toBeVisible({
      timeout: 15_000,
    });
    await logout(page);
  });
});
