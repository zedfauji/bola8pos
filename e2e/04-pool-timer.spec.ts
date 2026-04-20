import { expect, test, type Page } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getLatestStoppedPoolChargeForTab, getOpenTabIdByCustomerName, openCaja, resetTestState } from './helpers/supabase';

async function openTabForCustomer(page: Page, customerName: string) {
  await page.getByRole('button', { name: /new tab/i }).click();
  await page.getByLabel(/customer name/i).fill(customerName);
  await page.getByRole('button', { name: 'Open Tab' }).click();
  await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
}

async function startFirstPoolSession(page: Page, customerName: string) {
  await page.goto('/pool-tables');
  await page.getByRole('button', { name: 'Start Session' }).first().click();

  const sheet = page.getByRole('dialog', { name: /start pool session/i });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.locator('#pool-start-tab').selectOption({ label: customerName });
  await sheet.getByRole('button', { name: 'Start Session' }).click();

  await expect(page.getByText(/pool session started/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /occupied:\s*1/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Stop Session' }).first()).toBeVisible({
    timeout: 20_000,
  });
}

test.describe('Pool Timer', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(450);
    await page.goto('/');
  });

  test('Start session on available table', async ({ page }) => {
    await loginAs(page, 'manager');
    await openTabForCustomer(page, 'Pool Link Tab');
    await startFirstPoolSession(page, 'Pool Link Tab');

    const timer = page.locator('time').first();
    await expect(timer).toBeVisible({ timeout: 20_000 });
    await expect(timer).not.toHaveText('00:00', { timeout: 20_000 });
    await logout(page);
  });

  test('Timer ticks', async ({ page }) => {
    await loginAs(page, 'manager');
    await openTabForCustomer(page, 'Pool Timer Tick');
    await startFirstPoolSession(page, 'Pool Timer Tick');

    const timer = page.locator('time').first();
    await expect(timer).toBeVisible({ timeout: 20_000 });
    const t0 = (await timer.innerText()).trim();
    await expect
      .poll(async () => (await timer.innerText()).trim(), { timeout: 20_000 })
      .not.toBe(t0);
    await logout(page);
  });

  test('15-minute minimum charge on stop', async ({ page }) => {
    await loginAs(page, 'manager');
    await openTabForCustomer(page, 'Pool Min Charge');
    await startFirstPoolSession(page, 'Pool Min Charge');

    await page.getByRole('button', { name: 'Stop Session' }).first().click();
    const confirm = page.getByRole('alertdialog', { name: /stop pool session/i });
    await expect(confirm).toBeVisible({ timeout: 15_000 });
    await expect(
      confirm.getByText('Sessions under 15 minutes are billed at the 15-minute minimum.')
    ).toBeVisible();
    await expect(confirm.getByText(/\$3\.75/)).toBeVisible();
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await logout(page);
  });

  test('Charge recorded for linked tab after stop', async ({ page }) => {
    await loginAs(page, 'manager');
    await openTabForCustomer(page, 'Pool Charge Tab');
    const tabId = await getOpenTabIdByCustomerName('Pool Charge Tab');
    expect(tabId).toBeTruthy();
    if (!tabId) {
      throw new Error('Expected the linked tab to exist after opening it.');
    }

    await startFirstPoolSession(page, 'Pool Charge Tab');

    await page.getByRole('button', { name: 'Stop Session' }).first().click();
    const confirm = page.getByRole('alertdialog', { name: /stop pool session/i });
    await confirm.getByRole('button', { name: /stop & finalize/i }).click();
    await expect(page.getByText(/pool session stopped/i)).toBeVisible({ timeout: 25_000 });

    const charge = await getLatestStoppedPoolChargeForTab(tabId);
    expect(charge).toBeGreaterThan(0);
  });
});
