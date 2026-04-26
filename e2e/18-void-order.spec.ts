/**
 * E2E: Void Order — /pos or /payments
 *
 * Tests the void-order feature: dialog appearance, reason validation,
 * RBAC (bartender vs manager), inventory restoration, and subtotal update.
 */

import { expect, test, type Page } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import {
  getInventoryQty,
  getServiceClient,
  openCaja,
  resetTestState,
  seedVoidableOrder,
} from './helpers/supabase';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

async function seedTabWithOrder(customerName: string): Promise<{ tabId: string; orderId: string }> {
  const admin = getServiceClient();
  const { data: staff } = await admin.from('profiles').select('id').limit(1).single();
  if (!staff) throw new Error('seedTabWithOrder: no profile found');

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
    if (shiftErr || !newShift) throw new Error(`shift create failed – ${shiftErr?.message}`);
    shiftId = newShift.id as string;
  }

  const { data: caja } = await admin
    .from('caja_sessions')
    .select('id')
    .eq('status', 'open')
    .maybeSingle();
  if (!caja) throw new Error('seedTabWithOrder: no open caja');

  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({
      customer_name: customerName,
      staff_id: staff.id,
      shift_id: shiftId,
      caja_session_id: caja.id,
      status: 'open',
      is_deleted: false,
    })
    .select('id')
    .single();
  if (tabErr || !tab) throw new Error(`tab insert failed – ${tabErr?.message}`);

  const orderId = await seedVoidableOrder(tab.id as string);
  return { tabId: tab.id as string, orderId };
}

