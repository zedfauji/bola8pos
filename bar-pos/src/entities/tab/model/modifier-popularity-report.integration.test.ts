// vi.unmock MUST be the very first statement — overrides the global Supabase mock in test-setup.ts
vi.unmock('@shared/lib/supabase');

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@shared/lib/supabase';
import { testDb } from '@shared/lib/supabase-test-client';
import { useModifierPopularityReport } from './queries-reports';

// Jamie Chen (manager) — consistent with other integration tests in this suite
const STAFF_ID = 'cb969ea6-7443-4c03-ac99-bbe8aba0bb8e';

// Existing seeded modifiers (npm run setup:dev) — "Extra Lime" has a non-zero
// price_delta so the revenue column is exercised, not just attach-count.
const MOD_LIME = '30000003-0000-0000-0000-000000000003'; // Extra Lime, price_delta=0.5
const MOD_SHOT = '30000004-0000-0000-0000-000000000004'; // Double Shot, price_delta=3

// Deterministic test IDs — prefix IT-MODPOP to avoid FK collisions
const IT_SHIFT_ID = 'dc010000-dc01-4dc0-8dc0-dc0100000001';
const IT_CAJA_ID = 'dc020000-dc02-4dc0-8dc0-dc0200000002';
const IT_TAB_ID = 'dc030000-dc03-4dc0-8dc0-dc0300000003';
const IT_ORDER_ID = 'dc040000-dc04-4dc0-8dc0-dc0400000004';
const IT_ITEM_LIME_ONLY = 'dc050000-dc05-4dc0-8dc0-dc0500000005';
const IT_ITEM_BOTH = 'dc060000-dc06-4dc0-8dc0-dc0600000006';
const IT_ITEM_SHOT_ONLY = 'dc070000-dc07-4dc0-8dc0-dc0700000007';

// Far-future date range so dev-environment data never contaminates these tests
// (same pattern as category-revenue-report.integration.test.ts).
const RANGE_FROM = new Date('2035-09-01T00:00:00.000Z');
const RANGE_TO = new Date('2035-09-30T23:59:59.000Z');

let PRODUCT_ID: string;

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

// ---------------------------------------------------------------------------
// Integration: useModifierPopularityReport — real Supabase
// Phase 24 Plan 06 Task 3 — SC-1, RESEARCH.md Pitfall 4
// ---------------------------------------------------------------------------

