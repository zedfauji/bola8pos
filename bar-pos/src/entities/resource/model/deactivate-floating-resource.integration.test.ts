/**
 * Integration test: deactivate_floating_resource() trigger — soft-retires a
 * floating resource the instant its pool session's stopped_at transitions
 * from null to non-null (Phase 26 Plan 03, SC-2).
 *
 * Requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and
 * SUPABASE_SERVICE_ROLE_KEY in the environment. Skips gracefully (does not
 * fail) when live creds are absent, mirroring
 * src/entities/promotion/model/pool-promotions-rpc.integration.test.ts.
 *
 * DEPENDENCY: this test requires both of the following to be LIVE on the
 * target Supabase project (Plan 26-03 Task 1/2's BLOCKING db push):
 *   - supabase/migrations/20260728000002_resources_is_temp_floating.sql
 *   - supabase/migrations/20260728000003_deactivate_floating_resource_trigger.sql
 *
 * The trigger under test is driven directly by updating
 * pool_sessions.stopped_at with the service-role client, never via the
 * stop_pool_session RPC — that RPC also runs billing math, promotions, and
 * version guards, and a failure there would be indistinguishable from a
 * trigger failure.
 */
import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const hasE2eEnv = !url || !serviceKey || !anonKey;

describe.skipIf(hasE2eEnv)('deactivate_floating_resource trigger (SC-2)', () => {
  // persistSession: false is load-bearing here, not cosmetic. This suite's
  // integration/jsdom environment gives both clients the same
  // window.localStorage backend; without this, once anonClient below signs
  // in, GoTrue's shared storage key silently makes `db`'s requests use that
  // session's JWT instead of the service-role key, so `db` stops bypassing
  // RLS — exactly what the soft-delete-visibility assertions below need it
  // to do.
  const db = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
  const anonClient = createClient(url!, anonKey!) as any;

  let testUserId: string;

  // Per-test cleanup registries.
  let resourceIds: string[];
  let sessionIds: string[];

  function uniqueNumber(): number {
    return 900000 + Math.floor(Math.random() * 99999);
  }

  async function signInTestUser(): Promise<void> {
    const testEmail = `__deactivate_floating_resource_test_${String(Date.now())}_${String(Math.random()).slice(2, 8)}@test.local`;
    const testPassword = 'TestDeactivateFloating123!';

    const { data: authUser, error: createErr } = await db.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (createErr || !authUser.user) throw new Error(`test user create: ${createErr?.message}`);
    testUserId = authUser.user.id as string;

    const { error: profileErr } = await db.from('profiles').upsert({
      id: testUserId,
      name: `__deactivate_floating_test_${testUserId.slice(0, 8)}__`,
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
  }

  async function seedResource(isTemp: boolean): Promise<string> {
    const number = uniqueNumber();
    const { data, error } = await db
      .from('resources')
      .insert({
        number,
        label: `__deactivate_floating_test_${String(number)}__`,
        rate_per_hour: 10,
        status: 'occupied',
        table_type: isTemp ? 'floating' : 'pool',
        is_temp: isTemp,
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(`resources insert: ${error?.message ?? 'no row'}`);
    return (data as { id: string }).id;
  }

  async function seedSession(tableId: string): Promise<string> {
    const { data, error } = await db
      .from('pool_sessions')
      .insert({ table_id: tableId, tab_id: null })
      .select('id')
      .single();
    if (error || !data) throw new Error(`pool_sessions insert: ${error?.message ?? 'no row'}`);
    return (data as { id: string }).id;
  }

  async function stopSession(sessionId: string): Promise<void> {
    // pool_sessions has a bump_version_on_update trigger (Phase 15) that
    // rejects any UPDATE not explicitly advancing `version` by 1 — fetch it
    // first, same pattern as useMutationStopSession/useMutationUpdateSessionStartTime.
    const { data: current, error: versionErr } = await db
      .from('pool_sessions')
      .select('version')
      .eq('id', sessionId)
      .single();
    if (versionErr || !current) {
      throw new Error(`pool_sessions version fetch: ${versionErr?.message ?? 'no row'}`);
    }

    const { error } = await db
      .from('pool_sessions')
      .update({
        stopped_at: new Date().toISOString(),
        version: (current as { version: number }).version + 1,
      })
      .eq('id', sessionId);
    if (error) throw new Error(`pool_sessions stop update: ${error.message}`);
  }

  async function getResource(
    resourceId: string
  ): Promise<{ is_deleted: boolean; deleted_at: string | null; status: string; current_session_id: string | null } | null> {
    const { data, error } = await db
      .from('resources')
      .select('is_deleted, deleted_at, status, current_session_id')
      .eq('id', resourceId)
      .maybeSingle();
    if (error) throw new Error(`resources select: ${error.message}`);
    return data;
  }

  beforeEach(async () => {
    resourceIds = [];
    sessionIds = [];
    if (hasE2eEnv) return;
    await signInTestUser();
  });

  afterEach(async () => {
    if (hasE2eEnv) return;

    await anonClient.auth.signOut();

    // Sessions before resources — pool_sessions.table_id carries ON DELETE
    // RESTRICT into resources.
    for (const id of sessionIds) {
      await db.from('pool_sessions').delete().eq('id', id);
    }
    for (const id of resourceIds) {
      await db.from('resources').delete().eq('id', id);
    }
    if (testUserId) {
      await db.from('profiles').delete().eq('id', testUserId);
      await db.auth.admin.deleteUser(testUserId);
    }
  });

  it('retires a floating resource the instant its session stops: is_deleted flips true, deleted_at is set', async () => {
    const resourceId = await seedResource(true);
    resourceIds.push(resourceId);
    const sessionId = await seedSession(resourceId);
    sessionIds.push(sessionId);

    await stopSession(sessionId);

    const resource = await getResource(resourceId);
    expect(resource).not.toBeNull();
    expect(resource!.is_deleted).toBe(true);
    expect(resource!.deleted_at).not.toBeNull();
    expect(resource!.status).toBe('available');
    expect(resource!.current_session_id).toBeNull();
  });

  it('soft-delete only: the retired row still exists via the service-role client and the session still resolves table_id', async () => {
    const resourceId = await seedResource(true);
    resourceIds.push(resourceId);
    const sessionId = await seedSession(resourceId);
    sessionIds.push(sessionId);

    await stopSession(sessionId);

    // Still present when queried with the service-role client (soft-delete,
    // not hard-delete) — a hard DELETE here would have raised a FK violation
    // against pool_sessions.table_id's ON DELETE RESTRICT.
    const resource = await getResource(resourceId);
    expect(resource).not.toBeNull();

    const { data: session, error } = await db
      .from('pool_sessions')
      .select('table_id')
      .eq('id', sessionId)
      .single();
    expect(error).toBeNull();
    expect((session as { table_id: string }).table_id).toBe(resourceId);
  });

  it('policy invisibility: the retired row is absent from an anon/authenticated-client read', async () => {
    const resourceId = await seedResource(true);
    resourceIds.push(resourceId);
    const sessionId = await seedSession(resourceId);
    sessionIds.push(sessionId);

    await stopSession(sessionId);

    const { data, error } = await anonClient
      .from('resources')
      .select('id')
      .eq('id', resourceId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('SC-4 no-regression: a non-floating resource survives an identical session stop untouched and visible', async () => {
    const resourceId = await seedResource(false);
    resourceIds.push(resourceId);
    const sessionId = await seedSession(resourceId);
    sessionIds.push(sessionId);

    await stopSession(sessionId);

    const resource = await getResource(resourceId);
    expect(resource).not.toBeNull();
    expect(resource!.is_deleted).toBe(false);
    expect(resource!.deleted_at).toBeNull();

    const { data, error } = await anonClient
      .from('resources')
      .select('id')
      .eq('id', resourceId)
      .maybeSingle();
    expect(error).toBeNull();
    expect((data as { id: string } | null)?.id).toBe(resourceId);
  });

  it('idempotence: setting stopped_at a second time on an already-stopped session does not error and leaves the retired row unchanged', async () => {
    const resourceId = await seedResource(true);
    resourceIds.push(resourceId);
    const sessionId = await seedSession(resourceId);
    sessionIds.push(sessionId);

    await stopSession(sessionId);
    const afterFirstStop = await getResource(resourceId);
    expect(afterFirstStop!.is_deleted).toBe(true);
    const deletedAtAfterFirstStop = afterFirstStop!.deleted_at;

    // Second stopped_at write on an already-stopped session: OLD.stopped_at
    // is no longer null, so the transition guard prevents the UPDATE body
    // from re-running.
    await stopSession(sessionId);

    const afterSecondStop = await getResource(resourceId);
    expect(afterSecondStop!.is_deleted).toBe(true);
    expect(afterSecondStop!.deleted_at).toBe(deletedAtAfterFirstStop);
  });
});
