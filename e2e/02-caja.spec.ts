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
    await page.goto('/pos');
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
    await page.goto('/pos');
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

  test('Pending total shows open-tab revenue after creating a tab with an item', async ({ page }) => {
    await openCaja(100);
    await loginAs(page, 'bartender');

    // Create a new tab at /pos and add an item
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Pending Summary Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    // Add at least one item (Budweiser is always seeded)
    const budBtn = page.getByRole('button', { name: /Select Budweiser/i });
    await expect(budBtn).toBeVisible({ timeout: 30_000 });
    await budBtn.click();
    // Wait for the item to appear in the cart (no toast for cart additions — item count changes)
    await expect(page.getByText(/1 item/i)).toBeVisible({ timeout: 15_000 });

    await logout(page);

    // Now check the summary on /staff
    await loginAs(page, 'manager');
    await page.goto('/staff');

    // The Pending (open tabs) card must show an amount > $0.00
    // We locate the card by its label text then find the sibling MoneyDisplay
    const pendingCard = page.locator('div').filter({ hasText: /Pending/i }).first();
    await expect(pendingCard).toBeVisible({ timeout: 30_000 });

    // The MoneyDisplay inside the card should NOT be $0.00
    // We check for a dollar amount pattern inside the card region
    const cardText = await pendingCard.textContent();
    expect(cardText).toMatch(/\$[1-9]\d*\.\d{2}|\$0\.[1-9]\d/);

    await logout(page);
  });

  test('Print Summary button is visible when caja is open', async ({ page }) => {
    await openCaja(100);
    await loginAs(page, 'manager');
    await page.goto('/staff');

    const printBtn = page.getByRole('button', { name: /print summary/i });
    await expect(printBtn).toBeVisible({ timeout: 30_000 });

    await logout(page);
  });

  test('5-card summary is hidden when caja is closed', async ({ page }) => {
    // Ensure caja is closed (resetTestState already closes any open caja in beforeEach)
    await loginAs(page, 'manager');
    await page.goto('/staff');

    // With no open caja, print summary button is visible but disabled (AC-3)
    await expect(page.getByRole('button', { name: /print summary/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /print summary/i })).toBeDisabled();
    await expect(page.getByText('Cash')).not.toBeVisible();
    await expect(page.getByText('Card')).not.toBeVisible();
    await expect(page.getByText('Rappi')).not.toBeVisible();
    await expect(page.getByText('Net')).not.toBeVisible();

    await logout(page);
  });
});
