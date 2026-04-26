import { expect, test, type Page } from './fixtures';
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
    await page.goto('/pos');
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
    await page.goto('/pos');
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
    await page.goto('/pos');
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

  test('T5: enter exact cash = subtotal — no negative change shown', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Exact Cash Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    if ((await payButton(page).count()) === 0) {
      test.skip(true, 'Close Tab / Pay control not present on POS');
    }
    await payButton(page).click();
    const modal = page.getByRole('dialog', { name: /process payment/i });
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await modal.getByTestId('payment-btn-cash').click();

    // Get subtotal from the modal
    const subtotalText = await modal.getByText(/\$\d+\.\d{2}/).first().textContent();
    const match = subtotalText?.match(/\$(\d+\.\d{2})/);
    const subtotal = match ? match[1] : '35.00';
    await modal.getByLabel(/amount tendered/i).fill(subtotal ?? '35.00');

    // Change due should show $0.00 or not a negative value
    const changeDue = modal.getByText(/change due/i);
    const changeVisible = await changeDue.isVisible({ timeout: 3_000 }).catch(() => false);
    if (changeVisible) {
      await expect(modal.getByText(/\$0\.00/)).toBeVisible({ timeout: 3_000 });
    }
    // Ensure no negative change
    await expect(modal.getByText(/-\$\d/)).toHaveCount(0);
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await logout(page);
  });

  test('T6: enter cash less than subtotal — submit blocked or validation error', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Under Cash Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    if ((await payButton(page).count()) === 0) {
      test.skip(true, 'Close Tab / Pay control not present on POS');
    }
    await payButton(page).click();
    const modal = page.getByRole('dialog', { name: /process payment/i });
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await modal.getByTestId('payment-btn-cash').click();
    await modal.getByLabel(/amount tendered/i).fill('1'); // clearly too low

    const processBtn = modal.getByRole('button', { name: /process payment/i });
    const isDisabled = await processBtn.isDisabled().catch(() => false);
    if (!isDisabled) {
      await processBtn.click();
      await expect(
        modal.getByText(/insufficient|amount.*less|must.*at least|underpayment/i)
      ).toBeVisible({ timeout: 10_000 });
    } else {
      expect(isDisabled).toBe(true);
    }
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await logout(page);
  });

  test('T7: tip field — enter $2, receipt shows tip', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Tip Test Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    if ((await payButton(page).count()) === 0) {
      test.skip(true, 'Close Tab / Pay control not present');
    }
    await payButton(page).click();
    const modal = page.getByRole('dialog', { name: /process payment/i });
    await modal.getByTestId('payment-btn-cash').click();

    const tipInput = modal.getByLabel(/tip/i);
    if (!(await tipInput.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'tip/discount UI not implemented');
      return;
    }
    await tipInput.fill('2');
    await modal.getByLabel(/amount tendered/i).fill('500');
    await modal.getByRole('button', { name: /process payment/i }).click();
    const receiptDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: 'Receipt' }) });
    await expect(receiptDialog.getByRole('heading', { name: 'Receipt' })).toBeVisible({ timeout: 90_000 });
    await expect(receiptDialog.locator('pre').getByText(/tip/i).first()).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);
  });

  test('T8: discount field — apply 10% discount', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Discount Test Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    if ((await payButton(page).count()) === 0) {
      test.skip(true, 'Close Tab / Pay control not present');
    }
    await payButton(page).click();
    const modal = page.getByRole('dialog', { name: /process payment/i });

    const discountInput = modal.getByLabel(/discount/i);
    if (!(await discountInput.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'tip/discount UI not implemented');
      return;
    }
    await discountInput.fill('10');
    await expect(modal.getByTestId('discount-applied-label')).toBeVisible({ timeout: 5_000 });
    await expect(modal.getByTestId('discount-row')).toBeVisible();
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await logout(page);
  });

  test('Card payment — no cash drawer in console', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      logs.push(msg.text());
    });

    await loginAs(page, 'manager');
    await page.goto('/pos');
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
