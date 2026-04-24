/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
/**
 * Integration tests: split-tab RPCs (Phase 6)
 * Stubs created by Plan 03 (Wave 2) — filled in by Plan 10 (Wave 5).
 *
 * Requires live Supabase DB + SUPABASE_SERVICE_ROLE_KEY in env.
 * Run: npx vitest run src/features/split-tab/split-tab-rpc.integration.test.ts
 */
import { describe, it } from 'vitest';

// These tests are skipped until Plan 10 implements the full bodies.
// When Plan 10 runs, it will replace each it.skip with a full it() body.

describe('split-tab RPCs (integration)', () => {
  it.skip('split_tab_by_item: creates sub-tabs, reassigns order_items, cascades combo children', async () => {
    // TODO (Plan 10): seed parent tab with 6 items + 1 combo;
    // call split_tab_by_item via supabase service client;
    // assert 2 sub-tab rows, correct order_items distribution, combo children follow parent.
  });

  it.skip('split_tab_evenly: returns per_payment_amount and cents_remainder for 3 ways', async () => {
    // TODO (Plan 10): seed parent tab with $60 total;
    // call split_tab_evenly(n=3);
    // assert per_payment_amount=20.00, cents_remainder=0.
  });

  it.skip('split_tab_by_person: creates N sub-tabs, unassigned items stay in parent orders', async () => {
    // TODO (Plan 10): seed parent tab with 6 items, assign 2 to person 1, leave 4 unassigned;
    // call split_tab_by_person(n=3);
    // assert 3 sub-tab rows created, unassigned items remain in parent orders.
  });

  it.skip('split_tab_by_amount: creates sub-tabs with greedy order_items allocation', async () => {
    // TODO (Plan 10): seed parent tab with 4 items at varying prices totalling $100;
    // call split_tab_by_amount([{label:"A",amount:60},{label:"B",amount:40}]);
    // assert 2 sub-tabs, order_items moved to correct orders, buckets allocated greedily.
  });

  it.skip('PARENT_TAB_PAID guard: attempting split on paid tab raises error', async () => {
    // TODO (Plan 10): seed paid tab; call split_tab_by_item; assert PARENT_TAB_PAID error.
  });

  it.skip('ITEM_ASSIGNED_TWICE guard: duplicate item in assignments raises error', async () => {
    // TODO (Plan 10): seed tab; call split_tab_by_item with same item_id in two assignments;
    // assert ITEM_ASSIGNED_TWICE error.
  });
});
