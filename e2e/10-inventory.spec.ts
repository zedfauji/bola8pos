import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getInventoryQty, openCaja, resetTestState, setInventoryQty } from './helpers/supabase';

const PRODUCT = process.env.E2E_INVENTORY_PRODUCT_NAME?.trim() || 'Budweiser';

test.describe('Inventory Decrement', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(560);
    await page.goto('/');
  });

  test('Inventory decrements after order', async ({ page }) => {
    const before = await getInventoryQty(PRODUCT);
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Inv Dec Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    const productBtn = page.getByRole('button', { name: new RegExp(`Select ${PRODUCT}`, 'i') });
    await productBtn.click();
    await productBtn.click();
    await page.getByRole('button', { name: 'Place Order' }).click();
    await expect(page.getByText(/order placed successfully/i)).toBeVisible({ timeout: 25_000 });

    const after = await getInventoryQty(PRODUCT);
    expect(after).toBe(before - 2);
    await logout(page);
  });

  test('Low stock alert visible to manager', async ({ page }) => {
    await setInventoryQty(PRODUCT, 1);
    await loginAs(page, 'manager');
    await page.goto('/pos');
    await expect(page.getByRole('status', { name: /low stock/i })).toBeVisible({ timeout: 30_000 });
    await logout(page);
  });

  test('Low stock alert hidden from bartender', async ({ page }) => {
    await setInventoryQty(PRODUCT, 1);
    await loginAs(page, 'bartender');
    await page.goto('/pos');
    await expect(page.getByRole('status', { name: /low stock/i })).toHaveCount(0);
    await logout(page);
  });
});
