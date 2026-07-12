/**
 * Integration test: stop_pool_session RPC — pool_billing discount + pool_grant
 * consumption + version guard (Phase 20, Plan 05 — SC-3 / D-05a / D-05b).
 *
 * Requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and
 * SUPABASE_SERVICE_ROLE_KEY in the environment. Skips gracefully (does not
 * fail) when live creds are absent, mirroring
 * src/entities/promotion/model/evaluate-promotions-rpc.integration.test.ts
 * and src/entities/caja/model/tip-distribution-rpc.integration.test.ts.
 *
 * DEPENDENCY: this test requires all of the following to be LIVE on the
 * target Supabase project (Plan 20-06's BLOCKING db push):
 *   - supabase/migrations/20260710000001_promotions_schema.sql
 *   - supabase/migrations/20260710000002_is_promotion_available_fn.sql
 *   - supabase/migrations/20260710000003_applied_promotions_table.sql
 *   - supabase/migrations/20260710000004_evaluate_promotions_rpc.sql
 *   - supabase/migrations/20260710000005_evaluate_promotions_pool_grant.sql
 *   - supabase/migrations/20260710000006_stop_pool_session_rpc.sql
 * Until that push lands, these cases will fail at runtime against a live env
 * (missing table/function) even though the env-guard skip path exits 0 today.
 *
 * `promotions` / `applied_promotions` / `stop_pool_session` are not yet in
 * supabase.types.ts, so a `db = supabase as any`-equivalent (`getServiceDb()`
 * returning `any`) cast is used file-wide per the CLAUDE.md "missing
 * generated types" workaround.
 */
import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const hasE2eEnv = !url || !serviceKey || !anonKey;

// Deterministic billing inputs shared by every case in this file.
const RATE_PER_HOUR = 100;
const SESSION_STARTED_MINUTES_AGO = 40; // comfortably clear of the 15-min rounding boundary
// prorated, no prepaid: base_billed=40(raw) -> chargeable=40 -> billed=ceil(40/15)*15=45
const EXPECTED_BASE_BILLED_MINUTES = 45;
const EXPECTED_BASE_CHARGE = 75; // (45/60) * 100

