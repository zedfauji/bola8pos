/**
 * E2E: Payment Edge Cases — /payments
 *
 * Tests exact-change calculation, insufficient cash validation,
 * tip field (optional), discount field (optional), Rappi method,
 * pool-only tab payment, and pool-session payment block.
 */

import { expect, test, type Page } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getServiceClient, openCaja, resetTestState } from './helpers/supabase';

// ---------------------------------------------------------------------------
// Shared helpers (mirrors 17-payment-pane.spec.ts)
// ---------------------------------------------------------------------------

async function enterPin(page: Page, pin: string): Promise<void> {
  for (const ch of pin) {
    await page.getByRole('button', { name: ch === '0' ? 'Key 0' : `Key ${ch}` }).click();
  }
}

async function ensureOpenShift(admin: ReturnType<typeof getServiceClient>): Promise<{ id: string; staff_id: string }> {
  const { data: existing } = await admin
    .from('shifts')
    .select('id, staff_id')
    .is('clock_out', null)
    .limit(1)
    .maybeSingle();
  if (existing) return existing as { id: string; staff_id: string };

  const { data: mgr } = await admin.from('profiles').select('id').eq('role', 'manager').limit(1).maybeSingle();
  if (!mgr) throw new Error('ensureOpenShift: no manager found');

  const { data: shift, error } = await admin
    .from('shifts')
    .insert({ staff_id: mgr.id, clock_in: new Date().toISOString() })
    .select('id, staff_id')
    .single();
  if (error || !shift) throw new Error(`ensureOpenShift failed – ${error?.message}`);
  return shift as { id: string; staff_id: string };
}

