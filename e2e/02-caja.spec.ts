import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { forceCloseAllOpenTabs, openCaja, resetTestState } from './helpers/supabase';

test.describe('Caja Management', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await page.goto('/');
  });

  test('Manager opens caja', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/staff');
    await expect(page.getByRole('heading', { name: 'Staff', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Open Caja' }).click();
    const openDlg = page.getByRole('dialog', { name: 'Open Caja' });
    await expect(openDlg).toBeVisible();
    await openDlg.getByLabel(/opening cash/i).fill('500');
    await openDlg.getByRole('button', { name: 'Open Caja' }).click();
    await expect(page.getByRole('button', { name: 'Close Caja' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('section').filter({ hasText: 'Daily business session' })).toContainText('Open');
    await logout(page);
  });

  test('POS is active after caja open', async ({ page }) => {
    await openCaja(100);
    await loginAs(page, 'manager');
    await page.goto('/pos');
    const bud = page.getByRole('button', { name: /Select Budweiser/i });
    await expect(bud).toBeVisible({ timeout: 30_000 });
    await expect(bud).toBeEnabled();
    await logout(page);
  });

  test('Cannot close caja with open tabs', async ({ page }) => {
    await openCaja(200);
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Caja Block Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await logout(page);

    await loginAs(page, 'manager');
    await page.goto('/staff');
    await page.getByRole('button', { name: 'Close Caja' }).click();
    const closeDlg = page.getByRole('dialog', { name: 'Close Caja' });
    await expect(closeDlg).toBeVisible();
    await closeDlg.getByLabel(/closing cash count/i).fill('200');
    await closeDlg.getByRole('button', { name: 'Close Caja' }).click();
    await expect(page.getByText(/there are open tabs/i)).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await logout(page);
  });

  test('Manager closes caja', async ({ page }) => {
    await openCaja(300);
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Close Caja Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await logout(page);

    await forceCloseAllOpenTabs();
    await loginAs(page, 'manager');
    await page.goto('/staff');
    await page.getByRole('button', { name: 'Close Caja' }).click();
    const closeDlg = page.getByRole('dialog', { name: 'Close Caja' });
    await closeDlg.getByLabel(/closing cash count/i).fill('300');
    await closeDlg.getByRole('button', { name: 'Close Caja' }).click();
    await expect(page.getByText(/caja closed successfully/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Open Caja' })).toBeVisible();
    await expect(page.getByText('Closed', { exact: true })).toBeVisible();
    await logout(page);
  });
});
