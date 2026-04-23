// vi.unmock MUST be the very first statement — overrides the global Supabase mock in test-setup.ts
vi.unmock('@shared/lib/supabase');

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@shared/lib/supabase';
import { testDb } from '@shared/lib/supabase-test-client';
import { useProductSalesReport } from './queries-reports';

// Jamie Chen (manager) — same staff used in pending-total integration test
const STAFF_ID = 'cb969ea6-7443-4c03-ac99-bbe8aba0bb8e';

// Deterministic test IDs — unique prefix IT-PRSALES to avoid collisions
const IT_SHIFT_ID = 'a1a10000-a1a1-4a1a-8a1a-a1a100000001';
const IT_CAJA_ID = 'b2b20000-b2b2-4b2b-8b2b-b2b200000002';
const IT_TAB_IN_RANGE = 'c3c30000-c3c3-4c3c-8c3c-c3c300000003';
const IT_TAB_OUT_OF_RANGE = 'd4d40000-d4d4-4d4d-8d4d-d4d400000004';
const IT_ORDER_BEER = 'e5e50000-e5e5-4e5e-8e5e-e5e500000005';
const IT_ORDER_SPIRITS = 'f6f60000-f6f6-4f6f-8f6f-f6f600000006';
const IT_ORDER_VOIDED = '17170000-1717-4171-8171-171700000007';
const IT_ORDER_OUT_OF_RANGE = '28280000-2828-4282-8282-282800000008';
const IT_ITEM_BEER_A = '39390000-3939-4393-8393-393900000009';
const IT_ITEM_BEER_B = '4a4a0000-4a4a-4a4a-84a4-4a4a0000000a';
const IT_ITEM_SPIRITS = '5b5b0000-5b5b-4b5b-85b5-5b5b0000000b';
const IT_ITEM_VOIDED = '6c6c0000-6c6c-4c6c-86c6-6c6c0000000c';
const IT_ITEM_OUT_OF_RANGE = '7d7d0000-7d7d-4d7d-87d7-7d7d0000000d';

let PRODUCT_ID_BEER: string;
let PRODUCT_ID_SPIRITS: string;

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

// ---------------------------------------------------------------------------
// Integration: useProductSalesReport — real Supabase
// QA-written tests per AC-2, AC-4, AC-5 of POS-3
// ---------------------------------------------------------------------------

