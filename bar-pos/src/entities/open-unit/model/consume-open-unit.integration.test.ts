import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integration test for Phase 27 (27-02) — the "sell one loose piece" tracer
 * slice. Proves the whole spine end-to-end against the live remote schema:
 * open_units table, products.parent_product_id/units_per_package,
 * consume_open_unit, and the deplete_for_order_item chokepoint branch.
 *
 * Requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and
 * SUPABASE_SERVICE_ROLE_KEY in environment (describe.skipIf below).
 *
 * Reuses src/entities/tab/model/depletion.integration.test.ts's skeleton
 * verbatim: a service-role client (`db`) for RLS-bypassing setup/teardown,
 * an authenticated client (`anonClient`) because deplete_for_order_item /
 * consume_open_unit call auth.uid() internally, and a temporary test user
 * created in beforeAll / torn down in afterAll.
 *
 * The test drives depletion exclusively through the deplete_for_order_item
 * RPC (the real chokepoint) — it never invokes the nested consume-side
 * function directly. This is the assertion that the nesting resolution
 * (27-02-PLAN.md objective, resolved Open Question 1) actually holds: if the
 * branch were missing, the call below would silently succeed and leave no
 * open_units row.
 *
 * NOTE: this file is authored and committed per plan 27-02, but is NOT
 * executed in this session — running it requires the four
 * 20260729* migrations to already be pushed to the live remote Supabase
 * project, which is deliberately deferred to a human-reviewed follow-up
 * (see 27-02-SUMMARY.md "Deferred to Human Review").
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const skip = !url || !serviceKey || !anonKey;

