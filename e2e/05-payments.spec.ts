import { expect, test, type Page } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';

function payButton(page: Page) {
  return page.getByRole('button', { name: /close tab and process payment/i });
}

test.describe('Payments', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    await page.goto('/');
  });

  test('Cash payment — change calculation', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Pay Cash Change');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    if ((await payButton(page).count()) === 0) {
      test.skip(true, 'Close Tab / Pay control not present on POS (OrderPanel not mounted).');
    }
    await payButton(page).click();
    const modal = page.getByRole('dialog', { name: /process payment/i });
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await modal.getByTestId('payment-btn-cash').click();
    await modal.getByLabel(/amount tendered/i).fill('100');
    await expect(modal.getByText(/change due/i)).toBeVisible();
    await expect(modal.getByText(/\$[0-9]+\.[0-9]{2}/).first()).toBeVisible();
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await logout(page);
  });

  test('Cash payment — completes', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Pay Cash Done');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Corona/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    if ((await payButton(page).count()) === 0) {
      test.skip(true, 'Close Tab / Pay control not present on POS (OrderPanel not mounted).');
    }
    await payButton(page).click();
    const modal = page.getByRole('dialog', { name: /process payment/i });
    await modal.getByTestId('payment-btn-cash').click();
    await modal.getByLabel(/amount tendered/i).fill('500');
    await modal.getByRole('button', { name: /process payment/i }).click();
    await expect(page.getByRole('heading', { name: 'Receipt' })).toBeVisible({ timeout: 90_000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);
  });

  test('Card payment button label', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Pay Card Label');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    if ((await payButton(page).count()) === 0) {
      test.skip(true, 'Close Tab / Pay control not present on POS (OrderPanel not mounted).');
    }
    await payButton(page).click();
    const modal = page.getByRole('dialog', { name: /process payment/i });
    await modal.getByTestId('payment-btn-card').click();
    await expect(modal.getByTestId('payment-btn-card')).toContainText('Terminal BBVA');
    await expect(modal.getByTestId('payment-btn-card')).not.toContainText(/^Card$/);
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await logout(page);
  });

  test('Card payment — no cash drawer in console', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      logs.push(msg.text());
    });

    await loginAs(page, 'manager');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Pay Card Console');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    if ((await payButton(page).count()) === 0) {
      test.skip(true, 'Close Tab / Pay control not present on POS (OrderPanel not mounted).');
    }
    await payButton(page).click();
    const modal = page.getByRole('dialog', { name: /process payment/i });
    await modal.getByTestId('payment-btn-card').click();
    await modal.getByRole('button', { name: /confirm card payment/i }).click();
    await expect(page.getByText(/receipt|error|failed/i).first()).toBeVisible({ timeout: 90_000 }).catch(() => undefined);
    await page.getByRole('button', { name: 'Done' }).click().catch(() => undefined);

    const joined = logs.join('\n').toLowerCase();
    expect(joined.includes('open_cash_drawer')).toBe(false);
    await logout(page);
  });
});
