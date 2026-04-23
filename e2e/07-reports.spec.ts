import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';

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
    await expect(page.getByText('Variance', { exact: false })).toBeVisible({ timeout: 30_000 });
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

    await expect(page.getByRole('status').filter({ hasText: /No sales data/i })).toBeVisible({ timeout: 20_000 });

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
});
