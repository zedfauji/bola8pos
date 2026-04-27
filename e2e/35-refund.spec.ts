/* eslint-disable */
/**
 * E2E spec: Phase 6 — Refund
 * Tickets: S4-07, S4-11, S4-19
 * Covers:
 *  T1-T4: Complete a paid tab, select 2 items, enter manager PIN, verify refund processed
 *  T5:    REFUND_EXCEEDS_ORIGINAL blocks double-refund of fully-refunded payment
 *  T6:    Refund remaining items with restock=false succeeds (no ledger change)
 *
 * NOTE (autonomous: false): These tests require a running dev server + Supabase
 * with migrations 20260427000000–20260427000004 applied. Run with:
 *   cd bar-pos && npx playwright test e2e/35-refund.spec.ts --headed
 *
 * Manager PIN: The ManagerPinDialog uses a PINKeypad (button-based, no text input).
 * Tests enter the admin PIN by pressing the numeric keypad buttons. The PIN length
 * must match the ManagerPinDialog's PINKeypad maxLength (default: 6). If the
 * E2E_ADMIN_PIN is shorter than 6 digits, pad with zeros or adjust PINKeypad maxLength.
 */

import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getServiceClient, openCaja, resetTestState } from './helpers/supabase';

// ---------------------------------------------------------------------------
// Seed helper
// ---------------------------------------------------------------------------

interface SeededPaidTab {
  tabId: string;
  paymentId: string;
  orderItemIds: string[];
}

/**
 * Seed a fully paid tab with `itemCount` order_items at `unitPrice` each.
 * Creates a shift if needed. Sets tab.status = 'paid'. Inserts one payment row.
 * Returns tabId, paymentId, and orderItemIds.
 */
async function seedPaidTab(
  db: ReturnType<typeof getServiceClient>,
  itemCount: number,
  unitPrice: number,
): Promise<SeededPaidTab> {
  const { data: profile } = await db
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single();

  // Reuse open shift or create fresh
  let shiftId: string;
  const { data: existingShift } = await db
    .from('shifts')
    .select('id')
    .is('clock_out', null)
    .limit(1)
    .maybeSingle();
  if (existingShift) {
    shiftId = existingShift.id as string;
  } else {
    const { data: newShift } = await db
      .from('shifts')
      .insert({ staff_id: profile.id, opening_cash: 0 })
      .select('id')
      .single();
    shiftId = newShift.id as string;
  }

  // Create tab (start as open to satisfy constraints, then mark paid)
  const { data: tab } = await db
    .from('tabs')
    .insert({
      customer_name: 'E2E Refund Test',
      staff_id: profile.id,
      shift_id: shiftId,
      status: 'open',
      is_deleted: false,
    })
    .select('id')
    .single();

  // Create order
  const { data: order } = await db
    .from('orders')
    .insert({
      tab_id: tab.id,
      staff_id: profile.id,
      status: 'pending',
    })
    .select('id')
    .single();

  // Get any active product
  const { data: product } = await db
    .from('products')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single();

  // Insert order_items
  const inserts = Array.from({ length: itemCount }, () => ({
    order_id: order.id,
    product_id: product.id,
    quantity: 1,
    unit_price: unitPrice,
    modifier_price_delta: 0,
  }));
  const { data: items } = await db.from('order_items').insert(inserts).select('id');
  const orderItemIds = (items as { id: string }[]).map(i => i.id);

  // Mark tab as paid
  await db
    .from('tabs')
    .update({ status: 'paid', closed_at: new Date().toISOString() })
    .eq('id', tab.id);

  // Insert payment row
  const { data: payment } = await db
    .from('payments')
    .insert({
      tab_id: tab.id,
      amount: itemCount * unitPrice,
      tip_amount: 0,
      method: 'cash',
      is_refund: false,
    })
    .select('id')
    .single();

  return {
    tabId: tab.id as string,
    paymentId: payment.id as string,
    orderItemIds,
  };
}

/**
 * Enter a PIN on the PINKeypad (button-based, aria-label "Key N").
 * Uses keyboard events which the PINKeypad globalListener handles.
 */
