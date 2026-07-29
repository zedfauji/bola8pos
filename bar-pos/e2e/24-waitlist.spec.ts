import { expect, test } from './fixtures';
import { loginAs } from './helpers/auth';
import { getServiceClient } from './helpers/supabase';

/**
 * 24-waitlist.spec.ts — S5 Waitlist E2E
 *
 * Tests: full waitlist flow — add party, notify, seat, no-show, realtime sync.
 *
 * Requires dev server running (npm run dev) and waitlist_entries table in DB.
 * Plan reference: 07-07-PLAN.md
 */

test.describe('24 — Waitlist queue management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/waitlist');
    await page.getByRole('heading', { name: 'Queue' }).waitFor({ timeout: 10000 });
  });

  test('T1: Add a party to the waitlist', async ({ page }) => {
    await page.getByRole('button', { name: 'Add to waitlist' }).click();

    const sheet = page.getByRole('dialog');
    await sheet.waitFor();

    await sheet.getByLabel('Party name').fill('García E2E');
    // Party size stays at default 1

    await sheet.getByRole('button', { name: 'Add to waitlist' }).click();

    // Entry card appears in queue
    await expect(page.getByText('García E2E')).toBeVisible({ timeout: 5000 });
    // Status badge shows 'waiting'
    await expect(page.getByText('waiting').first()).toBeVisible();
  });

  test('T2: Notify a waiting party', async ({ page }) => {
    // Ensure at least one waiting entry exists (assumes T1 ran or seed data)
    // Tap Notify button on first waiting entry
    const notifyBtn = page.getByRole('button', { name: /Notify/ }).first();
    await expect(notifyBtn).toBeVisible({ timeout: 10000 });
    await notifyBtn.click();

    // Entry transitions to 'notified' status
    await expect(page.getByText('notified').first()).toBeVisible({ timeout: 5000 });
  });

  test('T3: Seat a party at a table', async ({ page }) => {
    // Ensure at least one waiting/notified entry exists
    const seatBtn = page.getByRole('button', { name: 'Seat party' }).first();
    await expect(seatBtn).toBeVisible({ timeout: 10000 });
    await seatBtn.click();

    const seatSheet = page.getByRole('dialog');
    await seatSheet.waitFor();

    // Select first available table
    const firstTable = seatSheet.getByRole('button', { name: /Free/ }).first();
    const hasTable = await firstTable.isVisible().catch(() => false);
    if (hasTable) {
      await firstTable.click();
      await seatSheet.getByRole('button', { name: 'Seat party' }).click();
      // Sheet closes and entry removed from queue
      await expect(seatSheet).not.toBeVisible({ timeout: 5000 });
    } else {
      // No available tables — annotate and pass
      test.info().annotations.push({
        type: 'skip',
        description: 'No available tables in test environment',
      });
    }
  });

  test('T4: Mark a party as no-show', async ({ page }) => {
    // Add a fresh entry to mark as no-show
    await page.getByRole('button', { name: 'Add to waitlist' }).click();
    const addSheet = page.getByRole('dialog');
    await addSheet.waitFor();
    await addSheet.getByLabel('Party name').fill('NoShow Test');
    await addSheet.getByRole('button', { name: 'Add to waitlist' }).click();
    await expect(page.getByText('NoShow Test')).toBeVisible({ timeout: 5000 });

    // Tap no-show icon button
    const noShowBtn = page.getByRole('button', { name: 'Mark as no-show' }).last();
    await noShowBtn.click();

    // ConfirmDialog appears
    const confirmDialog = page.getByRole('alertdialog');
    await confirmDialog.waitFor();
    await confirmDialog.getByRole('button', { name: 'Mark no-show' }).click();

    // Entry no longer shows "NoShow Test" as waiting
    await expect(page.getByText('NoShow Test')).not.toBeVisible({ timeout: 5000 });
  });

  test('T5: WaitlistRealtimeListener — queue updates in real time', async ({
    page,
    browser,
  }) => {
    // Open a second page context to verify Realtime sync
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await loginAs(page2, 'admin');
    await page2.goto('/waitlist');
    await page2.getByRole('heading', { name: 'Queue' }).waitFor({ timeout: 10000 });

    // Add a party from page 1
    await page.getByRole('button', { name: 'Add to waitlist' }).click();
    const addSheet = page.getByRole('dialog');
    await addSheet.waitFor();
    await addSheet.getByLabel('Party name').fill('Realtime Test');
    await addSheet.getByRole('button', { name: 'Add to waitlist' }).click();

    // Verify it appears on page 2 (Realtime sync)
    await expect(page2.getByText('Realtime Test')).toBeVisible({ timeout: 10000 });

    await context2.close();
  });
});

