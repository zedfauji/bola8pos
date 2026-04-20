/**
 * E2E: Payment Pane — /payments
 *
 * Tests the dedicated cashier station for processing open-tab payments.
 * Covers navigation paths, tab listing, pool-session warnings,
 * PIN gate (bartender + manager), cash payment completion, and item grouping.
 *
 * Dependencies tested in production:
 *   - src/widgets/PaymentPane/ui/PaymentPane.tsx
 *   - src/widgets/PaymentPane/ui/TabPaymentList.tsx
 *   - src/widgets/PaymentPane/ui/TabPaymentCard.tsx
 *   - src/features/manager-pin-gate/ui/ManagerPinDialog.tsx
 *   - src/widgets/PaymentModal/ui/PaymentForm.tsx
 *   - src/widgets/AppNav/ui/AppNav.tsx
 *   - src/widgets/HomeDashboard/ui/HomeDashboard.tsx
 */

import { expect, test, type Page } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import {
  getServiceClient,
  openCaja,
  resetTestState,
} from './helpers/supabase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function enterPin(page: Page, pin: string): Promise<void> {
  for (const ch of pin) {
    const label = ch === '0' ? 'Key 0' : `Key ${ch}`;
    await page.getByRole('button', { name: label }).click();
  }
}

/** Navigate to /payments from the Home dashboard big-box grid. */
async function goToPaymentsViaHome(page: Page): Promise<void> {
  await page.goto('/home');
  await page.getByRole('button', { name: 'Payments' }).click();
  await expect(page).toHaveURL(/\/payments/, { timeout: 15_000 });
}

/**
 * Create a tab with one item via the service client (bypasses UI, much faster).
 * Returns the tab id.
 */
async function seedOpenTab(customerName: string): Promise<string> {
  const admin = getServiceClient();

  // Resolve shift id for the manager
  const { data: shift } = await admin
    .from('shifts')
    .select('id, profile_id')
    .is('clock_out', null)
    .limit(1)
    .maybeSingle();

  if (!shift) throw new Error('seedOpenTab: no open shift found — run openCaja first');

  // Resolve caja session
  const { data: caja } = await admin
    .from('caja_sessions')
    .select('id')
    .eq('status', 'open')
    .maybeSingle();

  if (!caja) throw new Error('seedOpenTab: no open caja session — run openCaja first');

  // Insert tab
  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({
      customer_name: customerName,
      staff_id: shift.profile_id,
      shift_id: shift.id,
      caja_session_id: caja.id,
      status: 'open',
    })
    .select('id')
    .single();

  if (tabErr || !tab) throw new Error(`seedOpenTab failed: ${tabErr?.message ?? 'no row'}`);

  // Add one item — find Budweiser
  const { data: bud } = await admin
    .from('products')
    .select('id, base_price')
    .eq('name', 'Budweiser')
    .maybeSingle();

  if (bud) {
    const { data: order } = await admin
      .from('orders')
      .insert({
        tab_id: tab.id,
        staff_id: shift.profile_id,
        status: 'delivered',
      })
      .select('id')
      .single();

    if (order) {
      await admin.from('order_items').insert({
        order_id: order.id,
        product_id: bud.id,
        quantity: 1,
        unit_price: bud.base_price,
        modifier_price_delta: 0,
      });
    }
  }

  return tab.id as string;
}

