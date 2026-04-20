import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import {
  getOccupiedPoolTableIds,
  getPoolSessionStartedAt,
  openCaja,
  resetTestState,
} from './helpers/supabase';

test.describe('Tab + Pool Transfer', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(520);
    await page.goto('/');
  });

  test('Transfer tab to new table', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Transfer Table Tab');
    await page.getByLabel(/table number/i).fill('5');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Table 5', { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Transfer tab' }).click();
    const dlg = page.getByRole('dialog', { name: /transfer tab/i });
    await dlg.getByLabel(/new table/i).fill('12');
    await dlg.getByRole('button', { name: 'Transfer' }).click();
    await expect(page.getByText(/tab transferred successfully/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Table 12', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('Transfer tab to different staff', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Transfer Staff Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Transfer tab' }).click();
    const dlg = page.getByRole('dialog', { name: /transfer tab/i });
    const primary = process.env.E2E_BARTENDER_NAME ?? '';
    const targetLabel = primary.includes('Sam')
      ? 'Alex Martinez (bartender)'
      : 'Sam Rivera (bartender)';
    await dlg.locator('#transfer-staff').selectOption({ label: targetLabel });
    await dlg.getByRole('button', { name: 'Transfer' }).click();
    await expect(page.getByText(/tab transferred successfully/i)).toBeVisible({ timeout: 25_000 });
    await logout(page);
  });

  test('Transfer pool session preserves started_at', async ({ page }) => {
    await loginAs(page, 'bartender');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Move Pool Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    await page.goto('/pool-tables');
    await page.getByRole('button', { name: 'Start Session' }).first().click();
    const sheet = page.getByRole('dialog', { name: /start pool session/i });
    await sheet.locator('#pool-start-tab').selectOption({ label: 'Move Pool Tab' });
    await sheet.getByRole('button', { name: 'Start Session' }).click();
    await expect(page.getByText(/pool session started/i)).toBeVisible({ timeout: 20_000 });

    const occ = await getOccupiedPoolTableIds();
    expect(occ.length).toBeGreaterThan(0);
    const sessionId = occ[0]!.sessionId;
    const startedBefore = await getPoolSessionStartedAt(sessionId);
    expect(startedBefore).toBeTruthy();

    await page.getByRole('button', { name: 'Move Table' }).first().click();
    const moveDlg = page.getByRole('dialog', { name: /move pool session/i });
    await expect(moveDlg).toBeVisible({ timeout: 15_000 });
    await moveDlg.locator('#target-table').selectOption({ index: 1 });
    await moveDlg.getByRole('button', { name: 'Move Session' }).click();
    await expect(page.getByText(/pool session moved/i)).toBeVisible({ timeout: 25_000 });

    await expect(page.getByRole('status', { name: /status: available/i }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('status', { name: /status: occupied/i }).first()).toBeVisible({ timeout: 20_000 });

    const startedAfter = await getPoolSessionStartedAt(sessionId);
    expect(startedAfter).toBe(startedBefore);
    await logout(page);
  });
});
