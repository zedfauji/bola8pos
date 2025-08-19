/// <reference types="node" />
import { test, expect } from '@playwright/test';

// E2E: ShiftBar payout threshold + PIN enforcement
// We mock backend API endpoints via route.fulfill to make tests hermetic.

const APP_URL = process.env.E2E_URL || 'http://localhost:5173';

test.describe('ShiftBar e2e', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure no cached settings interfere and mark E2E mode
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch {}
      // @ts-ignore
      (window as any).__E2E__ = true;
      // Avoid native print dialogs blocking tests
      const _open = window.open;
      window.open = function(...args) {
        const w = _open.apply(this, args);
        try { w.print = () => {}; } catch {}
        return w;
      } as any;
    });

    // Default mocks used by most tests
    // Settings: ensure lifecycle and refund PINs are disabled, and set payout threshold high
    await page.route('**/api/settings*', async (route) => {
      const url = new URL(route.request().url());
      const key = url.pathname.split('/').pop() || '';
      const defaults: Record<string, any> = {
        access: {
          requirePinLifecycle: false,
          requirePinVoidComp: false,
          requirePinRefund: false,
          approvalThresholds: { cashPayoutAmount: 100 },
        },
        store: {},
        printing: {},
        taxes: {},
        tips: {},
      };
      const value = defaults[key] ?? {};
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value }) });
    });
    // Active shift present
    await page.route('**/api/shifts/active', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'S1', movements: [], expected: 0 }) });
    });

    // Open/Close endpoints (noop)
    await page.route('**/api/shifts/open', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'S1' }) });
    });
    await page.route('**/api/shifts/S1/close', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
  });

  test('close shift with denominations calculates counted and posts it', async ({ page }) => {
    // Mock window.prompt to return a PIN automatically
    await page.addInitScript(() => {
      window.prompt = () => '1234'; // Return a mock PIN
    });

    // Enable console logging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Log all network requests
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log('REQUEST:', request.method(), request.url());
      }
    });

    // Mock active shift with expected = 150.00
    await page.unroute('**/api/shifts/active');
    await page.route('**/api/shifts/active', async (route) => {
      console.log('Active shift route intercepted');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'S2', movements: [], expected: 150 }) });
    });

    // Mock PIN verification for close action
    await page.route('**/api/admin/verify-pin', async (route) => {
      console.log('PIN verification route intercepted');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    // Intercept close to assert counted
    let postedCounted = 0;
    await page.route('**/api/shifts/*/close', async (route) => {
      console.log('Close route intercepted, URL:', route.request().url());
      const data = JSON.parse(route.request().postData() || '{}');
      postedCounted = Number(data.end_cash_counted || 0);
      console.log('Close route intercepted, counted:', postedCounted);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto(APP_URL);
    await expect(page.getByText('Shift: S2')).toBeVisible();
    // Disambiguate from Toastify close button
    await page.locator('button:not(.Toastify__close-button)', { hasText: 'Close' }).first().click();
    // Target the actual modal dialog
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Ensure Use Denominations is ON (default on)
    const denomGrid = modal.locator('input.pos-input').first();
    await expect(denomGrid).toBeVisible();

    // Enter some denominations: 2x $50, 1x $20, 3x $5 = 50*2 + 20*1 + 5*3 = 135
    // plus 15 in coins: 10x $1 = 10, 20x $0.25 = 5 → total 150
    const setDenom = async (value: number, qty: number) => {
      const input = modal.locator(`[data-testid="denom-input-${value}"]`);
      await expect(input).toBeVisible();
      await input.fill(String(qty));
    };
    await setDenom(50, 2);
    await setDenom(20, 1);
    await setDenom(5, 3);
    await setDenom(1, 10);
    await setDenom(0.25, 20);

    // Counted preview should show 150.00
    await expect(modal.locator('text=Counted').locator('xpath=..').locator('text="$150.00"')).toBeVisible();
    // Over/Short should be 0.00
    await expect(modal.locator('text=Over / Short').locator('xpath=..').locator('text="0.00"')).toBeVisible();

    console.log('About to click Close button');
    
    // Debug modal state
    const modalCount = await page.locator('[role="dialog"]').count();
    console.log('Number of modals found:', modalCount);
    
    // Try multiple selectors for the close button
    const closeButton1 = modal.getByRole('button', { name: 'Close' });
    const closeButton2 = modal.locator('button:has-text("Close")');
    const closeButton3 = page.locator('[data-testid="modal-close-shift"] button:has-text("Close")');
    
    console.log('Close button 1 visible:', await closeButton1.isVisible());
    console.log('Close button 2 visible:', await closeButton2.isVisible());
    console.log('Close button 3 visible:', await closeButton3.isVisible());
    
    // Listen for any JavaScript errors
    page.on('pageerror', error => {
      console.log('PAGE ERROR:', error.message);
    });
    
    // Try clicking the most specific button
    const targetButton = await closeButton3.isVisible() ? closeButton3 : closeButton1;
    console.log('Using button selector, clicking now');
    await targetButton.click({ force: true });
    console.log('Close button clicked, waiting for API call');
    
    // Wait a bit to see if API call happens
    await page.waitForTimeout(2000);
    console.log('After 2s wait, postedCounted =', postedCounted);
    
    await expect.poll(() => postedCounted).toBe(150);
  });

  test('Shift History page shows list and summary', async ({ page }) => {
    // Provide history and summary payloads
    await page.route('**/api/shifts/history?**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 'H1', opened_at: '2025-08-12 08:00:00', closed_at: '2025-08-12 16:00:00', start_cash: 100, expected_cash: 450, end_cash_counted: 450, over_short: 0 },
        { id: 'H0', opened_at: '2025-08-11 08:00:00', closed_at: '2025-08-11 16:00:00', start_cash: 50, expected_cash: 300, end_cash_counted: 295, over_short: -5 }
      ]) });
    });
    await page.route('**/api/shifts/H1/summary', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        shift: { id: 'H1', start_cash: 100, end_cash_counted: 450 },
        cash_sales: 400,
        drops_total: 0,
        payouts_total: 50,
        adjustments_total: 0,
        expected_cash: 450,
        over_short: 0,
        movements: [
          { type: 'payout', amount: 50, reason: 'Supplies', created_at: '2025-08-12 12:00:00' }
        ]
      }) });
    });

    await page.goto(APP_URL);
    await page.getByRole('link', { name: 'Shift History' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Shift History' })).toBeVisible();
    // List shows H1 and H0
    await expect(page.getByText('Shift #H1')).toBeVisible();
    await expect(page.getByText('Shift #H0')).toBeVisible();
    await page.getByText('Shift #H1').click();
    // Summary tiles
    await expect(page.getByText('Start Cash')).toBeVisible();
    await expect(page.getByText('$100.00')).toBeVisible();
    await expect(page.getByText('Expected Cash')).toBeVisible();
    // Scope to the Expected Cash tile to avoid duplicates
    const expectedTile = page.locator('text=Expected Cash').locator('xpath=..');
    await expect(expectedTile.locator('text="$450.00"')).toBeVisible();
    await expect(page.getByText('Over / Short')).toBeVisible();
    // Movements table row
    await expect(page.getByText('Supplies')).toBeVisible();
  });

  test('app launches', async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page).toHaveTitle(/POS/i);
  });

  test('payout requires PIN (always)', async ({ page }) => {
    let movementCalled = false;
    let verifyCalled = false;

    // Clear any existing routes first
    await page.unroute('**/api/shifts/*/movement');
    await page.unroute('**/api/admin/verify-pin');

    await page.route('**/api/admin/verify-pin', async (route) => {
      verifyCalled = true; // must be called
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.route('**/api/shifts/*/movement', async (route) => {
      console.log('Movement route intercepted, URL:', route.request().url());
      movementCalled = true;
      const req = route.request();
      const data = JSON.parse(req.postData() || '{}');
      console.log('Movement route intercepted, data:', data);
      expect(data.type).toBe('payout');
      expect(Number(data.amount)).toBeGreaterThan(0);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto(APP_URL);
    // Wait for shift to load and payout button to be visible
    await expect(page.getByText('Shift: S1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Payout' })).toBeVisible();
    await page.getByRole('button', { name: 'Payout' }).click();
    // Wait for movement modal to appear
    await expect(page.locator('[data-testid="movement-amount"]')).toBeVisible();
    const dialog = page.getByRole('dialog');
    const addBtn = dialog.locator('button.pos-button:has-text("Add")');
    await expect(addBtn).toBeVisible();
    // Ensure amount is provided (UI default may be empty)
    await page.locator('[data-testid="movement-amount"]').fill('20');
    // Accept PIN prompt with a valid PIN
    page.once('dialog', async (dlg) => { await dlg.accept('1234'); });
    await addBtn.click({ force: true });
    await expect.poll(() => movementCalled, { timeout: 10000 }).toBeTruthy();
    await expect.poll(() => verifyCalled, { timeout: 5000 }).toBeTruthy();
  });

  test('payout at/above threshold requires PIN (success)', async ({ page }) => {
    // Lower threshold so default amount (20) triggers requirement
    await page.route('**/api/settings*', async (route) => {
      const url = new URL(route.request().url());
      const key = url.pathname.split('/').pop() || '';
      const overrides: Record<string, any> = {
        access: {
          requirePinLifecycle: false,
          requirePinVoidComp: false,
          requirePinRefund: false,
          approvalThresholds: { cashPayoutAmount: 20 },
        },
      };
      const value = overrides[key] ?? {};
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value }) });
    });

    let verifyCalled = false;
    await page.route('**/api/admin/verify-pin', async (route) => {
      verifyCalled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    let movementCalled = false;
    await page.route('**/api/shifts/**/movement', async (route) => {
      movementCalled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto(APP_URL);
    await page.getByRole('button', { name: 'Payout' }).click();
    await expect(page.locator('[data-testid="movement-amount"]')).toBeVisible();

    // Accept PIN prompt
    page.once('dialog', async (dlg) => {
      await dlg.accept('1234');
    });
    const movementReq2 = page.waitForRequest((req) => req.url().includes('/api/shifts/') && req.url().includes('/movement') && req.method() === 'POST');
    const addBtn2 = page.locator('div.fixed.inset-0').locator('button.pos-button:has-text("Add")');
    await expect(addBtn2).toBeVisible();
    await addBtn2.click();
    await movementReq2;
    await expect.poll(() => verifyCalled).toBeTruthy();
    await expect.poll(() => movementCalled).toBeTruthy();
  });

  test('payout at/above threshold with invalid PIN blocks', async ({ page }) => {
    // Lower threshold to force PIN
    await page.route('**/api/settings*', async (route) => {
      const url = new URL(route.request().url());
      const key = url.pathname.split('/').pop() || '';
      const overrides: Record<string, any> = {
        access: {
          requirePinLifecycle: false,
          requirePinVoidComp: false,
          requirePinRefund: false,
          approvalThresholds: { cashPayoutAmount: 20 },
        },
      };
      const value = overrides[key] ?? {};
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value }) });
    });

    await page.route('**/api/admin/verify-pin', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
    });
    let movementCalled = false;
    await page.route('**/api/shifts/**/movement', async (route) => {
      movementCalled = true; // should not be called
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto(APP_URL);
    await page.getByRole('button', { name: 'Payout' }).click();

    // Provide bad PIN
    page.once('dialog', async (dlg) => {
      await dlg.accept('0000');
    });
    await page.getByRole('button', { name: 'Add' }).click();

    // Expect inline error and no movement call
    await expect(page.locator('text=Invalid PIN')).toBeVisible();
    await expect.poll(() => movementCalled).toBeFalsy();
  });

  test('print summary opens window', async ({ page, context }) => {
    await page.goto(APP_URL);
    // Ensure specific shift label to avoid strict violation
    await expect(page.getByText('Shift: S1')).toBeVisible();
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Print' }).click(),
    ]);
    await popup.waitForLoadState();
    await expect(popup).toHaveTitle(/Shift Summary/i);
    await popup.close();
  });
});