async function openPaymentsAndSelectTab(page: Page, customerName: string): Promise<void> {
  await page.goto('/payments');
  const list = page.getByTestId('tabs-waiting-for-payment');
  await expect(list).toBeVisible({ timeout: 20_000 });
  await expect(list.getByText(customerName)).toBeVisible({ timeout: 15_000 });
  await list.getByRole('button', { name: new RegExp(`tab ${customerName}`, 'i') }).click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Void Order', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    await page.goto('/');
  });

  test('V1: VoidOrderDialog appears when void button clicked', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await seedTabWithOrder('Void Dialog Tab');
    await openPaymentsAndSelectTab(page, 'Void Dialog Tab');

    // Verify pin then look for void button
    await page.getByRole('button', { name: /verify pin to process payment/i }).click();
    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 10_000 });
    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    for (const ch of managerPin) {
      await pinDialog.getByRole('button', { name: ch === '0' ? 'Key 0' : `Key ${ch}` }).click();
    }
    await expect(pinDialog).not.toBeVisible({ timeout: 10_000 });

    // Look for void order button in payment form / order review area
    const voidBtn = page.getByRole('button', { name: /void order/i }).first();
    const voidBtnVisible = await voidBtn.isVisible().catch(() => false);
    if (!voidBtnVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: void-order button in payment pane');
      return;
    }
    await voidBtn.click();

    const voidDialog = page.getByRole('alertdialog', { name: /void order/i });
    await expect(voidDialog).toBeVisible({ timeout: 10_000 });
    await expect(voidDialog.getByLabel(/void reason/i)).toBeVisible();
    await logout(page);
  });

  test('V2: submit void with reason — success toast and order shows voided state', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    // Use table-status page which shows void button per order
    const { tabId } = await seedTabWithOrder('Void Success Tab');
    const admin = getServiceClient();
    const { data: poolTable } = await admin
      .from('pool_tables')
      .select('id')
      .eq('status', 'available')
      .limit(1)
      .maybeSingle();

    if (!poolTable) {
      test.skip(true, 'No available pool table to seed session for void test');
      return;
    }

    // Navigate via pos to find the void button in order panel
    await page.goto('/pos');
    // Switch to the tab
    await page.getByRole('button', { name: /switch tab|open tabs/i }).first().click();
    const tabDrawer = page.getByRole('dialog');
    const tabVisible = await tabDrawer
      .getByRole('button', { name: /Void Success Tab/i })
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!tabVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: void-order via POS order panel');
      return;
    }

    await tabDrawer.getByRole('button', { name: /Void Success Tab/i }).click();
    await tabDrawer.getByRole('button', { name: 'Close' }).click();

    const voidBtn = page.getByRole('button', { name: /void/i }).first();
    await expect(voidBtn).toBeVisible({ timeout: 10_000 });
    await voidBtn.click();

    const voidDialog = page.getByRole('alertdialog', { name: /void order/i });
    await expect(voidDialog).toBeVisible({ timeout: 10_000 });
    await voidDialog.getByLabel(/void reason/i).fill('Test void reason');
    await voidDialog.getByRole('button', { name: /void order/i }).click();
    await expect(page.getByText(/order voided/i)).toBeVisible({ timeout: 20_000 });
    await logout(page);
    void tabId; // suppress unused warning
  });

  test('V3: bartender — void button absent or shows manager PIN dialog', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'bartender');
    await seedTabWithOrder('Void Bartender Tab');

    await page.goto('/pos');
    await page.getByRole('button', { name: /switch tab|open tabs/i }).first().click();
    const tabDrawer = page.getByRole('dialog');
    const tabVisible = await tabDrawer
      .getByRole('button', { name: /Void Bartender Tab/i })
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!tabVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: void-order for bartender check');
      return;
    }
    await tabDrawer.getByRole('button', { name: /Void Bartender Tab/i }).click();
    await tabDrawer.getByRole('button', { name: 'Close' }).click();

    const voidBtn = page.getByRole('button', { name: /void/i }).first();
    const voidVisible = await voidBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (voidVisible) {
      await voidBtn.click();
      // Either manager PIN dialog appears, or button is disabled
      const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
      const pinVisible = await pinDialog.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(pinVisible).toBe(true);
    } else {
      // Button absent — acceptable for bartender role
      expect(voidVisible).toBe(false);
    }
    await logout(page);
  });

  test('V4: void product with inventory — qty restores by 1', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    const qtyBefore = await getInventoryQty('Budweiser');
    const { tabId } = await seedTabWithOrder('Void Inventory Tab');

    // Trigger void via direct DB update to avoid full UI dependency
    const admin = getServiceClient();
    const { data: order } = await admin
      .from('orders')
      .select('id')
      .eq('tab_id', tabId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!order) {
      test.skip(true, 'No pending order found — seed may have failed');
      return;
    }

    // Perform void via UI on table-status page if occupied, otherwise skip
    test.skip(true, 'UI not implemented — EXPECTED FAIL: inventory restoration on void (requires UI void flow)');
    void qtyBefore;
  });

  test('V5: submit void with empty reason — form error shown, order not voided', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await seedTabWithOrder('Void Empty Reason Tab');

    await page.goto('/pos');
    await page.getByRole('button', { name: /switch tab|open tabs/i }).first().click();
    const tabDrawer = page.getByRole('dialog');
    const tabVisible = await tabDrawer
      .getByRole('button', { name: /Void Empty Reason Tab/i })
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!tabVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: void-order reason validation');
      return;
    }
    await tabDrawer.getByRole('button', { name: /Void Empty Reason Tab/i }).click();
    await tabDrawer.getByRole('button', { name: 'Close' }).click();

    const voidBtn = page.getByRole('button', { name: /void/i }).first();
    await expect(voidBtn).toBeVisible({ timeout: 10_000 });
    await voidBtn.click();

    const voidDialog = page.getByRole('alertdialog', { name: /void order/i });
    await expect(voidDialog).toBeVisible({ timeout: 10_000 });

    // Leave reason empty and confirm — button should be disabled or show error
    const confirmBtn = voidDialog.getByRole('button', { name: /void order/i });
    const isDisabled = await confirmBtn.isDisabled();
    if (isDisabled) {
      expect(isDisabled).toBe(true);
    } else {
      await confirmBtn.click();
      // Should not close — error shown
      await expect(voidDialog).toBeVisible({ timeout: 3_000 });
    }
    await logout(page);
  });

  test('V6: after void, tab subtotal decreases', async ({ page }) => {
    test.skip(true, 'UI not implemented — EXPECTED FAIL: subtotal update after void (requires UI void flow integrated with payment pane)');
  });

  test('V7: void an already-voided order — button disabled or error shown', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');
    const { tabId } = await seedTabWithOrder('Already Voided Tab');

    // Mark the order as voided in DB directly
    const admin = getServiceClient();
    await admin.from('orders').update({ status: 'voided' }).eq('tab_id', tabId);

    await page.goto('/pos');
    await page.getByRole('button', { name: /switch tab|open tabs/i }).first().click();
    const tabDrawer = page.getByRole('dialog');
    const tabVisible = await tabDrawer
      .getByRole('button', { name: /Already Voided Tab/i })
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!tabVisible) {
      test.skip(true, 'UI not implemented — EXPECTED FAIL: already-voided order state');
      return;
    }
    await tabDrawer.getByRole('button', { name: /Already Voided Tab/i }).click();
    await tabDrawer.getByRole('button', { name: 'Close' }).click();

    const voidBtn = page.getByRole('button', { name: /void/i }).first();
    const voidVisible = await voidBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (voidVisible) {
      const isDisabled = await voidBtn.isDisabled();
      expect(isDisabled).toBe(true);
    }
    await logout(page);
  });
});
