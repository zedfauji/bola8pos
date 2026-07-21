/**
 * E2E spec: Phase 23 — Reopen Closed Ticket
 * Plan: 23-01 (Wave-0 scaffold) / activated in Plan 06 (SC-1, SC-3)
 *
 * SC-1: a manager+ PIN-gated dialog reopens a closed/paid tab from the
 * PaymentPane payment-history row (mirrors e2e/47-edit-paid-tab.spec.ts's
 * PIN-gate/manager-vs-bartender shape).
 * SC-3: the 24h window + 2x reopen cap are enforced.
 *
 * This file is a PENDING scaffold only — Plan 06 fills in the seed helper
 * and converts each `test.fixme` below into a real test. No live UI
 * interaction happens here; `--list` must enumerate the fixme tests without
 * error.
 *
 * Requires bar-pos/.env.local with E2E_*_PIN/NAME and SUPABASE_SERVICE_ROLE_KEY.
 */
import { test } from './fixtures';

test.describe('Reopen Closed Ticket', () => {
  // ==========================================================================
  // SC-1: manager reopens a closed/paid tab from /payments
  // ==========================================================================
  test.describe('SC-1: reopen a closed/paid tab from /payments', () => {
    test.fixme(
      'manager opens ReopenTabDialog from a closed tab\'s payment row, passes the PIN gate, ' +
        'fills a reason, confirms, and the tab flips back to open (payment(s) shown as voided)',
      async () => {
        // Plan 06 fills this in — seed a closed/paid tab (mirrors 47-edit-paid-tab.spec.ts's
        // seedPaidTab), login as manager, open /payments, click "Reabrir ticket" on the
        // seeded payment row, pass the PIN gate, confirm, and DB-verify tabs.status = 'open'
        // and the payment's status = 'reopened_void'.
      },
    );

    test.fixme(
      'bartender cannot self-approve the reopen-tab PIN gate (manager+ only, D-04)',
      async () => {
        // Plan 06 fills this in — mirrors 47-edit-paid-tab.spec.ts's bartender-negative
        // test: bartender can open the dialog, but ManagerPinDialog's eligibleStaff check
        // rejects a bartender PIN for requiredAction="reopen_tab"; dialog stays open, no
        // DB write occurs.
      },
    );
  });

  // ==========================================================================
  // SC-3: reopen cap + window enforcement surfaces in the UI
  // ==========================================================================
  test.describe('SC-3: reopen cap + window enforcement', () => {
    test.fixme(
      'a tab already reopened twice shows a disabled/blocked reopen action (REOPEN_CAP_EXCEEDED)',
      async () => {
        // Plan 06 fills this in — seed a tab with reopen_count = 2, attempt the reopen
        // flow, assert the RPC's REOPEN_CAP_EXCEEDED error surfaces as a toast/inline
        // message and the tab remains closed.
      },
    );
  });
});
