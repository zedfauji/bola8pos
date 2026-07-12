/**
 * Integration test: promotions + promotion_availability schema, CHECK
 * constraints, is_promotion_available() evaluator, and per-verb RLS
 * (Phase 20, Plan 01 — SC-1).
 *
 * Requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and
 * SUPABASE_SERVICE_ROLE_KEY in the environment. Skips gracefully (does not
 * fail) when live creds are absent, mirroring
 * src/entities/audit-log/model/rls-denial.integration.test.ts.
 *
 * DEPENDENCY: this test requires the `promotions` / `promotion_availability`
 * tables + `is_promotion_available()` function from
 * supabase/migrations/20260710000001_promotions_schema.sql and
 * supabase/migrations/20260710000002_is_promotion_available_fn.sql to be
 * LIVE on the target Supabase project. Plan 20-06 is the BLOCKING db push.
 * Until that push lands, these cases will fail at runtime against a live env
 * (missing table/function) even though the env-guard skip path exits 0 today.
 *
 * `promotions`/`promotion_availability` are not yet in supabase.types.ts, so
 * a `db = supabase as any` cast is used file-wide per the CLAUDE.md
 * "missing generated types" workaround. Do not import from
 * entities/promotion/model/queries.ts (created in Plan 20-02) — this file
 * talks to Supabase directly.
 */
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const hasE2eEnv = !url || !serviceKey || !anonKey;

describe.skipIf(hasE2eEnv)('promotions schema + RLS + availability (SC-1)', () => {
  const db = createClient(url!, serviceKey!) as any;
  const anonClient = createClient(url!, anonKey!) as any;

  let testUserId: string;
  let seededPromotionId: string;

  beforeAll(async () => {
    // Create a temporary bartender test user and sign in so anonClient
    // carries an authenticated (non-service-role) JWT with role = bartender
    // (lowest-privilege authenticated role — must be denied write access).
    const testEmail = `__promo_schema_test_${String(Date.now())}@test.local`;
    const testPassword = 'TestPromoSchema123!';

    const { data: authUser, error: createErr } = await db.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (createErr || !authUser.user) throw new Error(`test user create: ${createErr?.message}`);
    testUserId = authUser.user.id as string;

    const { error: profileErr } = await db.from('profiles').upsert({
      id: testUserId,
      name: '__promo_schema_test__',
      email: testEmail,
      role: 'bartender',
      pin: '999997',
      is_active: true,
    });
    if (profileErr) throw new Error(`profile upsert: ${profileErr.message}`);

    const { error: signInErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInErr) throw new Error(`sign in: ${signInErr.message}`);

    // Seed a real promotion row (service role, bypasses RLS) with zero
    // availability rows, for the always-available + RLS-select cases.
    const { data: seeded, error: seedErr } = await db
      .from('promotions')
      .insert({
        name: '__promo_schema_test_promo__',
        discount_type: 'percentage',
        discount_value: 10,
        target_type: 'pool_billing',
        priority: 0,
        is_active: true,
      })
      .select('id')
      .single();
    if (seedErr || !seeded) throw new Error(`promotions seed insert: ${seedErr?.message}`);
    seededPromotionId = (seeded as { id: string }).id;
  });

  afterAll(async () => {
    await anonClient.auth.signOut();

    if (seededPromotionId) {
      await db.from('promotions').delete().eq('id', seededPromotionId);
    }
    if (testUserId) {
      await db.from('profiles').delete().eq('id', testUserId);
      await db.auth.admin.deleteUser(testUserId);
    }
  });

  it('rejects a promotion with a negative discount_value (CHECK constraint)', async () => {
    const { error } = await db.from('promotions').insert({
      name: '__promo_negative_discount__',
      discount_type: 'fixed_amount',
      discount_value: -1,
      target_type: 'pool_billing',
    });

    expect(error).not.toBeNull();
  });

  it('rejects a percentage promotion with discount_value > 100 (CHECK constraint)', async () => {
    const { error } = await db.from('promotions').insert({
      name: '__promo_over_100_percent__',
      discount_type: 'percentage',
      discount_value: 150,
      target_type: 'pool_billing',
    });

    expect(error).not.toBeNull();
  });

  it('is_promotion_available returns true for a promotion with zero availability rows', async () => {
    const { data, error } = await db.rpc('is_promotion_available', {
      p_promotion_id: seededPromotionId,
      p_ts: new Date().toISOString(),
    });

    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it('is_promotion_available returns false outside a configured window and true inside it', async () => {
    // Window: every day, 14:00-15:00 America/Mexico_City.
    const { error: windowErr } = await db.from('promotion_availability').insert({
      promotion_id: seededPromotionId,
      days_of_week: [1, 2, 3, 4, 5, 6, 7],
      start_time: '14:00:00',
      end_time: '15:00:00',
    });
    expect(windowErr).toBeNull();

    // 20:00 UTC on an arbitrary Wednesday is 14:00 America/Mexico_City (UTC-6) — inside the window.
    const insideWindowTs = new Date('2026-07-15T20:00:00.000Z').toISOString();
    // 12:00 UTC is 06:00 America/Mexico_City — outside the window.
    const outsideWindowTs = new Date('2026-07-15T12:00:00.000Z').toISOString();

    const { data: insideResult, error: insideErr } = await db.rpc('is_promotion_available', {
      p_promotion_id: seededPromotionId,
      p_ts: insideWindowTs,
    });
    expect(insideErr).toBeNull();
    expect(insideResult).toBe(true);

    const { data: outsideResult, error: outsideErr } = await db.rpc('is_promotion_available', {
      p_promotion_id: seededPromotionId,
      p_ts: outsideWindowTs,
    });
    expect(outsideErr).toBeNull();
    expect(outsideResult).toBe(false);

    // Clean up the window row so it doesn't affect subsequent test ordering.
    await db.from('promotion_availability').delete().eq('promotion_id', seededPromotionId);
  });

  it('SELECT is permitted for an authenticated bartender (sanity check on the seeded row)', async () => {
    const { data, error } = await anonClient
      .from('promotions')
      .select('id, name')
      .eq('id', seededPromotionId)
      .single();

    expect(error).toBeNull();
    expect((data as { id: string; name: string } | null)?.name).toBe('__promo_schema_test_promo__');
  });

  it('INSERT into promotions is denied for an authenticated bartender (manage_products RLS)', async () => {
    const { data, error } = await anonClient
      .from('promotions')
      .insert({
        name: '__promo_bartender_insert_attempt__',
        discount_type: 'fixed_amount',
        discount_value: 5,
        target_type: 'pool_billing',
      })
      .select();

    // No INSERT policy matches bartender (manage_products requires
    // manager/admin) -> either an RLS error or a silently empty result.
    if (error) {
      expect(error).not.toBeNull();
    } else {
      expect(data as unknown[]).toHaveLength(0);
    }
  });
});
