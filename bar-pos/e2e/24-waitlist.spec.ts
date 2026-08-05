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
    const admin = getServiceClient();
    // Unique per run — the historical fixed name 'García E2E' accumulates one
    // row per prior run (this spec never deleted them), and a bare
    // page.getByText('García E2E') strict-mode-violates once 2+ rows exist
    // (39-06 triage finding). Scoped listitem locator + per-run name +
    // cleanup matches the pattern already established by T6/T7 below.
    const partyName = `García E2E ${String(Date.now())}`;
    let createdEntryId: string | null = null;

    try {
      await page.getByRole('button', { name: 'Add to waitlist' }).click();

      const sheet = page.getByRole('dialog').filter({ hasText: 'Add to waitlist' });
      await sheet.waitFor();

      await sheet.getByLabel('Party name').fill(partyName);
      // Party size stays at default 1

      await sheet.getByRole('button', { name: 'Add to waitlist' }).click();

      // Entry card appears in queue
      const entryItem = page.locator('div[role="listitem"]').filter({ hasText: partyName });
      await expect(entryItem).toBeVisible({ timeout: 5000 });
      // Status badge shows 'waiting'
      await expect(entryItem.getByText('waiting').first()).toBeVisible();

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
    }
  });

  test('T2: Notify a waiting party', async ({ page }) => {
    // Seeds its own entry rather than depending on T1 having run first or on
    // ambient seed data (39-06 triage finding: the old "assumes T1 ran or
    // seed data" comment was an implicit cross-test dependency that fails
    // once historical entries are all past 'waiting' status).
    const admin = getServiceClient();
    const partyName = `Notify E2E ${String(Date.now())}`;
    let createdEntryId: string | null = null;

    try {
      await page.getByRole('button', { name: 'Add to waitlist' }).click();
      const addSheet = page.getByRole('dialog').filter({ hasText: 'Add to waitlist' });
      await addSheet.waitFor();
      await addSheet.getByLabel('Party name').fill(partyName);
      await addSheet.getByRole('button', { name: 'Add to waitlist' }).click();

      const entryItem = page.locator('div[role="listitem"]').filter({ hasText: partyName });
      await expect(entryItem).toBeVisible({ timeout: 5000 });

      const { data: entryRow } = await admin
        .from('waitlist_entries')
        .select('id')
        .eq('name', partyName)
        .maybeSingle();
      createdEntryId = (entryRow as { id: string } | null)?.id ?? null;

      // Tap Notify button on this specific entry. The button's accessible
      // name comes from its `aria-label` (NotifyButton.tsx), which reads
      // "Send WhatsApp notification" / "Send manager notification" — NOT
      // "Notify ..." (that's only the button's inner *text*, which
      // aria-label overrides for accessible-name matching). A bare
      // /Notify/ regex against getByRole's name never matched this button
      // regardless of entry status (39-06 triage finding: this was a
      // pre-existing locator bug, independently of the cross-test-dependency
      // fix above — both needed fixing for T2 to pass).
      const notifyBtn = entryItem.getByRole('button', { name: /notification/i });
      await expect(notifyBtn).toBeVisible({ timeout: 10000 });
      await notifyBtn.click();

      // Assert against the DB row directly rather than the UI badge — a
      // more robust check regardless of UI caching behavior, and the one
      // that surfaced this real regression (39-06 triage finding). This is
      // currently EXPECTED TO FAIL: the notify UPDATE itself is rejected by
      // Postgres (`schema "net" does not exist`, confirmed via browser
      // console — see the filed todo:
      // .planning/todos/pending/2026-08-04-notify-waitlist-fails-pg-net-schema-missing.md).
      // Left asserting the correct/intended outcome rather than the current
      // broken one, per D-03 (real product bugs are filed, not fixed here,
      // and the test should not be weakened to match broken behavior).
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from('waitlist_entries')
              .select('status')
              .eq('id', createdEntryId)
              .maybeSingle();
            return (data as { status: string } | null)?.status ?? null;
          },
          { timeout: 5000 }
        )
        .toBe('notified');
    } finally {
      if (createdEntryId) {
        await admin.from('waitlist_entries').delete().eq('id', createdEntryId);
      }
    }
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
    // Add a fresh entry to mark as no-show. Unique per-run name + listitem
    // scoping — see T1's comment (39-06 triage finding).
    const admin = getServiceClient();
    const partyName = `NoShow Test ${String(Date.now())}`;
    let createdEntryId: string | null = null;

    try {
      await page.getByRole('button', { name: 'Add to waitlist' }).click();
      const addSheet = page.getByRole('dialog').filter({ hasText: 'Add to waitlist' });
      await addSheet.waitFor();
      await addSheet.getByLabel('Party name').fill(partyName);
      await addSheet.getByRole('button', { name: 'Add to waitlist' }).click();
      const entryItem = page.locator('div[role="listitem"]').filter({ hasText: partyName });
      await expect(entryItem).toBeVisible({ timeout: 5000 });

      const { data: entryRow } = await admin
        .from('waitlist_entries')
        .select('id')
        .eq('name', partyName)
        .maybeSingle();
      createdEntryId = (entryRow as { id: string } | null)?.id ?? null;

      // Tap no-show icon button on this specific entry. There is no
      // confirmation dialog in the current UI — useMarkNoShow.ts's mutation
      // fires directly on click (39-06 triage finding: the old test expected
      // an alertdialog + a second "Mark no-show" confirm click that don't
      // exist anywhere in mark-waitlist-no-show/WaitlistEntryCard.tsx).
      const noShowBtn = entryItem.getByRole('button', { name: 'Mark as no-show' });
      await noShowBtn.click();

      // The entry stays in the query (queries.ts only excludes
      // 'seated'/'cancelled', not 'no_show'), so the card itself does not
      // disappear — but `isActive` (status === 'waiting' || 'notified')
      // goes false, hiding the action-button row, and the status badge
      // switches to the destructive "no show" badge (StatusBadge in
      // WaitlistEntryCard.tsx).
      await expect(entryItem.getByText('no show', { exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(noShowBtn).not.toBeVisible({ timeout: 5_000 });
    } finally {
      if (createdEntryId) {
        await admin.from('waitlist_entries').delete().eq('id', createdEntryId);
      }
    }
  });

  test('T5: WaitlistRealtimeListener — queue updates in real time', async ({
    page,
    browser,
  }) => {
    // 39-06 triage finding: reproducibly fails even after widening the
    // timeout to 20s across two independent live runs (both attempts, both
    // Playwright retries) — not a transient flake. This is the same
    // structural limitation already documented and accepted as a
    // `valid-skip` for the analogous cross-context Realtime assertion in
    // 39-02-LEDGER.md (e2e/16-table-status.spec.ts T13): "requires two
    // simultaneous browser contexts updating the same Supabase Realtime
    // channel, which is unreliable in a single-worker CI environment."
    // page2's Realtime subscription may not be fully established by the
    // time page1's insert fires (this exact race is called out in T6's own
    // comment above: "the subscription may not be established yet this
    // soon after login"), and unlike T6, T5 has no reload step after the
    // mutation to fall back on — the entire point of this test is to
    // observe the live push, not a subsequent fetch.
    test.skip(true, 'Cross-context Supabase Realtime sync is unreliable in this single-worker Playwright environment — same structural limitation as 16-table-status.spec.ts T13 (39-02-LEDGER.md), reproduced on 2 independent live runs at both 10s and 20s timeouts');
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
      // Reload rather than rely on the Realtime invalidation window — same
      // reasoning as T6's identical comment above. Without this reload the
      // SeatPartySheet's `resources` query (staleTime 30s) can still be
      // serving pre-mutation cached data from the initial page load in
      // beforeEach, before this test's admin.update() ran (39-06 triage
      // finding: this was the missing step causing T7's toHaveCount(0)
      // flake against a table this test had just freed).
      await page.reload();
      await page.getByRole('heading', { name: 'Queue' }).waitFor({ timeout: 10000 });

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
