/**
 * Integration tests: process_refund RPC (Phase 6)
 * Stubs created by Plan 03 (Wave 2) — filled in by Plan 10 (Wave 5).
 *
 * Requires live Supabase DB + SUPABASE_SERVICE_ROLE_KEY in env.
 * Run: npx vitest run src/features/process-refund/process-refund-rpc.integration.test.ts
 */
import { describe, it } from 'vitest';

describe('process_refund RPC (integration)', () => {
  it.skip('process_refund: inserts negative payment row and refund record', async () => {
    // TODO (Plan 10): seed paid tab; call process_refund as admin;
    // assert refunds row + payments row with is_refund=true, amount negative.
  });

  it.skip('process_refund: REFUND_EXCEEDS_ORIGINAL blocks over-refund', async () => {
    // TODO (Plan 10): process full refund first; attempt second refund of same payment;
    // assert REFUND_EXCEEDS_ORIGINAL error raised.
  });

  it.skip('process_refund: AUTH_FORBIDDEN blocks bartender role', async () => {
    // TODO (Plan 10): call process_refund as bartender profile;
    // assert AUTH_FORBIDDEN error.
  });

  it.skip('process_refund: restock=true attempts deplete_for_order_item (stub graceful when Phase 4 absent)', async () => {
    // TODO (Plan 10): call process_refund with restock=true item;
    // assert no error raised even when deplete_for_order_item does not exist.
  });

  it.skip('after_payment_insert_check_parent_close trigger: parent auto-closes when all sub-tabs paid', async () => {
    // TODO (Plan 10): seed split tab with 2 sub-tabs; pay both;
    // assert parent tab status = paid.
  });
});