describe.skipIf(hasE2eEnv)('stop_pool_session RPC — pool_billing + pool_grant (SC-3)', () => {
  const db = createClient(url!, serviceKey!) as any;
  const anonClient = createClient(url!, anonKey!) as any;

  let testUserId: string;
  let originalBillingConfig: { value: unknown } | null;

  // Per-test cleanup registries.
  let poolTableIds: string[];
  let poolSessionIds: string[];
  let tabIds: string[];
  let productIds: string[];
  let promotionIds: string[];

  async function signInTestManager(): Promise<void> {
    const testEmail = `__pool_promo_rpc_test_${String(Date.now())}_${String(Math.random()).slice(2, 8)}@test.local`;
    const testPassword = 'TestPoolPromoRpc123!';

    const { data: authUser, error: createErr } = await db.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (createErr || !authUser.user) throw new Error(`test user create: ${createErr?.message}`);
    testUserId = authUser.user.id as string;

    const { error: profileErr } = await db.from('profiles').upsert({
      id: testUserId,
      name: `__pool_promo_rpc_test_${testUserId.slice(0, 8)}__`,
      email: testEmail,
      role: 'manager',
      pin: '999993',
      is_active: true,
    });
    if (profileErr) throw new Error(`profile upsert: ${profileErr.message}`);

    const { error: signInErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInErr) throw new Error(`sign in: ${signInErr.message}`);
  }

  async function setBillingFirstHourMode(mode: 'full' | 'prorated'): Promise<void> {
    await db.from('settings').upsert({ key: 'billing', value: { firstHourMode: mode } }, { onConflict: 'key' });
  }

  async function seedPoolTable(): Promise<string> {
    const number = 900000 + Math.floor(Math.random() * 99999);
    const { data, error } = await db
      .from('pool_tables')
      .insert({
        number,
        label: `__pool_promo_rpc_table_${String(number)}__`,
        rate_per_hour: RATE_PER_HOUR,
        status: 'occupied',
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(`pool_tables insert: ${error?.message ?? 'no row'}`);
    return (data as { id: string }).id;
  }

  async function seedTab(): Promise<string> {
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
        customer_name: '__pool_promo_rpc_tab__',
        status: 'open',
        is_deleted: false,
        staff_id: testUserId,
        shift_id: shiftId,
      })
      .select('id')
      .single();
    if (tabErr || !tab) throw new Error(`tab insert: ${tabErr.message}`);
    return (tab as { id: string }).id;
  }

  async function seedPoolSession(tableId: string, tabId: string | null): Promise<string> {
    const startedAt = new Date(Date.now() - SESSION_STARTED_MINUTES_AGO * 60 * 1000);
    const { data, error } = await db
      .from('pool_sessions')
      .insert({
        table_id: tableId,
        tab_id: tabId,
        started_at: startedAt.toISOString(),
      })
      .select('id, version')
      .single();
    if (error || !data) throw new Error(`pool_sessions insert: ${error?.message ?? 'no row'}`);
    return (data as { id: string }).id;
  }

  async function seedPoolBillingPromotion(percentOff: number): Promise<string> {
    const { data, error } = await db
      .from('promotions')
      .insert({
        name: '__pool_promo_rpc_pool_billing_promo__',
        discount_type: 'percentage',
        discount_value: percentOff,
        target_type: 'pool_billing',
        priority: 0,
        is_active: true,
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(`pool_billing promotion insert: ${error?.message}`);
    return (data as { id: string }).id;
  }

  async function seedPoolGrantProduct(): Promise<string> {
    const { data: cat, error: catErr } = await db.from('categories').select('id').limit(1).single();
    if (catErr || !cat) throw new Error(`category lookup: ${catErr?.message ?? 'no categories'}`);

    const { data: prod, error: prodErr } = await db
      .from('products')
      .insert({
        name: '__pool_promo_rpc_grant_product__',
        base_price: 50,
        category_id: (cat as { id: string }).id,
        is_active: true,
      })
      .select('id')
      .single();
    if (prodErr || !prod) throw new Error(`product insert: ${prodErr?.message}`);
    return (prod as { id: string }).id;
  }

  async function seedPoolGrantPromotion(productId: string, minutesGranted: number): Promise<string> {
    const { data, error } = await db
      .from('promotions')
      .insert({
        name: '__pool_promo_rpc_pool_grant_promo__',
        discount_type: 'fixed_amount',
        discount_value: minutesGranted,
        target_type: 'pool_grant',
        target_product_id: productId,
        priority: 0,
        is_active: true,
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(`pool_grant promotion insert: ${error?.message}`);
    return (data as { id: string }).id;
  }

  beforeEach(async () => {
    poolTableIds = [];
    poolSessionIds = [];
    tabIds = [];
    productIds = [];
    promotionIds = [];
    if (hasE2eEnv) return;

    const { data: billingRow } = await db.from('settings').select('value').eq('key', 'billing').maybeSingle();
    originalBillingConfig = billingRow ?? null;

    await signInTestManager();
    await setBillingFirstHourMode('prorated');
  });

  afterEach(async () => {
    if (hasE2eEnv) return;

    await anonClient.auth.signOut();

    for (const id of poolSessionIds) {
      await db.from('applied_promotions').delete().eq('pool_session_id', id);
      await db.from('audit_logs').delete().eq('entity_id', id);
      await db.from('pool_sessions').delete().eq('id', id);
    }
    for (const id of tabIds) {
      await db.from('applied_promotions').delete().eq('tab_id', id);
      await db.from('tabs').delete().eq('id', id);
    }
    for (const id of poolTableIds) {
      await db.from('pool_tables').delete().eq('id', id);
    }
    for (const id of productIds) {
      await db.from('products').delete().eq('id', id);
    }
    for (const id of promotionIds) {
      await db.from('promotions').delete().eq('id', id);
    }
    if (testUserId) {
      await db.from('shifts').delete().eq('staff_id', testUserId);
      await db.from('profiles').delete().eq('id', testUserId);
      await db.auth.admin.deleteUser(testUserId);
    }

    if (originalBillingConfig) {
      await db.from('settings').upsert({ key: 'billing', value: originalBillingConfig.value }, { onConflict: 'key' });
    } else {
      await db.from('settings').delete().eq('key', 'billing');
    }
  });

  it('pool_billing percentage promotion reduces total_charge and records an applied_promotions row', async () => {
    const tableId = await seedPoolTable();
    poolTableIds.push(tableId);
    const tabId = await seedTab();
    tabIds.push(tabId);
    const sessionId = await seedPoolSession(tableId, tabId);
    poolSessionIds.push(sessionId);
    const promotionId = await seedPoolBillingPromotion(20);
    promotionIds.push(promotionId);

    const { data, error } = await anonClient.rpc('stop_pool_session', {
      p_session_id: sessionId,
      p_expected_version: null,
    });

    expect(error).toBeNull();
    const result = data as {
      billed_minutes: unknown;
      total_charge: unknown;
      version: unknown;
    };
    expect(Number(result.billed_minutes)).toBe(EXPECTED_BASE_BILLED_MINUTES);
    // 20% off the undiscounted base charge (EXPECTED_BASE_CHARGE = 75 -> 60).
    const expectedDiscounted = Number((EXPECTED_BASE_CHARGE * 0.8).toFixed(2));
    expect(Number(result.total_charge)).toBe(expectedDiscounted);
    expect(Number(result.total_charge)).not.toBe(EXPECTED_BASE_CHARGE);

    const { data: appliedRows, error: appliedErr } = await db
      .from('applied_promotions')
      .select('promotion_id, target_type, pool_session_id, original_amount, discounted_amount')
      .eq('pool_session_id', sessionId);
    expect(appliedErr).toBeNull();
    expect(appliedRows).toHaveLength(1);
    const applied = (
      appliedRows as {
        promotion_id: string;
        target_type: string;
        pool_session_id: string;
        original_amount: unknown;
        discounted_amount: unknown;
      }[]
    )[0]!;
    expect(applied.promotion_id).toBe(promotionId);
    expect(applied.target_type).toBe('pool_billing');
    expect(applied.pool_session_id).toBe(sessionId);
    expect(Number(applied.original_amount)).toBe(EXPECTED_BASE_CHARGE);
    expect(Number(applied.discounted_amount)).toBe(expectedDiscounted);
  });

  it('pool_grant: purchasing a targeted product records an unconsumed grant, consumed on stop_pool_session and deducted from billed minutes', async () => {
    const productId = await seedPoolGrantProduct();
    productIds.push(productId);
    const promotionId = await seedPoolGrantPromotion(productId, 15); // 15 bonus minutes
    promotionIds.push(promotionId);
    const tabId = await seedTab();
    tabIds.push(tabId);

    // Purchase the pool_grant-targeted product — triggers
    // evaluate_promotions_for_item's pool_grant loop via create_order_with_items.
    const { data: orderData, error: orderErr } = await anonClient.rpc('create_order_with_items', {
      p_tab_id: tabId,
      p_staff_id: testUserId,
      p_status: 'pending',
      p_notes: null,
      p_items: [{ product_id: productId, quantity: 1, unit_price: 50 }],
      p_skip_depletion: true,
    });
    expect(orderErr).toBeNull();
    const orderPayload = orderData as { order: { id: string } };
    expect(orderPayload.order.id).toBeDefined();

    // Confirm the unconsumed grant was recorded before stopping the session.
    const { data: unconsumedBefore, error: unconsumedBeforeErr } = await db
      .from('applied_promotions')
      .select('id, pool_minutes_granted, consumed_at')
      .eq('tab_id', tabId)
      .is('consumed_at', null);
    expect(unconsumedBeforeErr).toBeNull();
    expect(unconsumedBefore).toHaveLength(1);
    expect(Number((unconsumedBefore as { pool_minutes_granted: unknown }[])[0]!.pool_minutes_granted)).toBe(15);

    const tableId = await seedPoolTable();
    poolTableIds.push(tableId);
    const sessionId = await seedPoolSession(tableId, tabId);
    poolSessionIds.push(sessionId);

    const { data, error } = await anonClient.rpc('stop_pool_session', {
      p_session_id: sessionId,
      p_expected_version: null,
    });
    expect(error).toBeNull();
    const result = data as { billed_minutes: unknown; total_charge: unknown };

    // 15 prepaid minutes deducted before block-rounding: chargeable=40-15=25 -> ceil(25/15)*15=30
    const expectedBilledMinutes = 30;
    const expectedCharge = Number(((expectedBilledMinutes / 60) * RATE_PER_HOUR).toFixed(2));
    expect(Number(result.billed_minutes)).toBe(expectedBilledMinutes);
    expect(Number(result.total_charge)).toBe(expectedCharge);

    // The grant is now consumed and tagged with this pool_session_id.
    const { data: afterGrant, error: afterGrantErr } = await db
      .from('applied_promotions')
      .select('consumed_at, pool_session_id')
      .eq('tab_id', tabId)
      .not('pool_minutes_granted', 'is', null)
      .single();
    expect(afterGrantErr).toBeNull();
    expect((afterGrant as { consumed_at: unknown }).consumed_at).not.toBeNull();
    expect((afterGrant as { pool_session_id: unknown }).pool_session_id).toBe(sessionId);
  });

  it('a stale p_expected_version yields a P0V01/STALE_VERSION error', async () => {
    const tableId = await seedPoolTable();
    poolTableIds.push(tableId);
    const sessionId = await seedPoolSession(tableId, null);
    poolSessionIds.push(sessionId);

    const { data: session } = await db.from('pool_sessions').select('version').eq('id', sessionId).single();
    const currentVersion = (session as { version: number }).version;

    const { data, error } = await anonClient.rpc('stop_pool_session', {
      p_session_id: sessionId,
      p_expected_version: currentVersion + 999, // deliberately wrong
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect((error as { code?: string }).code).toBe('P0V01');

    // The session was NOT stopped by the failed call.
    const { data: unchanged } = await db
      .from('pool_sessions')
      .select('stopped_at, version')
      .eq('id', sessionId)
      .single();
    expect((unchanged as { stopped_at: unknown }).stopped_at).toBeNull();
    expect((unchanged as { version: number }).version).toBe(currentVersion);
  });
});
