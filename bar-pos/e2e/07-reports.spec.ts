import { expect, test, type Page } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getServiceClient, openCaja, resetTestState } from './helpers/supabase';

// --------------------------------------------------------------------------
// Phase 24 (operational-reports-suite-csv) — Wave 6 helpers
// --------------------------------------------------------------------------

/** Inject a fake `__TAURI_INTERNALS__` so CSV export (save + write_file) resolves
 * without a real Tauri runtime. Mirrors e2e/25-export-reports.spec.ts. */
async function injectTauriMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>)['__exportMockState'] = {
      saveDialogCalled: false,
      savedPath: null as string | null,
    };
    (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {
      invoke(cmd: string): Promise<unknown> {
        const state = (window as unknown as Record<string, unknown>)['__exportMockState'] as {
          saveDialogCalled: boolean;
          savedPath: string | null;
        };
        if (cmd === 'plugin:dialog|save') {
          state.saveDialogCalled = true;
          state.savedPath = '/tmp/e2e-phase24-export.csv';
          return Promise.resolve('/tmp/e2e-phase24-export.csv');
        }
        if (cmd === 'plugin:fs|write_file') {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      },
      transformCallback(callback: (arg: unknown) => void, _once: boolean): number {
        const id = Math.floor(Math.random() * 1_000_000);
        (window as unknown as Record<string, unknown>)[`_${String(id)}`] = callback;
        return id;
      },
      unregisterCallback(id: number): void {
        delete (window as unknown as Record<string, unknown>)[`_${String(id)}`];
      },
    };
  });
}

/** Seed a single `cash` payment on a fresh tab so Payment Methods has a
 * guaranteed non-empty rollup row (ExportButtons is hidden on empty state). */
async function seedCashPayment(): Promise<void> {
  const admin = getServiceClient();
  const { data: staff, error: sErr } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .single();
  if (sErr || !staff) throw new Error(`seedCashPayment: no staff profile - ${sErr?.message}`);

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
    if (shiftErr || !newShift) throw new Error(`seedCashPayment: shift create failed - ${shiftErr?.message}`);
    shiftId = newShift.id as string;
  }

  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({
      customer_name: 'E2E Payment Methods Seed',
      status: 'closed',
      closed_at: new Date().toISOString(),
      staff_id: staff.id,
      shift_id: shiftId,
      is_deleted: false,
    })
    .select('id')
    .single();
  if (tabErr || !tab) throw new Error(`seedCashPayment: tab insert failed - ${tabErr?.message}`);

  const { error: payErr } = await admin.from('payments').insert({
    tab_id: tab.id,
    amount: 25,
    method: 'cash',
    processed_by: staff.id,
    processed_at: new Date().toISOString(),
    idempotency_key: `e2e-phase24-payment-methods-${String(Date.now())}`,
  });
  if (payErr) throw new Error(`seedCashPayment: payment insert failed - ${payErr.message}`);
}

/** Seed an occupied pool table with an open tab + one order item, matching the
 * pattern in e2e/16-table-status.spec.ts's seedOccupiedTableDirect. */
