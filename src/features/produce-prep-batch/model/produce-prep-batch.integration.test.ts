/**
 * Integration: prep_productions trigger + deplete_for_order_item regression (Phase 5).
 * Mirrors depletion.integration.test auth pattern (ephemeral manager user).
 */
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const skip = !url || !serviceKey || !anonKey;

describe.skipIf(skip)('produce-prep-batch integration', () => {
  const db = createClient(url!, serviceKey!) as any;
  const anonClient = createClient(url!, anonKey!) as any;

  let testUserId: string;
  let categoryId: string;

  beforeAll(async () => {
    const testEmail = `__prep_batch_test_${Date.now()}@test.local`;
    const testPassword = 'TestPrepBatch123!';

    const { data: authUser, error: createErr } = await db.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (createErr || !authUser.user) throw new Error(`test user create: ${createErr?.message}`);
    testUserId = authUser.user.id;

    const { error: profileErr } = await db.from('profiles').upsert({
      id: testUserId,
      name: '__prep_batch_test__',
      email: testEmail,
      role: 'manager',
      pin: '888888',
      is_active: true,
    });
    if (profileErr) throw new Error(`profile upsert: ${profileErr.message}`);

    const { error: signInErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInErr) throw new Error(`sign in: ${signInErr.message}`);

    const { data: cat, error: catErr } = await db.from('categories').select('id').limit(1).single();
    if (catErr || !cat) throw new Error(`category: ${catErr?.message ?? 'none'}`);
    categoryId = (cat as { id: string }).id;
  });

  afterAll(async () => {
    await anonClient.auth.signOut();
    await db.from('stock_movements').delete().eq('staff_id', testUserId);
    await db.from('orders').delete().eq('staff_id', testUserId);
    await db.from('tabs').delete().eq('staff_id', testUserId);
    await db.from('shifts').delete().eq('staff_id', testUserId);
    await db.from('profiles').delete().eq('id', testUserId);
    await db.auth.admin.deleteUser(testUserId);
  });

  async function createOpenOrderItem(productId: string): Promise<{
    orderItemId: string;
    orderId: string;
    tabId: string;
    shiftId: string;
  }> {
    const { data: shift, error: shiftErr } = await db
      .from('shifts')
      .insert({ staff_id: testUserId, opening_cash: 0 })
      .select('id')
      .single();
    if (shiftErr || !shift) throw new Error(`shift: ${shiftErr?.message}`);
    const shiftId = (shift as { id: string }).id;

    const { data: tab, error: tabErr } = await db
      .from('tabs')
      .insert({
        customer_name: '__prep_tab__',
        status: 'open',
        is_deleted: false,
        staff_id: testUserId,
        shift_id: shiftId,
      })
      .select('id')
      .single();
    if (tabErr || !tab) throw new Error(`tab: ${tabErr?.message}`);
    const tabId = (tab as { id: string }).id;

    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({ tab_id: tabId, status: 'pending', staff_id: testUserId })
      .select('id')
      .single();
    if (orderErr || !order) throw new Error(`order: ${orderErr?.message}`);
    const orderId = (order as { id: string }).id;

    const { data: oi, error: oiErr } = await db
      .from('order_items')
      .insert({
        order_id: orderId,
        product_id: productId,
        quantity: 1,
        unit_price: 10,
        modifier_price_delta: 0,
      })
      .select('id')
      .single();
    if (oiErr || !oi) throw new Error(`order_item: ${oiErr?.message}`);
    return {
      orderItemId: (oi as { id: string }).id,
      orderId,
      tabId,
      shiftId,
    };
  }

  it('I1: prep with no recipe — credits prep ingredient; one movement', async () => {
    const { data: ing, error: ingErr } = await db
      .from('ingredients')
      .insert({
        name: `__prep_i1_${Date.now()}`,
        uom: 'portion',
        purchase_to_base_factor: 1,
        cost_per_base_unit: 0,
        quantity_on_hand: 0,
        is_prep: true,
      })
      .select('id')
      .single();
    expect(ingErr).toBeNull();
    const ingId = (ing as { id: string }).id;

    const { data: prod, error } = await anonClient
      .from('prep_productions')
      .insert({ prep_ingredient_id: ingId, qty_produced: 5 })
      .select('id')
      .single();
    expect(error).toBeNull();
    const prodId = (prod as { id: string }).id;

    const { data: movements } = await db
      .from('stock_movements')
      .select('*')
      .eq('ref_type', 'prep_production')
      .eq('ref_id', prodId);

    expect((movements as any[]).length).toBe(1);
    expect((movements as any[])[0].quantity_delta).toBeCloseTo(5, 2);
    expect((movements as any[])[0].reason).toBe('prep_production');

    await db.from('stock_movements').delete().eq('ref_id', prodId);
    await db.from('prep_productions').delete().eq('id', prodId);
    await db.from('ingredients').delete().eq('id', ingId);
  });

  it('I2: prep with recipe — credit + raw debits', async () => {
    const { data: salsa } = await db
      .from('ingredients')
      .insert({
        name: `__prep_i2_salsa_${Date.now()}`,
        uom: 'portion',
        purchase_to_base_factor: 1,
        cost_per_base_unit: 0,
        quantity_on_hand: 0,
        is_prep: true,
      })
      .select('id')
      .single();
    const { data: tomato } = await db
      .from('ingredients')
      .insert({
        name: `__prep_i2_tomato_${Date.now()}`,
        uom: 'g',
        purchase_to_base_factor: 1,
        cost_per_base_unit: 0,
        quantity_on_hand: 5000,
        is_prep: false,
      })
      .select('id')
      .single();
    const { data: onion } = await db
      .from('ingredients')
      .insert({
        name: `__prep_i2_onion_${Date.now()}`,
        uom: 'g',
        purchase_to_base_factor: 1,
        cost_per_base_unit: 0,
        quantity_on_hand: 1000,
        is_prep: false,
      })
      .select('id')
      .single();
    const salsaId = (salsa as { id: string }).id;
    const tomatoId = (tomato as { id: string }).id;
    const onionId = (onion as { id: string }).id;

    const { data: recipe } = await db
      .from('recipes')
      .insert({ prep_ingredient_id: salsaId, yield_qty: 1 })
      .select('id')
      .single();
    const recipeId = (recipe as { id: string }).id;
    await db.from('recipe_items').insert([
      { recipe_id: recipeId, ingredient_id: tomatoId, qty: 100 },
      { recipe_id: recipeId, ingredient_id: onionId, qty: 10 },
    ]);

    const { data: prod, error } = await anonClient
      .from('prep_productions')
      .insert({ prep_ingredient_id: salsaId, qty_produced: 10 })
      .select('id')
      .single();
    expect(error).toBeNull();
    const prodId = (prod as { id: string }).id;

    const { data: movements } = await db
      .from('stock_movements')
      .select('*')
      .eq('ref_type', 'prep_production')
      .eq('ref_id', prodId);

    expect(movements?.length ?? 0).toBe(3);

    await db.from('stock_movements').delete().eq('ref_id', prodId);
    await db.from('prep_productions').delete().eq('id', prodId);
    await db.from('recipe_items').delete().eq('recipe_id', recipeId);
    await db.from('recipes').delete().eq('id', recipeId);
    await db.from('ingredients').delete().in('id', [salsaId, tomatoId, onionId]);
  });

  it('I3: non-prep ingredient rejected', async () => {
    const { data: ing } = await db
      .from('ingredients')
      .insert({
        name: `__prep_i3_${Date.now()}`,
        uom: 'kg',
        quantity_on_hand: 100,
        is_prep: false,
        purchase_to_base_factor: 1,
        cost_per_base_unit: 0,
      })
      .select('id')
      .single();
    const ingId = (ing as { id: string }).id;

    const { error } = await anonClient
      .from('prep_productions')
      .insert({ prep_ingredient_id: ingId, qty_produced: 1 })
      .select()
      .single();

    expect(error).not.toBeNull();
    if (!error) throw new Error('expected error');
    expect(error.message).toMatch(/PREP_INGREDIENT_REQUIRED/);
    await db.from('ingredients').delete().eq('id', ingId);
  });

  it('I4: insufficient raw stock — insert fails', async () => {
    const { data: prepIng } = await db
      .from('ingredients')
      .insert({
        name: `__prep_i4_prep_${Date.now()}`,
        uom: 'portion',
        purchase_to_base_factor: 1,
        cost_per_base_unit: 0,
        quantity_on_hand: 0,
        is_prep: true,
      })
      .select('id')
      .single();
    const { data: rawIng } = await db
      .from('ingredients')
      .insert({
        name: `__prep_i4_raw_${Date.now()}`,
        uom: 'g',
        purchase_to_base_factor: 1,
        cost_per_base_unit: 0,
        quantity_on_hand: 0,
        is_prep: false,
      })
      .select('id')
      .single();
    const prepId = (prepIng as { id: string }).id;
    const rawId = (rawIng as { id: string }).id;

    const { data: recipe } = await db
      .from('recipes')
      .insert({ prep_ingredient_id: prepId, yield_qty: 1 })
      .select('id')
      .single();
    const recipeId = (recipe as { id: string }).id;
    await db.from('recipe_items').insert({
      recipe_id: recipeId,
      ingredient_id: rawId,
      qty: 100,
    });

    const { error } = await anonClient
      .from('prep_productions')
      .insert({ prep_ingredient_id: prepId, qty_produced: 1 })
      .select()
      .single();

    expect(error).not.toBeNull();
    if (!error) throw new Error('expected error');
    expect(error.message).toMatch(/INVENTORY_NEGATIVE/i);

    const { data: movements } = await db
      .from('stock_movements')
      .select('id')
      .in('ingredient_id', [prepId, rawId])
      .eq('ref_type', 'prep_production');

    expect(movements?.length ?? 0).toBe(0);

    await db.from('recipe_items').delete().eq('recipe_id', recipeId);
    await db.from('recipes').delete().eq('id', recipeId);
    await db.from('ingredients').delete().in('id', [prepId, rawId]);
  });

  it('I5: deplete_for_order_item reduces prep ingredient via product recipe', async () => {
    const { data: salsa } = await db
      .from('ingredients')
      .insert({
        name: `__prep_i5_salsa_${Date.now()}`,
        uom: 'portion',
        purchase_to_base_factor: 1,
        cost_per_base_unit: 0,
        quantity_on_hand: 50,
        is_prep: true,
      })
      .select('id')
      .single();
    const salsaId = (salsa as { id: string }).id;

    const { data: alitas } = await db
      .from('products')
      .insert({
        name: `__prep_i5_alitas_${Date.now()}`,
        base_price: 120,
        category_id: categoryId,
        is_active: true,
      })
      .select('id')
      .single();
    const alitasId = (alitas as { id: string }).id;

    const { data: recipe } = await db
      .from('recipes')
      .insert({ product_id: alitasId, yield_qty: 1 })
      .select('id')
      .single();
    const recipeId = (recipe as { id: string }).id;
    await db.from('recipe_items').insert({
      recipe_id: recipeId,
      ingredient_id: salsaId,
      qty: 1,
    });

    const { orderItemId, orderId, tabId, shiftId } = await createOpenOrderItem(alitasId);
    const qtyBefore = 50;

    const { error: depleteError } = await anonClient.rpc('deplete_for_order_item', {
      p_order_item_id: orderItemId,
      p_direction: 1,
      p_allow_negative: false,
    });
    expect(depleteError).toBeNull();

    const { data: salsaAfter } = await db
      .from('ingredients')
      .select('quantity_on_hand')
      .eq('id', salsaId)
      .single();
    const qtyAfter = (salsaAfter as { quantity_on_hand: number }).quantity_on_hand;
    expect(qtyAfter).toBeCloseTo(qtyBefore - 1, 5);

    await db.from('stock_movements').delete().eq('ref_id', orderItemId).eq('ref_type', 'order_item');
    await db.from('order_items').delete().eq('id', orderItemId);
    await db.from('orders').delete().eq('id', orderId);
    await db.from('tabs').delete().eq('id', tabId);
    await db.from('shifts').delete().eq('id', shiftId);
    await db.from('recipe_items').delete().eq('recipe_id', recipeId);
    await db.from('recipes').delete().eq('id', recipeId);
    await db.from('products').delete().eq('id', alitasId);
    await db.from('ingredients').delete().eq('id', salsaId);
  });

  it('I6: deplete_for_order_item product recipe still writes raw stock movements', async () => {
    const { data: product } = await db
      .from('products')
      .insert({
        name: `__prep_i6_prod_${Date.now()}`,
        base_price: 10,
        category_id: categoryId,
        is_active: true,
      })
      .select('id')
      .single();
    const productId = (product as { id: string }).id;

    const { data: rawIng } = await db
      .from('ingredients')
      .insert({
        name: `__prep_i6_raw_${Date.now()}`,
        uom: 'g',
        purchase_to_base_factor: 1,
        cost_per_base_unit: 0,
        quantity_on_hand: 1000,
        is_prep: false,
      })
      .select('id')
      .single();
    const rawId = (rawIng as { id: string }).id;

    const { data: recipe } = await db
      .from('recipes')
      .insert({ product_id: productId, yield_qty: 1 })
      .select('id')
      .single();
    const recipeId = (recipe as { id: string }).id;
    await db.from('recipe_items').insert({
      recipe_id: recipeId,
      ingredient_id: rawId,
      qty: 50,
    });

    const { orderItemId, orderId, tabId, shiftId } = await createOpenOrderItem(productId);

    const { error } = await anonClient.rpc('deplete_for_order_item', {
      p_order_item_id: orderItemId,
      p_direction: 1,
      p_allow_negative: false,
    });
    expect(error).toBeNull();

    const { data: movements } = await db
      .from('stock_movements')
      .select('*')
      .eq('ref_type', 'order_item')
      .eq('ref_id', orderItemId)
      .eq('ingredient_id', rawId);

    expect((movements as any[]).length).toBe(1);
    expect((movements as any[])[0].quantity_delta).toBeCloseTo(-50, 5);

    await db.from('stock_movements').delete().eq('ref_id', orderItemId).eq('ref_type', 'order_item');
    await db.from('order_items').delete().eq('id', orderItemId);
    await db.from('orders').delete().eq('id', orderId);
    await db.from('tabs').delete().eq('id', tabId);
    await db.from('shifts').delete().eq('id', shiftId);
    await db.from('recipe_items').delete().eq('recipe_id', recipeId);
    await db.from('recipes').delete().eq('id', recipeId);
    await db.from('products').delete().eq('id', productId);
    await db.from('ingredients').delete().eq('id', rawId);
  });
});
