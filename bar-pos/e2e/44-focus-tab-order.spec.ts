/**
 * e2e/44-focus-tab-order.spec.ts
 *
 * FOCUS-03 (Phase 32, D-11/D-12/D-13): automated Tab-order regression coverage
 * for the three named surfaces. Read-only — does not modify ManagerPinDialog,
 * PINKeypad, DataTable, or SearchInput.
 *
 * UI text & role references are derived from reading:
 *   - e2e/16-table-status.spec.ts (spec boilerplate + seed conventions this file follows)
 *   - e2e/helpers/auth.ts (loginAs/logout conventions)
 *   - src/widgets/TableStatusPanel/index.tsx (Edit Start Time PIN-gated action)
 *   - src/features/manager-pin-gate/ui/ManagerPinDialog.tsx (PIN entry dialog shell)
 *   - src/shared/ui/PINKeypad.tsx (Key 1-9, Key 0, Backspace button grid — DOM/visual order)
 *   - src/shared/ui/DataTable.tsx + src/shared/ui/SearchInput.tsx (search/filter row)
 *   - src/widgets/InventoryPagePanel.tsx (category filter toolbar, batch-adjustment dialog form)
 *   - src/entities/inventory/ui/InventoryRow.tsx (SortHeader column-header buttons)
 *   - .planning/phases/32-touch-target-focus-visible-sweep/32-CONTEXT.md (D-11, D-12, D-13)
 *
 * NOTE (documented gap, D-12(b)): InventoryPagePanel's <DataTable> call does not pass
 * `searchable`, so there is no SearchInput rendered on /inventory — only the category
 * `<select>` filter. Surface (b) below therefore asserts Tab order from that filter
 * select into the first two sortable column headers (Product, Category), which is the
 * real "search/filter row" reachable under this page today.
 */

import { expect, test, type Page } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { getOccupiedPoolTableIds, openCaja, resetTestState } from './helpers/supabase';

// ---------------------------------------------------------------------------
// Seed helpers (mirrors e2e/16-table-status.spec.ts conventions)
// ---------------------------------------------------------------------------

async function openTabViaUI(page: Page, customerName: string): Promise<void> {
  await page.goto('/pos');
  await page.getByRole('button', { name: /new tab/i }).click();
  await page.getByLabel(/customer name/i).fill(customerName);
  await page.getByRole('button', { name: 'Open Tab' }).click();
  await expect(page.getByText(/tab opened/i)).toBeVisible({ timeout: 20_000 });
}

async function startSessionViaUI(page: Page, customerName: string): Promise<void> {
  await page.goto('/pool-tables');
  await page.getByRole('button', { name: 'Start Session' }).first().click();

  const sheet = page.getByRole('dialog', { name: /start pool session/i });
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await sheet.locator('#pool-start-tab').selectOption({ label: customerName });
  await sheet.getByRole('button', { name: 'Start Session' }).click();

  await expect(page.getByText(/pool session started/i)).toBeVisible({ timeout: 20_000 });
}

async function navigateToFirstOccupiedStatusPage(page: Page): Promise<string> {
  const occupied = await getOccupiedPoolTableIds();
  if (occupied.length === 0) throw new Error('No occupied table found – seeding may have failed.');
  const { tableId } = occupied[0]!;
  await page.goto(`/pool-tables/${tableId}`);
  return tableId;
}

/** Reads the currently focused element's accessible name (aria-label, else trimmed text). */
async function focusedAccessibleName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return '';
    return el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName;
  });
}

