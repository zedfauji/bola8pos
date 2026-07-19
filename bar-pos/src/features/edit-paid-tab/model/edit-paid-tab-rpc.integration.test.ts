/**
 * Integration tests: edit_paid_tab RPC (Phase 22, Plan 01 — Wave 0 scaffold).
 *
 * PENDING SCAFFOLD — the `edit_paid_tab` RPC does not exist yet (lands in
 * 22-02's migration). These `it.todo` placeholders name the SC-1/SC-2
 * scenarios that plan 22-02 will activate with live-Supabase assertions,
 * mirroring the pattern in
 * `src/entities/payment/model/split-payment-rpc.integration.test.ts`
 * (service-role client, seed helpers, itInt gate on VITE_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY).
 *
 * Run: cd bar-pos && npx vitest run src/features/edit-paid-tab/model/edit-paid-tab-rpc.integration.test.ts
 */
import { describe, it } from 'vitest';

describe('edit_paid_tab RPC', () => {
  it.todo(
    'SC-1 happy path: a whitelisted order_item patch bumps tabs.version and returns the new total'
  );

  it.todo('SC-1: STALE_VERSION is returned when p_expected_version does not match tabs.version');

  it.todo('SC-1: AUTH_FORBIDDEN is returned when the caller is not manager/admin role');

  it.todo(
    'SC-1: a non-whitelisted key in an order_item patch is ignored/rejected, not applied'
  );

  it.todo(
    'SC-2: a successful edit writes an audit_logs row (action=tab.edit_paid) with before/after diff'
  );
});