/** Seed a tab with two identical items (same product) to verify grouping. */
async function seedTabWithDuplicateItems(customerName: string): Promise<string> {
  const admin = getServiceClient();

  const { data: shift } = await admin
    .from('shifts')
    .select('id, profile_id')
    .is('clock_out', null)
    .limit(1)
    .maybeSingle();

  if (!shift) throw new Error('seedTabWithDuplicateItems: no open shift');

  const { data: caja } = await admin
    .from('caja_sessions')
    .select('id')
    .eq('status', 'open')
    .maybeSingle();

  if (!caja) throw new Error('seedTabWithDuplicateItems: no open caja');

  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({
      customer_name: customerName,
      staff_id: shift.profile_id,
      shift_id: shift.id,
      caja_session_id: caja.id,
      status: 'open',
    })
    .select('id')
    .single();

  if (tabErr || !tab) throw new Error(`seedTabWithDuplicateItems failed: ${tabErr?.message ?? 'no row'}`);

  const { data: beer } = await admin
    .from('products')
    .select('id, base_price')
    .eq('name', 'Budweiser')
    .maybeSingle();

  if (beer) {
    const { data: order } = await admin
      .from('orders')
      .insert({
        tab_id: tab.id,
        staff_id: shift.profile_id,
        status: 'delivered',
      })
      .select('id')
      .single();

    if (order) {
      // Two separate order_items rows for the same product
      await admin.from('order_items').insert([
        {
          order_id: order.id,
          product_id: beer.id,
          quantity: 1,
          unit_price: beer.base_price,
          modifier_price_delta: 0,
        },
        {
          order_id: order.id,
          product_id: beer.id,
          quantity: 1,
          unit_price: beer.base_price,
          modifier_price_delta: 0,
        },
      ]);
    }
  }

  return tab.id as string;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Payment Pane', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    await page.goto('/');
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  test('T1: navigate to /payments from HomeDashboard big-box button', async ({ page }) => {
    await loginAs(page, 'manager');
    await goToPaymentsViaHome(page);
    await expect(page.getByText(/tabs awaiting payment/i)).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('T2: navigate to /payments from AppNav sidebar link', async ({ page }) => {
    await loginAs(page, 'manager');
    // Desktop sidebar: AppNav renders a Link/Button with label "Payments"
    await page.getByRole('button', { name: 'Payments' }).click();
    await expect(page).toHaveURL(/\/payments/, { timeout: 15_000 });
    await expect(page.getByText(/tabs awaiting payment/i)).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  // ── Left panel — tab listing ───────────────────────────────────────────────

  test('T3: left panel lists open tabs', async ({ page }) => {
    await seedOpenTab('Pane List Test');
    await loginAs(page, 'manager');
    await goToPaymentsViaHome(page);

    const list = page.getByLabel('tabs waiting for payment');
    await expect(list).toBeVisible({ timeout: 20_000 });
    await expect(list.getByText('Pane List Test')).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('T4: pool table tab shows Pool badge in the card', async ({ page }) => {
    const admin = getServiceClient();
    const tabId = await seedOpenTab('Pool Badge Test');

    // Attach the tab to an available pool table (via direct DB update to simulate active session)
    const { data: poolTable } = await admin
      .from('pool_tables')
      .select('id, number')
      .eq('status', 'available')
      .limit(1)
      .maybeSingle();

    if (poolTable) {
      // Create a pool session
      const { data: session } = await admin
        .from('pool_sessions')
        .insert({
          table_id: poolTable.id,
          tab_id: tabId,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (session) {
        await admin
          .from('pool_tables')
          .update({ status: 'occupied', current_session_id: session.id })
          .eq('id', poolTable.id);
      }
    }

    await loginAs(page, 'manager');
    await goToPaymentsViaHome(page);

    const list = page.getByLabel('tabs waiting for payment');
    await expect(list).toBeVisible({ timeout: 20_000 });
    const card = list.getByRole('button', { name: /tab Pool Badge Test/i });
    await expect(card).toBeVisible({ timeout: 15_000 });

    if (poolTable) {
      // Either shows Pool #N badge or Timer Running badge (session is running)
      const hasBadge =
        (await card.getByText(/pool #/i).count()) > 0 ||
        (await card.getByText(/timer running/i).count()) > 0;
      expect(hasBadge).toBe(true);
    }
    await logout(page);
  });

  // ── Right panel — PIN gate ─────────────────────────────────────────────────

  test('T5: selecting a tab shows PIN prompt on right panel', async ({ page }) => {
    await seedOpenTab('PIN Prompt Test');
    await loginAs(page, 'manager');
    await goToPaymentsViaHome(page);

    const list = page.getByLabel('tabs waiting for payment');
    await expect(list.getByText('PIN Prompt Test')).toBeVisible({ timeout: 20_000 });
    await list.getByRole('button', { name: /tab PIN Prompt Test/i }).click();

    await expect(
      page.getByRole('button', { name: /verify pin to process payment/i })
    ).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  test('T6: entering wrong PIN shows error inside the dialog', async ({ page }) => {
    await seedOpenTab('Wrong PIN Test');
    await loginAs(page, 'manager');
    await goToPaymentsViaHome(page);

    const list = page.getByLabel('tabs waiting for payment');
    await expect(list.getByText('Wrong PIN Test')).toBeVisible({ timeout: 20_000 });
    await list.getByRole('button', { name: /tab Wrong PIN Test/i }).click();
    await page.getByRole('button', { name: /verify pin to process payment/i }).click();

    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 10_000 });

    // Enter 6-digit wrong PIN
    await enterPin(page, '000000');
    await expect(pinDialog.getByText(/incorrect pin/i)).toBeVisible({ timeout: 5_000 });
    await logout(page);
  });

  test('T7: correct manager PIN unlocks PaymentForm', async ({ page }) => {
    await seedOpenTab('Manager PIN Test');
    await loginAs(page, 'manager');
    await goToPaymentsViaHome(page);

    const list = page.getByLabel('tabs waiting for payment');
    await expect(list.getByText('Manager PIN Test')).toBeVisible({ timeout: 20_000 });
    await list.getByRole('button', { name: /tab Manager PIN Test/i }).click();
    await page.getByRole('button', { name: /verify pin to process payment/i }).click();

    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 10_000 });

    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    await enterPin(page, managerPin);

    // Dialog closes, PaymentForm appears
    await expect(pinDialog).not.toBeVisible({ timeout: 10_000 });
    // PaymentForm shows the customer name in its header
    await expect(page.getByRole('heading', { name: 'Manager PIN Test' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('payment-btn-cash')).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  test('T8: correct bartender PIN also unlocks PaymentForm (RBAC: bartender has close_tab)', async ({ page }) => {
    await seedOpenTab('Bartender PIN Test');
    await loginAs(page, 'bartender');
    await goToPaymentsViaHome(page);

    const list = page.getByLabel('tabs waiting for payment');
    await expect(list.getByText('Bartender PIN Test')).toBeVisible({ timeout: 20_000 });
    await list.getByRole('button', { name: /tab Bartender PIN Test/i }).click();
    await page.getByRole('button', { name: /verify pin to process payment/i }).click();

    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 10_000 });

    // Bartender PIN is accepted because close_tab is in their action set
    const bartenderPin = process.env['E2E_BARTENDER_PIN'] ?? '';
    await enterPin(page, bartenderPin);

    await expect(pinDialog).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('payment-btn-cash')).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  // ── Cash payment completes ─────────────────────────────────────────────────

  test('T9: cash payment completes — tab removed from list, receipt shown', async ({ page }) => {
    await seedOpenTab('Cash Pay Pane Test');
    await loginAs(page, 'manager');
    await goToPaymentsViaHome(page);

    const list = page.getByLabel('tabs waiting for payment');
    await expect(list.getByText('Cash Pay Pane Test')).toBeVisible({ timeout: 20_000 });
    await list.getByRole('button', { name: /tab Cash Pay Pane Test/i }).click();
    await page.getByRole('button', { name: /verify pin to process payment/i }).click();

    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 10_000 });
    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    await enterPin(page, managerPin);
    await expect(pinDialog).not.toBeVisible({ timeout: 10_000 });

    // PaymentForm is active — fill in cash
    await expect(page.getByTestId('payment-btn-cash')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('payment-btn-cash').click();
    await page.getByLabel(/amount tendered/i).fill('500');
    await page.getByRole('button', { name: /process payment/i }).click();

    // Receipt step appears
    await expect(page.getByRole('heading', { name: 'Receipt' })).toBeVisible({ timeout: 90_000 });

    // Click Done — selection resets, tab removed from list
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(
      page.getByText(/select a tab from the list to process payment/i)
    ).toBeVisible({ timeout: 10_000 });

    // The paid tab should no longer appear in the list
    await expect(list.getByText('Cash Pay Pane Test')).not.toBeVisible({ timeout: 5_000 });
    await logout(page);
  });

  // ── Back button ───────────────────────────────────────────────────────────

  test('T10: back button in right panel header clears selected tab', async ({ page }) => {
    await seedOpenTab('Back Button Test');
    await loginAs(page, 'manager');
    await goToPaymentsViaHome(page);

    const list = page.getByLabel('tabs waiting for payment');
    await expect(list.getByText('Back Button Test')).toBeVisible({ timeout: 20_000 });
    await list.getByRole('button', { name: /tab Back Button Test/i }).click();
    await expect(
      page.getByRole('button', { name: /verify pin to process payment/i })
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /back to tab list/i }).click();

    await expect(
      page.getByText(/select a tab from the list to process payment/i)
    ).toBeVisible({ timeout: 5_000 });
    await logout(page);
  });

  // ── Back-to-home navigation ───────────────────────────────────────────────

  test('T12: back button navigates from /payments to /home', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/payments');
    await page.getByRole('link', { name: /home/i }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10_000 });
    await logout(page);
  });

  // ── Item grouping ─────────────────────────────────────────────────────────

  test('T11: items with same product appear grouped (e.g. "2×" prefix) in order review', async ({ page }) => {
    await seedTabWithDuplicateItems('Group Items Test');
    await loginAs(page, 'manager');
    await goToPaymentsViaHome(page);

    const list = page.getByLabel('tabs waiting for payment');
    await expect(list.getByText('Group Items Test')).toBeVisible({ timeout: 20_000 });
    await list.getByRole('button', { name: /tab Group Items Test/i }).click();
    await page.getByRole('button', { name: /verify pin to process payment/i }).click();

    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 10_000 });
    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    await enterPin(page, managerPin);
    await expect(pinDialog).not.toBeVisible({ timeout: 10_000 });

    // PaymentForm shows order review — two Budweiser items should be merged to "2× Budweiser"
    await expect(page.getByTestId('payment-btn-cash')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/2×\s*Budweiser/i)).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });
});
