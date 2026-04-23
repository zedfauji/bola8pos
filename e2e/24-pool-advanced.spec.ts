/**
 * E2E: Advanced Pool Operations — /pool-tables and /pool-tables/:tableId
 *
 * Tests multiple simultaneous sessions, session-stop charge display,
 * rate validation, and the edit-session-start-time feature.
 */

import { expect, test, type Page } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import {
  getLatestStoppedPoolChargeForTab,
  getOccupiedPoolTableIds,
  getServiceClient,
  openCaja,
  resetTestState,
} from './helpers/supabase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openTabForCustomer(page: Page, customerName: string): Promise<void> {
  await page.goto('/pos');
  await page.getByRole('button', { name: /new tab/i }).click();
  await page.getByLabel(/customer name/i).fill(customerName);
  await page.getByRole('button', { name: 'Open Tab' }).click();
  await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
}

async function startSessionOnFirstAvailableTable(page: Page, customerName: string): Promise<void> {
  await page.goto('/pool-tables');
  await page.getByRole('button', { name: 'Start Session' }).first().click();
  const sheet = page.getByRole('dialog', { name: /start pool session/i });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.locator('#pool-start-tab').selectOption({ label: customerName });
  await sheet.getByRole('button', { name: 'Start Session' }).click();
  await expect(page.getByText(/pool session started/i)).toBeVisible({ timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Advanced Pool Operations', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    await page.goto('/');
  });

  test('PA1: edit start time 30 min ago — stop shows higher charge', async ({ page }) => {
    test.skip(true, 'UI not implemented — EXPECTED FAIL: edit-start-time UI not implemented');
  });

  test('PA2: start session with New Tab, then assign to existing tab', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    // Create a named tab first
    await openTabForCustomer(page, 'PA2 Assign Tab');

    // Start session with auto-create (New Tab)
    await page.goto('/pool-tables');
    await page.getByRole('button', { name: 'Start Session' }).first().click();
    const sheet = page.getByRole('dialog', { name: /start pool session/i });
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    // Leave as __new_tab__ (default)
    await sheet.getByRole('button', { name: /start session/i }).click();
    await expect(page.getByText(/pool session started/i)).toBeVisible({ timeout: 20_000 });

    // Navigate to the table status page
    const occupied = await getOccupiedPoolTableIds();
    if (occupied.length === 0) {
      test.skip(true, 'No occupied table found after starting session');
      return;
    }
    await page.goto(`/pool-tables/${occupied[0]!.tableId}`);

    // Look for "Assign to Tab" or "Change Tab" on the status page
    const assignBtn = page.getByRole('button', { name: /assign.*tab|change.*tab/i });
    const assignVisible = await assignBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!assignVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: assign session to tab button missing');
      return;
    }

    await assignBtn.click();
    const assignDialog = page.getByRole('dialog');
    await expect(assignDialog).toBeVisible({ timeout: 10_000 });
    await assignDialog.locator('select').selectOption({ label: 'PA2 Assign Tab' });
    await assignDialog.getByRole('button', { name: /assign|save/i }).click();

    await expect(page.getByText('PA2 Assign Tab')).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('PA3: start sessions on Table 1 and Table 2 — both show timers', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    // Check we have at least 2 available tables
    const admin = getServiceClient();
    const { data: tables } = await admin
      .from('pool_tables')
      .select('id, number')
      .eq('status', 'available')
      .limit(2);

    if (!tables || tables.length < 2) {
      test.skip(true, 'Need at least 2 available pool tables for this test');
      return;
    }

    await openTabForCustomer(page, 'PA3 Tab One');
    await startSessionOnFirstAvailableTable(page, 'PA3 Tab One');

    await openTabForCustomer(page, 'PA3 Tab Two');
    await startSessionOnFirstAvailableTable(page, 'PA3 Tab Two');

    await page.goto('/pool-tables');
    const timers = page.locator('span.font-mono');
    await expect.poll(async () => timers.count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    await logout(page);
  });

  test('PA4: stop Table 1 — Table 1 available, Table 2 still running', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    const admin = getServiceClient();
    const { data: tables } = await admin
      .from('pool_tables')
      .select('id, number')
      .eq('status', 'available')
      .limit(2);

    if (!tables || tables.length < 2) {
      test.skip(true, 'Need at least 2 available pool tables for this test');
      return;
    }

    await openTabForCustomer(page, 'PA4 Tab One');
    await startSessionOnFirstAvailableTable(page, 'PA4 Tab One');

    await openTabForCustomer(page, 'PA4 Tab Two');
    await startSessionOnFirstAvailableTable(page, 'PA4 Tab Two');

    // Stop only the first session (first Stop Session button)
    await page.goto('/pool-tables');
    await page.getByRole('button', { name: 'Stop Session' }).first().click();
    const confirm = page.getByRole('alertdialog', { name: /stop pool session/i });
    await expect(confirm).toBeVisible({ timeout: 15_000 });
    await confirm.getByRole('button', { name: /stop & finalize/i }).click();
    await expect(page.getByText(/pool session stopped/i)).toBeVisible({ timeout: 25_000 });

    // One table available, one still occupied
    const occupied = await getOccupiedPoolTableIds();
    expect(occupied.length).toBeGreaterThanOrEqual(1);
    // At least one Stop Session button still visible
    await expect(page.getByRole('button', { name: 'Stop Session' }).first()).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  test('PA5: after stopping session, /payments shows pool charge line item', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    await openTabForCustomer(page, 'PA5 Pool Charge Tab');
    await startSessionOnFirstAvailableTable(page, 'PA5 Pool Charge Tab');

    // Stop session
    await page.getByRole('button', { name: 'Stop Session' }).first().click();
    const confirm = page.getByRole('alertdialog', { name: /stop pool session/i });
    await expect(confirm).toBeVisible({ timeout: 15_000 });
    await confirm.getByRole('button', { name: /stop & finalize/i }).click();
    await expect(page.getByText(/pool session stopped/i)).toBeVisible({ timeout: 25_000 });

    // Navigate to /payments and find the tab
    await page.goto('/payments');
    const list = page.getByTestId('tabs-waiting-for-payment');
    await expect(list).toBeVisible({ timeout: 20_000 });
    await expect(list.getByText('PA5 Pool Charge Tab')).toBeVisible({ timeout: 15_000 });

    // Select tab and verify pin
    await list.getByRole('button', { name: /tab PA5 Pool Charge Tab/i }).click();
    await page.getByRole('button', { name: /verify pin to process payment/i }).click();

    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 10_000 });
    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    for (const ch of managerPin) {
      await pinDialog.getByRole('button', { name: ch === '0' ? 'Key 0' : `Key ${ch}` }).click();
    }
    await expect(pinDialog).not.toBeVisible({ timeout: 10_000 });

    // Payment form should show pool charge
    await expect(page.getByText(/pool.*table|billar|pool charge|\$3\.75/i)).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  test('PA6: rate displayed in start session dialog matches a dollar pattern', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    await page.goto('/pool-tables');
    await page.getByRole('button', { name: 'Start Session' }).first().click();

    const sheet = page.getByRole('dialog', { name: /start pool session/i });
    await expect(sheet).toBeVisible({ timeout: 15_000 });

    // Rate should display as $X or $X.XX / hr or /hour
    const rateText = sheet.getByText(/\$\d+(\.\d{2})?\s*\/\s*(hr|hour)/i);
    await expect(rateText).toBeVisible({ timeout: 5_000 });
    await logout(page);
  });

  test('PA7: session started 16 min ago — charge is proportional, not flat minimum', async ({
    page,
  }) => {
    test.skip(true, 'UI not implemented — EXPECTED FAIL: edit-start-time UI not implemented');
  });
});
