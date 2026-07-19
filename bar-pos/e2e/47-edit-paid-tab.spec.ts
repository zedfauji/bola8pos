/**
 * E2E spec: Phase 22 — Edit Paid Ticket + History (Wave 0 scaffold)
 * Plan: 22-01 (created) / activated in 22-03 (SC-3) and 22-04/22-05 (SC-4)
 *
 * PENDING SCAFFOLD — EditPaidTabDialog (22-03) and /edit-history (22-04) do
 * not exist yet. These `test.fixme` placeholders name the SC-3/SC-4
 * scenarios later plans will activate with real assertions, mirroring the
 * DOM/a11y contract established in `e2e/38-audit-logs.spec.ts`.
 *
 * Requires bar-pos/.env.local with E2E_*_PIN/NAME and SUPABASE_SERVICE_ROLE_KEY.
 */
import { test } from './fixtures';
import { loginAs, logout } from './helpers/auth';
import { requireIntegrationEnv } from './helpers/requireEnv';
import { openCaja, resetTestState } from './helpers/supabase';

test.describe('Edit Paid Tab', () => {
  test.beforeEach(async ({ page }) => {
    requireIntegrationEnv();
    await resetTestState();
    await openCaja(540);
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    await logout(page).catch(() => undefined);
  });

  test.describe('SC-3: edit a paid tab from /payments', () => {
    test.fixme(
      'manager opens EditPaidTabDialog from a paid tab, passes the PIN gate, edits an item and reason, and saves',
      async ({ page }) => {
        await loginAs(page, 'manager');
        // TODO (22-03): navigate to /payments, open a paid tab's edit action,
        // pass ManagerPinDialog (requiredAction="edit_paid_tab"), change an
        // item quantity/notes, fill the reason field, save, and assert the
        // success toast + updated tab total.
      }
    );

    test.fixme(
      'bartender cannot see or trigger the edit-paid-tab action (manager+ only)',
      async ({ page }) => {
        await loginAs(page, 'bartender');
        // TODO (22-03): assert the edit action is absent/disabled for bartender.
      }
    );
  });

  test.describe('SC-4: /edit-history lists edits and opens the diff viewer', () => {
    test.fixme(
      'manager sees the edit in /edit-history and row click opens the JsonDiffViewer',
      async ({ page }) => {
        await loginAs(page, 'manager');
        // TODO (22-04/22-05): navigate to /edit-history, assert a row with
        // action=tab.edit_paid is visible, click it, and assert the
        // before/after diff sheet renders (mirrors 38-audit-logs.spec.ts).
      }
    );

    test.fixme('bartender is redirected away from /edit-history', async ({ page }) => {
      await loginAs(page, 'bartender');
      // TODO (22-04): assert redirect to /home + restricted toast, reusing
      // the view_audit_log guard (per RESEARCH.md A3).
    });
  });
});
