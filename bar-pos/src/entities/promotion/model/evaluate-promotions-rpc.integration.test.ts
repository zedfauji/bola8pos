/**
 * Integration test: evaluate_promotions_for_item + create_order_with_items v3
 * (Phase 20, Plan 03 — SC-3 / T-20-03).
 *
 * Requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and
 * SUPABASE_SERVICE_ROLE_KEY in the environment. Skips gracefully (does not
 * fail) when live creds are absent, mirroring
 * src/entities/tab/model/depletion.integration.test.ts.
 *
 * DEPENDENCY: this test requires:
 *   - supabase/migrations/20260710000001_promotions_schema.sql (promotions table)
 *   - supabase/migrations/20260710000002_is_promotion_available_fn.sql
 *   - supabase/migrations/20260710000003_applied_promotions_table.sql
 *   - supabase/migrations/20260710000004_evaluate_promotions_rpc.sql
 * to be LIVE on the target Supabase project. Until the phase's BLOCKING db
 * push lands, these cases will fail at runtime against a live env (missing
 * table/function) even though the env-guard skip path exits 0 today.
 *
 * Core assertion (T-20-03, Pitfall 1): evaluate_promotions_for_item treats
 * whatever unit_price the client submits as the undiscounted BASE price
 * input — it never trusts a client-submitted value as the already-final
 * charged price. This test submits a deliberately inflated unit_price and
 * asserts the server independently (re)computes and writes the discounted
 * final price (base_submitted × the active promotion's stack) rather than
 * ever using the client's raw submitted number as the charged amount. An
 * applied_promotions audit row is created recording both amounts.
 *
 * `promotions` / `applied_promotions` are not yet in supabase.types.ts, so a
 * `db = supabase as any` cast is used file-wide per the CLAUDE.md "missing
 * generated types" workaround.
 */
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const hasE2eEnv = !url || !serviceKey || !anonKey;

