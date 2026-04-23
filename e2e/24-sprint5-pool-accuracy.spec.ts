/**
 * e2e/24-sprint5-pool-accuracy.spec.ts
 *
 * Sprint 5 — Pool Session Accuracy
 *
 * Feature #2: Edit Session Start Time
 *   - "Edit Start Time" button visible to all roles on occupied table status page
 *   - Button requires manager PIN before showing the edit dialog
 *   - Manager can edit start time back in the past → elapsed timer updates
 *   - Future datetime is rejected with inline error
 *
 * Feature #4: Print on Start
 *   - "Print start ticket" toggle visible in Settings → Hardware tab
 *   - Session starts successfully regardless of printOnStart setting
 *     (Tauri IPC interception not used; we assert observable behavior only)
 *
 * UI text & role references derived from:
 *   - src/widgets/TableStatusPanel/index.tsx
 *   - src/features/edit-session-start-time/ui/EditStartTimeDialog.tsx
 *   - src/features/edit-session-start-time/model/useEditSessionStartTime.ts
 *   - src/widgets/SettingsTabsPanel/tabs/HardwareSettingsTab.tsx
 *   - e2e/16-table-status.spec.ts  (seedOccupiedTableDirect, enterManagerPin pattern)
 *   - e2e/04-pool-timer.spec.ts    (startFirstPoolSession helper pattern)
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
// Local seed + navigation helpers (reuse patterns from 16-table-status.spec.ts)
// ---------------------------------------------------------------------------

/**
 * Seed an occupied pool table directly via the service client.
 * Faster than going through the UI; options.startedAtOffset is ms in the past.
 */
async function seedOccupiedTable(
  customerName: string,
  options?: { startedAtOffset?: number }
): Promise<{ tableId: string; sessionId: string; tabId: string }> {
  const admin = getServiceClient();

  const { data: tables, error: tErr } = await admin
    .from('pool_tables')
    .select('id, number')
    .eq('status', 'available')
    .limit(1)
    .single();
  if (tErr || !tables) throw new Error(`seedOccupiedTable: no available table – ${tErr?.message}`);

  const { data: staff, error: sErr } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .single();
  if (sErr || !staff) throw new Error(`seedOccupiedTable: no staff profile – ${sErr?.message}`);

  // Find or create an open shift (tabs require shift_id)
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

  const startedAt = new Date(
    Date.now() - (options?.startedAtOffset ?? 2 * 60 * 1000)
  ).toISOString();

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

  await admin
    .from('pool_tables')
    .update({ status: 'occupied', current_session_id: session.id })
    .eq('id', tables.id);

  return {
    tableId: tables.id as string,
    sessionId: session.id as string,
    tabId: tab.id as string,
  };
}

/** Navigate to the status page for the first currently-occupied table. */
async function navigateToFirstOccupiedStatusPage(page: Page): Promise<string> {
  const occupied = await getOccupiedPoolTableIds();
  if (occupied.length === 0) throw new Error('No occupied table found — seeding may have failed.');
  const { tableId } = occupied[0]!;
  await page.goto(`/pool-tables/${tableId}`);
  return tableId;
}

/**
 * Enter digits on the manager PIN keypad.
 * Matches the pattern used in 16-table-status.spec.ts.
 */
async function enterManagerPin(page: Page, pin: string): Promise<void> {
  for (const ch of pin) {
    const label = ch === '0' ? 'Key 0' : `Key ${ch}`;
    await page.getByRole('button', { name: label }).click();
  }
}

/**
 * Open the manager PIN dialog for "Edit Start Time" and pass the PIN.
 * Returns after the PIN dialog has closed (edit dialog should now be open).
 */
async function openEditStartTimeViaPin(page: Page, pin: string): Promise<void> {
  await page.getByRole('button', { name: 'Edit Start Time' }).click();

  const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
  await expect(pinDialog).toBeVisible({ timeout: 15_000 });

  await enterManagerPin(page, pin);

  // PIN dialog closes after correct PIN; edit dialog should open
  await expect(pinDialog).not.toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('edit-start-time-form')).toBeVisible({ timeout: 10_000 });
}

