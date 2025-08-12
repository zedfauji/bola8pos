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
    // Settings: default threshold high (no PIN below threshold)
    await page.route('**/api/settings*', async (route) => {
      const url = new URL(route.request().url());
      const key = url.pathname.split('/').pop() || '';
      // Return minimal settings blobs depending on key
      const defaults: Record<string, any> = {
        access: {
          requirePinLifecycle: false,
          approvalThresholds: { cashPayoutAmount: 100 },
        },
        store_config: {},
        printing: {},
        taxes: {},
        tips: {},
      };
      const body = defaults[key] ?? defaults;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
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

  test('app launches', async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page).toHaveTitle(/POS/i);
  });

  test('payout below threshold skips PIN', async ({ page }) => {
    let movementCalled = false;
    let verifyCalled = false;
    await page.route('**/api/admin/verify-pin', async (route) => {
      verifyCalled = true; // should not be called
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.route('**/api/shifts/**/movement', async (route) => {
      movementCalled = true;
      const req = route.request();
      const data = JSON.parse(req.postData() || '{}');
      expect(data.type).toBe('payout');
      // default amount in UI payload is 20 for payout
      expect(Number(data.amount)).toBeGreaterThan(0);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    // Dismiss any stray dialogs to avoid hard failures
    page.on('dialog', async (dlg) => { await dlg.dismiss(); });

    await page.goto(APP_URL);
    // Wait for shift to load and payout button to be visible
    await expect(page.getByText('Shift: S1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Payout' })).toBeVisible();
    await page.getByRole('button', { name: 'Payout' }).click();
    // Wait for movement modal to appear
    await expect(page.locator('[data-testid="movement-amount"]')).toBeVisible();
    const addBtn = page.locator('div.fixed.inset-0').locator('button.pos-button:has-text("Add")');
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await expect.poll(() => movementCalled).toBeTruthy();
    await expect.poll(() => verifyCalled).toBeFalsy();
  });

  test('payout at/above threshold requires PIN (success)', async ({ page }) => {
    // Lower threshold so default amount (20) triggers requirement
    await page.route('**/api/settings*', async (route) => {
      const url = new URL(route.request().url());
      const key = url.pathname.split('/').pop() || '';
      const overrides: Record<string, any> = {
        access: {
          requirePinLifecycle: false,
          approvalThresholds: { cashPayoutAmount: 20 },
        },
      };
      const body = overrides[key] ?? overrides;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
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
          approvalThresholds: { cashPayoutAmount: 20 },
        },
      };
      const body = overrides[key] ?? overrides;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
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
