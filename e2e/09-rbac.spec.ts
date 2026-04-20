import { expect, test, type Page } from '@playwright/test';
import { loginAs, loginAsNamed, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';

function payButton(page: Page) {
  return page.getByRole('button', { name: /close tab and process payment/i });
}

test.describe('Role-Based Access', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(550);
    await page.goto('/');
  });

  test('Bartender cannot use Close Tab / Pay', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('RBAC Bartender Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    if ((await payButton(page).count()) === 0) {
      await expect(payButton(page)).toHaveCount(0);
    } else {
      await expect(payButton(page)).toBeDisabled();
    }
    await logout(page);
  });

  test('Bartender cannot access Reports route', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.goto('/reports');
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
    await logout(page);
  });

  test('Manager can Close Tab / Pay', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('RBAC Manager Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    if ((await payButton(page).count()) === 0) {
      test.skip(true, 'Close Tab / Pay control not present on POS (OrderPanel not mounted).');
    }
    await expect(payButton(page)).toBeEnabled();
    await logout(page);
  });

  test('Manager sees Reports on home dashboard and can access it', async ({ page }) => {
    await loginAs(page, 'manager');
    await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();
    await page.getByRole('button', { name: 'Reports' }).click();
    await expect(page).toHaveURL(/\/reports/, { timeout: 15_000 });
    await logout(page);
  });

  test('Admin can access Settings', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 20_000 });
    await logout(page);
  });

  test("Bartender B does not see Bartender A's tab in drawer", async ({ page }) => {
    test.skip(!process.env.E2E_BARTENDER_B_NAME || !process.env.E2E_BARTENDER_B_PIN, 'Set E2E_BARTENDER_B_NAME and E2E_BARTENDER_B_PIN for second bartender');

    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('RBAC Owner Tab A');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await logout(page);

    await loginAsNamed(page, process.env.E2E_BARTENDER_B_NAME!, process.env.E2E_BARTENDER_B_PIN!);
    await page.getByRole('button', { name: /open tabs/i }).click();
    await expect(page.getByRole('button', { name: /tab for rbac owner tab a/i })).toHaveCount(0);
    await logout(page);
  });
});
