/**
 * Integration tests: split-tab RPCs (Phase 6, Plan 10)
 *
 * Requires: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars
 * Run: cd bar-pos && npx vitest run src/features/split-tab/split-tab-rpc.integration.test.ts
 *
 * Tests skip gracefully when env vars are absent.
 * Split RPCs use SECURITY DEFINER but do not call auth.uid() — service role works.
 */
import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// ── Env guard ─────────────────────────────────────────────────────────────────

const hasEnv =
  typeof process.env['VITE_SUPABASE_URL'] === 'string' &&
  process.env['VITE_SUPABASE_URL'] !== '' &&
  typeof process.env['SUPABASE_SERVICE_ROLE_KEY'] === 'string' &&
  process.env['SUPABASE_SERVICE_ROLE_KEY'] !== '';

/** Live-DB test — skipped when service role key is absent. */
const itInt = hasEnv ? it : it.skip;

// ── Client factory ────────────────────────────────────────────────────────────

function getDb(): any {
  const url = process.env['VITE_SUPABASE_URL']!;
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function getStaffAndShift(db: any): Promise<{ staffId: string; shiftId: string }> {
  const { data: staff } = await db
    .from('profiles')
    .select('id')
    .in('role', ['manager', 'admin'])
    .limit(1)
    .single();
  if (!staff) throw new Error('getStaffAndShift: no manager/admin profile found');
  const staffId = staff.id as string;

  const { data: existing } = await db
    .from('shifts')
    .select('id')
    .eq('staff_id', staffId)
    .is('clock_out', null)
    .limit(1)
    .maybeSingle();

  if (existing) return { staffId, shiftId: existing.id as string };

  const { data: newShift, error: shiftErr } = await db
    .from('shifts')
    .insert({ staff_id: staffId, opening_cash: 0 })
    .select('id')
    .single();
  if (shiftErr || !newShift) throw new Error(`getStaffAndShift: shift create failed: ${shiftErr?.message ?? 'no row'}`);
  return { staffId, shiftId: newShift.id as string };
}

interface SeedResult {
  tabId: string;
  orderId: string;
  itemIds: string[];
  staffId: string;
  shiftId: string;
}

/**
 * Seeds a tab with `itemCount` order_items.
 * `overrideStatus` lets you create a tab in a non-open state (e.g. 'paid') for guard tests.
 */
async function seedTabWithItems(
  db: any,
  itemCount: number,
  overrideStatus?: string,
): Promise<SeedResult> {
  const { staffId, shiftId } = await getStaffAndShift(db);

  const { data: product } = await db
    .from('products')
    .select('id, base_price')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (!product) throw new Error('seedTabWithItems: no active product found');

  const tabPayload: Record<string, unknown> = {
    customer_name: `Integration Test Tab ${Date.now()}`,
    staff_id: staffId,
    shift_id: shiftId,
    status: overrideStatus ?? 'open',
  };
  // closed_at is required for any non-open/non-split status (CHECK constraint)
  if (overrideStatus && overrideStatus !== 'open' && overrideStatus !== 'split') {
    tabPayload.closed_at = new Date().toISOString();
  }

  const { data: tab, error: tabErr } = await db
    .from('tabs')
    .insert(tabPayload)
    .select('id')
    .single();
  if (tabErr || !tab) throw new Error(`seedTabWithItems: tab insert failed: ${tabErr?.message ?? 'no row'}`);

  const { data: order, error: orderErr } = await db
    .from('orders')
    .insert({ tab_id: tab.id, staff_id: staffId, status: 'pending' })
    .select('id')
    .single();
  if (orderErr || !order) throw new Error(`seedTabWithItems: order insert failed: ${orderErr?.message ?? 'no row'}`);

  const { data: items, error: itemErr } = await db
    .from('order_items')
    .insert(
      Array.from({ length: itemCount }, () => ({
        order_id: order.id,
        product_id: product.id,
        quantity: 1,
        unit_price: Number(product.base_price) || 10.0,
        modifier_price_delta: 0,
      })),
    )
    .select('id');
  if (itemErr || !items) throw new Error(`seedTabWithItems: items insert failed: ${itemErr?.message ?? 'no row'}`);

  return {
    tabId: tab.id as string,
    orderId: order.id as string,
    itemIds: (items as { id: string }[]).map((i) => i.id),
    staffId,
    shiftId,
  };
}

/**
 * Hard-delete cleanup that handles parent+sub-tabs.
 * Order: sub-tab payments → sub-tabs (cascade) → parent payments → parent (cascade).
 */
async function cleanupTab(db: any, parentTabId: string): Promise<void> {
  // 1. Delete payments on sub-tabs (RESTRICT prevents deleting tab while payments exist)
  const { data: subTabs } = await db
    .from('tabs')
    .select('id')
    .eq('parent_tab_id', parentTabId);
  for (const sub of (subTabs ?? []) as { id: string }[]) {
    await db.from('payments').delete().eq('tab_id', sub.id);
  }

  // 2. Delete sub-tabs → cascade to their orders → cascade to order_items
  await db.from('tabs').delete().eq('parent_tab_id', parentTabId);

  // 3. Delete parent tab payments
  await db.from('payments').delete().eq('tab_id', parentTabId);

  // 4. Delete parent tab → cascade to its orders → cascade to remaining order_items
  await db.from('tabs').delete().eq('id', parentTabId);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('split-tab RPCs (integration)', () => {
  let db: any;
  let tabId: string;

  beforeEach(() => {
    db = getDb();
    tabId = '';
  });

  afterEach(async () => {
    if (tabId) {
      await cleanupTab(db, tabId).catch(() => undefined);
    }
  });

  itInt('split_tab_by_item: creates sub-tabs, reassigns order_items, cascades combo children', async () => {
    // Seed parent tab with 6 items
    const { tabId: tid, orderId, itemIds } = await seedTabWithItems(db, 6);
    tabId = tid;

    // Add a combo child for itemIds[0] — tests cascade behavior
    const { data: product } = await db
      .from('products')
      .select('id, base_price')
      .eq('is_active', true)
      .limit(1)
      .single();
    const { data: comboChild, error: childErr } = await db
      .from('order_items')
      .insert({
        order_id: orderId,
        product_id: product.id,
        quantity: 1,
        unit_price: 0, // combo children priced at 0
        modifier_price_delta: 0,
        parent_order_item_id: itemIds[0],
      })
      .select('id')
      .single();
    expect(childErr).toBeNull();

    // Distribute: Alice gets items 0-2, Bob gets items 3-5
    const assignments = [
      { sub_tab_label: 'Alice', order_item_ids: itemIds.slice(0, 3) },
      { sub_tab_label: 'Bob', order_item_ids: itemIds.slice(3, 6) },
    ];

    const { data: subTabIds, error } = await db.rpc('split_tab_by_item', {
      p_parent_tab_id: tabId,
      p_assignments: assignments,
    });

    expect(error).toBeNull();
    expect(Array.isArray(subTabIds)).toBe(true);
    expect(subTabIds).toHaveLength(2);

    // Parent is now 'split' with split_mode='item'
    const { data: parent } = await db
      .from('tabs')
      .select('status, split_mode')
      .eq('id', tabId)
      .single();
    expect(parent.status).toBe('split');
    expect(parent.split_mode).toBe('item');

    // Sub-tabs have correct split_label and parent_tab_id
    const { data: subs } = await db
      .from('tabs')
      .select('id, parent_tab_id, split_label')
      .eq('parent_tab_id', tabId)
      .order('split_label');
    expect(subs).toHaveLength(2);
    expect(subs[0].split_label).toBe('Alice');
    expect(subs[1].split_label).toBe('Bob');

    // Alice's items are under Alice's sub-tab
    const { data: aliceItem } = await db
      .from('order_items')
      .select('order_id')
      .eq('id', itemIds[0])
      .single();
    const { data: aliceOrder } = await db
      .from('orders')
      .select('tab_id')
      .eq('id', aliceItem.order_id)
      .single();
    expect(aliceOrder.tab_id).toBe(subTabIds[0]);

    // Combo child cascaded to Alice's sub-tab along with its parent item
    const { data: childItem } = await db
      .from('order_items')
      .select('order_id')
      .eq('id', comboChild.id)
      .single();
    const { data: childOrder } = await db
      .from('orders')
      .select('tab_id')
      .eq('id', childItem.order_id)
      .single();
    expect(childOrder.tab_id).toBe(subTabIds[0]); // cascaded to Alice
  });

  itInt('split_tab_evenly: returns per_payment_amount and cents_remainder for 3 ways', async () => {
    // Seed parent tab with 3 items at $20.00 each = $60.00 total
    const { staffId, shiftId } = await getStaffAndShift(db);

    const { data: product } = await db
      .from('products')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    const { data: tab } = await db
      .from('tabs')
      .insert({
        customer_name: `Evenly Test ${Date.now()}`,
        staff_id: staffId,
        shift_id: shiftId,
        status: 'open',
      })
      .select('id')
      .single();
    tabId = tab.id as string;

    const { data: order } = await db
      .from('orders')
      .insert({ tab_id: tabId, staff_id: staffId, status: 'pending' })
      .select('id')
      .single();

    await db.from('order_items').insert(
      Array.from({ length: 3 }, () => ({
        order_id: order.id,
        product_id: product.id,
        quantity: 1,
        unit_price: 20.0,
        modifier_price_delta: 0,
      })),
    );

    const { data: result, error } = await db.rpc('split_tab_evenly', {
      p_parent_tab_id: tabId,
      p_n: 3,
    });

    expect(error).toBeNull();
    expect(result).toBeTruthy();
    // $60 / 3 = $20 base; remainder = 60 - 20*2 = 20; cents_remainder = 20 - 20 = 0
    expect(Number(result.per_payment_amount)).toBe(20.0);
    expect(Number(result.cents_remainder)).toBe(0);
  });

  itInt('split_tab_by_person: creates N sub-tabs, unassigned items stay in parent orders', async () => {
    const { tabId: tid, itemIds } = await seedTabWithItems(db, 4);
    tabId = tid;

    // Assign item 0 to person 1, item 1 to person 2 — items 2 & 3 are unassigned
    const assignments = [
      { sub_tab_label: 'Person 1', order_item_ids: [itemIds[0]] },
      { sub_tab_label: 'Person 2', order_item_ids: [itemIds[1]] },
    ];

    const { data: subTabIds, error } = await db.rpc('split_tab_by_person', {
      p_parent_tab_id: tabId,
      p_n: 2,
      p_assignments: assignments,
    });

    expect(error).toBeNull();
    expect(subTabIds).toHaveLength(2);

    // Parent is now 'split'
    const { data: parent } = await db
      .from('tabs')
      .select('status')
      .eq('id', tabId)
      .single();
    expect(parent.status).toBe('split');

    // Unassigned item stays in the parent tab's order
    const { data: unassignedItem } = await db
      .from('order_items')
      .select('order_id')
      .eq('id', itemIds[2])
      .single();
    const { data: itemOrder } = await db
      .from('orders')
      .select('tab_id')
      .eq('id', unassignedItem.order_id)
      .single();
    expect(itemOrder.tab_id).toBe(tabId); // still in parent tab
  });

  itInt('split_tab_by_amount: creates sub-tabs with greedy order_items allocation', async () => {
    const { staffId, shiftId } = await getStaffAndShift(db);

    const { data: product } = await db
      .from('products')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    const { data: tab } = await db
      .from('tabs')
      .insert({
        customer_name: `Amount Split Test ${Date.now()}`,
        staff_id: staffId,
        shift_id: shiftId,
        status: 'open',
      })
      .select('id')
      .single();
    tabId = tab.id as string;

    const { data: order } = await db
      .from('orders')
      .insert({ tab_id: tabId, staff_id: staffId, status: 'pending' })
      .select('id')
      .single();

    // Two items: $60 + $40 = $100 total; amounts sum must match exactly (±0.01)
    await db.from('order_items').insert([
      { order_id: order.id, product_id: product.id, quantity: 1, unit_price: 60.0, modifier_price_delta: 0 },
      { order_id: order.id, product_id: product.id, quantity: 1, unit_price: 40.0, modifier_price_delta: 0 },
    ]);

    const { data: subTabIds, error } = await db.rpc('split_tab_by_amount', {
      p_parent_tab_id: tabId,
      p_amounts: [
        { sub_tab_label: 'A', amount: 60.0 },
        { sub_tab_label: 'B', amount: 40.0 },
      ],
    });

    expect(error).toBeNull();
    expect(subTabIds).toHaveLength(2);

    const { data: parent } = await db
      .from('tabs')
      .select('status, split_mode')
      .eq('id', tabId)
      .single();
    expect(parent.status).toBe('split');
    expect(parent.split_mode).toBe('by_amount');
  });

  itInt('PARENT_TAB_PAID guard: attempting split on paid tab raises error', async () => {
    // Seed a paid tab (split_tab_by_item checks status='open' and raises if not)
    const { tabId: tid, itemIds } = await seedTabWithItems(db, 2, 'paid');
    tabId = tid;

    const { error } = await db.rpc('split_tab_by_item', {
      p_parent_tab_id: tabId,
      p_assignments: [
        { sub_tab_label: 'X', order_item_ids: [itemIds[0]] },
        { sub_tab_label: 'Y', order_item_ids: [itemIds[1]] },
      ],
    });

    expect(error).not.toBeNull();
    expect(error.message).toContain('PARENT_TAB_PAID');
  });

  itInt('ITEM_ASSIGNED_TWICE guard: duplicate item in assignments raises error', async () => {
    const { tabId: tid, itemIds } = await seedTabWithItems(db, 3);
    tabId = tid;

    const { error } = await db.rpc('split_tab_by_item', {
      p_parent_tab_id: tabId,
      p_assignments: [
        { sub_tab_label: 'A', order_item_ids: [itemIds[0], itemIds[1]] },
        { sub_tab_label: 'B', order_item_ids: [itemIds[1], itemIds[2]] }, // itemIds[1] assigned twice
      ],
    });

    expect(error).not.toBeNull();
    expect(error.message).toContain('ITEM_ASSIGNED_TWICE');
  });
});
