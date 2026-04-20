import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BAR_POS_ROOT = path.resolve(__dirname, '..', '..');

function getUrl(): string {
  const u = process.env.VITE_SUPABASE_URL;
  if (!u) throw new Error('Missing VITE_SUPABASE_URL');
  return u;
}

function getServiceKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return k;
}

export function getServiceClient(): SupabaseClient {
  return createClient(getUrl(), getServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Best-effort reset: end pool sessions, void open tabs, close caja, end open shifts.
 */
export async function resetTestState(): Promise<void> {
  const admin = getServiceClient();

  await admin
    .from('pool_tables')
    .update({ status: 'available', current_session_id: null })
    .eq('status', 'occupied');

  await admin
    .from('pool_sessions')
    .update({
      stopped_at: new Date().toISOString(),
      billed_minutes: 15,
      total_charge: 4,
    })
    .is('stopped_at', null);

  await admin
    .from('tabs')
    .update({ status: 'voided', closed_at: new Date().toISOString() })
    .eq('status', 'open')
    .eq('is_deleted', false);

  const { data: openCaja } = await admin.from('caja_sessions').select('id, opened_by, opening_cash').eq('status', 'open').maybeSingle();

  if (openCaja) {
    await admin
      .from('caja_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: openCaja.opened_by,
        closing_cash: openCaja.opening_cash,
      })
      .eq('id', openCaja.id);
  }

  await admin.from('shifts').update({ clock_out: new Date().toISOString() }).is('clock_out', null);

  const { data: bud } = await admin.from('products').select('id').eq('name', 'Budweiser').maybeSingle();
  if (bud?.id) {
    await admin.from('inventory').update({ quantity_on_hand: 100 }).eq('product_id', bud.id);
  }
}

/**
 * Opens a new caja session (requires no other open caja). Uses first manager profile as opener.
 */
export async function openCaja(openingCash: number): Promise<string> {
  const admin = getServiceClient();
  const { data: mgr, error: mErr } = await admin.from('profiles').select('id').eq('role', 'manager').limit(1).maybeSingle();
  if (mErr || !mgr) throw new Error('openCaja: no manager profile found');

  await admin
    .from('caja_sessions')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: mgr.id,
      closing_cash: openingCash,
    })
    .eq('status', 'open');

  const { data: row, error } = await admin
    .from('caja_sessions')
    .insert({
      opened_by: mgr.id,
      opening_cash: openingCash,
      status: 'open',
    })
    .select('id')
    .single();

  if (error || !row) throw new Error(`openCaja failed: ${error?.message ?? 'no row'}`);
  return row.id as string;
}

export async function getInventoryQty(productName: string): Promise<number> {
  const admin = getServiceClient();
  const { data: prod, error: pErr } = await admin.from('products').select('id').eq('name', productName).maybeSingle();
  if (pErr || !prod) throw new Error(`getInventoryQty: product "${productName}" not found`);
  const { data: inv, error: iErr } = await admin
    .from('inventory')
    .select('quantity_on_hand')
    .eq('product_id', prod.id)
    .maybeSingle();
  if (iErr || inv == null) throw new Error(`getInventoryQty: no inventory row for "${productName}"`);
  return Number(inv.quantity_on_hand);
}

export async function setInventoryQty(productName: string, qty: number): Promise<void> {
  const admin = getServiceClient();
  const { data: prod, error: pErr } = await admin.from('products').select('id').eq('name', productName).maybeSingle();
  if (pErr || !prod) throw new Error(`setInventoryQty: product "${productName}" not found`);
  const { error } = await admin.from('inventory').update({ quantity_on_hand: qty }).eq('product_id', prod.id);
  if (error) throw new Error(`setInventoryQty failed: ${error.message}`);
}

export async function getOrderCount(tabId: string): Promise<number> {
  const admin = getServiceClient();
  const { count, error } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('tab_id', tabId)
    .eq('is_deleted', false);
  if (error) throw new Error(`getOrderCount: ${error.message}`);
  return count ?? 0;
}

/**
 * Lists migration files on disk and marks applied=true if `supabase migration list` shows them as applied.
 * If the CLI is unavailable, returns applied:false for all (infra test documents the gap).
 */
export async function getMigrationList(): Promise<{ name: string; applied: boolean }[]> {
  const dir = path.join(BAR_POS_ROOT, 'supabase', 'migrations');
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  let cliOutput = '';
  try {
    cliOutput = execSync('npx supabase migration list', {
      cwd: BAR_POS_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60_000,
    });
  } catch {
    return files.map(name => ({ name, applied: false }));
  }

  return files.map(name => {
    // CLI output shows only the timestamp prefix (e.g. "20260414000001"), not the full filename
    const timestamp = name.split('_')[0];
    return {
      name,
      applied: cliOutput.includes(timestamp),
    };
  });
}

export async function forceCloseAllOpenTabs(): Promise<void> {
  const admin = getServiceClient();
  await admin
    .from('tabs')
    .update({ status: 'voided', closed_at: new Date().toISOString() })
    .eq('status', 'open')
    .eq('is_deleted', false);
}

export async function getOpenTabIdByCustomerName(customerName: string): Promise<string | null> {
  const admin = getServiceClient();
  const { data, error } = await admin
    .from('tabs')
    .select('id')
    .eq('customer_name', customerName)
    .eq('status', 'open')
    .eq('is_deleted', false)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.id as string | undefined) ?? null;
}

export async function getPoolSessionStartedAt(sessionId: string): Promise<string | null> {
  const admin = getServiceClient();
  const { data, error } = await admin.from('pool_sessions').select('started_at').eq('id', sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.started_at as string | undefined) ?? null;
}

export async function getLatestStoppedPoolChargeForTab(tabId: string): Promise<number> {
  const admin = getServiceClient();
  const { data, error } = await admin
    .from('pool_sessions')
    .select('total_charge')
    .eq('tab_id', tabId)
    .not('stopped_at', 'is', null)
    .order('stopped_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.total_charge == null) return 0;
  return Number(data.total_charge);
}

export async function getOccupiedPoolTableIds(): Promise<{ tableId: string; sessionId: string; number: number }[]> {
  const admin = getServiceClient();
  const { data, error } = await admin
    .from('pool_tables')
    .select('id, number, current_session_id')
    .eq('status', 'occupied')
    .not('current_session_id', 'is', null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { id: string; number: number; current_session_id: string }) => ({
    tableId: r.id,
    sessionId: r.current_session_id,
    number: r.number,
  }));
}
