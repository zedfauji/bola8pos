/**
 * Integration test: append-only RLS on `applied_promotions` (Phase 20, Plan
 * 03 — SC-2 / T-20-02).
 *
 * Requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and
 * SUPABASE_SERVICE_ROLE_KEY in the environment. Skips gracefully (does not
 * fail) when live creds are absent, mirroring
 * src/entities/audit-log/model/rls-denial.integration.test.ts.
 *
 * DEPENDENCY: this test requires the `applied_promotions` table + RLS
 * policies from supabase/migrations/20260710000003_applied_promotions_table.sql
 * to be LIVE on the target Supabase project. Until the phase's BLOCKING db
 * push lands, these cases will fail at runtime against a live env (missing
 * table) even though the env-guard skip path exits 0 today.
 *
 * `applied_promotions` is not yet in supabase.types.ts, so a
 * `db = supabase as any` cast is used file-wide per the CLAUDE.md "missing
 * generated types" workaround.
 *
 * Two authenticated (non-service-role) clients:
 *   bartenderClient — lowest-privilege role; SELECT must be denied.
 *   managerClient   — SELECT permitted; INSERT/UPDATE/DELETE must ALL be
 *                      denied (append-only by omission — no client, not even
 *                      manager/admin, can write this table; the SECURITY
 *                      DEFINER evaluate_promotions_for_item function is the
 *                      sole writer and bypasses RLS entirely).
 */
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const hasE2eEnv = !url || !serviceKey || !anonKey;

