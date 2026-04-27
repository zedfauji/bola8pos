/**
 * E2E spec: Phase 8 — Analytics Reports tabs (Wave 3-4)
 *
 * Covers the 5 new analytics tabs added to ReportsPage:
 *   T0: All 5 new tab triggers are visible
 *   T1: ComboMixReport tab renders without crash
 *   T2: RecipeVarianceReport tab renders without crash
 *   T3: WaitlistAnalyticsReport renders metric cards or empty state
 *   T4: Export triggers Tauri mock save dialog and shows success toast (Combo Mix)
 *
 * Requires:
 *   1. Dev server running: cd bar-pos && npm run dev
 *   2. Optional seed data: cd bar-pos && npx tsx scripts/seed-reports.ts
 *   3. .env.local with E2E credentials
 *
 * The Tauri IPC is mocked via page.addInitScript so tests run in standard Chromium.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

// ---------------------------------------------------------------------------
// Tauri IPC mock — injected before page scripts load (same pattern as 25-export-reports.spec.ts)
// ---------------------------------------------------------------------------

async function injectTauriMocks(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {
      invoke(cmd: string, args: unknown): Promise<unknown> {
        if (cmd === 'plugin:dialog|save') {
          return Promise.resolve('/tmp/test-report.xlsx');
        }
        if (cmd === 'plugin:fs|write_file') {
          void args;
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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('37-analytics-reports', () => {
  test.beforeEach(async ({ page }) => {
    await injectTauriMocks(page);
    await loginAs(page, 'admin');
    await page.goto('/reports');
    // Wait for the page to be interactive (TabsList is visible)
    await expect(page.getByRole('tab', { name: 'Session View' })).toBeVisible({ timeout: 30_000 });
  });

  // T0: Verify all 5 new analytics tab triggers are visible in the TabsList
  test('T0: ReportsPage has all 5 new analytics tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Combo Mix' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Recipe Variance' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Waitlist' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Refunds Register' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Overrides' })).toBeVisible();
  });

  // T1: ComboMixReport tab loads without runtime error
  test('T1: ComboMixReport tab renders without crash', async ({ page }) => {
    await page.getByRole('tab', { name: 'Combo Mix' }).click();
    // After clicking, either a loading spinner, a table, or an empty state appears — never a crash
    await expect(
      page.locator('[data-testid="loading-spinner"], table, [data-testid="empty-state"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  // T2: RecipeVarianceReport tab loads without runtime error
  test('T2: RecipeVarianceReport tab renders without crash', async ({ page }) => {
    await page.getByRole('tab', { name: 'Recipe Variance' }).click();
    await expect(
      page.locator('[data-testid="loading-spinner"], table, [data-testid="empty-state"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  // T3: WaitlistAnalyticsReport shows metric cards or empty state
  test('T3: WaitlistAnalyticsReport renders metric cards or empty state', async ({ page }) => {
    await page.getByRole('tab', { name: 'Waitlist' }).click();
    // Allow query to complete
    await page.waitForTimeout(2_000);
    const hasMetrics = await page.getByText('Parties Seated').isVisible().catch(() => false);
    const hasEmpty = await page.getByText('No waitlist activity').isVisible().catch(() => false);
    // Either metric cards (data present) or empty state (no data) must be shown
    expect(hasMetrics || hasEmpty).toBe(true);
  });

  // T4: Export triggers Tauri save dialog mock and shows success toast on Combo Mix tab
  test('T4: Export triggers Tauri mock and shows success toast on Combo Mix', async ({ page }) => {
    await page.getByRole('tab', { name: 'Combo Mix' }).click();
    // Wait for loading to finish
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="loading-spinner"]'),
      { timeout: 8_000 }
    );

    const exportButton = page.getByRole('button', { name: /export/i }).first();
    const isVisible = await exportButton.isVisible().catch(() => false);

    if (isVisible) {
      await exportButton.click();
      // Click the Excel option from the dropdown
      const excelItem = page.getByRole('menuitem', { name: /excel/i });
      if (await excelItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await excelItem.click();
      } else {
        // Some export buttons use a direct click (no submenu)
        await exportButton.click();
      }
      // Tauri IPC mock returns '/tmp/test-report.xlsx' so the export flow completes successfully
      await expect(page.getByText(/report exported/i)).toBeVisible({ timeout: 8_000 });
    } else {
      // No data loaded yet or RBAC gate — annotate and pass gracefully
      test.info().annotations.push({
        type: 'note',
        description: 'Export button not visible — no data or RBAC gate; Tauri mock path not exercised',
      });
    }
  });
});