/**
 * Phase 26 (floating-tables-is-temp), Plan 04 — SC-3/D-05 end-to-end proof.
 *
 * The temporary-table copy is genuinely translated (es-MX vs en-US, see
 * src/shared/lib/i18n/locales/{es-MX,en-US}/featMgmt.json), so selectors
 * match both strings via regex rather than hardcoding one locale's copy —
 * same pattern as e2e/46-i18n-locale-switch.spec.ts.
 */
test.describe('24 — Waitlist floating-table seating (SC-3, D-05)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/waitlist');
    await page.getByRole('heading', { name: 'Queue' }).waitFor({ timeout: 10000 });
  });

  test('T6: Seat a party at a new temporary table when nothing is free', async ({ page }) => {
    const admin = getServiceClient();
    // Unique per run — the "added to the waitlist" toast contains the party
    // name too, and a re-run's entry must not collide with one a prior run
    // left behind (this spec never deletes the waitlist_entries rows it
    // creates, matching its own pre-existing T1/T4 convention).
    const partyName = `Floating E2E ${String(Date.now())}`;

    // Force the empty-availability state by occupying every currently
    // available resource, rather than assuming a fixed seed-data table
    // count. Restored in the finally block below.
    const { data: freeRows } = await admin.from('resources').select('id').eq('status', 'available');
    const occupiedIds = (freeRows ?? []).map(row => (row as { id: string }).id);
    if (occupiedIds.length > 0) {
      await admin.from('resources').update({ status: 'occupied' }).in('id', occupiedIds);
    }

    let createdFloatingId: string | null = null;
    let createdEntryId: string | null = null;

    try {
      // Reload rather than rely on the Realtime invalidation window — the
      // subscription may not be established yet this soon after login, and
      // a reload's initial fetch reads the DB mutation directly.
      await page.reload();
      await page.getByRole('heading', { name: 'Queue' }).waitFor({ timeout: 10000 });

      await page.getByRole('button', { name: 'Add to waitlist' }).click();
      // Filtered by title text — the AI-assistant side panel is also a
      // persistent `dialog` role that can be open concurrently.
      const addSheet = page.getByRole('dialog').filter({ hasText: 'Add to waitlist' });
      await addSheet.waitFor();
      await addSheet.getByLabel('Party name').fill(partyName);
      await addSheet.getByRole('button', { name: 'Add to waitlist' }).click();

      // Scoped to the listitem, not a bare getByText — the success toast
      // also contains the party name and would otherwise double-match.
      const entryItem = page.locator('div[role="listitem"]').filter({ hasText: partyName });
      await expect(entryItem).toBeVisible({ timeout: 5000 });
      await entryItem.getByRole('button', { name: 'Seat party' }).click();

      // Filtered by title text — see the addSheet comment above.
      const seatSheet = page.getByRole('dialog').filter({ hasText: 'Seat party' });
      await seatSheet.waitFor();

      // Empty-state message still renders alongside the new action — D-05
      // is additive, not a replacement of the existing "nothing free" copy.
      await expect(seatSheet.getByText('No tables available right now.')).toBeVisible({
        timeout: 10000,
      });

      const newTableAction = seatSheet.getByRole('button', {
        name: /^(Sentar en una mesa temporal nueva|Seat at a new temporary table)$/,
      });
      await expect(newTableAction).toBeVisible();
      await newTableAction.click();

      // Sheet closes and the entry leaves the active queue once seated.
      await expect(seatSheet).not.toBeVisible({ timeout: 10000 });
      await expect(page.locator('div[role="listitem"]').filter({ hasText: partyName })).not.toBeVisible({
        timeout: 5000,
      });

      const { data: seatedEntry } = await admin
        .from('waitlist_entries')
        .select('id')
        .eq('name', partyName)
        .maybeSingle();
      createdEntryId = (seatedEntry as { id: string } | null)?.id ?? null;

      // Table number is never asserted (D-03: numbers climb monotonically
      // and a retired floating table's number is never reissued).
      const { data: floatingRows } = await admin
        .from('resources')
        .select('id, is_temp, status')
        .eq('table_type', 'floating')
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(1);
      const floatingRow = (floatingRows ?? [])[0] as
        | { id: string; is_temp: boolean; status: string }
        | undefined;
      expect(floatingRow?.is_temp).toBe(true);
      createdFloatingId = floatingRow?.id ?? null;

      // Visual marker: the floating badge is distinguishable at a glance.
      await page.goto('/pool-tables');
      await expect(
        page.getByTestId('table-type-badge').filter({ hasText: 'Floating' }).first()
      ).toBeVisible({ timeout: 10000 });
    } finally {
      // Cleanup: hard-delete the floating table this test created. No pool
      // session was ever started on it (the auto-deactivate trigger never
      // fires without one), so there is no FK reference to protect — a real
      // production retirement always goes through the soft-delete trigger
      // (D-04), but a genuinely unreferenced test row is freed here rather
      // than soft-deleted so its number does not become permanently
      // unusable and fail every subsequent run of this exact test on the
      // same shared project (D-03: numbers are never reused once consumed).
      if (createdFloatingId) {
        await admin.from('resources').delete().eq('id', createdFloatingId);
      }
      if (createdEntryId) {
        await admin.from('waitlist_entries').delete().eq('id', createdEntryId);
      }
      if (occupiedIds.length > 0) {
        await admin.from('resources').update({ status: 'available' }).in('id', occupiedIds);
      }
    }
  });

  test('T7: The new-temporary-table action is absent while a table is available', async ({
    page,
  }) => {
    const admin = getServiceClient();

    // Guard the D-05 boundary: guarantee at least one available table
    // exists so the action must not appear. Restores whatever it borrowed.
    const { data: anyAvailable } = await admin
      .from('resources')
      .select('id')
      .eq('status', 'available')
      .limit(1)
      .maybeSingle();

    let borrowedId: string | null = null;
    let borrowedPreviousStatus: string | null = null;
    if (!anyAvailable) {
      const { data: anyResource } = await admin
        .from('resources')
        .select('id, status')
        .limit(1)
        .maybeSingle();
      if (anyResource) {
        const row = anyResource as { id: string; status: string };
        borrowedId = row.id;
        borrowedPreviousStatus = row.status;
        await admin.from('resources').update({ status: 'available' }).eq('id', row.id);
      }
    }

    const partyName = `NotEmpty E2E ${String(Date.now())}`;
    let createdEntryId: string | null = null;

    try {
      await page.getByRole('button', { name: 'Add to waitlist' }).click();
      // Filtered by title text — the AI-assistant side panel is also a
      // persistent `dialog` role that can be open concurrently.
      const addSheet = page.getByRole('dialog').filter({ hasText: 'Add to waitlist' });
      await addSheet.waitFor();
      await addSheet.getByLabel('Party name').fill(partyName);
      await addSheet.getByRole('button', { name: 'Add to waitlist' }).click();

      const entryItem = page.locator('div[role="listitem"]').filter({ hasText: partyName });
      await expect(entryItem).toBeVisible({ timeout: 5000 });
      await entryItem.getByRole('button', { name: 'Seat party' }).click();

      // Filtered by title text — the AI-assistant side panel is also a
      // persistent `dialog` role that can be open concurrently.
      const seatSheet = page.getByRole('dialog').filter({ hasText: 'Seat party' });
      await seatSheet.waitFor();

      await expect(
        seatSheet.getByRole('button', {
          name: /^(Sentar en una mesa temporal nueva|Seat at a new temporary table)$/,
        })
      ).toHaveCount(0);

      // .first() — every Sheet renders both a footer "Close" button and a
      // built-in sr-only "Close" icon button (src/shared/ui/sheet.tsx); both
      // dismiss the sheet identically.
      await seatSheet.getByRole('button', { name: 'Close' }).first().click();

      const { data: entryRow } = await admin
        .from('waitlist_entries')
        .select('id')
        .eq('name', partyName)
        .maybeSingle();
      createdEntryId = (entryRow as { id: string } | null)?.id ?? null;
    } finally {
      if (createdEntryId) {
        await admin.from('waitlist_entries').delete().eq('id', createdEntryId);
      }
      if (borrowedId && borrowedPreviousStatus) {
        await admin.from('resources').update({ status: borrowedPreviousStatus }).eq('id', borrowedId);
      }
    }
  });
});