/**
 * Format a Date as a datetime-local string (YYYY-MM-DDTHH:MM) — same helper
 * used by EditStartTimeDialog.tsx internally.
 */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Sprint 5 – Pool Session Accuracy', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(450);
    await page.goto('/');
  });

  // ── Feature #2 — Edit Session Start Time ──────────────────────────────────

  // T1: Edit Start Time button visible on occupied table status page (manager)
  test('T1: Edit start time button visible on occupied table status page', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    await seedOccupiedTable('Edit Btn Visible Test');
    await navigateToFirstOccupiedStatusPage(page);

    // Button is rendered when session is active (!session.stoppedAt)
    const editBtn = page.getByRole('button', { name: 'Edit Start Time' });
    await expect(editBtn).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  // T2: Bartender can also see Edit Start Time button
  // NOTE: The TableStatusPanel renders the "Edit Start Time" button for any
  // logged-in user when session is active — there is no role guard in the JSX.
  // Bartenders can click it but will need to provide a manager PIN.
  test('T2: Bartender can see Edit Start Time button (no role gate on the button itself)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'bartender');

    await seedOccupiedTable('Bartender Edit Btn Test');
    await navigateToFirstOccupiedStatusPage(page);

    const editBtn = page.getByRole('button', { name: 'Edit Start Time' });
    await expect(editBtn).toBeVisible({ timeout: 20_000 });

    await logout(page);
  });

  // T3: Edit Start Time button triggers manager PIN dialog
  test('T3: Edit start time requires manager PIN', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, 'manager');

    await seedOccupiedTable('Edit PIN Gate Test');
    await navigateToFirstOccupiedStatusPage(page);

    const editBtn = page.getByRole('button', { name: 'Edit Start Time' });
    await expect(editBtn).toBeVisible({ timeout: 20_000 });
    await editBtn.click();

    // PIN dialog should appear before the edit dialog
    const pinDialog = page.getByRole('alertdialog', { name: /manager access required/i });
    await expect(pinDialog).toBeVisible({ timeout: 15_000 });

    // Close without entering PIN
    await page.keyboard.press('Escape');
    await expect(pinDialog).not.toBeVisible({ timeout: 5_000 });

    // Edit dialog should NOT be open
    await expect(page.getByTestId('edit-start-time-form')).not.toBeVisible();

    await logout(page);
  });

  // T4: Manager edits start time back 30 min and elapsed time updates
  test('T4: Manager edits start time back 30 min and elapsed timer reflects the change', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    // Seed with session started 2 min ago (default)
    await seedOccupiedTable('Edit 30 Min Back Test');
    await navigateToFirstOccupiedStatusPage(page);

    // Capture the current elapsed display
    const elapsedEl = page.getByTestId('elapsed-minutes');
    await expect(elapsedEl).toBeVisible({ timeout: 20_000 });

    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    await openEditStartTimeViaPin(page, managerPin);

    // Set datetime-local to 30 minutes ago
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const newValue = toDatetimeLocal(thirtyMinAgo);

    const input = page.locator('#start-time-input');
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill(newValue);

    await page.getByRole('button', { name: 'Save' }).click();

    // Success toast
    await expect(page.getByText(/session start time updated/i)).toBeVisible({ timeout: 20_000 });

    // Edit dialog should close
    await expect(page.getByTestId('edit-start-time-form')).not.toBeVisible({ timeout: 10_000 });

    // Elapsed timer should now reflect ~30 min. We poll until the displayed
    // value contains "29" or "30" (minutes part of HH:MM:SS).
    // The timer updates each second via usePoolTimer polling.
    await expect
      .poll(
        async () => {
          const text = (await elapsedEl.innerText()).trim();
          // Format is HH:MM:SS — extract total seconds to check >= 29 min
          const parts = text.split(':').map(Number);
          const totalSec = (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
          return totalSec;
        },
        { timeout: 15_000, intervals: [1000] }
      )
      .toBeGreaterThan(28 * 60); // > 28 minutes in seconds

    await logout(page);
  });

  // T5: Future datetime is rejected with inline error
  test('T5: Future datetime is rejected with inline validation error', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    await seedOccupiedTable('Future Date Reject Test');
    await navigateToFirstOccupiedStatusPage(page);

    const managerPin = process.env['E2E_MANAGER_PIN'] ?? '';
    await openEditStartTimeViaPin(page, managerPin);

    // Set datetime-local to 1 hour from now
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    const futureValue = toDatetimeLocal(oneHourFromNow);

    const input = page.locator('#start-time-input');
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill(futureValue);

    await page.getByRole('button', { name: 'Save' }).click();

    // Inline error message should appear (useEditSessionStartTime returns
    // validationError({ startedAt: 'Start time must be in the past' }))
    const form = page.getByTestId('edit-start-time-form');
    await expect(form.getByText(/must be in the past/i)).toBeVisible({ timeout: 10_000 });

    // Dialog stays open — edit has not been applied
    await expect(page.getByTestId('edit-start-time-form')).toBeVisible();

    // No success toast should have appeared
    await expect(page.getByText(/session start time updated/i)).not.toBeVisible();

    // Close the dialog
    await page.getByRole('button', { name: 'Cancel' }).click();

    await logout(page);
  });

  // ── Feature #4 — Print on Start ───────────────────────────────────────────

  // T6: Print start ticket toggle visible in Settings → Hardware tab
  test('T6: Print start ticket toggle visible in Settings Hardware tab', async ({ page }) => {
    test.setTimeout(90_000);
    // Settings require manage_settings → admin only
    await loginAs(page, 'admin');

    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Hardware' }).click();

    await expect(page.getByRole('heading', { name: 'Hardware' })).toBeVisible({ timeout: 20_000 });

    // The checkbox id is "receipt-printOnStart" and the label text is "Print start ticket"
    const toggle = page.locator('#receipt-printOnStart');
    await expect(toggle).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel('Print start ticket')).toBeVisible({ timeout: 10_000 });

    await logout(page);
  });

  // T7: Session starts successfully when printOnStart is enabled
  // NOTE: We cannot intercept Tauri IPC in Playwright without complex setup.
  // We test observable behavior: session starts (toast visible), no error dialog.
  test('T7: Session starts successfully when print_on_start is enabled', async ({ page }) => {
    test.setTimeout(120_000);

    // Enable the toggle as admin
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Hardware' }).click();
    await expect(page.locator('#receipt-printOnStart')).toBeVisible({ timeout: 20_000 });
    await page.locator('#receipt-printOnStart').setChecked(true);
    await expect(page.locator('#receipt-printOnStart')).toBeChecked({ timeout: 10_000 });
    await logout(page);

    // Switch to manager and start a session
    await loginAs(page, 'manager');
    await page.goto('/pool-tables');
    await page.getByRole('button', { name: 'Start Session' }).first().click();

    const sheet = page.getByRole('dialog', { name: /start pool session/i });
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await sheet.getByRole('button', { name: 'Start Session' }).click();

    // Session must start successfully
    await expect(page.getByText(/pool session started/i)).toBeVisible({ timeout: 20_000 });

    // In a test environment the printer is not connected; we accept either:
    //   a) no print-related error — Tauri IPC is unavailable but the feature fails silently
    //   b) a non-blocking error toast (acceptable)
    // Assert no blocking alertdialog appeared
    await page.waitForTimeout(2_000);
    const blockingDialog = page.getByRole('alertdialog');
    const dialogVisible = await blockingDialog.isVisible().catch(() => false);
    expect(dialogVisible).toBe(false);

    await logout(page);

    // Cleanup: disable the toggle
    await loginAs(page, 'admin');
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Hardware' }).click();
    await expect(page.locator('#receipt-printOnStart')).toBeVisible({ timeout: 20_000 });
    await page.locator('#receipt-printOnStart').setChecked(false);
    await logout(page);
  });

  // T8: Session starts successfully when printOnStart is disabled (default behavior)
  // NOTE: Same observable-behavior approach as T7 — no Tauri IPC interception.
  test('T8: Session starts successfully when print_on_start is disabled (default)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAs(page, 'manager');

    await page.goto('/pool-tables');
    await page.getByRole('button', { name: 'Start Session' }).first().click();

    const sheet = page.getByRole('dialog', { name: /start pool session/i });
    await expect(sheet).toBeVisible({ timeout: 15_000 });
    await sheet.getByRole('button', { name: 'Start Session' }).click();

    // Session should start without issues
    await expect(page.getByText(/pool session started/i)).toBeVisible({ timeout: 20_000 });

    // No blocking dialog should appear (no print errors)
    await page.waitForTimeout(2_000);
    const blockingDialog = page.getByRole('alertdialog');
    const dialogVisible = await blockingDialog.isVisible().catch(() => false);
    expect(dialogVisible).toBe(false);

    await logout(page);
  });
});
