import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integration tests for Phase 4 depletion flow.
 * Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
 * Tests: S3b-03, S3b-04, S3b-10, S3b-11
 *
 * Two clients:
 *   db  — service-role client: bypasses RLS for setup/teardown and direct table reads
 *   rpc — authenticated user client: needed for deplete_for_order_item which calls
 *          auth.uid() internally (stock_movements.staff_id NOT NULL)
 *
 * Note on idempotency: record_stock_movement has a UNIQUE index on
 * (ref_type, ref_id, ingredient_id). Each test case uses a fresh order_item
 * to avoid conflicts between I1 (sale) and I2 (void).
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const skip = !url || !serviceKey || !anonKey;

describe.skipIf(skip)('Depletion integration', () => {
  // Service-role client: setup, teardown, direct table queries (bypasses RLS)
  const db = createClient(url!, serviceKey!) as any;
  // Authenticated client: used for RPC calls that invoke auth.uid()
  const anonClient = createClient(url!, anonKey!) as any;

  let productId: string;
  let ingredientAId: string;
  let ingredientBId: string;
  let recipeId: string;
  let tabId: string;
  let orderId: string;
  let testUserId: string;
  let modifierId: string;
  let modifierTwoId: string;
  let recipelessProductId: string;

  // Fresh order_item IDs per test (idempotency UNIQUE index requires distinct refs)
  let saleItemId: string;
  let voidItemId: string;
  let negativeItemId: string;
  let overrideItemId: string;
  let modifierItemId: string;
  let recipelessModifierItemId: string;
  let collisionItemId: string;

  beforeAll(async () => {
    // 0. Create a temporary test user and sign in to get auth.uid() for RPC calls
    const testEmail = `__depletion_test_${Date.now()}@test.local`;
    const testPassword = 'TestDepletion123!';

    const { data: authUser, error: createErr } = await db.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (createErr || !authUser.user) throw new Error(`test user create: ${createErr?.message}`);
    testUserId = authUser.user.id;

    // Insert a profiles row so FK from stock_movements.staff_id is satisfied
    const { error: profileErr } = await db.from('profiles').upsert({
      id: testUserId,
      name: '__depletion_test__',
      email: testEmail,
      role: 'manager',
      pin: '999999',
      is_active: true,
    });
    if (profileErr) throw new Error(`profile upsert: ${profileErr.message}`);

    // Sign in as the test user so anonClient has auth.uid() = testUserId
    const { error: signInErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInErr) throw new Error(`sign in: ${signInErr.message}`);

    // 1. Find any existing category to satisfy NOT NULL constraint on products
    const { data: cat, error: catErr } = await db
      .from('categories')
      .select('id')
      .limit(1)
      .single();
    if (catErr || !cat) throw new Error(`category lookup: ${catErr?.message ?? 'no categories'}`);
    const categoryId = (cat as { id: string }).id;

    // 2. Create test product
    const { data: prod, error: prodErr } = await db
      .from('products')
      .insert({ name: '__test_alitas__', base_price: 5.0, category_id: categoryId, is_active: true })
      .select('id')
      .single();
    if (prodErr) throw new Error(`product insert: ${prodErr.message}`);
    productId = (prod as { id: string }).id;

    // 3. Create 2 ingredients with enough stock (uom must be a valid enum value)
    const { data: ingA, error: ingAErr } = await db
      .from('ingredients')
      .insert({ name: '__test_wing__', uom: 'unit', quantity_on_hand: 100 })
      .select('id')
      .single();
    if (ingAErr) throw new Error(`ingredient A insert: ${ingAErr.message}`);
    ingredientAId = (ingA as { id: string }).id;

    const { data: ingB, error: ingBErr } = await db
      .from('ingredients')
      .insert({ name: '__test_sauce__', uom: 'ml', quantity_on_hand: 500 })
      .select('id')
      .single();
    if (ingBErr) throw new Error(`ingredient B insert: ${ingBErr.message}`);
    ingredientBId = (ingB as { id: string }).id;

    // 4. Create recipe: 6 wings + 2 ml sauce per 1 serving
    const { data: rec, error: recErr } = await db
      .from('recipes')
      .insert({ product_id: productId, yield_qty: 1 })
      .select('id')
      .single();
    if (recErr) throw new Error(`recipe insert: ${recErr.message}`);
    recipeId = (rec as { id: string }).id;

    const { error: riErr } = await db.from('recipe_items').insert([
      { recipe_id: recipeId, ingredient_id: ingredientAId, qty: 6 },
      { recipe_id: recipeId, ingredient_id: ingredientBId, qty: 2 },
    ]);
    if (riErr) throw new Error(`recipe_items insert: ${riErr.message}`);

    // 5. Create a tab and order using the test user as staff_id
    // Find or create a shift for the test user
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
        customer_name: '__test_tab__',
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

    // 6. Insert 4 distinct order_items — one per test (idempotency constraint)
    const insertItem = async (opts?: { productId?: string; modifierIds?: string[] }) => {
      const { data, error } = await db
        .from('order_items')
        .insert({
          order_id: orderId,
          product_id: opts?.productId ?? productId,
          quantity: 1,
          unit_price: 5.0,
          modifier_price_delta: 0,
          ...(opts?.modifierIds != null ? { modifier_ids: opts.modifierIds } : {}),
        })
        .select('id')
        .single();
      if (error) throw new Error(`order_item insert: ${error.message}`);
      return (data as { id: string }).id;
    };

    saleItemId = await insertItem();
    voidItemId = await insertItem();
    negativeItemId = await insertItem();
    overrideItemId = await insertItem();

    // 7. Modifier fixtures (Phase 17: modifier-driven depletion) — I5/I6
    const { data: mod, error: modErr } = await db
      .from('modifiers')
      .insert({ name: '__test_extra_lime__', price_delta: 0, sort_order: 0 })
      .select('id')
      .single();
    if (modErr) throw new Error(`modifier insert: ${modErr.message}`);
    modifierId = (mod as { id: string }).id;

    const { error: modRuleErr } = await db
      .from('modifier_inventory_rules')
      .insert({ modifier_id: modifierId, ingredient_id: ingredientBId, delta: 3 });
    if (modRuleErr) throw new Error(`modifier_inventory_rules insert: ${modRuleErr.message}`);

    // 8. Recipe-less product (D-04: modifier depletion must fire even without a recipe)
    const { data: recipelessProd, error: recipelessProdErr } = await db
      .from('products')
      .insert({ name: '__test_bottle__', base_price: 3.0, category_id: categoryId, is_active: true })
      .select('id')
      .single();
    if (recipelessProdErr) {
      throw new Error(`recipeless product insert: ${recipelessProdErr.message}`);
    }
    recipelessProductId = (recipelessProd as { id: string }).id;

    modifierItemId = await insertItem({ modifierIds: [modifierId] });
    recipelessModifierItemId = await insertItem({
      productId: recipelessProductId,
      modifierIds: [modifierId],
    });

    // 9. Second modifier targeting the SAME ingredient as `modifierId` (CR-01 regression
    // fixture, Phase 17 code review): two different modifiers on one order_item both
    // mapping to ingredientBId must aggregate into a single stock_movements row, not
    // collide on the (ref_type, ref_id, ingredient_id) unique index.
    const { data: modTwo, error: modTwoErr } = await db
      .from('modifiers')
      .insert({ name: '__test_heavy_garnish__', price_delta: 0, sort_order: 1 })
      .select('id')
      .single();
    if (modTwoErr) throw new Error(`modifier two insert: ${modTwoErr.message}`);
    modifierTwoId = (modTwo as { id: string }).id;

    const { error: modRuleTwoErr } = await db
      .from('modifier_inventory_rules')
      .insert({ modifier_id: modifierTwoId, ingredient_id: ingredientBId, delta: 1 });
    if (modRuleTwoErr) throw new Error(`modifier_inventory_rules two insert: ${modRuleTwoErr.message}`);

    collisionItemId = await insertItem({ modifierIds: [modifierId, modifierTwoId] });
  });

  afterAll(async () => {
    await anonClient.auth.signOut();

    // Cleanup stock_movements first (FK refs ingredient_id)
    if (ingredientAId || ingredientBId) {
      const ingIds = [ingredientAId, ingredientBId].filter(Boolean);
      await db.from('stock_movements').delete().in('ingredient_id', ingIds);
    }

    // Cleanup audit_log
    const allItemIds = [
      saleItemId,
      voidItemId,
      negativeItemId,
      overrideItemId,
      modifierItemId,
      recipelessModifierItemId,
      collisionItemId,
    ].filter(Boolean);
    if (allItemIds.length > 0) {
      await db.from('audit_log').delete().in('entity_id', allItemIds);
      await db.from('order_items').delete().in('id', allItemIds);
    }

    if (orderId) await db.from('orders').delete().eq('id', orderId);
    if (tabId) await db.from('tabs').delete().eq('id', tabId);
    if (recipeId) {
      await db.from('recipe_items').delete().eq('recipe_id', recipeId);
      await db.from('recipes').delete().eq('id', recipeId);
    }
    if (modifierId) {
      await db.from('modifier_inventory_rules').delete().eq('modifier_id', modifierId);
      await db.from('modifiers').delete().eq('id', modifierId);
    }
    if (modifierTwoId) {
      await db.from('modifier_inventory_rules').delete().eq('modifier_id', modifierTwoId);
      await db.from('modifiers').delete().eq('id', modifierTwoId);
    }
    if (recipelessProductId) {
      await db.from('products').delete().eq('id', recipelessProductId);
    }
    if (ingredientAId || ingredientBId) {
      const ingIds = [ingredientAId, ingredientBId].filter(Boolean);
      await db.from('ingredients').delete().in('id', ingIds);
    }
    if (productId) await db.from('products').delete().eq('id', productId);

    // Delete shifts + profile + auth user for the test user
    if (testUserId) {
      await db.from('shifts').delete().eq('staff_id', testUserId);
      await db.from('profiles').delete().eq('id', testUserId);
      await db.auth.admin.deleteUser(testUserId);
    }
  });

  it('I1: deplete_for_order_item writes 2 negative stock_movement rows', async () => {
    const { error } = await anonClient.rpc('deplete_for_order_item', {
      p_order_item_id: saleItemId,
      p_direction: 1,
      p_allow_negative: false,
    });
    expect(error).toBeNull();

    const { data, error: queryErr } = await db
      .from('stock_movements')
      .select('ingredient_id, quantity_delta')
      .in('ingredient_id', [ingredientAId, ingredientBId])
      .eq('ref_type', 'order_item')
      .eq('ref_id', saleItemId)
      .order('created_at');

    expect(queryErr).toBeNull();
    expect(data).toHaveLength(2);
    const wingRow = (data as { ingredient_id: string; quantity_delta: number }[]).find(
      r => r.ingredient_id === ingredientAId,
    );
    expect(wingRow?.quantity_delta).toBeCloseTo(-6);
  });

  it('I2: deplete_for_order_item direction=-1 (void) writes 2 positive reversal rows', async () => {
    const { error } = await anonClient.rpc('deplete_for_order_item', {
      p_order_item_id: voidItemId,
      p_direction: -1,
      p_allow_negative: false,
    });
    expect(error).toBeNull();

    const { data, error: queryErr } = await db
      .from('stock_movements')
      .select('ingredient_id, quantity_delta')
      .in('ingredient_id', [ingredientAId, ingredientBId])
      .eq('ref_type', 'order_item')
      .eq('ref_id', voidItemId)
      .order('created_at');

    expect(queryErr).toBeNull();
    expect(data).toHaveLength(2);
    const wingRow = (data as { ingredient_id: string; quantity_delta: number }[]).find(
      r => r.ingredient_id === ingredientAId,
    );
    expect(wingRow?.quantity_delta).toBeCloseTo(6);
  });

  it('I3: deplete when stock=0 raises INVENTORY_NEGATIVE', async () => {
    await db.from('ingredients').update({ quantity_on_hand: 0 }).eq('id', ingredientAId);
    await db.from('ingredients').update({ quantity_on_hand: 0 }).eq('id', ingredientBId);

    const { error } = await anonClient.rpc('deplete_for_order_item', {
      p_order_item_id: negativeItemId,
      p_direction: 1,
      p_allow_negative: false,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/INVENTORY_NEGATIVE/i);

    // Restore stock for I4
    await db.from('ingredients').update({ quantity_on_hand: 100 }).eq('id', ingredientAId);
    await db.from('ingredients').update({ quantity_on_hand: 500 }).eq('id', ingredientBId);
  });

  it('I4: p_allow_negative=true bypasses guard and writes audit_log', async () => {
    await db.from('ingredients').update({ quantity_on_hand: 0 }).eq('id', ingredientAId);
    await db.from('ingredients').update({ quantity_on_hand: 0 }).eq('id', ingredientBId);

    const { error } = await anonClient.rpc('deplete_for_order_item', {
      p_order_item_id: overrideItemId,
      p_direction: 1,
      p_allow_negative: true,
    });
    expect(error).toBeNull();

    const { data: auditRows, error: auditErr } = await db
      .from('audit_log')
      .select('*')
      .eq('action', 'stock_override')
      .eq('entity_type', 'order_item')
      .eq('entity_id', overrideItemId);

    expect(auditErr).toBeNull();
    expect((auditRows as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  // Phase 17: I1-I4 above (recipe-only, no modifiers) MUST still pass unchanged —
  // this is the SC-4 regression proof that the v3 RPC's new modifier loop does
  // not disturb existing recipe-driven depletion.

  it('I5: modifier rule writes an order_item_modifier stock_movement alongside recipe rows', async () => {
    // I4 (above) intentionally leaves ingredient stock at 0 after its override test —
    // restore sufficient stock before exercising I5/I6's non-override depletion path.
    await db.from('ingredients').update({ quantity_on_hand: 100 }).eq('id', ingredientAId);
    await db.from('ingredients').update({ quantity_on_hand: 500 }).eq('id', ingredientBId);

    const { error } = await anonClient.rpc('deplete_for_order_item', {
      p_order_item_id: modifierItemId,
      p_direction: 1,
      p_allow_negative: false,
    });
    expect(error).toBeNull();

    const { data: modRows, error: modQueryErr } = await db
      .from('stock_movements')
      .select('ingredient_id, quantity_delta')
      .eq('ref_type', 'order_item_modifier')
      .eq('ref_id', modifierItemId);

    expect(modQueryErr).toBeNull();
    expect(modRows).toHaveLength(1);
    // -(direction(1) × qty(1) × delta(3)) = -3
    expect((modRows as { quantity_delta: number }[])[0]?.quantity_delta).toBeCloseTo(-3);

    // No collision with the recipe loop — the same order_item still writes its 2 recipe rows
    const { data: recipeRows, error: recipeQueryErr } = await db
      .from('stock_movements')
      .select('ingredient_id, quantity_delta')
      .eq('ref_type', 'order_item')
      .eq('ref_id', modifierItemId);

    expect(recipeQueryErr).toBeNull();
    expect(recipeRows).toHaveLength(2);
  });

  it('I6: recipe-less product with a modifier still depletes (D-04)', async () => {
    const { error } = await anonClient.rpc('deplete_for_order_item', {
      p_order_item_id: recipelessModifierItemId,
      p_direction: 1,
      p_allow_negative: false,
    });
    expect(error).toBeNull();

    const { data: modRows, error: modQueryErr } = await db
      .from('stock_movements')
      .select('ingredient_id, quantity_delta')
      .eq('ref_type', 'order_item_modifier')
      .eq('ref_id', recipelessModifierItemId);

    expect(modQueryErr).toBeNull();
    expect(modRows).toHaveLength(1);
    expect((modRows as { quantity_delta: number }[])[0]?.quantity_delta).toBeCloseTo(-3);

    // The recipe-less product has no recipe — zero 'order_item' rows must be written
    const { data: recipeRows, error: recipeQueryErr } = await db
      .from('stock_movements')
      .select('ingredient_id')
      .eq('ref_type', 'order_item')
      .eq('ref_id', recipelessModifierItemId);

    expect(recipeQueryErr).toBeNull();
    expect(recipeRows).toHaveLength(0);
  });

  it('I7: two modifiers on one order_item targeting the same ingredient aggregate into a single row (CR-01 regression)', async () => {
    // Prior to the v4 fix, this raised a unique_violation on
    // idx_stock_movements_idempotency and aborted the whole RPC call.
    const { error } = await anonClient.rpc('deplete_for_order_item', {
      p_order_item_id: collisionItemId,
      p_direction: 1,
      p_allow_negative: false,
    });
    expect(error).toBeNull();

    const { data: modRows, error: modQueryErr } = await db
      .from('stock_movements')
      .select('ingredient_id, quantity_delta')
      .eq('ref_type', 'order_item_modifier')
      .eq('ref_id', collisionItemId);

    expect(modQueryErr).toBeNull();
    // modifierId's rule (delta=3) + modifierTwoId's rule (delta=1) both target
    // ingredientBId — must aggregate into exactly ONE row, not two.
    expect(modRows).toHaveLength(1);
    // -(direction(1) × qty(1) × (3 + 1)) = -4
    expect((modRows as { quantity_delta: number }[])[0]?.quantity_delta).toBeCloseTo(-4);

    // Recipe loop for this order_item's (shared) product still writes its 2 rows unaffected.
    const { data: recipeRows, error: recipeQueryErr } = await db
      .from('stock_movements')
      .select('ingredient_id')
      .eq('ref_type', 'order_item')
      .eq('ref_id', collisionItemId);

    expect(recipeQueryErr).toBeNull();
    expect(recipeRows).toHaveLength(2);
  });
});
