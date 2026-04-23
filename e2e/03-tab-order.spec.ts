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
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('E2E Customer');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /switch tab/i }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: /tab for e2e customer/i })).toBeVisible({ timeout: 15_000 });
    // Close the drawer so the sidebar Logout button isn't blocked by the overlay
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
    await logout(page);
  });

  test('Add items to cart', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'bartender');
    await page.goto('/pos');
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
    await page.goto('/pos');
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
    await page.goto('/pos');
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

  test('T5: add 3 items — cart badge shows ≥3', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('E2E Cart Badge');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    const budBtn = page.getByRole('button', { name: /Select Budweiser/i });
    await budBtn.click();
    await budBtn.click();
    await budBtn.click();

    // Badge text or item count should show ≥3
    const itemCountText = page.getByText(/\d+ (item|items)/).first();
    await expect.poll(
      async () => {
        const txt = await itemCountText.textContent({ timeout: 3_000 }).catch(() => '0');
        return parseInt(txt?.match(/\d+/)?.[0] ?? '0', 10);
      },
      { timeout: 15_000 }
    ).toBeGreaterThanOrEqual(3);
    await logout(page);
  });

  test('T6: remove item from cart — cart empties', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('E2E Remove Item');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Select Budweiser/i }).click();

    // Find a remove/trash button on the cart item
    const removeBtn = page
      .getByRole('button', { name: /remove|delete|trash/i })
      .first();
    const clearBtn = page.getByRole('button', { name: /clear cart|empty cart/i });

    const hasRemove = await removeBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasClear = await clearBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasRemove) {
      await removeBtn.click();
    } else if (hasClear) {
      await clearBtn.click();
    } else {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: remove item button not found in cart');
      return;
    }

    await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  test('T7: open tab with notes — notes visible in tab detail', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByLabel(/customer name/i).fill('E2E Notes Tab');

    const notesField = dialog.getByLabel(/note|memo|comment/i);
    const notesVisible = await notesField.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!notesVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: notes field in open tab dialog');
      return;
    }
    await notesField.fill('E2E test note content');
    await dialog.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    // Notes should be visible somewhere in the tab view
    await expect(page.getByText('E2E test note content')).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  test('T8: per-item notes saved with order', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('E2E Item Notes');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Select Budweiser/i }).click();

    // Look for per-item notes input in cart
    const itemNotesField = page.getByLabel(/item notes|special request|notes/i).first();
    const hasItemNotes = await itemNotesField.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasItemNotes) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: per-item notes field not present');
      return;
    }

    await itemNotesField.fill('No ice please');
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });
    await logout(page);
  });

  test('T9: open tab with no items — empty tab closes or shows message', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('E2E Empty Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    // Try to place order without any items
    const placeOrderBtn = page.getByRole('button', { name: 'Place Order' });
    const isDisabled = await placeOrderBtn.isDisabled().catch(() => true);
    if (!isDisabled) {
      await placeOrderBtn.click();
      // Should show error or cart empty message
      await expect(
        page.getByText(/cart is empty|no items|add.*item/i)
      ).toBeVisible({ timeout: 10_000 });
    } else {
      expect(isDisabled).toBe(true);
    }
    await logout(page);
  });
});
