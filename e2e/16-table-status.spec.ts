/**
 * e2e/16-table-status.spec.ts
 *
 * Tests for the Table Status Page (/pool-tables/:tableId).
 * Requires a running dev server (npm run dev) and a valid .env.local.
 *
 * Seeding strategy: direct Supabase service-role inserts via getServiceClient(),
 * identical to the pattern used in 04-pool-timer.spec.ts.
 *
 * UI text & role references are derived from reading:
 *   - src/widgets/TableStatusPanel/index.tsx
 *   - src/entities/pool-table/ui/PoolTableCard.tsx
 *   - src/pages/pool-table-status/index.tsx
 *   - src/features/stop-pool-timer/ui/StopSessionConfirm.tsx
 *   - src/features/stop-and-move-table/ui/StopAndMoveDialog.tsx
 *   - src/features/manager-pin-gate/ui/ManagerPinDialog.tsx
 */

import { expect, test, type Page } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import {
  getOccupiedPoolTableIds,
  getServiceClient,
  openCaja,
  resetTestState,
} from './helpers/supabase';

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Open a tab with the given customer name via the UI (POS page).
 * Returns after the "tab opened" toast is visible.
 */
async function openTabViaUI(page: Page, customerName: string): Promise<void> {
  await page.goto('/pos');
  await page.getByRole('button', { name: /new tab/i }).click();
  await page.getByLabel(/customer name/i).fill(customerName);
  await page.getByRole('button', { name: 'Open Tab' }).click();
  await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
}

/**
 * Start a pool session on the first available table, linking it to the given tab name.
 * Returns after the "pool session started" toast is visible.
 */
async function startSessionViaUI(page: Page, customerName: string): Promise<void> {
  await page.goto('/pool-tables');
  await page.getByRole('button', { name: 'Start Session' }).first().click();

  const sheet = page.getByRole('dialog', { name: /start pool session/i });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.locator('#pool-start-tab').selectOption({ label: customerName });
  await sheet.getByRole('button', { name: 'Start Session' }).click();

  await expect(page.getByText(/pool session started/i)).toBeVisible({ timeout: 20_000 });
}

/**
 * Navigate to the status page for the first currently-occupied table.
 * Throws if no occupied table is found in DB.
 */
async function navigateToFirstOccupiedStatusPage(page: Page): Promise<string> {
  const occupied = await getOccupiedPoolTableIds();
  if (occupied.length === 0) throw new Error('No occupied table found – seeding may have failed.');
  const { tableId } = occupied[0]!;
  await page.goto(`/pool-tables/${tableId}`);
  return tableId;
}

/**
 * Seed an occupied table directly via service client (faster than UI flow).
 * Creates a tab and a pool session. Returns the tableId and tabId.
 */
async function seedOccupiedTableDirect(
  customerName: string,
  options?: { startedAtOffset?: number /* ms in the past */ }
): Promise<{ tableId: string; sessionId: string; tabId: string }> {
  const admin = getServiceClient();

  // Pick an available pool table
  const { data: tables, error: tErr } = await admin
    .from('pool_tables')
    .select('id, number')
    .eq('status', 'available')
    .limit(1)
    .single();
  if (tErr || !tables) throw new Error(`seedOccupiedTable: no available table – ${tErr?.message}`);

  // Find a staff member to own the tab
  const { data: staff, error: sErr } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .single();
  if (sErr || !staff) throw new Error(`seedOccupiedTable: no staff profile – ${sErr?.message}`);

  // Find or create an open shift for the staff member (tabs require shift_id)
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
    if (shiftErr || !newShift)
      throw new Error(`seedOccupiedTable: shift create failed – ${shiftErr?.message}`);
    shiftId = newShift.id as string;
  }

  // Create the tab
  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({
      customer_name: customerName,
      status: 'open',
      staff_id: staff.id,
      shift_id: shiftId,
      is_deleted: false,
    })
    .select('id')
    .single();
  if (tabErr || !tab) throw new Error(`seedOccupiedTable: tab insert failed – ${tabErr?.message}`);

  // Compute started_at
  const startedAt = new Date(
    Date.now() - (options?.startedAtOffset ?? 2 * 60 * 1000)
  ).toISOString();

  // Create the pool session
  const { data: session, error: sessErr } = await admin
    .from('pool_sessions')
    .insert({
      table_id: tables.id,
      tab_id: tab.id,
      started_at: startedAt,
      billed_minutes: null,
      total_charge: null,
      stopped_at: null,
    })
    .select('id')
    .single();
  if (sessErr || !session)
    throw new Error(`seedOccupiedTable: session insert failed – ${sessErr?.message}`);

  // Mark table occupied
  const { error: updateErr } = await admin
    .from('pool_tables')
    .update({ status: 'occupied', current_session_id: session.id })
    .eq('id', tables.id);
  if (updateErr)
    throw new Error(`seedOccupiedTable: table update failed – ${updateErr.message}`);

  return { tableId: tables.id as string, sessionId: session.id as string, tabId: tab.id as string };
}

