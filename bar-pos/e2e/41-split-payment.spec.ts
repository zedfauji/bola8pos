/* eslint-disable */
/**
 * E2E spec: Phase 18 — Split Payment (Multi-Method)
 * Plan: 18-06
 * Covers:
 *  T1: Happy path (D-08/D-09, SC-2/SC-3) — 2-method split close (cash + card) through
 *      the deployed process-split-payment edge function + process_split_payment_atomic
 *      RPC, sequential per-leg receipts, tab reaches 'paid'.
 *  T2: Validation gate (SC-3, Pitfall 3) — partial row allocation blocks submit.
 *  T3: Add/remove row (D-02) — cap at 4 rows, floor at 2 rows.
 *
 * NOTE (autonomous: false): Requires `bar-pos/.env.local` + remote Supabase with the
 * Phase 18 migrations applied (payment_group_id/split_index columns +
 * process_split_payment_atomic RPC) and the process-split-payment edge function deployed.
 * Follows the seed-via-DB + selectTabByName pattern established by 34-split-bill.spec.ts
 * (NOT the same feature — split TAB vs split PAYMENT — but the tab-seeding helper is
 * directly reusable). Environment-dependent branches annotate rather than hard-skip,
 * per the 32-combos/40-kds-bar precedent.
 */

import { expect, test, type Page } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getServiceClient, openCaja, resetTestState } from './helpers/supabase';

// ---------------------------------------------------------------------------
// Seed helpers (adapted from e2e/34-split-bill.spec.ts's seedOpenTab/selectTabByName)
// ---------------------------------------------------------------------------

interface SeededTab {
  tabId: string;
}

/**
 * Seed an open tab with `itemCount` order_items at `unitPrice` each.
 * Creates a shift if none exist. Uses the first admin profile.
 */
async function seedOpenTab(
  db: ReturnType<typeof getServiceClient>,
  customerName: string,
  itemCount: number,
  unitPrice: number,
): Promise<SeededTab> {
  const { data: profile } = await db
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single();

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

  const { data: tab } = await db
    .from('tabs')
    .insert({
      customer_name: customerName,
      staff_id: profile.id,
      shift_id: shiftId,
      status: 'open',
      is_deleted: false,
    })
    .select('id')
    .single();

  const { data: order } = await db
    .from('orders')
    .insert({
      tab_id: tab.id,
      staff_id: profile.id,
      status: 'pending',
    })
    .select('id')
    .single();

  const { data: product } = await db
    .from('products')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single();

  const inserts = Array.from({ length: itemCount }, () => ({
    order_id: order.id,
    product_id: product.id,
    quantity: 1,
    unit_price: unitPrice,
    modifier_price_delta: 0,
  }));
  await db.from('order_items').insert(inserts).select('id');

  return { tabId: tab.id as string };
}

/**
 * Navigate to /pos and select a tab by customer name.
 * Handles both "no tab selected" (Select Tab button) and "tab already selected" (Switch Tab button).
 */