describe('useModifierPopularityReport — integration (real Supabase)', () => {
  beforeAll(async () => {
    await supabase.auth.signInWithPassword({ email: 'jamie@barpos.dev', password: '567890' });

    const { data: prod } = await testDb
      .from('products')
      .select('id')
      .eq('name', 'Budweiser')
      .maybeSingle();
    if (!prod?.id) throw new Error('Budweiser product missing — run npm run setup:dev');
    PRODUCT_ID = prod.id;
  });

  afterAll(async () => {
    await supabase.auth.signOut();
  });

  beforeEach(async () => {
    const shiftR = await testDb.from('shifts').upsert({
      id: IT_SHIFT_ID,
      staff_id: STAFF_ID,
      opening_cash: 0,
      clock_in: new Date().toISOString(),
    });
    if (shiftR.error) throw new Error(`beforeEach shift: ${JSON.stringify(shiftR.error)}`);

    const cajaR = await testDb.from('caja_sessions').upsert({
      id: IT_CAJA_ID,
      opened_by: STAFF_ID,
      opening_cash: 0,
      closing_cash: 0,
      status: 'closed',
      closed_at: new Date().toISOString(),
    });
    if (cajaR.error) throw new Error(`beforeEach caja: ${JSON.stringify(cajaR.error)}`);

    const tabR = await testDb.from('tabs').upsert({
      id: IT_TAB_ID,
      caja_session_id: IT_CAJA_ID,
      staff_id: STAFF_ID,
      shift_id: IT_SHIFT_ID,
      status: 'closed',
      closed_at: '2035-09-15T12:00:00.000Z',
      customer_name: 'IT-modpop-test',
      created_at: '2035-09-15T12:00:00.000Z',
    });
    if (tabR.error) throw new Error(`beforeEach tab: ${JSON.stringify(tabR.error)}`);

    const orderR = await testDb.from('orders').upsert({
      id: IT_ORDER_ID,
      tab_id: IT_TAB_ID,
      staff_id: STAFF_ID,
      status: 'served',
      created_at: '2035-09-15T12:00:00.000Z',
    });
    if (orderR.error) throw new Error(`beforeEach order: ${JSON.stringify(orderR.error)}`);

    // 3 order_items exercising a multi-modifier item (IT_ITEM_BOTH carries
    // BOTH modifier_ids) — RESEARCH.md Pitfall 4: attach-count per modifier
    // must equal a manual ANY(modifier_ids) count, not be inflated by the
    // unnest/join. Expected: MOD_LIME attach_count=2 (LIME_ONLY + BOTH),
    // MOD_SHOT attach_count=2 (BOTH + SHOT_ONLY).
    const itemsR = await testDb.from('order_items').upsert([
      {
        id: IT_ITEM_LIME_ONLY,
        order_id: IT_ORDER_ID,
        product_id: PRODUCT_ID,
        quantity: 1,
        unit_price: 10,
        modifier_ids: [MOD_LIME],
      },
      {
        id: IT_ITEM_BOTH,
        order_id: IT_ORDER_ID,
        product_id: PRODUCT_ID,
        quantity: 1,
        unit_price: 10,
        modifier_ids: [MOD_LIME, MOD_SHOT],
      },
      {
        id: IT_ITEM_SHOT_ONLY,
        order_id: IT_ORDER_ID,
        product_id: PRODUCT_ID,
        quantity: 1,
        unit_price: 10,
        modifier_ids: [MOD_SHOT],
      },
    ]);
    if (itemsR.error) throw new Error(`beforeEach items: ${JSON.stringify(itemsR.error)}`);
  });

  afterEach(async () => {
    await testDb
      .from('order_items')
      .delete()
      .in('id', [IT_ITEM_LIME_ONLY, IT_ITEM_BOTH, IT_ITEM_SHOT_ONLY]);
    await testDb.from('orders').delete().eq('id', IT_ORDER_ID);
    await testDb.from('tabs').delete().eq('id', IT_TAB_ID);
    await testDb.from('caja_sessions').delete().eq('id', IT_CAJA_ID);
    await testDb.from('shifts').delete().eq('id', IT_SHIFT_ID);
  });

  // ---------------------------------------------------------------------------
  // Pitfall 4: attach-count matches a manual ANY(modifier_ids) spot-check —
  // multi-modifier items must not double-count or cross-multiply
  // ---------------------------------------------------------------------------

  it('attach-count for each modifier matches a manual ANY(modifier_ids) count, and revenue = attachCount * priceDelta', async () => {
    // Manual spot-check via the raw table, independent of the RPC's own
    // unnest/CTE logic (RESEARCH.md Pitfall 4).
    const { data: allItems, error: manualErr } = await testDb
      .from('order_items')
      .select('modifier_ids')
      .in('id', [IT_ITEM_LIME_ONLY, IT_ITEM_BOTH, IT_ITEM_SHOT_ONLY]);
    expect(manualErr).toBeNull();
    const manualLimeCount = (allItems ?? []).filter(i => i.modifier_ids.includes(MOD_LIME)).length;
    const manualShotCount = (allItems ?? []).filter(i => i.modifier_ids.includes(MOD_SHOT)).length;
    expect(manualLimeCount).toBe(2);
    expect(manualShotCount).toBe(2);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useModifierPopularityReport(RANGE_FROM, RANGE_TO), {
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
    const limeRow = rows.find(r => r.modifierId === MOD_LIME);
    const shotRow = rows.find(r => r.modifierId === MOD_SHOT);

    expect(limeRow).toBeDefined();
    expect(limeRow?.modifierName).toBe('Extra Lime');
    expect(limeRow?.attachCount).toBe(manualLimeCount);
    expect(limeRow?.revenue).toBe(manualLimeCount * 0.5);

    expect(shotRow).toBeDefined();
    expect(shotRow?.modifierName).toBe('Double Shot');
    expect(shotRow?.attachCount).toBe(manualShotCount);
    expect(shotRow?.revenue).toBe(manualShotCount * 3);

    qc.clear();
  });
});