describe.skipIf(hasE2eEnv)('applied_promotions append-only RLS (SC-2)', () => {
  const db = createClient(url!, serviceKey!) as any;
  const bartenderClient = createClient(url!, anonKey!) as any;
  const managerClient = createClient(url!, anonKey!) as any;

  let bartenderUserId: string;
  let managerUserId: string;
  let seededRowId: string;

  beforeAll(async () => {
    const bartenderEmail = `__applied_promo_bartender_${String(Date.now())}@test.local`;
    const managerEmail = `__applied_promo_manager_${String(Date.now())}@test.local`;
    const password = 'TestAppliedPromoRls123!';

    const { data: bartenderAuth, error: bartenderCreateErr } = await db.auth.admin.createUser({
      email: bartenderEmail,
      password,
      email_confirm: true,
    });
    if (bartenderCreateErr || !bartenderAuth.user) {
      throw new Error(`bartender user create: ${bartenderCreateErr?.message}`);
    }
    bartenderUserId = bartenderAuth.user.id as string;

    const { data: managerAuth, error: managerCreateErr } = await db.auth.admin.createUser({
      email: managerEmail,
      password,
      email_confirm: true,
    });
    if (managerCreateErr || !managerAuth.user) {
      throw new Error(`manager user create: ${managerCreateErr?.message}`);
    }
    managerUserId = managerAuth.user.id as string;

    const { error: bartenderProfileErr } = await db.from('profiles').upsert({
      id: bartenderUserId,
      name: '__applied_promo_bartender__',
      email: bartenderEmail,
      role: 'bartender',
      pin: '999996',
      is_active: true,
    });
    if (bartenderProfileErr) throw new Error(`bartender profile upsert: ${bartenderProfileErr.message}`);

    const { error: managerProfileErr } = await db.from('profiles').upsert({
      id: managerUserId,
      name: '__applied_promo_manager__',
      email: managerEmail,
      role: 'manager',
      pin: '999995',
      is_active: true,
    });
    if (managerProfileErr) throw new Error(`manager profile upsert: ${managerProfileErr.message}`);

    const { error: bartenderSignInErr } = await bartenderClient.auth.signInWithPassword({
      email: bartenderEmail,
      password,
    });
    if (bartenderSignInErr) throw new Error(`bartender sign in: ${bartenderSignInErr.message}`);

    const { error: managerSignInErr } = await managerClient.auth.signInWithPassword({
      email: managerEmail,
      password,
    });
    if (managerSignInErr) throw new Error(`manager sign in: ${managerSignInErr.message}`);

    // Seed a real applied_promotions row (service role, bypasses RLS) with no
    // tab_id/order_item_id (both nullable) so this test has zero dependency
    // on tabs/order_items fixtures.
    const { data: seeded, error: seedErr } = await db
      .from('applied_promotions')
      .insert({
        promotion_id: null,
        promotion_name_snapshot: '__applied_promo_rls_test__',
        target_type: 'item',
        discount_type: 'percentage',
        discount_value: 10,
        original_amount: 100,
        discounted_amount: 90,
      })
      .select('id')
      .single();
    if (seedErr || !seeded) throw new Error(`applied_promotions seed insert: ${seedErr?.message}`);
    seededRowId = (seeded as { id: string }).id;
  });

  afterAll(async () => {
    await bartenderClient.auth.signOut();
    await managerClient.auth.signOut();

    if (seededRowId) {
      await db.from('applied_promotions').delete().eq('id', seededRowId);
    }
    if (bartenderUserId) {
      await db.from('profiles').delete().eq('id', bartenderUserId);
      await db.auth.admin.deleteUser(bartenderUserId);
    }
    if (managerUserId) {
      await db.from('profiles').delete().eq('id', managerUserId);
      await db.auth.admin.deleteUser(managerUserId);
    }
  });

  it('SELECT is denied for an authenticated bartender (manager+ only)', async () => {
    const { data, error } = await bartenderClient
      .from('applied_promotions')
      .select('id')
      .eq('id', seededRowId);

    // No SELECT policy matches bartender -> RLS silently filters to 0 rows
    // (no Postgres-level error, just an empty result set).
    if (error) {
      expect(error).not.toBeNull();
    } else {
      expect(data as unknown[]).toHaveLength(0);
    }
  });

  it('SELECT is permitted for an authenticated manager (sanity check on the seeded row)', async () => {
    const { data, error } = await managerClient
      .from('applied_promotions')
      .select('id, promotion_name_snapshot')
      .eq('id', seededRowId)
      .single();

    expect(error).toBeNull();
    expect((data as { id: string; promotion_name_snapshot: string } | null)?.promotion_name_snapshot).toBe(
      '__applied_promo_rls_test__'
    );
  });

  it('INSERT is denied for an authenticated manager (append-only by omission — nobody may write)', async () => {
    const { data, error } = await managerClient
      .from('applied_promotions')
      .insert({
        promotion_id: null,
        promotion_name_snapshot: '__applied_promo_manager_insert_attempt__',
        target_type: 'item',
        discount_type: 'percentage',
        discount_value: 5,
      })
      .select();

    if (error) {
      expect(error).not.toBeNull();
    } else {
      expect(data as unknown[]).toHaveLength(0);
    }
  });

  it('UPDATE is denied for an authenticated manager (append-only by omission)', async () => {
    const { data, error } = await managerClient
      .from('applied_promotions')
      .update({ promotion_name_snapshot: 'tampered' })
      .eq('id', seededRowId)
      .select();

    if (error) {
      expect(error).not.toBeNull();
    } else {
      expect(data as unknown[]).toHaveLength(0);
    }

    const { data: after, error: afterErr } = await db
      .from('applied_promotions')
      .select('promotion_name_snapshot')
      .eq('id', seededRowId)
      .single();
    expect(afterErr).toBeNull();
    expect((after as { promotion_name_snapshot: string } | null)?.promotion_name_snapshot).toBe(
      '__applied_promo_rls_test__'
    );
  });

  it('DELETE is denied for an authenticated manager (append-only by omission)', async () => {
    const { data, error } = await managerClient
      .from('applied_promotions')
      .delete()
      .eq('id', seededRowId)
      .select();

    if (error) {
      expect(error).not.toBeNull();
    } else {
      expect(data as unknown[]).toHaveLength(0);
    }

    const { data: stillThere, error: existsErr } = await db
      .from('applied_promotions')
      .select('id')
      .eq('id', seededRowId)
      .maybeSingle();
    expect(existsErr).toBeNull();
    expect((stillThere as { id: string } | null)?.id).toBe(seededRowId);
  });
});