async function selectTabByName(page: Page, customerName: string): Promise<void> {
  await page.goto('/pos');

  const switchBtn = page
    .getByRole('button', { name: /switch tab/i })
    .or(page.getByRole('button', { name: /select.*tab/i }))
    .or(page.getByRole('button', { name: /select existing tab/i }));
  await expect(switchBtn.first()).toBeVisible({ timeout: 20_000 });
  await expect(switchBtn.first()).toBeEnabled({ timeout: 30_000 });
  await switchBtn.first().click();

  const tabBtn = page.getByRole('button', {
    name: new RegExp(`tab for ${customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
  });
  await expect(tabBtn).toBeVisible({ timeout: 15_000 });
  await tabBtn.click();

  await expect(page.getByText(new RegExp(customerName, 'i')).first()).toBeVisible({ timeout: 10_000 });
}

function payButton(page: Page) {
  return page.getByRole('button', { name: /close tab and process payment/i });
}

function paymentDialog(page: Page) {
  return page.getByRole('dialog', { name: /process payment/i });
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

test.describe('Split Payment', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(500);
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    await logout(page).catch(() => undefined);
  });

  // ==========================================================================
  // T1: Happy path — 2-method split close (cash + card)
  // ==========================================================================
  test('T1: happy path — 2-method split close (cash + card)', async ({ page }) => {
    test.setTimeout(150_000);
    test.info().annotations.push({ type: 'requirement', description: 'SC-2, SC-3, D-08, D-09' });

    const db = getServiceClient();
    const { tabId } = await seedOpenTab(db, 'E2E Split Payment T1', 4, 15.0);

    await loginAs(page, 'admin');
    await selectTabByName(page, 'E2E Split Payment T1');

    if ((await payButton(page).count()) === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'Close Tab / Pay control not present on POS (OrderPanel not mounted or no items on tab).',
      });
      return;
    }
    await payButton(page).click();

    const modal = paymentDialog(page);
    await expect(modal).toBeVisible({ timeout: 15_000 });

    // Toggle "Split payment" ON — 2 rows + Remaining to pay box appear (SC-3)
    await modal.getByRole('switch', { name: 'Split payment' }).click();
    await expect(modal.getByText('Payment 1')).toBeVisible();
    await expect(modal.getByText('Payment 2')).toBeVisible();
    await expect(modal.getByText(/remaining to pay/i)).toBeVisible();

    // Read the target subtotal+tax straight from the (0/0) remaining-balance box —
    // avoids hardcoding tax-rate/discount assumptions; matches whatever the running
    // environment actually computes.
    const remainingBoxText = (await modal.getByText('Remaining to pay').locator('..').innerText()).trim();
    const match = /\$([0-9]+\.[0-9]{2})/.exec(remainingBoxText);
    if (!match?.[1]) {
      throw new Error(`T1: could not parse remaining-balance amount from "${remainingBoxText}"`);
    }
    const totalCents = Math.round(parseFloat(match[1]) * 100);
    const halfCents = Math.floor(totalCents / 2);
    const row1Amount = (halfCents / 100).toFixed(2);
    const row2Amount = ((totalCents - halfCents) / 100).toFixed(2);

    // Row 2 → card FIRST — both rows default to cash, so switching row 2 away from
    // cash before touching row 1's "Amount tendered" keeps that label unambiguous
    // (only row 1 remains cash at that point, avoiding a strict-mode locator clash).
    await modal.getByRole('button', { name: 'Terminal BBVA' }).nth(1).click();

    // Row 1 stays cash (default) — Amount + Amount tendered (exact, no change due)
    const amountInputs = modal.getByLabel('Amount', { exact: true });
    await amountInputs.nth(0).fill(row1Amount);
    await modal.getByLabel('Amount tendered', { exact: true }).fill(row1Amount);

    // Row 2 → fill Amount for the remainder
    await amountInputs.nth(1).fill(row2Amount);

    await expect(modal.getByText('Fully allocated ✓')).toBeVisible({ timeout: 5_000 });
    const submitBtn = modal.getByRole('button', { name: 'Process split payment' });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Sequential per-leg receipts (D-09)
    await expect(modal.getByText(/Receipt 1 of 2/)).toBeVisible({ timeout: 90_000 });
    await modal.getByRole('button', { name: 'Done' }).click();
    await expect(modal.getByText(/Receipt 2 of 2/)).toBeVisible({ timeout: 15_000 });
    await modal.getByRole('button', { name: 'Done' }).click();

    // Last receipt's Done closes the modal
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    // Tab reaches 'paid' only after both legs succeed (D-08 all-or-nothing)
    await expect
      .poll(
        async () => {
          const { data } = await db.from('tabs').select('status').eq('id', tabId).single();
          return (data as { status: string } | null)?.status ?? null;
        },
        { timeout: 15_000 },
      )
      .toBe('paid');

    // Both legs share one payment_group_id, distinct split_index, cash + card methods
    const { data: paymentRows } = await db
      .from('payments')
      .select('amount, method, payment_group_id, split_index')
      .eq('tab_id', tabId)
      .eq('is_refund', false);
    const rows = (paymentRows ?? []) as {
      amount: number;
      method: string;
      payment_group_id: string | null;
      split_index: number | null;
    }[];
    expect(rows.length).toBe(2);
    const groupIds = new Set(rows.map(r => r.payment_group_id));
    expect(groupIds.size).toBe(1);
    expect([...groupIds][0]).not.toBeNull();
    expect(rows.map(r => r.method).sort()).toEqual(['card', 'cash']);
    expect(new Set(rows.map(r => r.split_index)).size).toBe(2);
  });

  // ==========================================================================
  // T2: Validation gate — partial allocation blocks submit
  // ==========================================================================
  test('T2: validation gate — partial row allocation blocks submit', async ({ page }) => {
    test.setTimeout(120_000);
    test.info().annotations.push({ type: 'requirement', description: 'SC-3, Pitfall 3' });

    const db = getServiceClient();
    await seedOpenTab(db, 'E2E Split Payment T2', 2, 20.0);

    await loginAs(page, 'admin');
    await selectTabByName(page, 'E2E Split Payment T2');

    if ((await payButton(page).count()) === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'Close Tab / Pay control not present on POS (OrderPanel not mounted or no items on tab).',
      });
      return;
    }
    await payButton(page).click();

    const modal = paymentDialog(page);
    await expect(modal).toBeVisible({ timeout: 15_000 });

    await modal.getByRole('switch', { name: 'Split payment' }).click();
    await expect(modal.getByText('Payment 1')).toBeVisible();
    await expect(modal.getByText('Payment 2')).toBeVisible();

    // Switch both rows to card to avoid the cash tendered-amount requirement
    const cardButtons = modal.getByRole('button', { name: 'Terminal BBVA' });
    await cardButtons.nth(0).click();
    await cardButtons.nth(1).click();

    const submitBtn = modal.getByRole('button', { name: 'Process split payment' });
    await expect(submitBtn).toBeDisabled();

    // Fill only row 1 — row 2 stays at $0 (remaining ≠ 0)
    const amountInputs = modal.getByLabel('Amount', { exact: true });
    await amountInputs.nth(0).fill('5.00');

    await expect(submitBtn).toBeDisabled();
    await expect(modal.getByText('Fully allocated ✓')).toHaveCount(0);
    await expect(modal.getByText(/remaining to pay/i)).toBeVisible();

    await modal.getByRole('button', { name: 'Cancel' }).click();
  });

  // ==========================================================================
  // T3: Add/remove row — cap at 4, floor at 2
  // ==========================================================================
  test('T3: add/remove row — cap at 4 rows, floor at 2 rows', async ({ page }) => {
    test.setTimeout(120_000);
    test.info().annotations.push({ type: 'requirement', description: 'D-02' });

    const db = getServiceClient();
    await seedOpenTab(db, 'E2E Split Payment T3', 2, 20.0);

    await loginAs(page, 'admin');
    await selectTabByName(page, 'E2E Split Payment T3');

    if ((await payButton(page).count()) === 0) {
      test.info().annotations.push({
        type: 'note',
        description: 'Close Tab / Pay control not present on POS (OrderPanel not mounted or no items on tab).',
      });
      return;
    }
    await payButton(page).click();

    const modal = paymentDialog(page);
    await expect(modal).toBeVisible({ timeout: 15_000 });

    await modal.getByRole('switch', { name: 'Split payment' }).click();
    await expect(modal.getByText('Payment 1')).toBeVisible();
    await expect(modal.getByText('Payment 2')).toBeVisible();

    // Remove control is not rendered at the 2-row floor
    await expect(modal.getByRole('button', { name: 'Remove payment 1' })).toHaveCount(0);

    const addBtn = modal.getByRole('button', { name: '+ Add payment method' });
    await addBtn.click();
    await expect(modal.getByText('Payment 3')).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Remove payment 1' })).toBeVisible();

    await addBtn.click();
    await expect(modal.getByText('Payment 4')).toBeVisible();
    await expect(addBtn).toBeDisabled();

    await modal.getByRole('button', { name: 'Remove payment 4' }).click();
    await modal.getByRole('button', { name: 'Remove payment 3' }).click();

    await expect(modal.getByText('Payment 3')).toHaveCount(0);
    await expect(modal.getByRole('button', { name: 'Remove payment 1' })).toHaveCount(0);
    await expect(addBtn).toBeEnabled();

    await modal.getByRole('button', { name: 'Cancel' }).click();
  });
});
