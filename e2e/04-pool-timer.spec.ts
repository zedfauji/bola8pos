import { expect, test, type Page } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getLatestStoppedPoolChargeForTab, getOpenTabIdByCustomerName, getServiceClient, openCaja, resetTestState } from './helpers/supabase';

async function openTabForCustomer(page: Page, customerName: string) {
  await page.goto('/pos');
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

    // Timer is displayed as a font-mono span inside the occupied table illustration
    const timer = page.locator('span.font-mono').first();
    await expect(timer).toBeVisible({ timeout: 20_000 });
    await expect(timer).not.toHaveText('00:00', { timeout: 20_000 });
    await logout(page);
  });

  test('Timer ticks', async ({ page }) => {
    await loginAs(page, 'manager');
    await openTabForCustomer(page, 'Pool Timer Tick');
    await startFirstPoolSession(page, 'Pool Timer Tick');

    // Timer is displayed as a font-mono span inside the occupied table illustration
    const timer = page.locator('span.font-mono').first();
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

  test('Start session auto-creates a New Tab', async ({ page }) => {
    // beforeEach already calls resetTestState + openCaja + goto('/')
    await loginAs(page, 'manager');
    await page.goto('/pool-tables');
    // click Start Session on first available table
    await page.getByRole('button', { name: 'Start Session' }).first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    // default dropdown value should be __new_tab__
    await expect(sheet.locator('#pool-start-tab')).toHaveValue('__new_tab__');
    // start session with auto-create
    await sheet.getByRole('button', { name: /start session/i }).click();
    await expect(page.getByText(/pool session started/i)).toBeVisible({ timeout: 20_000 });
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

  test('T8: maintenance table — Start Session button absent or disabled', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    // Set a table to maintenance status directly
    const admin = getServiceClient();
    const { data: table } = await admin
      .from('pool_tables')
      .select('id, number')
      .eq('status', 'available')
      .limit(1)
      .maybeSingle();

    if (!table) {
      test.skip(true, 'No available table to set to maintenance');
      return;
    }

    await admin.from('pool_tables').update({ status: 'maintenance' }).eq('id', table.id);

    await page.goto('/pool-tables');
    // The maintenance card should not show a Start Session button
    const maintenanceCard = page.locator('[data-testid="pool-table-card"]').filter({
      hasText: new RegExp(`Table ${String(table.number)}`, 'i'),
    });
    const cardVisible = await maintenanceCard.isVisible({ timeout: 15_000 }).catch(() => false);

    if (cardVisible) {
      const startBtn = maintenanceCard.getByRole('button', { name: 'Start Session' });
      const startVisible = await startBtn.isVisible({ timeout: 3_000 }).catch(() => false);
      if (startVisible) {
        await expect(startBtn).toBeDisabled();
      } else {
        // Button absent — acceptable
        expect(startVisible).toBe(false);
      }
    }

    // Restore table to available
    await admin.from('pool_tables').update({ status: 'available' }).eq('id', table.id);
    await logout(page);
  });

  test('T9: reserved table — card shows Reserved badge or label', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    const admin = getServiceClient();
    const { data: table } = await admin
      .from('pool_tables')
      .select('id, number')
      .eq('status', 'available')
      .limit(1)
      .maybeSingle();

    if (!table) {
      test.skip(true, 'No available table to set to reserved');
      return;
    }

    await admin.from('pool_tables').update({ status: 'reserved' }).eq('id', table.id);
    await page.goto('/pool-tables');

    // Card should show "Reserved" text or badge
    const reservedText = page.getByText(/reserved/i).first();
    await expect(reservedText).toBeVisible({ timeout: 15_000 });

    // Restore
    await admin.from('pool_tables').update({ status: 'available' }).eq('id', table.id);
    await logout(page);
  });

  test('T10: Start Session dialog shows rate as dollar amount pattern', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    await page.goto('/pool-tables');
    await page.getByRole('button', { name: 'Start Session' }).first().click();

    const sheet = page.getByRole('dialog', { name: /start pool session/i });
    await expect(sheet).toBeVisible({ timeout: 15_000 });

    // Rate should display as $X or $X.XX per hr/hour
    const rateText = sheet.getByText(/\$\d+(\.\d{2})?\s*\/\s*(hr|hour)/i);
    await expect(rateText).toBeVisible({ timeout: 5_000 });
    await logout(page);
  });

  test('T11: carom table billed at its own rate (not global default)', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    const admin = getServiceClient();

    // Find an available table to use as a carom table
    const { data: table } = await admin
      .from('pool_tables')
      .select('id, number, table_type, rate_per_hour')
      .eq('status', 'available')
      .limit(1)
      .maybeSingle();

    if (!table) {
      test.skip(true, 'No available table found for carom rate test');
      return;
    }

    const originalType = table.table_type;
    const originalRate = table.rate_per_hour;

    // Set table to carom type with $80/hr rate
    await admin
      .from('pool_tables')
      .update({ table_type: 'carom', rate_per_hour: 80 })
      .eq('id', table.id);

    try {
      // Find a staff member and shift for tab creation
      const { data: staff } = await admin.from('profiles').select('id').limit(1).single();
      if (!staff) {
        test.skip(true, 'No staff profile found');
        return;
      }

      let shiftId: string;
      const { data: existingShift } = await admin
        .from('shifts')
        .select('id')
        .eq('staff_id', staff.id)
        .is('clock_out', null)
        .limit(1)
        .maybeSingle();
      if (existingShift) {
        shiftId = existingShift.id as string;
      } else {
        const { data: newShift, error: shiftErr } = await admin
          .from('shifts')
          .insert({ staff_id: staff.id, opening_cash: 0 })
          .select('id')
          .single();
        if (shiftErr || !newShift) throw new Error(`T11: shift create failed – ${shiftErr?.message}`);
        shiftId = newShift.id as string;
      }

      // Create a tab
      const { data: tab, error: tabErr } = await admin
        .from('tabs')
        .insert({ customer_name: 'T11 Carom Rate', status: 'open', staff_id: staff.id, shift_id: shiftId, is_deleted: false })
        .select('id')
        .single();
      if (tabErr || !tab) throw new Error(`T11: tab insert failed – ${tabErr?.message}`);

      // Create a session started ~31 minutes ago
      // prorated: ceil(31/15)*15 = 45 billedMinutes; 45/60 * $80 = $60.00
      const startedAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
      const { data: session, error: sessErr } = await admin
        .from('pool_sessions')
        .insert({ table_id: table.id, tab_id: tab.id, started_at: startedAt, billed_minutes: null, total_charge: null, stopped_at: null })
        .select('id')
        .single();
      if (sessErr || !session) throw new Error(`T11: session insert failed – ${sessErr?.message}`);

      await admin
        .from('pool_tables')
        .update({ status: 'occupied', current_session_id: session.id })
        .eq('id', table.id);

      // Navigate to the table status page and wait for session data to load
      await page.goto(`/pool-tables/${table.id}`);
      // Wait for the timer display to confirm session data has loaded
      await expect(page.locator('span.font-mono').first()).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Stop Timer' }).click({ timeout: 15_000 });

      const dialog = page.getByRole('alertdialog', { name: /stop pool session/i });
      await expect(dialog).toBeVisible({ timeout: 15_000 });

      // 45 billedMinutes × $80/hr = $60.00
      await expect(dialog.locator('[aria-label*="60.00 dollars"]')).toBeVisible({ timeout: 5_000 });

      // Cancel — don't stop the session
      await dialog.getByRole('button', { name: 'Cancel' }).click();
    } finally {
      // Always restore original table settings to avoid polluting subsequent tests
      await admin
        .from('pool_tables')
        .update({ status: 'available', current_session_id: null, table_type: originalType, rate_per_hour: originalRate })
        .eq('id', table.id);
    }

    await logout(page);
  });

  test('T12: firstHourMode=full charges full hour for sub-60-min session', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    const admin = getServiceClient();

    // Read current billing settings to restore later
    const { data: existingBilling } = await admin
      .from('settings')
      .select('value')
      .eq('key', 'billing')
      .maybeSingle();
    const originalBillingValue = existingBilling?.value ?? null;

    // Build new billing value with firstHourMode='full'
    const baseBilling =
      originalBillingValue && typeof originalBillingValue === 'object'
        ? { ...(originalBillingValue as Record<string, unknown>) }
        : { taxRatePercent: 16, defaultTipPercentages: [10, 15, 18, 20], paymentMethods: { cash: true, bbvaCard: true, rappi: true } };
    const fullModeBilling = { ...baseBilling, firstHourMode: 'full' };

    await admin
      .from('settings')
      .upsert({ key: 'billing', value: fullModeBilling }, { onConflict: 'key' });

    // Find an available table at $60/hr
    const { data: table } = await admin
      .from('pool_tables')
      .select('id, number, rate_per_hour')
      .eq('status', 'available')
      .limit(1)
      .maybeSingle();

    if (!table) {
      await admin.from('settings').upsert({ key: 'billing', value: { ...baseBilling, firstHourMode: 'prorated' } }, { onConflict: 'key' });
      test.skip(true, 'No available table found for T12');
      return;
    }

    // Set rate to $60/hr for predictable assertions
    const originalRate = table.rate_per_hour;
    await admin.from('pool_tables').update({ rate_per_hour: 60 }).eq('id', table.id);

    try {
      // Find a staff member and shift
      const { data: staff } = await admin.from('profiles').select('id').limit(1).single();
      if (!staff) {
        test.skip(true, 'No staff profile found');
        return;
      }

      let shiftId: string;
      const { data: existingShift } = await admin
        .from('shifts')
        .select('id')
        .eq('staff_id', staff.id)
        .is('clock_out', null)
        .limit(1)
        .maybeSingle();
      if (existingShift) {
        shiftId = existingShift.id as string;
      } else {
        const { data: newShift, error: shiftErr } = await admin
          .from('shifts')
          .insert({ staff_id: staff.id, opening_cash: 0 })
          .select('id')
          .single();
        if (shiftErr || !newShift) throw new Error(`T12: shift create failed – ${shiftErr?.message}`);
        shiftId = newShift.id as string;
      }

      // Create a tab
      const { data: tab, error: tabErr } = await admin
        .from('tabs')
        .insert({ customer_name: 'T12 Full Hour', status: 'open', staff_id: staff.id, shift_id: shiftId, is_deleted: false })
        .select('id')
        .single();
      if (tabErr || !tab) throw new Error(`T12: tab insert failed – ${tabErr?.message}`);

      // Session started ~25 minutes ago; full mode → 60 min charge → 60/60 * $60 = $60.00
      const startedAt = new Date(Date.now() - 25 * 60 * 1000).toISOString();
      const { data: session, error: sessErr } = await admin
        .from('pool_sessions')
        .insert({ table_id: table.id, tab_id: tab.id, started_at: startedAt, billed_minutes: null, total_charge: null, stopped_at: null })
        .select('id')
        .single();
      if (sessErr || !session) throw new Error(`T12: session insert failed – ${sessErr?.message}`);

      await admin
        .from('pool_tables')
        .update({ status: 'occupied', current_session_id: session.id })
        .eq('id', table.id);

      await page.goto(`/pool-tables/${table.id}`);
      // Wait for session to be visible before clicking Stop Timer
      await expect(page.locator('span.font-mono').first()).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Stop Timer' }).click({ timeout: 15_000 });

      const dialog = page.getByRole('alertdialog', { name: /stop pool session/i });
      await expect(dialog).toBeVisible({ timeout: 15_000 });

      // full mode: 25 min < 60 min → billedMinutes=60 → $60.00
      await expect(dialog.locator('[aria-label*="60.00 dollars"]')).toBeVisible({ timeout: 5_000 });

      await dialog.getByRole('button', { name: 'Cancel' }).click();
    } finally {
      // Always restore settings and table even if test assertions fail
      const restoredBilling = { ...baseBilling, firstHourMode: 'prorated' };
      await admin.from('settings').upsert({ key: 'billing', value: restoredBilling }, { onConflict: 'key' });
      await admin
        .from('pool_tables')
        .update({ status: 'available', current_session_id: null, rate_per_hour: originalRate })
        .eq('id', table.id);
    }

    await logout(page);
  });
});