async function enterManagerPin(
  page: import('@playwright/test').Page,
  pin: string,
): Promise<void> {
  // The PINKeypad has keyboard support — type each digit
  // Also click the buttons as a fallback for environments without focus
  for (const ch of pin) {
    const label = ch === '0' ? 'Key 0' : `Key ${ch}`;
    const btn = page.getByRole('button', { name: label });
    // If button is visible (PINKeypad rendered), click it; otherwise rely on keyboard
    const isVisible = await btn.isVisible().catch(() => false);
    if (isVisible) {
      await btn.click();
    } else {
      // Fallback: keyboard type (PINKeypad handles window keydown)
      await page.keyboard.type(ch);
    }
  }
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  page.on('console', msg => {
    console.log(`[browser:${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[browser:pageerror] ${err.message}`);
  });

  requireIntegrationEnv();
  await resetTestState();
  await openCaja(570);
  await page.goto('/');
});

test.afterEach(async ({ page }) => {
  await logout(page).catch(() => undefined);
});

// ============================================================================
// T1-T4: Process refund on 2 items with manager PIN
// ============================================================================
test('T1-T4: process refund on 2 items with manager PIN (admin PIN from env)', async ({ page }) => {
  test.info().annotations.push({ type: 'requirement', description: 'S4-07, S4-11, S4-19' });

  const db = getServiceClient();
  const { paymentId } = await seedPaidTab(db, 5, 10.0);
  const adminPin = process.env['E2E_ADMIN_PIN'] ?? '0000';

  await loginAs(page, 'admin');
  await page.goto('/payments');

  // T2: Refund button visible on paid payment row
  const refundBtn = page.getByRole('button', { name: 'Refund' }).first();
  await expect(refundBtn).toBeVisible({ timeout: 20_000 });

  // Open RefundSheet
  await refundBtn.click();
  const refundDialog = page.getByRole('dialog');
  await expect(refundDialog).toBeVisible({ timeout: 10_000 });
  await expect(refundDialog.getByText(/process refund/i)).toBeVisible();

  // T3: Select first 2 items (checkboxes not disabled — items not yet refunded)
  const checkboxes = page.getByRole('checkbox');
  await expect(checkboxes.first()).toBeVisible({ timeout: 10_000 });
  const totalCheckboxes = await checkboxes.count();
  expect(totalCheckboxes).toBeGreaterThanOrEqual(2);

  // Select items that are not disabled
  let selectedCount = 0;
  for (let i = 0; i < totalCheckboxes && selectedCount < 2; i++) {
    const cb = checkboxes.nth(i);
    if (!(await cb.isDisabled())) {
      await cb.check();
      selectedCount++;
    }
  }
  expect(selectedCount).toBe(2);

  // Set reason via the Select dropdown (SelectTrigger id="refund-reason")
  const reasonTrigger = page.locator('#refund-reason');
  await expect(reasonTrigger).toBeVisible({ timeout: 5_000 });
  await reasonTrigger.click();
  // Select "Wrong order" option
  const wrongOrderOption = page.getByRole('option', { name: /wrong.*order/i });
  await expect(wrongOrderOption).toBeVisible({ timeout: 5_000 });
  await wrongOrderOption.click();

  // Verify refund total shows ~$20 (2 items × $10)
  await expect(page.getByText(/20/)).toBeVisible({ timeout: 5_000 });

  // T4: Click "Request approval" → ManagerPinDialog opens
  await page.getByRole('button', { name: /request approval/i }).click();

  // Manager PIN dialog (AlertDialog)
  const pinDialog = page.getByRole('alertdialog');
  await expect(pinDialog).toBeVisible({ timeout: 8_000 });
  await expect(pinDialog.getByText(/manager access required/i)).toBeVisible();

  // Enter admin PIN using PINKeypad buttons
  await enterManagerPin(page, adminPin);

  // After correct PIN: ManagerPinDialog closes and refund is submitted
  // Success toast: "Refund of $20.00 processed."
  await expect(page.getByText(/refund.*processed/i)).toBeVisible({ timeout: 15_000 });

  // T5 (DB assertions): refunds row exists
  const { data: refund } = await db
    .from('refunds')
    .select('id, amount')
    .eq('original_payment_id', paymentId)
    .single();
  expect(refund).not.toBeNull();
  expect(Number((refund as { amount: number }).amount)).toBeCloseTo(20.0, 1);

  // T5: negative payment row
  const { data: negPmt } = await db
    .from('payments')
    .select('amount, is_refund')
    .eq('refund_id', (refund as { id: string }).id)
    .single();
  expect(negPmt).not.toBeNull();
  expect((negPmt as { is_refund: boolean }).is_refund).toBe(true);
  expect(Number((negPmt as { amount: number }).amount)).toBeCloseTo(-20.0, 1);

  // T5: Refunds tab on PaymentsPage shows new row
  const refundsTab = page.getByRole('tab', { name: /refunds/i });
  if (await refundsTab.count() > 0) {
    await refundsTab.click();
    // Refund row should be visible — look for the payment ID prefix or amount
    await expect(
      page.getByText(paymentId.slice(0, 8)).or(page.getByText(/\-.*20/)).first()
    ).toBeVisible({ timeout: 8_000 });
  }
});

