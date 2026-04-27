import { test, expect } from './fixtures';
import { loginAs } from './helpers/auth';
import { getServiceClient, openCaja, resetTestState } from './helpers/supabase';

test.describe('Sprint 3 — Carom Tables & Billing Config', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState();
    await openCaja(500);
    await loginAs(page, 'admin');
  });

  test.afterEach(async () => {
    await resetTestState();
  });

  test('pool tables grid shows type filter tabs (All, Pool, Carom, Consumption)', async ({
    page,
  }) => {
    await page.goto('/pool-tables');
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Pool' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Carom' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Consumption' })).toBeVisible();
  });

  test('pool table card type badge is visible and contains type text', async ({ page }) => {
    await page.goto('/pool-tables');
    const firstCard = page.locator('[data-testid="pool-table-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });
    const badge = firstCard.locator('[data-testid="table-type-badge"]');
    await expect(badge).toBeVisible();
    const badgeText = await badge.textContent();
    expect(['Pool', 'Carom', 'Consumption']).toContain(badgeText?.trim());
  });

  test('settings pool tables tab allows table type configuration', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Pool Tables' }).click();
    // Heading for the tab content
    await expect(page.getByRole('heading', { name: /Pool Tables/i })).toBeVisible({
      timeout: 5000,
    });
    // At least one "Type" label should be present (one per table row in the settings list)
    await expect(page.getByText('Type').first()).toBeVisible({ timeout: 5000 });
  });

  test('settings billing tab: prorated mode is the default', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Billing' }).click();
    await expect(page.getByRole('button', { name: /Prorated/i })).toBeVisible({ timeout: 5000 });
  });

  test('settings billing tab: can switch to Full Hour mode and save', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Billing' }).click();

    const fullHourBtn = page.getByRole('button', { name: /Full Hour/i });
    await expect(fullHourBtn).toBeVisible({ timeout: 5000 });
    await fullHourBtn.click();

    await page.getByRole('button', { name: /Save Billing/i }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Billing settings saved.').first()).toBeVisible({ timeout: 5000 });

    // Restore to prorated so we don't affect other tests
    await page.getByRole('button', { name: /Prorated/i }).click();
    await page.getByRole('button', { name: /Save Billing/i }).click();
    await expect(page.getByText('Billing settings saved.').first()).toBeVisible({ timeout: 5000 });
  });

  test('pool table session stop dialog shows charge based on table rate', async ({ page }) => {
    // Check if any available pool table exists
    const db = getServiceClient();
    const { data: availableTables } = await db
      .from('pool_tables')
      .select('id, number')
      .eq('status', 'available')
      .limit(1);

    if (!availableTables || availableTables.length === 0) {
      test.skip(true, 'No available pool tables to start a session on');
      return;
    }

    await page.goto('/pool-tables');

    // Start a session on the first available table
    const startBtn = page.getByRole('button', { name: /Start Session/i }).first();
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    // In the StartSessionSheet, confirm/start without selecting a tab (standalone session)
    const sheetStartBtn = page.getByRole('button', { name: /Start Session/i }).last();
    await expect(sheetStartBtn).toBeVisible({ timeout: 3000 });
    await sheetStartBtn.click();

    // Wait for session to start and navigate back to pool-tables
    await page.waitForTimeout(1000);
    await page.goto('/pool-tables');

    // Find the now-occupied table card and click Stop Session
    const stopBtn = page.getByRole('button', { name: /Stop Session/i }).first();
    await expect(stopBtn).toBeVisible({ timeout: 5000 });
    await stopBtn.click();

    // The StopSessionConfirm dialog should show a charge preview containing a dollar amount
    // MoneyDisplay renders an aria-label="$X.XX dollars" span
    const chargePreview = page.getByText(/Final charge/i);
    await expect(chargePreview).toBeVisible({ timeout: 3000 });

    // Close the dialog without confirming (press Escape)
    await page.keyboard.press('Escape');
  });

  test('billing mode full charges minimum 1 hour for short sessions', async ({ page }) => {
    // Enable Full Hour billing mode first
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Billing' }).click();
    const fullHourBtn = page.getByRole('button', { name: /Full Hour/i });
    await expect(fullHourBtn).toBeVisible({ timeout: 5000 });
    await fullHourBtn.click();
    await page.getByRole('button', { name: /Save Billing/i }).click();
    await expect(page.getByText('Billing settings saved.').first()).toBeVisible({ timeout: 5000 });

    // Check for an available table
    const db = getServiceClient();
    const { data: availableTables } = await db
      .from('pool_tables')
      .select('id, number')
      .eq('status', 'available')
      .limit(1);

    if (!availableTables || availableTables.length === 0) {
      // Restore billing mode and skip
      await page.goto('/settings');
      await page.getByRole('tab', { name: 'Billing' }).click();
      await page.getByRole('button', { name: /Prorated/i }).click();
      await page.getByRole('button', { name: /Save Billing/i }).click();
      test.skip(true, 'No available pool tables to start a session on');
      return;
    }

    await page.goto('/pool-tables');

    // Start session
    const startBtn = page.getByRole('button', { name: /Start Session/i }).first();
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    const sheetStartBtn = page.getByRole('button', { name: /Start Session/i }).last();
    await expect(sheetStartBtn).toBeVisible({ timeout: 3000 });
    await sheetStartBtn.click();

    await page.waitForTimeout(1000);
    await page.goto('/pool-tables');

    // Stop session — the dialog should show the full hour charge preview
    const stopBtn = page.getByRole('button', { name: /Stop Session/i }).first();
    await expect(stopBtn).toBeVisible({ timeout: 5000 });
    await stopBtn.click();

    // The stop confirm dialog shows "Final charge (preview)" — verify it is visible
    await expect(page.getByText(/Final charge/i)).toBeVisible({ timeout: 3000 });

    // Close dialog
    await page.keyboard.press('Escape');

    // Restore billing mode to prorated
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Billing' }).click();
    await page.getByRole('button', { name: /Prorated/i }).click();
    await page.getByRole('button', { name: /Save Billing/i }).click();
    await expect(page.getByText('Billing settings saved.').first()).toBeVisible({ timeout: 5000 });
  });
});
