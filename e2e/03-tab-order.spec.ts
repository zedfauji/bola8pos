import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getOpenTabIdByCustomerName, getOrderCount, openCaja, resetTestState } from './helpers/supabase';

test.describe('Tab + Order Flow', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(400);
    await page.goto('/');
  });

  test('Bartender creates a tab', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('E2E Customer');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /open tabs/i }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: /tab for e2e customer/i })).toBeVisible({ timeout: 15_000 });
    // Close the drawer so the sidebar Logout button isn't blocked by the overlay
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
    await logout(page);
  });

  test('Add items to cart', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('E2E Cart Items');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    const before = await page.getByText(/\d+ (item|items)/).first().textContent();
    await page.getByRole('button', { name: /Select Corona/i }).click();
    await expect(async () => {
      const after = await page.getByText(/\d+ (item|items)/).first().textContent();
      expect(after).not.toBe(before);
    }).toPass({ timeout: 15_000 });
    await logout(page);
  });

  test('Place order', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('E2E Order Flow');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    const tabId = await getOpenTabIdByCustomerName('E2E Order Flow');
    expect(tabId).toBeTruthy();
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 30_000 });
    const count = await getOrderCount(tabId!);
    expect(count).toBeGreaterThanOrEqual(1);
    await logout(page);
  });

  test('Cart clears after order', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('E2E Cart Clear');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });
});
