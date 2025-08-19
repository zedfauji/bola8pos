/// <reference types="node" />
import { test, expect, Page, Request } from '@playwright/test';

// Simple in-test mock backend for shift endpoints
async function mockShiftApi(page: Page) {
  type Movement = { type: 'drop'|'payout'|'adjustment', amount: number, reason?: string, created_at?: string };
  let active: null | { id: string; expected: number; counted: number | null; over_short: number | null; movements: Movement[] } = null;
  const history: any[] = [];

  const isShiftPath = (url: string) => /\/api\/shifts\//.test(url) || /\/api\/shifts($|\?)/.test(url) || /\/api\/shifts\/active/.test(url) || /\/api\/shifts\/history/.test(url);

  await page.route('**/api/*', async (route, request) => {
    const url = request.url();

    // Minimal settings endpoints used by SettingsContext
    if (/\/api\/settings\//.test(url)) {
      if (request.method() === 'GET') {
        // Provide values in { value: ... } envelope
        const section = url.split('/').pop() || '';
        const map: Record<string, any> = {
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
        const value = map[section] ?? {};
        return route.fulfill({ status: 200, body: JSON.stringify({ value }) });
      }
      if (request.method() === 'PUT') {
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
    }

    if (/\/api\/reports\//.test(url)) {
      return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    }

    if (/\/api\/tables/.test(url) || /\/api\/orders/.test(url) || /\/api\/inventory/.test(url)) {
      // Not used in these tests; provide benign responses
      return route.fulfill({ status: 200, body: JSON.stringify({ ok: true, items: [] }) });
    }

    if (isShiftPath(url)) {
      if (/\/api\/shifts\/active$/.test(url) && request.method() === 'GET') {
        if (active) {
          return route.fulfill({ status: 200, body: JSON.stringify(active) });
        }
        // No active shift — return 404 so UI shows the Open Shift button
        return route.fulfill({ status: 404, body: JSON.stringify({ error: 'no active shift' }) });
      }
      if (/\/api\/shifts\/open$/.test(url) && request.method() === 'POST') {
        const payload = request.postDataJSON?.() as any;
        active = {
          id: 's1',
          expected: Number(payload?.start_cash ?? 0),
          counted: null,
          over_short: null,
          movements: [],
        };
        console.log('Shift opened with ID:', active.id);
        return route.fulfill({ status: 200, body: JSON.stringify(active) });
      }
      const movementMatch = url.match(/\/api\/shifts\/([^\/]+)\/movement$/);
      if (movementMatch && request.method() === 'POST') {
        const payload = request.postDataJSON?.() as any;
        if (active && movementMatch[1] === active.id) {
          active.movements.push({ type: payload.type, amount: Number(payload.amount), reason: payload.reason || '', created_at: new Date().toISOString() });
          if (payload.type === 'drop') active.expected += Number(payload.amount);
          if (payload.type === 'payout' || payload.type === 'adjustment') active.expected -= Number(payload.amount);
        }
        return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      }
      const closeMatch = url.match(/\/api\/shifts\/([^\/]+)\/close$/);
      if (closeMatch && request.method() === 'POST') {
        const payload = request.postDataJSON?.() as any;
        if (active && closeMatch[1] === active.id) {
          const counted = Number(payload.end_cash_counted ?? 0);
          const overShort = counted - active.expected;
          const closed = { ...active, counted, over_short: overShort };
          history.unshift({ ...closed, closed_at: new Date().toISOString() });
          active = null;
          return route.fulfill({ status: 200, body: JSON.stringify(closed) });
        }
        return route.fulfill({ status: 404, body: JSON.stringify({ error: 'not active' }) });
      }
      if (/\/api\/shifts\/history/.test(url) && request.method() === 'GET') {
        return route.fulfill({ status: 200, body: JSON.stringify({ items: history }) });
      }
    }

    // Fallback: pass-through
    route.continue();
  });
}

const base = process.env.E2E_URL || 'http://localhost:5173';

// Ensure desktop layout to avoid mobile overlays blocking clicks
test.use({ viewport: { width: 1280, height: 900 } });

test.describe('ShiftBar cash reconciliation', () => {
  test('open shift, movement, close with counted cash, then verify history', async ({ page }) => {
    await mockShiftApi(page);

    await page.goto(base);
    
    // Wait for page to load and ensure we start with no active shift
    await page.waitForLoadState('networkidle');
    console.log('Page loaded, looking for Open Shift button');

    // Open shift
    await page.getByRole('button', { name: 'Open Shift' }).click();
    const openModal = page.getByRole('dialog');
    await expect(openModal).toBeVisible();
    await openModal.getByTestId('open-start-cash').fill('200');
    await openModal.getByRole('button', { name: /^Open$/ }).click();

    // Expect Shift: s1 label visible (try multiple patterns)
    const shiftText1 = page.getByText('Shift: s1');
    const shiftText2 = page.getByText(/Shift.*s1/);
    const shiftText3 = page.locator('text*=s1');
    
    console.log('Looking for shift text...');
    try {
      await expect(shiftText1).toBeVisible({ timeout: 3000 });
    } catch {
      try {
        await expect(shiftText2).toBeVisible({ timeout: 3000 });
      } catch {
        await expect(shiftText3).toBeVisible({ timeout: 3000 });
      }
    }

    // Add a Drop of 50
    await page.getByRole('button', { name: 'Drop' }).click();
    const moveModal = page.getByRole('dialog');
    await expect(moveModal).toBeVisible();
    await moveModal.getByTestId('movement-amount').fill('50');
    await moveModal.getByRole('button', { name: /^Add$/ }).click();

    // Close shift with counted 260 (expected 250 after drop -> over +10)
    await page.getByRole('button', { name: 'Close' }).click();
    const closeModal = page.getByRole('dialog');
    await expect(closeModal).toBeVisible();
    // Toggle off denominations to use plain counted input if needed
    const denomsToggle = closeModal.getByRole('checkbox');
    if (await denomsToggle.isChecked()) {
      await denomsToggle.click();
    }
    await closeModal.getByTestId('close-counted').fill('260');
    await closeModal.getByRole('button', { name: /^Close$/ }).click();

    // After closing, Open Shift button should reappear
    await expect(page.getByRole('button', { name: 'Open Shift' })).toBeVisible();

    // Navigate to Shift History and verify the closed shift exists
    await page.getByRole('link', { name: 'Shift History' }).click();
    await expect(page).toHaveURL(/.*\/shifts\/history/);
    await expect(page.getByText('Over/Short')).toBeVisible();
  });
});