// ---------------------------------------------------------------------------
// PIN helper for item removal tests
// ---------------------------------------------------------------------------

async function enterManagerPin(page: Page, pin: string): Promise<void> {
  for (const ch of pin) {
    const label = ch === '0' ? 'Key 0' : `Key ${ch}`;
    await page.getByRole('button', { name: label }).click();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Table Status Page', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(300);
    await page.goto('/');
  });

  // ── Test 1 ────────────────────────────────────────────────────────────────
  test('T1: navigate from pool grid to status page via View Status button', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    // Seed occupied table via UI so the grid renders correctly
    await openTabViaUI(page, 'Status Nav Test');
    await startSessionViaUI(page, 'Status Nav Test');

    // Pool grid should show the occupied table — click the card itself to navigate to status page
    await page.goto('/pool-tables');
    // Occupied cards are clickable (the whole card acts as a nav link to the status page)
    const occupiedCard = page.locator('[data-testid="pool-table-card"]').filter({
      has: page.getByText('Status Nav Test'),
    });
    await expect(occupiedCard).toBeVisible({ timeout: 20_000 });
    await occupiedCard.click();

    // URL includes the table ID segment
    await expect(page).toHaveURL(/\/pool-tables\/[0-9a-f-]{36}/, { timeout: 15_000 });

    // Customer name displayed
    await expect(page.getByText('Status Nav Test')).toBeVisible({ timeout: 15_000 });

    // Timer is ticking: capture text, wait 1.5 s, assert it changed
    const timer = page.locator('span.font-mono').first();
    await expect(timer).toBeVisible({ timeout: 15_000 });
    const t0 = (await timer.innerText()).trim();
    await expect
      .poll(async () => (await timer.innerText()).trim(), { timeout: 10_000 })
      .not.toBe(t0);

    await logout(page);
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────
  test('T2: "Moved from" badge visible when session has previous_table_id', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    // Seed: two pool tables — occupy one, then manually set previous_table_id on its session
    const { tableId, sessionId } = await seedOccupiedTableDirect('Moved From Test');

    // Pick a different table to act as the "previous" one
    const admin = getServiceClient();
    const { data: otherTable } = await admin
      .from('pool_tables')
      .select('id, number')
      .neq('id', tableId)
      .limit(1)
      .single();

    if (otherTable) {
      // Only set previous_table_id — the number is resolved via a join in the UI query
      await admin
        .from('pool_sessions')
        .update({
          previous_table_id: otherTable.id,
        })
        .eq('id', sessionId);
    }

    await page.goto(`/pool-tables/${tableId}`);

    // "Moved from Table N" badge
    await expect(
      page.getByText(new RegExp(`moved from table\\s*${String(otherTable?.number ?? '\\d+')}`, 'i'))
    ).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────
  test('T3: Happy Hour badge visible when current time is within happy hour window', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    const admin = getServiceClient();

    // Set happy hour on the first available category to cover the current time
    const now = new Date();
    const hhmm = now.getHours() * 60 + now.getMinutes();
    // Window: 30 min before to 30 min after current time
    const startH = Math.floor((hhmm - 30 + 1440) % 1440 / 60);
    const startM = Math.floor((hhmm - 30 + 1440) % 1440 % 60);
    const endH = Math.floor((hhmm + 30) % 1440 / 60);
    const endM = Math.floor((hhmm + 30) % 1440 % 60);
    const startStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    const { data: category } = await admin
      .from('categories')
      .select('id')
      .limit(1)
      .single();

    if (!category) {
      test.skip(true, 'No category found to apply happy hour — seed may be missing');
      return;
    }

    // Apply happy hour window on this category
    await admin
      .from('categories')
      .update({ happy_hour_start: startStr, happy_hour_end: endStr })
      .eq('id', category.id);

    // Find a product in this category
    const { data: product } = await admin
      .from('products')
      .select('id, base_price')
      .eq('category_id', category.id)
      .limit(1)
      .single();

    if (!product) {
      test.skip(true, 'No product found in happy hour category');
      return;
    }

    // Seed occupied table and add an order with this product
    const { tableId, tabId } = await seedOccupiedTableDirect('Happy Hour Test');

    // Insert an order + order_item directly
    const { data: staffRow } = await admin.from('profiles').select('id').limit(1).single();
    const { data: order } = await admin
      .from('orders')
      .insert({
        tab_id: tabId,
        status: 'pending',
        staff_id: staffRow!.id,
      })
      .select('id')
      .single();

    if (order) {
      await admin.from('order_items').insert({
        order_id: order.id,
        product_id: product.id,
        quantity: 1,
        unit_price: product.base_price,
      });
    }

    await page.goto(`/pool-tables/${tableId}`);

    await expect(page.getByText(/happy hour active/i)).toBeVisible({ timeout: 20_000 });

    // Cleanup: remove happy hour from category
    await admin
      .from('categories')
      .update({ happy_hour_start: null, happy_hour_end: null })
      .eq('id', category.id);

    await logout(page);
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────
  test('T4: Stop Timer opens confirmation dialog, confirm redirects to /pool-tables', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    await openTabViaUI(page, 'Stop Timer Test');
    await startSessionViaUI(page, 'Stop Timer Test');
    const tableId = await navigateToFirstOccupiedStatusPage(page);
    expect(tableId).toBeTruthy();

    await page.getByRole('button', { name: 'Stop Timer' }).click();

    // ConfirmDialog (alertdialog) with title "Stop pool session?"
    const dialog = page.getByRole('alertdialog', { name: /stop pool session/i });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await dialog.getByRole('button', { name: /stop & finalize/i }).click();

    // Redirected back to pool tables grid
    await expect(page).toHaveURL(/\/pool-tables$/, { timeout: 30_000 });

    // The table card that was occupied should now show "Available" status
    await expect(page.getByText(/pool session stopped/i)).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  // ── Test 5 ────────────────────────────────────────────────────────────────
  test('T5: Stop & Move to Table stops session and moves tab to new table number', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    await openTabViaUI(page, 'Stop Move Test');
    await startSessionViaUI(page, 'Stop Move Test');
    await navigateToFirstOccupiedStatusPage(page);

    await page.getByRole('button', { name: /stop.*move to table/i }).click();

    const moveDialog = page.getByRole('alertdialog', { name: /stop timer.*move table/i });
    await expect(moveDialog).toBeVisible({ timeout: 15_000 });

    // Fill in new table number
    await moveDialog.getByLabel(/new table number/i).fill('12');

    await moveDialog.getByRole('button', { name: /stop.*move/i }).click();

    // Should navigate back to /pool-tables after success
    await expect(page).toHaveURL(/\/pool-tables$/, { timeout: 30_000 });
    await expect(page.getByText(/session stopped.*tab moved to table 12/i)).toBeVisible({
      timeout: 20_000,
    });

    await logout(page);
  });

  // ── Test 6 ────────────────────────────────────────────────────────────────
  test('T6: Print Pre-cheque button triggers print flow without error dialog', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    await openTabViaUI(page, 'Print Precheque Test');
    await startSessionViaUI(page, 'Print Precheque Test');
    await navigateToFirstOccupiedStatusPage(page);

    // Button is enabled when tab data is loaded
    const printBtn = page.getByRole('button', { name: /print pre-cheque/i });
    await expect(printBtn).toBeVisible({ timeout: 15_000 });
    await expect(printBtn).toBeEnabled({ timeout: 15_000 });

    await printBtn.click();

    // In a test environment the printer is not connected; we accept either:
    //   a) success toast "Pre-cheque sent to printer."
    //   b) error toast if Tauri IPC is unavailable — but NO alertdialog should block UI
    // Wait briefly and assert no blocking alertdialog opened
    await page.waitForTimeout(2_000);
    const blockingDialog = page.getByRole('alertdialog');
    const dialogVisible = await blockingDialog.isVisible().catch(() => false);
    expect(dialogVisible).toBe(false);

    await logout(page);
  });

  // ── Test 7 ────────────────────────────────────────────────────────────────
  test('T7: Bartender removing an item requires manager PIN (wrong PIN → error, correct PIN → confirm)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'bartender');

    // Seed occupied table with two items (so order is not voided on removal)
    const admin = getServiceClient();
    const { tableId, tabId } = await seedOccupiedTableDirect('Bartender Remove Item');

    const { data: staffRow } = await admin.from('profiles').select('id').limit(1).single();
    const { data: products } = await admin
      .from('products')
      .select('id, base_price')
      .limit(2);

    if (!products || products.length < 2) {
      test.skip(true, 'Need at least 2 products seeded to run this test');
      return;
    }

    const { data: order } = await admin
      .from('orders')
      .insert({
        tab_id: tabId,
        status: 'pending',
        staff_id: staffRow!.id,
      })
      .select('id')
      .single();

    if (order) {
      await admin.from('order_items').insert([
        {
          order_id: order.id,
          product_id: products[0]!.id,
          quantity: 1,
          unit_price: products[0]!.base_price,
        },
        {
          order_id: order.id,
          product_id: products[1]!.id,
          quantity: 1,
          unit_price: products[1]!.base_price,
        },
      ]);
    }

    await page.goto(`/pool-tables/${tableId}`);

    // Click X button on first item
    const removeBtn = page.getByRole('button', { name: 'Remove item' }).first();
    await expect(removeBtn).toBeVisible({ timeout: 20_000 });
    await removeBtn.click();

    // PIN dialog appears
    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 15_000 });

    // Enter wrong PIN (must be full 6 digits to trigger onComplete)
    await enterManagerPin(page, '000000');
    await expect(pinDialog.getByText(/incorrect pin/i)).toBeVisible({ timeout: 10_000 });

    // Enter correct manager PIN
    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    await enterManagerPin(page, managerPin);

    // Removal confirm dialog should now appear
    const confirmDialog = page.getByRole('alertdialog').filter({ hasText: /remove/i });
    await expect(confirmDialog).toBeVisible({ timeout: 15_000 });
    await confirmDialog.getByRole('button', { name: /confirm|remove/i }).click();

    // Item count decreases — one item section should remain
    await expect(
      page.locator('button[title="Remove item"]')
    ).toHaveCount(1, { timeout: 20_000 });

    await logout(page);
  });

  // ── Test 8 ────────────────────────────────────────────────────────────────
  test('T8: Admin removing an item also requires manager PIN', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'admin');

    const admin = getServiceClient();
    const { tableId, tabId } = await seedOccupiedTableDirect('Admin Remove Item');

    const { data: staffRow } = await admin.from('profiles').select('id').limit(1).single();
    const { data: products } = await admin.from('products').select('id, base_price').limit(2);

    if (!products || products.length < 2) {
      test.skip(true, 'Need at least 2 products seeded');
      return;
    }

    const { data: order } = await admin
      .from('orders')
      .insert({
        tab_id: tabId,
        status: 'pending',
        staff_id: staffRow!.id,
      })
      .select('id')
      .single();

    if (order) {
      await admin.from('order_items').insert([
        {
          order_id: order.id,
          product_id: products[0]!.id,
          quantity: 1,
          unit_price: products[0]!.base_price,
        },
        {
          order_id: order.id,
          product_id: products[1]!.id,
          quantity: 1,
          unit_price: products[1]!.base_price,
        },
      ]);
    }

    await page.goto(`/pool-tables/${tableId}`);

    const removeBtn = page.getByRole('button', { name: 'Remove item' }).first();
    await expect(removeBtn).toBeVisible({ timeout: 20_000 });
    await removeBtn.click();

    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 15_000 });

    const adminPin = process.env['E2E_ADMIN_PIN'] ?? '';
    await enterManagerPin(page, adminPin);

    const confirmDialog = page.getByRole('alertdialog').filter({ hasText: /remove/i });
    await expect(confirmDialog).toBeVisible({ timeout: 15_000 });
    await confirmDialog.getByRole('button', { name: /confirm|remove/i }).click();

    await expect(
      page.locator('button[title="Remove item"]')
    ).toHaveCount(1, { timeout: 20_000 });

    await logout(page);
  });

  // ── Test 9 ────────────────────────────────────────────────────────────────
  test('T9: Removing the last item in an order removes the entire order section', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    const admin = getServiceClient();
    const { tableId, tabId } = await seedOccupiedTableDirect('Remove Last Item');

    const { data: staffRow } = await admin.from('profiles').select('id').limit(1).single();
    const { data: product } = await admin.from('products').select('id, base_price').limit(1).single();

    if (!product) {
      test.skip(true, 'No product seeded');
      return;
    }

    const { data: order } = await admin
      .from('orders')
      .insert({
        tab_id: tabId,
        status: 'pending',
        staff_id: staffRow!.id,
      })
      .select('id')
      .single();

    if (order) {
      await admin.from('order_items').insert({
        order_id: order.id,
        product_id: product.id,
        quantity: 1,
        unit_price: product.base_price,
      });
    }

    await page.goto(`/pool-tables/${tableId}`);

    // One order section heading: "Order #1 —"
    await expect(page.getByText(/order #1/i)).toBeVisible({ timeout: 20_000 });

    // Click X
    const removeBtn = page.getByRole('button', { name: 'Remove item' }).first();
    await expect(removeBtn).toBeVisible({ timeout: 10_000 });
    await removeBtn.click();

    // PIN dialog — enter manager PIN
    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 15_000 });
    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    await enterManagerPin(page, managerPin);

    const confirmDialog = page.getByRole('alertdialog').filter({ hasText: /remove/i });
    await expect(confirmDialog).toBeVisible({ timeout: 15_000 });
    await confirmDialog.getByRole('button', { name: /confirm|remove/i }).click();

    // Order #1 section heading should disappear (no more active orders)
    await expect(page.getByText(/order #1/i)).not.toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  // ── Test 10 ───────────────────────────────────────────────────────────────
  test('T10: "Add More Items" navigates to /pos with the tab active', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    await openTabViaUI(page, 'Add Items Nav Test');
    await startSessionViaUI(page, 'Add Items Nav Test');
    await navigateToFirstOccupiedStatusPage(page);

    await page.getByRole('button', { name: 'Add More Items' }).click();

    // Should navigate to POS
    await expect(page).toHaveURL(/\/pos/, { timeout: 20_000 });

    // The tab drawer or selected tab indicator shows the customer name
    // The tab may open the drawer automatically — look for the customer name in the page
    // Use .first() to avoid strict-mode violation when the name appears in both the order
    // panel and the tab drawer button simultaneously.
    await expect(page.getByText(/Add Items Nav Test/i).first()).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  // ── Test 11 ───────────────────────────────────────────────────────────────
  test('T11: "Close & Pay" shows confirmation then navigates to /pos', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    await openTabViaUI(page, 'Close Pay Test');
    await startSessionViaUI(page, 'Close Pay Test');
    await navigateToFirstOccupiedStatusPage(page);

    await page.getByRole('button', { name: 'Close & Pay' }).click();

    // ConfirmDialog
    const dialog = page.getByRole('alertdialog', { name: /close tab.*proceed to payment/i });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await dialog.getByRole('button', { name: 'Close & Pay' }).click();

    // Redirected to POS
    await expect(page).toHaveURL(/\/pos/, { timeout: 20_000 });

    await logout(page);
  });

  // ── Test 12 ───────────────────────────────────────────────────────────────
  test('T12: Navigating to status page of available table shows "No active session"', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await loginAs(page, 'manager');

    // Find an available pool table ID directly from DB
    const admin = getServiceClient();
    const { data: availableTable } = await admin
      .from('pool_tables')
      .select('id')
      .eq('status', 'available')
      .limit(1)
      .single();

    if (!availableTable) {
      test.skip(true, 'All tables are occupied; cannot test available-table guard');
      return;
    }

    await page.goto(`/pool-tables/${availableTable.id}`);

    // Either redirected to /pool-tables OR shows the EmptyState with "No active session"
    const redirected = await page
      .waitForURL(/\/pool-tables$/, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!redirected) {
      await expect(page.getByText(/no active session/i)).toBeVisible({ timeout: 15_000 });
    }

    await logout(page);
  });

  // ── Test 13 ───────────────────────────────────────────────────────────────
  test.skip('T13: Real-time — session stopped externally updates the UI', async () => {
    // TODO: Skipped because it requires two simultaneous browser contexts updating the same
    // Supabase Realtime channel, which is unreliable in a single-worker CI environment.
    // Revisit with Playwright multi-context (browserContext.newPage) + a second service-role
    // DB write after subscribing to the real-time channel.
    // Linked issue: track as "realtime-E2E coverage"
  });

  // ── Test 14 ───────────────────────────────────────────────────────────────
  test.skip('T14: Offline resilience — mutations are blocked when device is offline', async () => {
    // TODO: Skipped because Playwright's page.context().setOffline(true) stalls fetch()
    // indefinitely (no rejection), which causes mutation hooks to hang forever instead of
    // returning a NETWORK_OFFLINE error. See feedback-offline-mutation-guard.md for full
    // root-cause analysis. Fix requires an isOnline() early-exit guard in the mutationFn
    // before this test can be enabled.
  });

  // ── Test 16 ───────────────────────────────────────────────────────────────
  test('T16: Edit Start Time requires manager PIN and rebills on save', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    // Seed a table with a session started 5 minutes ago
    const { tableId } = await seedOccupiedTableDirect('T16 Edit Start Time', {
      startedAtOffset: 5 * 60 * 1000,
    });

    await page.goto(`/pool-tables/${tableId}`);

    // "Edit Start Time" button is visible for active sessions
    const editBtn = page.getByRole('button', { name: /edit start time/i });
    await expect(editBtn).toBeVisible({ timeout: 15_000 });

    await editBtn.click();

    // ManagerPinDialog opens first
    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 15_000 });

    // Enter wrong PIN (000000 is unlikely to be a valid manager PIN)
    await enterManagerPin(page, '000000');
    await expect(pinDialog.getByText(/incorrect pin/i)).toBeVisible({ timeout: 10_000 });

    // Enter correct manager PIN
    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    await enterManagerPin(page, managerPin);

    // EditStartTimeDialog should now open
    const editForm = page.getByTestId('edit-start-time-form');
    await expect(editForm).toBeVisible({ timeout: 15_000 });

    // Change the start time to 65 minutes ago so elapsed > 1 hour
    const startTime65MinAgo = new Date(Date.now() - 65 * 60 * 1000);
    // Format as datetime-local string (YYYY-MM-DDTHH:MM)
    const year = startTime65MinAgo.getFullYear();
    const month = String(startTime65MinAgo.getMonth() + 1).padStart(2, '0');
    const day = String(startTime65MinAgo.getDate()).padStart(2, '0');
    const hours = String(startTime65MinAgo.getHours()).padStart(2, '0');
    const minutes = String(startTime65MinAgo.getMinutes()).padStart(2, '0');
    const datetimeLocalStr = `${year}-${month}-${day}T${hours}:${minutes}`;

    const startInput = page.locator('#start-time-input');
    await expect(startInput).toBeVisible({ timeout: 10_000 });
    await startInput.fill(datetimeLocalStr);

    await page.getByRole('button', { name: /save/i }).click();

    // Success toast
    await expect(page.getByText(/session start time updated/i)).toBeVisible({ timeout: 15_000 });

    // Elapsed timer should now show ≥ 1 hour (01:00:xx or more)
    // Use span.font-mono fallback in case data-testid is not immediately rendered
    const timer = page.locator('[data-testid="elapsed-minutes"], span.font-mono').first();
    await expect(timer).toBeVisible({ timeout: 20_000 });
    // The timer format is HH:MM:SS — assert it starts with "01:" or higher
    await expect
      .poll(async () => (await timer.innerText()).trim(), { timeout: 20_000 })
      .toMatch(/^(?:0[1-9]|[1-9]\d):/);

    await logout(page);
  });

  // ── Test 15 ───────────────────────────────────────────────────────────────
  test('T15: Back button navigates to /pool-tables', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    const { tableId } = await seedOccupiedTableDirect('Back Nav Test');
    await page.goto(`/pool-tables/${tableId}`);

    // The page header has a "Pool Tables" link rendered as a ghost button (ChevronLeft icon)
    // In pool-table-status/index.tsx: <Link to="/pool-tables">Pool Tables</Link>
    await page.getByRole('link', { name: /pool tables/i }).click();

    await expect(page).toHaveURL(/\/pool-tables$/, { timeout: 15_000 });

    // Also confirm the "Back to Pool Tables" button inside the panel works
    // (navigate back in to test it)
    await page.goto(`/pool-tables/${tableId}`);
    await page.getByRole('button', { name: /back to pool tables/i }).click();
    await expect(page).toHaveURL(/\/pool-tables$/, { timeout: 15_000 });

    await logout(page);
  });
});
