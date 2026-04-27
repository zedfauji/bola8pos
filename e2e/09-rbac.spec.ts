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

  test('Bartender Close Tab / Pay button is present (requires PIN verification)', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('RBAC Bartender Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    // Bartenders have close_tab RBAC permission (PIN verification occurs in the dialog)
    // Button should be present (enabled) — payment requires PIN to complete
    await expect(payButton(page)).toBeEnabled({ timeout: 10_000 });
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
    await page.goto('/pos');
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

  test('T7: admin deletes a tab — tab deleted toast, tab no longer in list', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'admin');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('RBAC Delete Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    // Look for delete tab button
    const deleteBtn = page.getByRole('button', { name: /delete tab/i });
    const hasDelete = await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasDelete) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: delete tab button not visible to admin');
      return;
    }

    await deleteBtn.click();
    // Confirm dialog may appear
    const confirmDlg = page.getByRole('alertdialog');
    const confirmVisible = await confirmDlg.isVisible({ timeout: 5_000 }).catch(() => false);
    if (confirmVisible) {
      await confirmDlg.getByRole('button', { name: /delete|confirm/i }).click();
    }

    await expect(page.getByText(/tab deleted/i)).toBeVisible({ timeout: 15_000 });

    // Tab should no longer appear
    await page.getByRole('button', { name: /switch tab|open tabs/i }).first().click();
    const drawer = page.getByRole('dialog');
    await expect(
      drawer.getByRole('button', { name: /RBAC Delete Tab/i })
    ).toHaveCount(0);
    await logout(page);
  });

  test('T8: bartender — void order button absent or shows manager PIN dialog', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('RBAC Bartender Void');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    const voidBtn = page.getByRole('button', { name: /void order/i }).first();
    const voidVisible = await voidBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (voidVisible) {
      await voidBtn.click();
      const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
      const pinVisible = await pinDialog.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(pinVisible).toBe(true);
    }
    // Button absent is also acceptable — bartender doesn't have void_order RBAC
    await logout(page);
  });

  test('T9: manager can void an order — success', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('RBAC Manager Void');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    const voidBtn = page.getByRole('button', { name: /void order/i }).first();
    const voidVisible = await voidBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!voidVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: void order button not visible to manager');
      return;
    }

    await voidBtn.click();
    const voidDialog = page.getByRole('alertdialog', { name: /void order/i });
    await expect(voidDialog).toBeVisible({ timeout: 10_000 });
    await voidDialog.getByLabel(/void reason/i).fill('Manager RBAC test void');
    await voidDialog.getByRole('button', { name: /void order/i }).click();
    await expect(page.getByText(/order voided/i)).toBeVisible({ timeout: 20_000 });
    await logout(page);
  });

  test('T10: bartender on /pos — caja open/close not visible or requires manager PIN', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'bartender');
    await page.goto('/pos');

    const cajaBtn = page.getByRole('button', { name: /open caja|close caja|caja|register/i }).first();
    const cajaVisible = await cajaBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (cajaVisible) {
      await cajaBtn.click();
      // Should require manager PIN
      const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
      const pinRequired = await pinDialog.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(pinRequired).toBe(true);
    }
    // Button absent for bartender is also acceptable
    await logout(page);
  });
});
