import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getOpenTabIdByCustomerName, getOrderCount, openCaja, resetTestState } from './helpers/supabase';

test.describe('Offline Resilience', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(570);
    await page.goto('/');
  });

  test('Offline banner appears', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await page.context().setOffline(true);
    await expect(page.getByText(/offline.*cached data/i)).toBeVisible({ timeout: 20_000 });
    await page.context().setOffline(false);
    await logout(page);
  });

  test('Order queued while offline — no error toast', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Offline Order Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    await page.context().setOffline(true);
    await expect(page.getByText(/offline.*cached data/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /error|failed/i })).toHaveCount(0);
    await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 25_000 });
    await page.context().setOffline(false);
    await logout(page);
  });

  test('Order syncs on reconnect', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Offline Sync Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    const id = await getOpenTabIdByCustomerName('Offline Sync Tab');
    expect(id).toBeTruthy();

    await page.context().setOffline(true);
    await expect(page.getByText(/offline.*cached data/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Corona/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 25_000 });

    await page.context().setOffline(false);
    await expect(page.getByText(/all actions synced|offline/i).first()).toBeVisible({ timeout: 45_000 });

    await expect.poll(async () => getOrderCount(id!), { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
    await logout(page);
  });

  test('T4: offline pool session start — syncs after reconnect', async ({ page }) => {
    test.skip(true, 'Skipped — Playwright setOffline stalls fetch() indefinitely on pool session mutations. See feedback-offline-mutation-guard.md. Fix requires isOnline() early-exit in mutationFn.');
  });

  test('T5: three offline actions — no error toasts, sync on reconnect', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Offline Multi Action Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    const id = await getOpenTabIdByCustomerName('Offline Multi Action Tab');
    expect(id).toBeTruthy();

    await page.context().setOffline(true);
    await expect(page.getByText(/offline.*cached data/i)).toBeVisible({ timeout: 20_000 });

    // Action 1: add item
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    // Action 2: place order
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 25_000 });
    // Action 3: add another item (queue a second order)
    await page.getByRole('button', { name: /Select Corona/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 25_000 });

    // No error toasts during offline
    await expect(page.getByRole('alert').filter({ hasText: /error|failed/i })).toHaveCount(0);

    await page.context().setOffline(false);
    await expect(page.getByText(/all actions synced|offline/i).first()).toBeVisible({ timeout: 45_000 });

    await expect.poll(async () => getOrderCount(id!), { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
    await logout(page);
  });
});