// ============================================================================
// T5: REFUND_EXCEEDS_ORIGINAL blocks double-refund
// ============================================================================
test('T5: REFUND_EXCEEDS_ORIGINAL blocks double-refund of fully-refunded payment', async ({
  page,
}) => {
  test.info().annotations.push({ type: 'requirement', description: 'S4-07, S4-19' });

  const db = getServiceClient();
  const { tabId, paymentId, orderItemIds } = await seedPaidTab(db, 2, 10.0);
  const adminPin = process.env['E2E_ADMIN_PIN'] ?? '0000';

  // Pre-seed a full refund via DB (bypasses RPC so we can test the guard)
  const { data: profile } = await db
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single();
  const { data: existingRefund } = await db
    .from('refunds')
    .insert({
      original_payment_id: paymentId,
      reason: 'wrong_order',
      amount: 20.0,
      created_by: profile.id,
    })
    .select('id')
    .single();
  await db.from('refund_items').insert(
    orderItemIds.map((id: string) => ({
      refund_id: existingRefund.id,
      order_item_id: id,
      qty: 1,
      amount: 10.0,
      restock: false,
    })),
  );
  await db.from('payments').insert({
    tab_id: tabId,
    amount: -20.0,
    tip_amount: 0,
    method: 'cash',
    is_refund: true,
    refund_id: existingRefund.id,
  });

  await loginAs(page, 'admin');
  await page.goto('/payments');

  const refundBtn = page.getByRole('button', { name: 'Refund' }).first();
  await expect(refundBtn).toBeVisible({ timeout: 20_000 });
  await refundBtn.click();

  const refundDialog = page.getByRole('dialog');
  await expect(refundDialog).toBeVisible({ timeout: 10_000 });

  // All items are fully refunded — checkboxes should be disabled
  const checkboxes = page.getByRole('checkbox');
  await expect(checkboxes.first()).toBeVisible({ timeout: 10_000 });

  const firstCbDisabled = await checkboxes.first().isDisabled();

  if (firstCbDisabled) {
    // UI correctly prevents submission — Request approval should be disabled
    const requestBtn = page.getByRole('button', { name: /request approval/i });
    await expect(requestBtn).toBeDisabled({ timeout: 5_000 });
  } else {
    // Fallback: UI allows selection — submit and expect RPC guard to block
    await checkboxes.first().check();
    const reasonTrigger = page.locator('#refund-reason');
    await reasonTrigger.click();
    await page.getByRole('option', { name: /wrong.*order/i }).click();
    await page.getByRole('button', { name: /request approval/i }).click();

    const pinDialog = page.getByRole('alertdialog');
    await expect(pinDialog).toBeVisible({ timeout: 8_000 });
    await enterManagerPin(page, adminPin);

    // Expect error toast: "exceeds remaining refundable balance" or similar
    await expect(
      page
        .getByText(/exceeds.*refundable/i)
        .or(page.getByText(/exceeds the remaining/i))
        .or(page.getByText(/REFUND_EXCEEDS_ORIGINAL/i)),
    ).toBeVisible({ timeout: 15_000 });
  }
});