describe.skipIf(hasE2eEnv)('evaluate_promotions_for_item + create_order_with_items v3 (SC-3)', () => {
  const db = createClient(url!, serviceKey!) as any;
  const anonClient = createClient(url!, anonKey!) as any;

  let testUserId: string;
  let tabId: string;
  let productId: string;
  let promotionId: string;
  let orderId: string | undefined;
  let orderItemId: string | undefined;

  const BASE_PRICE = 100; // products.base_price — informational only, not read by the RPC
  const INFLATED_CLIENT_PRICE = 999; // deliberately inflated order_items.unit_price input
  const DISCOUNT_PERCENT = 20;
  // The server treats INFLATED_CLIENT_PRICE as the undiscounted base and
  // always (re)applies the active promotion stack on top of it — the client
  // can never get its raw submitted number accepted as the final charged
  // price once a promotion is eligible.
  const EXPECTED_SERVER_PRICE = 799.2; // 999 * (1 - 20/100)

  beforeAll(async () => {
    const testEmail = `__evaluate_promo_rpc_test_${String(Date.now())}@test.local`;
    const testPassword = 'TestEvaluatePromoRpc123!';

    const { data: authUser, error: createErr } = await db.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (createErr || !authUser.user) throw new Error(`test user create: ${createErr?.message}`);
    testUserId = authUser.user.id as string;

    const { error: profileErr } = await db.from('profiles').upsert({
      id: testUserId,
      name: '__evaluate_promo_rpc_test__',
      email: testEmail,
      role: 'manager',
      pin: '999994',
      is_active: true,
    });
    if (profileErr) throw new Error(`profile upsert: ${profileErr.message}`);

    const { error: signInErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInErr) throw new Error(`sign in: ${signInErr.message}`);

    const { data: cat, error: catErr } = await db.from('categories').select('id').limit(1).single();
    if (catErr || !cat) throw new Error(`category lookup: ${catErr?.message ?? 'no categories'}`);
    const categoryId = (cat as { id: string }).id;

    const { data: prod, error: prodErr } = await db
      .from('products')
      .insert({
        name: '__evaluate_promo_rpc_product__',
        base_price: BASE_PRICE,
        category_id: categoryId,
        is_active: true,
      })
      .select('id')
      .single();
    if (prodErr) throw new Error(`product insert: ${prodErr.message}`);
    productId = (prod as { id: string }).id;

    // Item-targeted, always-available (zero promotion_availability rows),
    // active percentage promotion on this product.
    const { data: promo, error: promoErr } = await db
      .from('promotions')
      .insert({
        name: '__evaluate_promo_rpc_promo__',
        discount_type: 'percentage',
        discount_value: DISCOUNT_PERCENT,
        target_type: 'item',
        target_product_id: productId,
        priority: 0,
        is_active: true,
      })
      .select('id')
      .single();
    if (promoErr || !promo) throw new Error(`promotion insert: ${promoErr?.message}`);
    promotionId = (promo as { id: string }).id;

    const { data: newShift, error: shiftErr } = await db
      .from('shifts')
      .insert({ staff_id: testUserId, opening_cash: 0 })
      .select('id')
      .single();
    if (shiftErr || !newShift) throw new Error(`shift insert: ${shiftErr?.message}`);
    const shiftId = (newShift as { id: string }).id;

    const { data: tab, error: tabErr } = await db
      .from('tabs')
      .insert({
        customer_name: '__evaluate_promo_rpc_tab__',
        status: 'open',
        is_deleted: false,
        staff_id: testUserId,
        shift_id: shiftId,
      })
      .select('id')
      .single();
    if (tabErr) throw new Error(`tab insert: ${tabErr.message}`);
    tabId = (tab as { id: string }).id;
  });

  afterAll(async () => {
    await anonClient.auth.signOut();

    if (orderItemId) {
      await db.from('applied_promotions').delete().eq('order_item_id', orderItemId);
      await db.from('audit_logs').delete().eq('entity_id', orderItemId);
    }
    if (orderId) await db.from('orders').delete().eq('id', orderId);
    if (tabId) await db.from('tabs').delete().eq('id', tabId);
    if (promotionId) await db.from('promotions').delete().eq('id', promotionId);
    if (productId) await db.from('products').delete().eq('id', productId);

    if (testUserId) {
      await db.from('shifts').delete().eq('staff_id', testUserId);
      await db.from('profiles').delete().eq('id', testUserId);
      await db.auth.admin.deleteUser(testUserId);
    }
  });

  it('server-evaluated unit_price overrides an inflated client-submitted unit_price, and an applied_promotions row is written', async () => {
    const { data, error } = await anonClient.rpc('create_order_with_items', {
      p_tab_id: tabId,
      p_staff_id: testUserId,
      p_status: 'pending',
      p_notes: null,
      p_items: [
        {
          product_id: productId,
          quantity: 1,
          unit_price: INFLATED_CLIENT_PRICE,
        },
      ],
      p_skip_depletion: true,
    });

    expect(error).toBeNull();

    const payload = data as { order: { id: string }; items: { id: string; unit_price: unknown }[] };
    orderId = payload.order.id;
    expect(payload.items).toHaveLength(1);
    const item = payload.items[0]!;
    orderItemId = item.id;

    // The server ignored the client's inflated unit_price entirely and wrote
    // its own evaluated, discounted price.
    expect(Number(item.unit_price)).toBe(EXPECTED_SERVER_PRICE);
    expect(Number(item.unit_price)).not.toBe(INFLATED_CLIENT_PRICE);

    // The order_items row in the DB reflects the same discounted price.
    const { data: dbItem, error: dbItemErr } = await db
      .from('order_items')
      .select('unit_price')
      .eq('id', orderItemId)
      .single();
    expect(dbItemErr).toBeNull();
    expect(Number((dbItem as { unit_price: unknown }).unit_price)).toBe(EXPECTED_SERVER_PRICE);

    // An applied_promotions audit row exists for this order_item, recording
    // the original (undiscounted) and discounted amounts.
    const { data: appliedRows, error: appliedErr } = await db
      .from('applied_promotions')
      .select('promotion_id, discount_type, discount_value, original_amount, discounted_amount')
      .eq('order_item_id', orderItemId);
    expect(appliedErr).toBeNull();
    expect(appliedRows).toHaveLength(1);
    const applied = (
      appliedRows as {
        promotion_id: string;
        discount_type: string;
        discount_value: unknown;
        original_amount: unknown;
        discounted_amount: unknown;
      }[]
    )[0]!;
    expect(applied.promotion_id).toBe(promotionId);
    expect(applied.discount_type).toBe('percentage');
    expect(Number(applied.discount_value)).toBe(DISCOUNT_PERCENT);
    // original_amount reflects the client's submitted (undiscounted) base
    // price input, not a re-derivation of product.base_price.
    expect(Number(applied.original_amount)).toBe(INFLATED_CLIENT_PRICE);
    expect(Number(applied.discounted_amount)).toBe(EXPECTED_SERVER_PRICE);
  });
});
