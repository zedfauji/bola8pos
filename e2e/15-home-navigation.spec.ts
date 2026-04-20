import { expect, test } from '@playwright/test';

import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';

test.describe('Home Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(600);
    await page.goto('/');
  });

  test('bartender login lands on /home', async ({ page }) => {
    await loginAs(page, 'bartender');
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
    await logout(page);
  });

  test('clicking POS Register navigates to /pos', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: 'POS Register' }).click();
    await expect(page).toHaveURL(/\/pos/, { timeout: 10_000 });
    await logout(page);
  });

  test('clicking Pool Tables navigates to /pool-tables', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: 'Pool Tables' }).click();
    await expect(page).toHaveURL(/\/pool-tables/, { timeout: 10_000 });
    await logout(page);
  });

  test('back button on feature page returns to /home', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: 'Pool Tables' }).click();
    await expect(page).toHaveURL(/\/pool-tables/, { timeout: 10_000 });
    await page.getByRole('link', { name: /Home/i }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10_000 });
    await logout(page);
  });

  test('bartender clicking Reports shows Manager PIN dialog', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: 'Reports' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Manager Access Required/i)).toBeVisible();
    await expect(page).toHaveURL(/\/home/);
    await logout(page);
  });

  test('wrong PIN in Manager PIN dialog shows error and stays on /home', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: 'Reports' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });

    const dialog = page.getByRole('alertdialog');
    for (const ch of '000000') {
      await dialog.getByRole('button', { name: ch === '0' ? 'Key 0' : `Key ${ch}` }).click();
    }
    await expect(dialog.getByText(/Incorrect PIN/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/home/);
    await logout(page);
  });

  test('correct manager PIN navigates to /reports', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: 'Reports' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });

    const dialog = page.getByRole('alertdialog');
    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    for (const ch of managerPin) {
      await dialog.getByRole('button', { name: ch === '0' ? 'Key 0' : `Key ${ch}` }).click();
    }
    await expect(page).toHaveURL(/\/reports/, { timeout: 15_000 });
    await logout(page);
  });

  test('manager login clicks Reports — no dialog, navigates directly', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.getByRole('button', { name: 'Reports' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/reports/, { timeout: 10_000 });
    await logout(page);
  });

  test('admin login can access Settings directly', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings/, { timeout: 10_000 });
    await logout(page);
  });

  test('bartender clicking Settings shows Manager PIN dialog', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Manager Access Required/i)).toBeVisible();
    await logout(page);
  });
});