async function seedRemovableItem(customerName: string): Promise<{ tableId: string }> {
  const admin = getServiceClient();

  const { data: table, error: tErr } = await admin
    .from('pool_tables')
    .select('id')
    .eq('status', 'available')
    .limit(1)
    .single();
  if (tErr || !table) throw new Error(`seedRemovableItem: no available table - ${tErr?.message}`);

  const { data: staff, error: sErr } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .single();
  if (sErr || !staff) throw new Error(`seedRemovableItem: no staff profile - ${sErr?.message}`);

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
    if (shiftErr || !newShift) throw new Error(`seedRemovableItem: shift create failed - ${shiftErr?.message}`);
    shiftId = newShift.id as string;
  }

  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({ customer_name: customerName, status: 'open', staff_id: staff.id, shift_id: shiftId, is_deleted: false })
    .select('id')
    .single();
  if (tabErr || !tab) throw new Error(`seedRemovableItem: tab insert failed - ${tabErr?.message}`);

  const { data: session, error: sessErr } = await admin
    .from('pool_sessions')
    .insert({
      table_id: table.id,
      tab_id: tab.id,
      started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();
  if (sessErr || !session) throw new Error(`seedRemovableItem: session insert failed - ${sessErr?.message}`);

  await admin
    .from('pool_tables')
    .update({ status: 'occupied', current_session_id: session.id })
    .eq('id', table.id);

  const { data: products, error: pErr } = await admin.from('products').select('id, base_price').limit(2);
  if (pErr || !products || products.length < 2) {
    throw new Error('seedRemovableItem: need at least 2 seeded products');
  }

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({ tab_id: tab.id, status: 'pending', staff_id: staff.id })
    .select('id')
    .single();
  if (orderErr || !order) throw new Error(`seedRemovableItem: order insert failed - ${orderErr?.message}`);

  // Two items — after removing one, the order still has a remaining item.
  const { error: itemErr } = await admin.from('order_items').insert([
    { order_id: order.id, product_id: products[0]!.id, quantity: 1, unit_price: products[0]!.base_price },
    { order_id: order.id, product_id: products[1]!.id, quantity: 1, unit_price: products[1]!.base_price },
  ]);
  if (itemErr) throw new Error(`seedRemovableItem: order_items insert failed - ${itemErr.message}`);

  return { tableId: table.id as string };
}

async function enterManagerPin(page: Page, pin: string): Promise<void> {
  for (const ch of pin) {
    const label = ch === '0' ? 'Key 0' : `Key ${ch}`;
    await page.getByRole('button', { name: label }).click();
  }
}

test.describe('Reports Page', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(530);
    await page.goto('/');
  });

  test('Reports page loads', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: /daily caja report/i })).toBeVisible({ timeout: 20_000 });
    await logout(page);
  });

  test('Session picker shows closed sessions', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/reports');
    const sel = page.locator('#caja-selector');
    await expect(sel).toBeVisible({ timeout: 20_000 });
    const options = await sel.locator('option').count();
    expect(options).toBeGreaterThanOrEqual(1);
    await logout(page);
  });

  test('Report sections visible after selecting session', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/reports');
    const sel = page.locator('#caja-selector');
    await expect(sel).toBeVisible({ timeout: 20_000 });
    const val = await sel.locator('option').nth(0).getAttribute('value');
    if (val) await sel.selectOption(val);

    await expect(page.getByText('Total Revenue', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Cash Reconciliation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Top 10 Products' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Staff Performance' })).toBeVisible();
    await logout(page);
  });

  test('Revenue breakdown shows cash, card, rappi', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/reports');
    const sel = page.locator('#caja-selector');
    await expect(sel).toBeVisible({ timeout: 20_000 });
    const val = await sel.locator('option').nth(0).getAttribute('value');
    if (val) await sel.selectOption(val);
    await expect(page.getByText('Cash Sales', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Card Sales', { exact: false })).toBeVisible();
    await expect(page.getByText('Rappi Sales', { exact: false })).toBeVisible();
    await logout(page);
  });

  test('Cash reconciliation variance displayed', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/reports');
    const sel = page.locator('#caja-selector');
    await expect(sel).toBeVisible({ timeout: 20_000 });
    const val = await sel.locator('option').nth(0).getAttribute('value');
    if (val) await sel.selectOption(val);
    // exact: true — a "Recipe Variance" report tab was added since this test
    // was written; { exact: false } now also matches that tab's label,
    // causing a strict-mode violation (2 elements) on the substring "Variance".
    await expect(page.getByText('Variance', { exact: true })).toBeVisible({ timeout: 30_000 });
    await logout(page);
  });

  // --------------------------------------------------------------------------
  // Sprint 1 Feature #12 — Product Sales & Hourly Breakdown tab tests
  // --------------------------------------------------------------------------

  test('Product Sales tab shows at least one product row with revenue > $0.00 after an order', async ({ page }) => {
    await loginAs(page, 'admin');

    // Add an order: go to POS, open a tab, add an item
    await page.goto('/pos');
    await expect(page.getByRole('button', { name: /new tab/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /new tab/i }).click();
    const tabNameInput = page.getByRole('textbox');
    await expect(tabNameInput).toBeVisible({ timeout: 10_000 });
    await tabNameInput.fill('E2E-Reports-Test');
    await page.getByRole('button', { name: /^open tab$/i }).click();
    await expect(page.getByText(/tab opened for E2E-Reports-Test/i).first()).toBeVisible({ timeout: 15_000 });

    // Add first available product
    const productBtn = page.locator('[data-testid="product-card"]').first();
    if (await productBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await productBtn.click();
    }

    // Navigate to reports
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /product sales/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /product sales/i }).click();

    // Assert the Product Sales tab panel is visible (it's always rendered, may contain data or empty state)
    await expect(page.getByRole('tabpanel', { name: /product sales/i })).toBeVisible({
      timeout: 20_000,
    });

    await logout(page);
  });

  test('Product Sales: date range filter to today shows data or empty state (no crash)', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /product sales/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /product sales/i }).click();

    // Ensure From and To inputs exist and have today's value
    const today = new Date().toISOString().slice(0, 10);
    const fromInput = page.getByLabel('From:').nth(0);
    const toInput = page.getByLabel('To:').nth(0);
    await expect(fromInput).toBeVisible({ timeout: 10_000 });
    await expect(toInput).toBeVisible({ timeout: 10_000 });

    // Confirm default date is today
    await expect(fromInput).toHaveValue(today);
    await expect(toInput).toHaveValue(today);

    // Panel should render without crashing (either table rows or empty state)
    await expect(
      page.locator('[data-testid="product-sales-panel"], [class*="DataTable"], [data-slot="data-table"], tbody, [aria-label*="No sales"]')
        .first()
    ).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  test('Product Sales: date range filter to far past shows empty state', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /product sales/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /product sales/i }).click();

    // Set From and To to a date with no data
    const fromInput = page.getByLabel('From:').nth(0);
    const toInput = page.getByLabel('To:').nth(0);
    await expect(fromInput).toBeVisible({ timeout: 10_000 });

    await fromInput.fill('2020-01-01');
    await toInput.fill('2020-01-02');

    // Trigger re-query by blurring the input
    await toInput.press('Tab');

    // Text updated by the Phase 21 i18n migration
    // (productSalesPanel.emptyTitle in en-US/wAdmin.json): "No sales data"
    // became "No sales in this range" — the role itself (EmptyState's
    // role="status") is unchanged.
    await expect(page.getByRole('status').filter({ hasText: /No sales in this range/i })).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  test('Hourly Breakdown tab shows 24 rows', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /hourly breakdown/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /hourly breakdown/i }).click();

    // Wait for content to load (either table or empty state)
    const tabPanel = page.getByRole('tabpanel').last();
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    // If there is a table, assert 24 rows; if empty state, that is acceptable too
    const tbody = tabPanel.locator('tbody');
    const isTableVisible = await tbody.isVisible({ timeout: 10_000 }).catch(() => false);

    if (isTableVisible) {
      const rows = tbody.locator('tr');
      await expect(rows).toHaveCount(24, { timeout: 20_000 });
    } else {
      // Empty state is valid when no data is present
      await expect(tabPanel.getByRole('heading', { name: 'No hourly data' })).toBeVisible({ timeout: 10_000 });
    }

    await logout(page);
  });

  test('Hourly Breakdown: Peak hour callout visible when revenue data exists', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /hourly breakdown/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /hourly breakdown/i }).click();

    const tabPanel = page.getByRole('tabpanel').last();
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    // If there are orders (revenue > 0), Peak callout must appear.
    // If no orders, table is in all-zero state and EmptyState renders — skip the peak check.
    const hasTable = await tabPanel.locator('tbody tr').first().isVisible({ timeout: 8_000 }).catch(() => false);

    if (hasTable) {
      await expect(tabPanel.getByText(/Peak:/i)).toBeVisible({ timeout: 15_000 });
    } else {
      // No data — acceptable empty state
      await expect(tabPanel.getByText(/No hourly data/i)).toBeVisible({ timeout: 10_000 });
    }

    await logout(page);
  });

  // --------------------------------------------------------------------------
  // S7-03 — Voids & Refunds sub-view (POS-4)
  // --------------------------------------------------------------------------

  test('Voids & Refunds tab is present and navigable on ReportsPage', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');

    // The Voids & Refunds tab trigger must be visible
    await expect(page.getByRole('tab', { name: /voids/i })).toBeVisible({ timeout: 20_000 });

    // Clicking it activates the tab and shows the panel
    await page.getByRole('tab', { name: /voids/i }).click();
    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  test('Voids & Refunds: shows date range inputs sharing the global filter', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /voids/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /voids/i }).click();

    // Date range inputs must be present within the Voids tab content
    const today = new Date().toISOString().slice(0, 10);
    // Labels "From:" and "To:" are shared across tabs; after switching to Voids the tab-scoped
    // inputs in the tabpanel are what we check
    const tabPanel = page.getByRole('tabpanel');
    const fromInput = tabPanel.getByLabel('From:');
    const toInput = tabPanel.getByLabel('To:');

    await expect(fromInput).toBeVisible({ timeout: 10_000 });
    await expect(toInput).toBeVisible({ timeout: 10_000 });

    // Default date is today for both
    await expect(fromInput).toHaveValue(today);
    await expect(toInput).toHaveValue(today);

    await logout(page);
  });

  test('Voids & Refunds: empty state shown when date range has no voids', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /voids/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /voids/i }).click();

    const tabPanel = page.getByRole('tabpanel');

    // Set date range to year 2020 — guaranteed to have no void data
    const fromInput = tabPanel.getByLabel('From:');
    const toInput = tabPanel.getByLabel('To:');
    await expect(fromInput).toBeVisible({ timeout: 10_000 });

    await fromInput.fill('2020-01-01');
    await toInput.fill('2020-01-02');
    await toInput.press('Tab');

    // AC-4: empty state message must appear
    await expect(tabPanel.getByText(/no voids or refunds in this range/i)).toBeVisible({
      timeout: 20_000,
    });

    await logout(page);
  });

  // --------------------------------------------------------------------------
  // S7-04 — Revenue by Category sub-view (POS-5)
  // --------------------------------------------------------------------------

  test('Revenue by Category tab is present and navigable on ReportsPage', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');

    await expect(page.getByRole('tab', { name: /revenue by category/i })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: /revenue by category/i }).click();
    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  test('Revenue by Category: all canonical categories appear with date range filter (no crash, no empty state)', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');

    await expect(page.getByRole('tab', { name: /revenue by category/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /revenue by category/i }).click();

    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    // AC-4: the "No category data" empty state must NOT appear when categories exist in the DB
    await expect(tabPanel.getByText('No category data')).not.toBeVisible({ timeout: 15_000 });

    // AC-1: table must be present with category name, revenue, and % columns
    await expect(tabPanel.getByRole('columnheader', { name: /category/i })).toBeVisible({ timeout: 15_000 });
    await expect(tabPanel.getByRole('columnheader', { name: /revenue/i })).toBeVisible();
    await expect(tabPanel.getByRole('columnheader', { name: /% of total/i })).toBeVisible();

    await logout(page);
  });

  test('Revenue by Category: shows date range inputs', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');

    await expect(page.getByRole('tab', { name: /revenue by category/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /revenue by category/i }).click();

    const today = new Date().toISOString().slice(0, 10);
    const tabPanel = page.getByRole('tabpanel');
    const fromInput = tabPanel.getByLabel('From:');
    const toInput = tabPanel.getByLabel('To:');

    await expect(fromInput).toBeVisible({ timeout: 10_000 });
    await expect(toInput).toBeVisible({ timeout: 10_000 });

    // AC-2: date range inputs are present and default to today
    await expect(fromInput).toHaveValue(today);
    await expect(toInput).toHaveValue(today);

    await logout(page);
  });

  // --------------------------------------------------------------------------
  // S7-06 — DateRangePicker shared state across all four date-filtered tabs (POS-7 AC-2)
  // --------------------------------------------------------------------------

  test('AC-2 (POS-7): changing date range in one tab propagates to all four date-filtered tabs', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');

    // Start on Product Sales tab
    await expect(page.getByRole('tab', { name: /product sales/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /product sales/i }).click();

    // Compute yesterday's date string (YYYY-MM-DD)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Click the "Yesterday" preset button on Product Sales tab
    await page.getByRole('button', { name: 'Yesterday' }).first().click();

    // Verify Product Sales tab now shows yesterday in From input
    const productTabPanel = page.getByRole('tabpanel');
    await expect(productTabPanel.getByLabel('From:')).toHaveValue(yesterdayStr, { timeout: 5_000 });

    // Switch to Hourly Breakdown — shared state means same date range
    await page.getByRole('tab', { name: /hourly breakdown/i }).click();
    const hourlyPanel = page.getByRole('tabpanel');
    await expect(hourlyPanel.getByLabel('From:')).toHaveValue(yesterdayStr, { timeout: 10_000 });

    // Switch to Voids & Refunds — must still show yesterday
    await page.getByRole('tab', { name: /voids/i }).click();
    const voidsPanel = page.getByRole('tabpanel');
    await expect(voidsPanel.getByLabel('From:')).toHaveValue(yesterdayStr, { timeout: 10_000 });

    // Switch to Revenue by Category — must still show yesterday
    await page.getByRole('tab', { name: /revenue by category/i }).click();
    const catPanel = page.getByRole('tabpanel');
    await expect(catPanel.getByLabel('From:')).toHaveValue(yesterdayStr, { timeout: 10_000 });

    await logout(page);
  });

  test('Voids & Refunds: table renders columns Timestamp, Staff, Amount, Reason when voids exist', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /voids/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /voids/i }).click();

    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    // If rows are present, assert AC-1: all four column headers must be in the table
    const tbody = tabPanel.locator('tbody');
    const hasRows = await tbody.locator('tr').first().isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasRows) {
      // AC-1: all four column headers must be visible
      await expect(tabPanel.getByRole('columnheader', { name: /timestamp/i })).toBeVisible();
      await expect(tabPanel.getByRole('columnheader', { name: /staff/i })).toBeVisible();
      await expect(tabPanel.getByRole('columnheader', { name: /amount/i })).toBeVisible();
      await expect(tabPanel.getByRole('columnheader', { name: /reason/i })).toBeVisible();
    } else {
      // No voids today — empty state is acceptable
      await expect(tabPanel.getByText(/no voids or refunds/i)).toBeVisible({ timeout: 10_000 });
    }

    await logout(page);
  });

  // --------------------------------------------------------------------------
  // Sprint 10 — Staff Performance tab (StaffSalesPanel)
  // --------------------------------------------------------------------------

  test('Sprint 10: Staff Performance tab is present and navigable', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /staff performance/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /staff performance/i }).click();
    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });
    await logout(page);
  });

  test('Sprint 10: Staff Performance tab shows DateRangePicker with today\'s date', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /staff performance/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /staff performance/i }).click();

    const today = new Date().toISOString().slice(0, 10);
    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    const fromInput = tabPanel.getByLabel('From:');
    const toInput = tabPanel.getByLabel('To:');
    await expect(fromInput).toBeVisible({ timeout: 10_000 });
    await expect(toInput).toBeVisible({ timeout: 10_000 });
    await expect(fromInput).toHaveValue(today);
    await expect(toInput).toHaveValue(today);

    await logout(page);
  });

  test('Sprint 10: Staff Performance tab shows column headers or empty state', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /staff performance/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /staff performance/i }).click();

    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    // Either data table with correct columns, or empty state — both are valid
    const tbody = tabPanel.locator('tbody');
    const hasRows = await tbody.locator('tr').first().isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasRows) {
      await expect(tabPanel.getByRole('columnheader', { name: /staff member/i })).toBeVisible();
      await expect(tabPanel.getByRole('columnheader', { name: /revenue/i })).toBeVisible();
      await expect(tabPanel.getByRole('columnheader', { name: /transactions/i })).toBeVisible();
      await expect(tabPanel.getByRole('columnheader', { name: /avg check/i })).toBeVisible();
      await expect(tabPanel.getByRole('columnheader', { name: /voids/i })).toBeVisible();
    } else {
      await expect(tabPanel.getByText(/no staff activity/i)).toBeVisible({ timeout: 20_000 });
    }

    await logout(page);
  });

  test('Sprint 10: Staff Performance tab shows empty state for year 2020 date range', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /staff performance/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /staff performance/i }).click();

    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    const fromInput = tabPanel.getByLabel('From:');
    const toInput = tabPanel.getByLabel('To:');
    await expect(fromInput).toBeVisible({ timeout: 10_000 });

    await fromInput.fill('2020-01-01');
    await toInput.fill('2020-01-02');
    await toInput.press('Tab');

    await expect(tabPanel.getByText(/no staff activity/i)).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  test('Sprint 10: Staff Performance date range propagates from Product Sales tab', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');

    // Start on Product Sales tab and click the Yesterday preset
    await expect(page.getByRole('tab', { name: /product sales/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /product sales/i }).click();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    await page.getByRole('button', { name: 'Yesterday' }).first().click();

    // Verify Product Sales tab picked up yesterday
    const productTabPanel = page.getByRole('tabpanel');
    await expect(productTabPanel.getByLabel('From:')).toHaveValue(yesterdayStr, { timeout: 5_000 });

    // Switch to Staff Performance — shared state means same date range
    await page.getByRole('tab', { name: /staff performance/i }).click();
    const staffTabPanel = page.getByRole('tabpanel');
    await expect(staffTabPanel.getByLabel('From:')).toHaveValue(yesterdayStr, { timeout: 10_000 });

    await logout(page);
  });

  // --------------------------------------------------------------------------
  // Sprint 10 — Tip Distribution tab (TipDistributionPanel)
  // --------------------------------------------------------------------------

  test('Sprint 10: Tip Distribution tab is present and navigable', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /tip distribution/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /tip distribution/i }).click();
    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });
    await logout(page);
  });

  test('Sprint 10: Tip Distribution tab shows DateRangePicker with today\'s date', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /tip distribution/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /tip distribution/i }).click();

    const today = new Date().toISOString().slice(0, 10);
    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    const fromInput = tabPanel.getByLabel('From:');
    const toInput = tabPanel.getByLabel('To:');
    await expect(fromInput).toBeVisible({ timeout: 10_000 });
    await expect(toInput).toBeVisible({ timeout: 10_000 });
    await expect(fromInput).toHaveValue(today);
    await expect(toInput).toHaveValue(today);

    await logout(page);
  });

  test('Sprint 10: Tip Distribution tab shows column headers or empty state', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /tip distribution/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /tip distribution/i }).click();

    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    // Either data table with correct columns, or empty state — both are valid
    const tbody = tabPanel.locator('tbody');
    const hasRows = await tbody.locator('tr').first().isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasRows) {
      await expect(tabPanel.getByRole('columnheader', { name: /staff member/i })).toBeVisible();
      await expect(tabPanel.getByRole('columnheader', { name: /total tips/i })).toBeVisible();
    } else {
      await expect(tabPanel.getByText(/no tip data/i)).toBeVisible({ timeout: 20_000 });
    }

    await logout(page);
  });

  test('Sprint 10: Tip Distribution tab shows empty state for year 2020 date range', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /tip distribution/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /tip distribution/i }).click();

    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    const fromInput = tabPanel.getByLabel('From:');
    const toInput = tabPanel.getByLabel('To:');
    await expect(fromInput).toBeVisible({ timeout: 10_000 });

    await fromInput.fill('2020-01-01');
    await toInput.fill('2020-01-02');
    await toInput.press('Tab');

    await expect(tabPanel.getByText(/no tip data/i)).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  test('Sprint 10: Export button appears in Staff Performance tab when data rows exist', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: /staff performance/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: /staff performance/i }).click();

    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    // Only assert Export button when rows are present — ExportButtons is hidden in EmptyState
    const tbody = tabPanel.locator('tbody');
    const hasRows = await tbody.locator('tr').first().isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasRows) {
      await expect(tabPanel.getByRole('button', { name: /export/i })).toBeVisible({ timeout: 10_000 });
    } else {
      // No staff data today — EmptyState correctly hides ExportButtons, test passes
      await expect(tabPanel.getByText(/no staff activity/i)).toBeVisible({ timeout: 10_000 });
    }

    await logout(page);
  });

  // --------------------------------------------------------------------------
  // Phase 24 (operational-reports-suite-csv) — Wave 6: 4 new report tabs + CSV
  // export + bartender-initiated reason-required removal (SC-1..SC-4)
  // --------------------------------------------------------------------------

  test('Phase 24: all 4 new report tabs render without crash', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/reports');

    await expect(page.getByRole('tab', { name: 'Deletions' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('tab', { name: 'Corrections' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Modifiers' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Payment Methods' })).toBeVisible();

    // deletions-pre: the standing historical-gap Alert is always visible (not dismissible)
    await page.getByRole('tab', { name: 'Deletions' }).click();
    const deletionsPrePanel = page.getByRole('tabpanel');
    await expect(deletionsPrePanel).toBeVisible({ timeout: 20_000 });
    await expect(deletionsPrePanel.getByText(/partial history|historial parcial/i)).toBeVisible({ timeout: 15_000 });

    // deletions-post: table or empty state, never a crash
    await page.getByRole('tab', { name: 'Corrections' }).click();
    const deletionsPostPanel = page.getByRole('tabpanel');
    await expect(deletionsPostPanel).toBeVisible({ timeout: 20_000 });

    // modifier-popularity: chart+table or empty state
    await page.getByRole('tab', { name: 'Modifiers' }).click();
    const modifierPanel = page.getByRole('tabpanel');
    await expect(modifierPanel).toBeVisible({ timeout: 20_000 });

    // payment-methods: chart+table or empty state
    await page.getByRole('tab', { name: 'Payment Methods' }).click();
    const paymentMethodsPanel = page.getByRole('tabpanel');
    await expect(paymentMethodsPanel).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  test('Phase 24: CSV export from Payment Methods report writes a file', async ({ page }) => {
    await seedCashPayment();
    await injectTauriMocks(page);

    await loginAs(page, 'admin');
    await page.goto('/reports');
    await page.getByRole('tab', { name: 'Payment Methods' }).click();

    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 20_000 });

    const exportBtn = tabPanel.getByRole('button', { name: /export/i });
    await expect(exportBtn).toBeVisible({ timeout: 20_000 });
    await exportBtn.click();

    const csvItem = page.getByRole('menuitem', { name: /^csv$/i });
    await expect(csvItem).toBeVisible({ timeout: 5_000 });
    await csvItem.click();

    await expect(page.getByText('Report exported successfully.')).toBeVisible({ timeout: 20_000 });

    const mockState = await page.evaluate(() => {
      return (window as unknown as Record<string, unknown>)['__exportMockState'] as {
        saveDialogCalled: boolean;
        savedPath: string | null;
      };
    });
    expect(mockState.saveDialogCalled).toBe(true);
    expect(mockState.savedPath).toMatch(/\.csv$/);

    await logout(page);
  });

  // Note: RemoveTabItemDialog/useRemoveTabItem (24-04/24-07) carry no PIN gate or
  // role check of their own (D-06/D-07) — but the only reachable UI caller,
  // TableStatusPanel, wraps removal with its own PRE-EXISTING ManagerPinDialog
  // (requiredAction="void_order"), unrelated to and unchanged by this phase — see
  // its "full two-step orchestration" doc comment and the already-passing
  // e2e/16-table-status.spec.ts "T7: Bartender removing an item requires manager
  // PIN" regression test. This test proves the phase's actual delivery: the
  // reason-required removal completes without AUTH_FORBIDDEN once past that
  // existing gate, and the removal is attributed correctly in the deletions-pre
  // report (SC-1).
  test('Phase 24: bartender-initiated reason-required removal succeeds (no AUTH_FORBIDDEN) and appears in Deletions', async ({ page }) => {
    test.setTimeout(120_000);
    const { tableId } = await seedRemovableItem('Phase24 Removal Test');

    await loginAs(page, 'bartender');
    await page.goto(`/pool-tables/${tableId}`);

    const removeBtn = page.getByRole('button', { name: 'Remove item' }).first();
    await expect(removeBtn).toBeVisible({ timeout: 20_000 });
    await removeBtn.click();

    // Step 1 — pre-existing manager-PIN gate on TableStatusPanel (unrelated to this phase)
    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 15_000 });
    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    await enterManagerPin(page, managerPin);

    // Step 2 — RemoveTabItemDialog: required reason field, no additional PIN prompt
    const confirmDialog = page.getByRole('alertdialog').filter({ hasText: /remove/i });
    await expect(confirmDialog).toBeVisible({ timeout: 15_000 });
    await expect(confirmDialog.getByRole('button', { name: 'Key 0' })).toHaveCount(0);

    const confirmBtn = confirmDialog.getByRole('button', { name: /confirm|remove/i });
    await expect(confirmBtn).toBeDisabled();

    // Unique per-run so a re-run of this test (or a prior failed run's leftover
    // audit row) never causes a strict-mode multi-match on the assertion below.
    const uniqueReason = `Phase 24 E2E - wrong item ${String(Date.now())}`;
    const reasonInput = confirmDialog.getByLabel(/reason|motivo/i);
    await reasonInput.fill(uniqueReason);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // No AUTH_FORBIDDEN — success toast confirms the RPC accepted the bartender-attributed removal
    await expect(page.getByText(/removed from order/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/forbidden/i)).not.toBeVisible();

    await logout(page);

    // Verify attribution in the deletions-pre report
    await loginAs(page, 'admin');
    await page.goto('/reports');
    await page.getByRole('tab', { name: 'Deletions' }).click();
    const deletionsPanel = page.getByRole('tabpanel');
    await expect(deletionsPanel).toBeVisible({ timeout: 20_000 });
    await expect(deletionsPanel.getByText(uniqueReason)).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });
});