describe('useProductSalesReport — integration (real Supabase)', () => {
  beforeAll(async () => {
    await supabase.auth.signInWithPassword({ email: 'jamie@barpos.dev', password: '567890' });

    // Look up Budweiser as the primary test product
    const { data: beer } = await testDb
      .from('products')
      .select('id')
      .eq('name', 'Budweiser')
      .maybeSingle();
    if (!beer?.id) throw new Error('Budweiser product missing — run npm run setup:dev');
    PRODUCT_ID_BEER = beer.id;

    // Use any other product for the second-product aggregation test
    const { data: spirits } = await testDb
      .from('products')
      .select('id')
      .neq('id', PRODUCT_ID_BEER)
      .limit(1)
      .maybeSingle();
    if (!spirits?.id) throw new Error('Need at least 2 products — run npm run setup:dev');
    PRODUCT_ID_SPIRITS = spirits.id;
  });

  afterAll(async () => {
    await supabase.auth.signOut();
  });

  beforeEach(async () => {
    // Defensive cleanup: E2E runs (e.g. KDS Playwright specs) occasionally
    // leak tabs with today's created_at. The product sales query filters by
    // tab.created_at, so those rows inflate revenue totals. Remove them first
    // so this test is resilient to prior-run leftovers.
    const { data: leakedTabs } = await testDb
      .from('tabs')
      .select('id')
      .like('customer_name', 'KDS E2E Tab%');
    const leakedTabIds = (leakedTabs ?? []).map(t => t.id);
    if (leakedTabIds.length > 0) {
      const { data: leakedOrders } = await testDb
        .from('orders')
        .select('id')
        .in('tab_id', leakedTabIds);
      const leakedOrderIds = (leakedOrders ?? []).map(o => o.id);
      if (leakedOrderIds.length > 0) {
        await testDb.from('order_items').delete().in('order_id', leakedOrderIds);
        await testDb.from('orders').delete().in('id', leakedOrderIds);
      }
      await testDb.from('tabs').delete().in('id', leakedTabIds);
    }

    // Seed shift (required FK for tabs)
    const shiftR = await testDb.from('shifts').upsert({
      id: IT_SHIFT_ID,
      staff_id: STAFF_ID,
      opening_cash: 0,
      clock_in: new Date().toISOString(),
    });
    if (shiftR.error) throw new Error(`beforeEach shift: ${JSON.stringify(shiftR.error)}`);

    // Seed caja session as 'closed' — we only need a valid FK for tabs.
    // Using 'open' would conflict with the unique_open constraint when running
    // alongside pending-total.integration.test.ts in parallel.
    const cajaR = await testDb.from('caja_sessions').upsert({
      id: IT_CAJA_ID,
      opened_by: STAFF_ID,
      opening_cash: 0,
      closing_cash: 0,
      status: 'closed',
      closed_at: new Date().toISOString(),
    });
    if (cajaR.error) throw new Error(`beforeEach caja: ${JSON.stringify(cajaR.error)}`);

    // Seed tabs: one with today's created_at (in range), one from 2020 (out of range)
    const tabsR = await testDb.from('tabs').upsert([
      {
        id: IT_TAB_IN_RANGE,
        caja_session_id: IT_CAJA_ID,
        staff_id: STAFF_ID,
        shift_id: IT_SHIFT_ID,
        status: 'open',
        customer_name: 'IT-prsales-in-range',
        created_at: new Date().toISOString(),
      },
      {
        id: IT_TAB_OUT_OF_RANGE,
        caja_session_id: IT_CAJA_ID,
        staff_id: STAFF_ID,
        shift_id: IT_SHIFT_ID,
        status: 'closed',
        closed_at: new Date().toISOString(),
        customer_name: 'IT-prsales-out-of-range',
        created_at: '2020-01-01T12:00:00.000Z',
      },
    ]);
    if (tabsR.error) throw new Error(`beforeEach tabs: ${JSON.stringify(tabsR.error)}`);

    // Seed orders (both belong to in-range tab; one is voided; one belongs to out-of-range tab)
    const ordersR = await testDb.from('orders').upsert([
      { id: IT_ORDER_BEER, tab_id: IT_TAB_IN_RANGE, staff_id: STAFF_ID, status: 'pending' },
      { id: IT_ORDER_SPIRITS, tab_id: IT_TAB_IN_RANGE, staff_id: STAFF_ID, status: 'pending' },
      { id: IT_ORDER_VOIDED, tab_id: IT_TAB_IN_RANGE, staff_id: STAFF_ID, status: 'voided' },
      {
        id: IT_ORDER_OUT_OF_RANGE,
        tab_id: IT_TAB_OUT_OF_RANGE,
        staff_id: STAFF_ID,
        status: 'pending',
      },
    ]);
    if (ordersR.error) throw new Error(`beforeEach orders: ${JSON.stringify(ordersR.error)}`);

    // Seed order items:
    //   Beer  (in-range): 2×$10 + 3×$10 = $50 (across two line items, same product)
    //   Spirits (in-range): 1×$30 = $30
    //   Voided beer: 1×$200 — MUST be excluded (order.status = 'voided')
    //   Out-of-range beer: 1×$500 — MUST be excluded (tab.created_at = 2020)
    const itemsR = await testDb.from('order_items').upsert([
      {
        id: IT_ITEM_BEER_A,
        order_id: IT_ORDER_BEER,
        product_id: PRODUCT_ID_BEER,
        quantity: 2,
        unit_price: 10,
        modifier_price_delta: 0,
      },
      {
        id: IT_ITEM_BEER_B,
        order_id: IT_ORDER_BEER,
        product_id: PRODUCT_ID_BEER,
        quantity: 3,
        unit_price: 10,
        modifier_price_delta: 0,
      },
      {
        id: IT_ITEM_SPIRITS,
        order_id: IT_ORDER_SPIRITS,
        product_id: PRODUCT_ID_SPIRITS,
        quantity: 1,
        unit_price: 30,
        modifier_price_delta: 0,
      },
      {
        id: IT_ITEM_VOIDED,
        order_id: IT_ORDER_VOIDED,
        product_id: PRODUCT_ID_BEER,
        quantity: 1,
        unit_price: 200,
        modifier_price_delta: 0,
      },
      {
        id: IT_ITEM_OUT_OF_RANGE,
        order_id: IT_ORDER_OUT_OF_RANGE,
        product_id: PRODUCT_ID_BEER,
        quantity: 1,
        unit_price: 500,
        modifier_price_delta: 0,
      },
    ]);
    if (itemsR.error) throw new Error(`beforeEach items: ${JSON.stringify(itemsR.error)}`);
  });

  afterEach(async () => {
    // Delete in FK order: order_items → orders → tabs → caja_sessions → shifts
    await testDb
      .from('order_items')
      .delete()
      .in('id', [
        IT_ITEM_BEER_A,
        IT_ITEM_BEER_B,
        IT_ITEM_SPIRITS,
        IT_ITEM_VOIDED,
        IT_ITEM_OUT_OF_RANGE,
      ]);
    await testDb
      .from('orders')
      .delete()
      .in('id', [IT_ORDER_BEER, IT_ORDER_SPIRITS, IT_ORDER_VOIDED, IT_ORDER_OUT_OF_RANGE]);
    await testDb.from('tabs').delete().in('id', [IT_TAB_IN_RANGE, IT_TAB_OUT_OF_RANGE]);
    await testDb.from('caja_sessions').delete().eq('id', IT_CAJA_ID);
    await testDb.from('shifts').delete().eq('id', IT_SHIFT_ID);
  });

  // -------------------------------------------------------------------------
  // AC-5: aggregation query over seeded fixture with multiple products
  // -------------------------------------------------------------------------

  it('AC-5: aggregates order_items by product — beer=$50 (5 units), spirits=$30 (1 unit)', async () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useProductSalesReport(from, to), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(
      () => {
        expect(result.current.isSuccess).toBe(true);
      },
      { timeout: 10_000 }
    );

    expect(result.current.data?.ok).toBe(true);
    if (!result.current.data?.ok) return;

    const rows = result.current.data.data;

    // Beer: two line items for same product (2×$10 + 3×$10) → 5 units, $50 revenue
    const beerRow = rows.find(r => r.productId === PRODUCT_ID_BEER);
    expect(beerRow).toBeDefined();
    expect(beerRow?.units).toBe(5);
    expect(beerRow?.revenue).toBe(50);

    // Spirits: 1×$30 → 1 unit, $30 revenue
    const spiritsRow = rows.find(r => r.productId === PRODUCT_ID_SPIRITS);
    expect(spiritsRow).toBeDefined();
    expect(spiritsRow?.units).toBe(1);
    expect(spiritsRow?.revenue).toBe(30);

    // Default sort: Beer ($50) before Spirits ($30) — revenue desc
    const beerIdx = rows.findIndex(r => r.productId === PRODUCT_ID_BEER);
    const spiritsIdx = rows.findIndex(r => r.productId === PRODUCT_ID_SPIRITS);
    expect(beerIdx).toBeLessThan(spiritsIdx);

    qc.clear();
  });

  // -------------------------------------------------------------------------
  // AC-2a: voided orders excluded from revenue aggregation
  // -------------------------------------------------------------------------

  it('AC-2: voided order_items are excluded — beer revenue is $50, not $250', async () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useProductSalesReport(from, to), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(
      () => {
        expect(result.current.isSuccess).toBe(true);
      },
      { timeout: 10_000 }
    );

    expect(result.current.data?.ok).toBe(true);
    if (!result.current.data?.ok) return;

    const beerRow = result.current.data.data.find(r => r.productId === PRODUCT_ID_BEER);
    // In-range non-voided: 2×$10 + 3×$10 = $50. Voided order ($200) must be excluded.
    expect(beerRow?.revenue).toBe(50);

    qc.clear();
  });

  // -------------------------------------------------------------------------
  // AC-2b: date range filter excludes tabs whose created_at is outside [from, to]
  // -------------------------------------------------------------------------

  it('AC-2: date range filter excludes tabs from 2020 — beer revenue stays $50', async () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useProductSalesReport(from, to), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(
      () => {
        expect(result.current.isSuccess).toBe(true);
      },
      { timeout: 10_000 }
    );

    expect(result.current.data?.ok).toBe(true);
    if (!result.current.data?.ok) return;

    const beerRow = result.current.data.data.find(r => r.productId === PRODUCT_ID_BEER);
    // Out-of-range tab (created 2020-01-01) had 1×$500 beer item — must be excluded.
    // Revenue must be $50 (in-range items only), not $550.
    expect(beerRow?.revenue).toBe(50);

    qc.clear();
  });

  // -------------------------------------------------------------------------
  // AC-4: empty array returned when date range contains no orders
  // -------------------------------------------------------------------------

  it('AC-4: returns empty array (→ empty state) when date range has no orders', async () => {
    const from = new Date('2020-06-01T00:00:00.000Z');
    const to = new Date('2020-06-01T23:59:59.999Z');

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useProductSalesReport(from, to), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(
      () => {
        expect(result.current.isSuccess).toBe(true);
      },
      { timeout: 10_000 }
    );

    expect(result.current.data?.ok).toBe(true);
    if (!result.current.data?.ok) return;
    expect(result.current.data.data).toHaveLength(0);

    qc.clear();
  });
});