describe.skipIf(skip)('consume_open_unit integration (Phase 27 tracer spine)', () => {
  // Service-role client: setup, teardown, direct table queries (bypasses RLS)
  const db = createClient(url!, serviceKey!) as any;
  // Authenticated client: used for the deplete_for_order_item RPC call (auth.uid())
  const anonClient = createClient(url!, anonKey!) as any;

  let testUserId: string;
  let categoryId: string;
  let boxProductId: string;
  let looseProductId: string;
  let tabId: string;
  let orderId: string;
  let shiftId: string;
  let saleItemOneId: string;
  let saleItemTwoId: string;

  const BOX_UNITS_PER_PACKAGE = 20;
  const BOX_INITIAL_STOCK = 2;
  // D-03 regression fixture: the loose product's own base_price is
  // deliberately NOT box_price / units_per_package, so a future regression
  // that starts deriving the price fails this assertion.
  const BOX_BASE_PRICE = 100.0;
  const LOOSE_BASE_PRICE = 7.5; // != 100 / 20 (= 5.0)

  beforeAll(async () => {
    // 0. Temporary test user, signed in so anonClient carries auth.uid()
    const testEmail = `__open_unit_test_${Date.now()}@test.local`;
    const testPassword = 'TestOpenUnit123!';

    const { data: authUser, error: createErr } = await db.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (createErr || !authUser.user) throw new Error(`test user create: ${createErr?.message}`);
    testUserId = authUser.user.id;

    const { error: profileErr } = await db.from('profiles').upsert({
      id: testUserId,
      name: '__open_unit_test__',
      email: testEmail,
      role: 'bartender',
      pin: '999998',
      is_active: true,
    });
    if (profileErr) throw new Error(`profile upsert: ${profileErr.message}`);

    const { error: signInErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInErr) throw new Error(`sign in: ${signInErr.message}`);

    // 1. Category
    const { data: cat, error: catErr } = await db
      .from('categories')
      .select('id')
      .limit(1)
      .single();
    if (catErr || !cat) throw new Error(`category lookup: ${catErr?.message ?? 'no categories'}`);
    categoryId = (cat as { id: string }).id;

    // 2. BOX product (units_per_package = 20)
    const { data: boxProd, error: boxErr } = await db
      .from('products')
      .insert({
        name: '__test_open_unit_box__',
        base_price: BOX_BASE_PRICE,
        category_id: categoryId,
        is_active: true,
        units_per_package: BOX_UNITS_PER_PACKAGE,
      })
      .select('id')
      .single();
    if (boxErr) throw new Error(`box product insert: ${boxErr.message}`);
    boxProductId = (boxProd as { id: string }).id;

    // 3. inventory row for the BOX product
    const { error: invErr } = await db
      .from('inventory')
      .insert({ product_id: boxProductId, quantity_on_hand: BOX_INITIAL_STOCK });
    if (invErr) throw new Error(`inventory insert: ${invErr.message}`);

    // 4. LOOSE product, linked to the BOX, distinct base_price (D-03)
    const { data: looseProd, error: looseErr } = await db
      .from('products')
      .insert({
        name: '__test_open_unit_loose__',
        base_price: LOOSE_BASE_PRICE,
        category_id: categoryId,
        is_active: true,
        parent_product_id: boxProductId,
      })
      .select('id')
      .single();
    if (looseErr) throw new Error(`loose product insert: ${looseErr.message}`);
    looseProductId = (looseProd as { id: string }).id;

    // 5. Tab + order using the test user as staff_id
    const { data: newShift, error: shiftErr } = await db
      .from('shifts')
      .insert({ staff_id: testUserId, opening_cash: 0 })
      .select('id')
      .single();
    if (shiftErr || !newShift) throw new Error(`shift insert: ${shiftErr?.message}`);
    shiftId = (newShift as { id: string }).id;

    const { data: tab, error: tabErr } = await db
      .from('tabs')
      .insert({
        customer_name: '__test_open_unit_tab__',
        status: 'open',
        is_deleted: false,
        staff_id: testUserId,
        shift_id: shiftId,
      })
      .select('id')
      .single();
    if (tabErr) throw new Error(`tab insert: ${tabErr.message}`);
    tabId = (tab as { id: string }).id;

    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({ tab_id: tabId, status: 'pending', staff_id: testUserId })
      .select('id')
      .single();
    if (orderErr) throw new Error(`order insert: ${orderErr.message}`);
    orderId = (order as { id: string }).id;

    // 6. Two distinct order_items for the LOOSE product — one per sale call.
    const insertLooseItem = async () => {
      const { data, error } = await db
        .from('order_items')
        .insert({
          order_id: orderId,
          product_id: looseProductId,
          quantity: 1,
          unit_price: LOOSE_BASE_PRICE,
          modifier_price_delta: 0,
        })
        .select('id')
        .single();
      if (error) throw new Error(`order_item insert: ${error.message}`);
      return (data as { id: string }).id;
    };

    saleItemOneId = await insertLooseItem();
    saleItemTwoId = await insertLooseItem();
  });

  afterAll(async () => {
    await anonClient.auth.signOut();

    // Cleanup audit_logs / open_units referencing the BOX product first (FK-safe order)
    if (boxProductId) {
      const { data: units } = await db
        .from('open_units')
        .select('id')
        .eq('product_id', boxProductId);
      const unitIds = ((units as { id: string }[] | null) ?? []).map(u => u.id);
      if (unitIds.length > 0) {
        await db.from('audit_logs').delete().in('entity_id', unitIds);
        await db.from('open_units').delete().in('id', unitIds);
      }
    }

    const itemIds = [saleItemOneId, saleItemTwoId].filter(Boolean);
    if (itemIds.length > 0) {
      await db.from('order_items').delete().in('id', itemIds);
    }

    if (orderId) await db.from('orders').delete().eq('id', orderId);
    if (tabId) await db.from('tabs').delete().eq('id', tabId);
    if (looseProductId) await db.from('products').delete().eq('id', looseProductId);
    if (boxProductId) {
      await db.from('inventory').delete().eq('product_id', boxProductId);
      await db.from('products').delete().eq('id', boxProductId);
    }

    if (testUserId) {
      await db.from('shifts').delete().eq('staff_id', testUserId);
      await db.from('profiles').delete().eq('id', testUserId);
      await db.auth.admin.deleteUser(testUserId);
    }
  });

  it('sells one loose piece end-to-end through deplete_for_order_item, auto-opening the box', async () => {
    // 1. No open_units row exists for the BOX product initially.
    const { data: before, error: beforeErr } = await db
      .from('open_units')
      .select('id')
      .eq('product_id', boxProductId);
    expect(beforeErr).toBeNull();
    expect(before).toHaveLength(0);

    // 2. Sell one loose piece through the real chokepoint.
    const { error: sellErr } = await anonClient.rpc('deplete_for_order_item', {
      p_order_item_id: saleItemOneId,
      p_direction: 1,
      p_allow_negative: false,
    });
    expect(sellErr).toBeNull();

    // 3. Exactly one active open_units row now exists for the BOX product.
    const { data: units, error: unitsErr } = await db
      .from('open_units')
      .select('id, status, remaining_count, opened_by, opened_at')
      .eq('product_id', boxProductId);
    expect(unitsErr).toBeNull();
    expect(units).toHaveLength(1);
    const unit = (units as { id: string; status: string; remaining_count: number; opened_by: string | null; opened_at: string | null }[])[0]!;
    expect(unit.status).toBe('active');
    expect(unit.remaining_count).toBe(BOX_UNITS_PER_PACKAGE - 1);
    expect(unit.opened_by).not.toBeNull();
    expect(unit.opened_at).not.toBeNull();

    // 4. The BOX product's inventory dropped by one package.
    const { data: inv, error: invErr } = await db
      .from('inventory')
      .select('quantity_on_hand')
      .eq('product_id', boxProductId)
      .single();
    expect(invErr).toBeNull();
    expect((inv as { quantity_on_hand: number }).quantity_on_hand).toBe(BOX_INITIAL_STOCK - 1);

    // 5. audit_logs contains open_unit.open and open_unit.deplete for this unit.
    const { data: auditRows, error: auditErr } = await db
      .from('audit_logs')
      .select('action, source, actor_id')
      .eq('entity_type', 'open_unit')
      .eq('entity_id', unit.id);
    expect(auditErr).toBeNull();
    const actions = (auditRows as { action: string; source: string; actor_id: string | null }[]).map(r => r.action);
    expect(actions).toContain('open_unit.open');
    expect(actions).toContain('open_unit.deplete');
    for (const row of auditRows as { action: string; source: string; actor_id: string | null }[]) {
      expect(row.source).toBe('rpc');
      expect(row.actor_id).not.toBeNull();
    }

    // 6. A second quantity-1 sale reuses the same active unit — no second
    //    active row is created (D-07's partial unique index + the RPC's
    //    "reuse the active unit" targeting both hold).
    const { error: secondSellErr } = await anonClient.rpc('deplete_for_order_item', {
      p_order_item_id: saleItemTwoId,
      p_direction: 1,
      p_allow_negative: false,
    });
    expect(secondSellErr).toBeNull();

    const { data: unitsAfterSecond, error: unitsAfterSecondErr } = await db
      .from('open_units')
      .select('id, status, remaining_count')
      .eq('product_id', boxProductId);
    expect(unitsAfterSecondErr).toBeNull();
    expect(unitsAfterSecond).toHaveLength(1);
    const unitAfterSecond = (unitsAfterSecond as { id: string; status: string; remaining_count: number }[])[0]!;
    expect(unitAfterSecond.id).toBe(unit.id);
    expect(unitAfterSecond.status).toBe('active');
    expect(unitAfterSecond.remaining_count).toBe(BOX_UNITS_PER_PACKAGE - 2);
  });
});