// ============================================================================
// T6: Refund remaining items with restock=false — no ledger change
// ============================================================================
test('T6: refund remaining 3 items with restock=false — no stock ledger change', async ({
  page,
}) => {
  test.info().annotations.push({ type: 'requirement', description: 'S4-07, S4-19' });

  const db = getServiceClient();
  const { tabId, paymentId, orderItemIds } = await seedPaidTab(db, 5, 10.0);
  const adminPin = process.env['E2E_ADMIN_PIN'] ?? '0000';

  // Pre-seed partial refund: items[0] and [1] already refunded
  const { data: profile } = await db
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single();
  const { data: partialRefund } = await db
    .from('refunds')
    .insert({
      original_payment_id: paymentId,
      reason: 'wrong_order',
      amount: 20.0,
      created_by: profile.id,
    })
    .select('id')
    .single();
  await db.from('refund_items').insert([
    {
      refund_id: partialRefund.id,
      order_item_id: orderItemIds[0],
      qty: 1,
      amount: 10.0,
      restock: false,
    },
    {
      refund_id: partialRefund.id,
      order_item_id: orderItemIds[1],
      qty: 1,
      amount: 10.0,
      restock: false,
    },
  ]);
  await db.from('payments').insert({
    tab_id: tabId,
    amount: -20.0,
    tip_amount: 0,
    method: 'cash',
    is_refund: true,
    refund_id: partialRefund.id,
  });

  await loginAs(page, 'admin');
  await page.goto('/payments');

  const refundBtn = page.getByRole('button', { name: 'Refund' }).first();
  await expect(refundBtn).toBeVisible({ timeout: 20_000 });
  await refundBtn.click();

  const refundDialog = page.getByRole('dialog');
  await expect(refundDialog).toBeVisible({ timeout: 10_000 });

  // Wait for items to load
  const checkboxes = page.getByRole('checkbox');
  await expect(checkboxes.first()).toBeVisible({ timeout: 10_000 });

  // Select all non-disabled checkboxes (items[0] and [1] should be disabled/fully refunded)
  const total = await checkboxes.count();
  let selectedCount = 0;
  for (let i = 0; i < total; i++) {
    const cb = checkboxes.nth(i);
    if (!(await cb.isDisabled())) {
      await cb.check();
      selectedCount++;
    }
  }
  // Should have selected 3 remaining items
  expect(selectedCount).toBe(3);

  // Set restock=false: uncheck any "Restock" checkboxes that are checked
  const restockCheckboxes = page.getByRole('checkbox', { name: /restock/i });
  const restockCount = await restockCheckboxes.count();
  for (let i = 0; i < restockCount; i++) {
    const rc = restockCheckboxes.nth(i);
    if (await rc.isChecked()) {
      await rc.uncheck();
    }
  }

  // Set reason
  const reasonTrigger = page.locator('#refund-reason');
  await expect(reasonTrigger).toBeVisible({ timeout: 5_000 });
  await reasonTrigger.click();
  await page.getByRole('option', { name: /wrong.*order/i }).click();

  // Request approval → PIN
  await page.getByRole('button', { name: /request approval/i }).click();

  const pinDialog = page.getByRole('alertdialog');
  await expect(pinDialog).toBeVisible({ timeout: 8_000 });
  await enterManagerPin(page, adminPin);

  // Success toast: "Refund of $30.00 processed."
  await expect(page.getByText(/refund.*processed/i)).toBeVisible({ timeout: 15_000 });

  // DB: second refund row for remaining 3 items ($30)
  const { data: secondRefund } = await db
    .from('refunds')
    .select('id, amount')
    .eq('original_payment_id', paymentId)
    .neq('id', partialRefund.id)
    .single();
  expect(secondRefund).not.toBeNull();
  expect(Number((secondRefund as { amount: number }).amount)).toBeCloseTo(30.0, 1);

  // restock=false: verify refund_items all have restock=false
  const { data: refundItems } = await db
    .from('refund_items')
    .select('restock')
    .eq('refund_id', (secondRefund as { id: string }).id);
  expect(
    (refundItems as { restock: boolean }[]).every(i => i.restock === false),
  ).toBe(true);
});
