import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';

test.describe('Receipt / Hardware Settings', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(540);
    await page.goto('/');
  });

  test('Save paper width setting (80mm / 40 chars)', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Hardware' }).click();
    await expect(page.getByRole('heading', { name: 'Hardware' })).toBeVisible({ timeout: 20_000 });
    await page.locator('#paper-width').selectOption('40');
    await expect(page.locator('#paper-width')).toHaveValue('40', { timeout: 20_000 });
    await logout(page);
  });

  test('Cashier name toggle off persists in UI state', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Hardware' }).click();
    await expect(page.locator('#receipt-showCashierName')).toBeVisible({ timeout: 20_000 });
    await page.locator('#receipt-showCashierName').setChecked(false);
    await expect(page.locator('#receipt-showCashierName')).not.toBeChecked();
    await logout(page);
  });

  test('Settings persist after reload', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Hardware' }).click();
    await expect(page.locator('#paper-width')).toBeVisible({ timeout: 20_000 });
    await page.locator('#paper-width').selectOption('40');
    await page.locator('#receipt-showCashierName').setChecked(false);
    await page.reload();
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Hardware' }).click();
    await expect(page.locator('#paper-width')).toHaveValue('40', { timeout: 20_000 });
    await expect(page.locator('#receipt-showCashierName')).not.toBeChecked();
    await logout(page);
  });

  test('Reset to defaults (58mm + cashier name)', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Hardware' }).click();
    await expect(page.locator('#paper-width')).toBeVisible({ timeout: 20_000 });
    await page.locator('#paper-width').selectOption('32');
    await page.locator('#receipt-showCashierName').setChecked(true);
    await expect(page.locator('#paper-width')).toHaveValue('32', { timeout: 20_000 });
    await expect(page.locator('#receipt-showCashierName')).toBeChecked();
    await logout(page);
  });

  test('Auto-cut toggle persists after reload', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Hardware' }).click();
    await expect(page.locator('#receipt-autoCut')).toBeVisible({ timeout: 20_000 });

    // Toggle ON — wait for the server round-trip before reloading
    await page.locator('#receipt-autoCut').setChecked(true);
    await expect(page.locator('#receipt-autoCut')).toBeChecked({ timeout: 10_000 });

    // Reload and re-navigate to Settings → Hardware
    await page.reload();
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Hardware' }).click();
    await expect(page.locator('#receipt-autoCut')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#receipt-autoCut')).toBeChecked();

    // Toggle OFF — persist that too
    await page.locator('#receipt-autoCut').setChecked(false);
    await expect(page.locator('#receipt-autoCut')).not.toBeChecked({ timeout: 10_000 });

    await page.reload();
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Hardware' }).click();
    await expect(page.locator('#receipt-autoCut')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#receipt-autoCut')).not.toBeChecked();

    await logout(page);
  });
});