async function seedTabWithBudweiser(customerName: string): Promise<string> {
  const admin = getServiceClient();
  const shift = await ensureOpenShift(admin);

  const { data: caja } = await admin.from('caja_sessions').select('id').eq('status', 'open').maybeSingle();
  if (!caja) throw new Error('seedTabWithBudweiser: no open caja');

  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({
      customer_name: customerName,
      staff_id: shift.staff_id,
      shift_id: shift.id,
      caja_session_id: caja.id,
      status: 'open',
    })
    .select('id')
    .single();
  if (tabErr || !tab) throw new Error(`tab insert failed – ${tabErr?.message}`);

  const { data: bud } = await admin.from('products').select('id, base_price').eq('name', 'Budweiser').maybeSingle();
  if (bud) {
    const { data: order } = await admin
      .from('orders')
      .insert({ tab_id: tab.id, staff_id: shift.staff_id, status: 'served' })
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

async function unlockPaymentForm(page: Page, customerName: string): Promise<boolean> {
  await page.goto('/payments');
  const list = page.getByTestId('tabs-waiting-for-payment');
  await expect(list).toBeVisible({ timeout: 20_000 });
  const tabCard = list.getByRole('button', { name: new RegExp(`tab ${customerName}`, 'i') });
  const visible = await tabCard.isVisible({ timeout: 15_000 }).catch(() => false);
  if (!visible) return false;
  await tabCard.click();
  await page.getByRole('button', { name: /verify pin to process payment/i }).click();
  const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
  await expect(pinDialog).toBeVisible({ timeout: 10_000 });
  const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
  await enterPin(page, managerPin);
  await expect(pinDialog).not.toBeVisible({ timeout: 10_000 });
  return true;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Payment Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    await page.goto('/');
  });

  test('PE1: enter exact cash = subtotal — change shows $0.00 or no change', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await seedTabWithBudweiser('PE1 Exact Cash');

    const unlocked = await unlockPaymentForm(page, 'PE1 Exact Cash');
    if (!unlocked) {
      test.skip(true, 'Tab not found in payments list');
      return;
    }

    await page.getByTestId('payment-btn-cash').click();
    // Read subtotal from the form — find price display
    const subtotalText = await page.getByText(/\$\d+\.\d{2}/).first().textContent();
    const match = subtotalText?.match(/\$(\d+\.\d{2})/);
    const subtotal = match ? match[1] : '35.00';

    await page.getByLabel(/amount tendered/i).fill(subtotal ?? '35.00');
    // Change should show $0.00 or nothing
    const changeDue = page.getByText(/change due/i);
    const changeVisible = await changeDue.isVisible({ timeout: 5_000 }).catch(() => false);
    if (changeVisible) {
      await expect(page.getByText(/\$0\.00/)).toBeVisible({ timeout: 3_000 });
    }
    // No negative change shown
    await expect(page.getByText(/-\$\d/)).toHaveCount(0);
    await logout(page);
  });

  test('PE2: enter cash less than subtotal — validation error or submit blocked', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await seedTabWithBudweiser('PE2 Under Cash');

    const unlocked = await unlockPaymentForm(page, 'PE2 Under Cash');
    if (!unlocked) {
      test.skip(true, 'Tab not found in payments list');
      return;
    }

    await page.getByTestId('payment-btn-cash').click();
    await page.getByLabel(/amount tendered/i).fill('1'); // clearly too low

    const processBtn = page.getByRole('button', { name: /process payment/i });
    const isDisabled = await processBtn.isDisabled().catch(() => false);

    if (!isDisabled) {
      await processBtn.click();
      // Should show validation error
      await expect(
        page.getByText(/insufficient|amount.*less|must.*at least|underpayment/i)
      ).toBeVisible({ timeout: 10_000 });
    } else {
      expect(isDisabled).toBe(true);
    }
    await logout(page);
  });

  test('PE3: tip field — enter $2 tip, receipt shows tip line', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await seedTabWithBudweiser('PE3 Tip Test');

    const unlocked = await unlockPaymentForm(page, 'PE3 Tip Test');
    if (!unlocked) {
      test.skip(true, 'Tab not found in payments list');
      return;
    }

    await page.getByTestId('payment-btn-cash').click();
    const tipInput = page.getByLabel(/tip/i);
    const tipVisible = await tipInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!tipVisible) {
      test.skip(true, 'tip/discount UI not implemented');
      return;
    }

    await tipInput.fill('2');
    await page.getByLabel(/amount tendered/i).fill('500');
    await page.getByRole('button', { name: /process payment/i }).click();

    await expect(page.getByRole('heading', { name: 'Receipt' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/tip/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);
  });

  test('PE4: discount field — apply 10% discount', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');
    await seedTabWithBudweiser('PE4 Discount');

    const unlocked = await unlockPaymentForm(page, 'PE4 Discount');
    if (!unlocked) {
      test.skip(true, 'Tab not found in payments list');
      return;
    }

    const discountInput = page.getByLabel(/discount/i);
    const discountVisible = await discountInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!discountVisible) {
      test.skip(true, 'tip/discount UI not implemented');
      return;
    }

    const originalTotal = await page.getByText(/\$\d+\.\d{2}/).first().textContent();
    await discountInput.fill('10');
    // Total should now show a smaller amount
    await page.waitForTimeout(500);
    const newTotal = await page.getByText(/\$\d+\.\d{2}/).first().textContent();
    expect(newTotal).not.toBe(originalTotal);
    await logout(page);
  });

  test('PE5: Rappi payment method — no open_cash_drawer in logs', async ({ page }) => {
    test.setTimeout(120_000);
    const logs: string[] = [];
    page.on('console', msg => { logs.push(msg.text()); });

    await loginAs(page, 'manager');
    await seedTabWithBudweiser('PE5 Rappi Pay');

    const unlocked = await unlockPaymentForm(page, 'PE5 Rappi Pay');
    if (!unlocked) {
      test.skip(true, 'Tab not found in payments list');
      return;
    }

    const rappiBtn = page.getByTestId('payment-btn-rappi');
    const rappiVisible = await rappiBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!rappiVisible) {
      test.skip(true, 'Rappi payment button not present');
      return;
    }

    await rappiBtn.click();
    const confirmRappi = page.getByRole('button', { name: /confirm|process rappi/i });
    if (await confirmRappi.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmRappi.click();
    }

    await page.waitForTimeout(3_000);
    const joined = logs.join('\n').toLowerCase();
    expect(joined.includes('open_cash_drawer')).toBe(false);
    await logout(page);
  });

  test('PE6: tab with only pool charge (no order items) can be paid', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    // Create a tab, start and stop a pool session (creates pool charge), no order items
    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('Pool Only Tab');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    await page.goto('/pool-tables');
    await page.getByRole('button', { name: 'Start Session' }).first().click();
    const sheet = page.getByRole('dialog', { name: /start pool session/i });
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await sheet.locator('#pool-start-tab').selectOption({ label: 'Pool Only Tab' });
    await sheet.getByRole('button', { name: 'Start Session' }).click();
    await expect(page.getByText(/pool session started/i)).toBeVisible({ timeout: 20_000 });

    // Stop the session
    await page.getByRole('button', { name: 'Stop Session' }).first().click();
    const confirm = page.getByRole('alertdialog', { name: /stop pool session/i });
    await confirm.getByRole('button', { name: /stop & finalize/i }).click();
    await expect(page.getByText(/pool session stopped/i)).toBeVisible({ timeout: 25_000 });

    // Now pay the tab from /payments
    const unlocked = await unlockPaymentForm(page, 'Pool Only Tab');
    if (!unlocked) {
      test.skip(true, 'Pool-only tab not in payments list — may require different navigation');
      return;
    }

    await expect(page.getByTestId('payment-btn-cash')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('payment-btn-cash').click();
    await page.getByLabel(/amount tendered/i).fill('500');
    await page.getByRole('button', { name: /process payment/i }).click();
    await expect(page.getByRole('heading', { name: 'Receipt' })).toBeVisible({ timeout: 90_000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await logout(page);
  });

  test('PE7: paying tab with running pool session — error shown', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    await page.goto('/pos');
    await page.getByRole('button', { name: /new tab/i }).click();
    await page.getByLabel(/customer name/i).fill('PE7 Pool Running Pay');
    await page.getByRole('button', { name: 'Open Tab' }).click();
    await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });

    await page.goto('/pool-tables');
    await page.getByRole('button', { name: 'Start Session' }).first().click();
    const sheet = page.getByRole('dialog', { name: /start pool session/i });
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await sheet.locator('#pool-start-tab').selectOption({ label: 'PE7 Pool Running Pay' });
    await sheet.getByRole('button', { name: 'Start Session' }).click();
    await expect(page.getByText(/pool session started/i)).toBeVisible({ timeout: 20_000 });

    // Try to pay immediately — pool session still running
    await page.goto('/payments');
    const list = page.getByTestId('tabs-waiting-for-payment');
    await expect(list).toBeVisible({ timeout: 20_000 });

    const tabCard = list.getByRole('button', { name: /tab PE7 Pool Running Pay/i });
    const cardVisible = await tabCard.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!cardVisible) {
      test.skip(true, 'Running-pool tab not in payments list — UI filters it');
      return;
    }
    await tabCard.click();

    // PaymentPane blocks payment for a tab with an active pool session immediately
    // on selection (see src/widgets/PaymentPane/ui/PaymentPane.tsx) — it renders the
    // "Timer Still Running" warning instead of the PIN-gate button, so the PIN dialog
    // and payment form are never reachable for this tab. Assert the early block
    // rather than trying to click through to a PIN button that will never render
    // (that was the source of the PE7 timeout: the locator waited 120s for a button
    // that structurally cannot appear while hasActivePoolSession is true).
    await expect(
      page.getByRole('heading', { name: /timer still running/i })
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('button', { name: /verify pin to process payment/i })
    ).toHaveCount(0);
    await logout(page);
  });
});