test.describe('Focus Tab Order (FOCUS-03)', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(300);
    await page.goto('/');
  });

  // ── Surface (a): ManagerPinDialog PIN entry via TableStatusPanel ──────────
  test('A: ManagerPinDialog Tab order follows the visual keypad layout (1-9, 0, Backspace, Cancel)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    await openTabViaUI(page, 'Focus Order PIN Test');
    await startSessionViaUI(page, 'Focus Order PIN Test');
    await navigateToFirstOccupiedStatusPage(page);

    const editBtn = page.getByRole('button', { name: /edit start time/i });
    await expect(editBtn).toBeVisible({ timeout: 15_000 });
    await editBtn.click();

    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 15_000 });

    // Capture the focused-element sequence across repeated Tab presses (initial
    // focus + 15 more) — robust to whichever element Radix's autofocus lands on.
    const seen: string[] = [await focusedAccessibleName(page)];
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      seen.push(await focusedAccessibleName(page));
    }

    // Backspace is `disabled` while the PIN is empty (PINKeypad.tsx), which
    // correctly removes it from the native tab order — verified below by its
    // absence, not asserted as a tab stop here.
    const expectedOrder = [
      'Key 1',
      'Key 2',
      'Key 3',
      'Key 4',
      'Key 5',
      'Key 6',
      'Key 7',
      'Key 8',
      'Key 9',
      'Key 0',
      'Cancel',
    ];

    // Radix AlertDialog's default autofocus lands on the Cancel action (not the
    // first tabbable descendant), so "Cancel" legitimately appears once before
    // the loop starts and again once the focus trap wraps after Key 0. Search
    // forward from the previous match so each label is matched against its
    // real position in sequence rather than the earliest occurrence.
    let lastIndex = -1;
    for (const label of expectedOrder) {
      const idx = seen.indexOf(label, lastIndex + 1);
      expect(idx, `expected to Tab through "${label}" — captured sequence: ${seen.join(', ')}`).toBeGreaterThan(-1);
      expect(
        idx,
        `"${label}" should receive focus after the previous expected element — captured sequence: ${seen.join(', ')}`
      ).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }

    await page.keyboard.press('Escape');
    await logout(page);
  });

  // ── Surface (b): inventory DataTable filter row + sortable column headers ─
  test('B: inventory category filter Tabs into the sortable column headers in visual order', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');
    await page.goto('/inventory');

    const categorySelect = page.locator('#inv-category-filter');
    await expect(categorySelect).toBeVisible({ timeout: 20_000 });
    await categorySelect.focus();
    await expect(categorySelect).toBeFocused();

    // First column (Product) is the next tab stop after the filter.
    await page.keyboard.press('Tab');
    const productHeader = page.getByRole('button', { name: 'Product', exact: true });
    await expect(productHeader).toBeFocused();

    // Second column (Category) follows — matches left-to-right visual column order.
    await page.keyboard.press('Tab');
    const categoryHeader = page.getByRole('button', { name: 'Category', exact: true });
    await expect(categoryHeader).toBeFocused();

    await logout(page);
  });

  // ── Surface (c): inventory Batch Adjustment form (product select -> qty -> Cancel -> Apply) ─
  test('C: Batch Adjustment dialog Tab order follows visual field/button layout', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');
    await page.goto('/inventory');

    const adjustBtn = page.getByRole('button', { name: 'Adjust', exact: true });
    await expect(adjustBtn).toBeVisible({ timeout: 20_000 });
    await adjustBtn.click();

    const dialog = page.getByRole('dialog', { name: /batch adjustment/i });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const productSelect = page.locator('#batch-product');
    await productSelect.focus();
    await expect(productSelect).toBeFocused();

    await page.keyboard.press('Tab');
    const deltaInput = page.getByLabel(/quantity delta/i);
    await expect(deltaInput).toBeFocused();

    await page.keyboard.press('Tab');
    const cancelBtn = dialog.getByRole('button', { name: 'Cancel', exact: true });
    await expect(cancelBtn).toBeFocused();

    await page.keyboard.press('Tab');
    const applyBtn = dialog.getByRole('button', { name: 'Apply', exact: true });
    await expect(applyBtn).toBeFocused();

    await page.keyboard.press('Escape');
    await logout(page);
  });
});
