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

  // Reset kds_status for all non-done items so the KDS board is clean between tests
  await admin
    .from('order_items')
    .update({ kds_status: 'done' })
    .neq('kds_status', 'done');

  await admin
    .from('tabs')
    .update({ status: 'voided', closed_at: new Date().toISOString() })
    .eq('status', 'open')
    .eq('is_deleted', false);

  // Bulk-close ALL open caja sessions to avoid duplicate-key errors on next openCaja()
  const { data: mgrForReset } = await admin.from('profiles').select('id').eq('role', 'manager').limit(1).maybeSingle();
  await admin
    .from('caja_sessions')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: mgrForReset?.id ?? null,
      closing_cash: 0,
    })
    .eq('status', 'open');

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

// ---------------------------------------------------------------------------
// New helpers added for specs 18-26
// ---------------------------------------------------------------------------

/**
 * Seed a pending order with one Budweiser item into an existing open tab.
 * Returns the orderId.
 */
export async function seedVoidableOrder(tabId: string): Promise<string> {
  const admin = getServiceClient();

  // Find a staff member for staff_id
  const { data: staff, error: sErr } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .single();
  if (sErr || !staff) throw new Error(`seedVoidableOrder: no profile found – ${sErr?.message}`);

  // Find Budweiser product
  const { data: bud, error: pErr } = await admin
    .from('products')
    .select('id, base_price')
    .eq('name', 'Budweiser')
    .maybeSingle();
  if (pErr || !bud) throw new Error(`seedVoidableOrder: Budweiser not found – ${pErr?.message}`);

  // Insert order
  const { data: order, error: oErr } = await admin
    .from('orders')
    .insert({
      tab_id: tabId,
      staff_id: staff.id,
      status: 'pending',
    })
    .select('id')
    .single();
  if (oErr || !order) throw new Error(`seedVoidableOrder: order insert failed – ${oErr?.message}`);

  // Insert order_item
  const { error: iErr } = await admin.from('order_items').insert({
    order_id: order.id,
    product_id: bud.id,
    quantity: 1,
    unit_price: bud.base_price,
    modifier_price_delta: 0,
  });
  if (iErr) throw new Error(`seedVoidableOrder: order_item insert failed – ${iErr.message}`);

  return order.id as string;
}

/**
 * Seed a closed/paid tab with one payment row.
 * Returns the tabId.
 */
export async function seedClosedTab(): Promise<string> {
  const admin = getServiceClient();

  const { data: staff } = await admin.from('profiles').select('id').limit(1).single();
  if (!staff) throw new Error('seedClosedTab: no profile found');

  // Find or create a shift
  let shiftId: string;
  const { data: existingShift } = await admin
    .from('shifts')
    .select('id')
    .eq('staff_id', staff.id)
    .is('clock_out', null)
    .limit(1)
    .maybeSingle();
  if (existingShift) {
    shiftId = existingShift.id as string;
  } else {
    const { data: newShift, error: shiftErr } = await admin
      .from('shifts')
      .insert({ staff_id: staff.id, opening_cash: 0 })
      .select('id')
      .single();
    if (shiftErr || !newShift) throw new Error(`seedClosedTab: shift create failed – ${shiftErr?.message}`);
    shiftId = newShift.id as string;
  }

  const { data: tab, error: tabErr } = await admin
    .from('tabs')
    .insert({
      customer_name: 'Closed Tab E2E',
      staff_id: staff.id,
      shift_id: shiftId,
      status: 'paid',
      closed_at: new Date().toISOString(),
      is_deleted: false,
    })
    .select('id')
    .single();
  if (tabErr || !tab) throw new Error(`seedClosedTab: tab insert failed – ${tabErr?.message}`);

  // Insert a payment row
  await admin.from('payments').insert({
    tab_id: tab.id,
    amount: 10,
    tip_amount: 0,
    method: 'cash',
    square_payment_id: null,
    square_receipt_url: null,
    processed_by: staff.id,
  });

  return tab.id as string;
}

/**
 * Seed a caja_entries row for the open caja session.
 * Returns the entryId.
 */
export async function seedCajaEntry(
  type: 'expense' | 'income',
  amount: number,
  concept: string
): Promise<string> {
  const admin = getServiceClient();

  const { data: caja, error: cErr } = await admin
    .from('caja_sessions')
    .select('id')
    .eq('status', 'open')
    .maybeSingle();
  if (cErr || !caja) throw new Error(`seedCajaEntry: no open caja session – ${cErr?.message}`);

  const { data: staff } = await admin.from('profiles').select('id').limit(1).single();
  if (!staff) throw new Error('seedCajaEntry: no profile found');

  const { data: entry, error: eErr } = await admin
    .from('caja_entries')
    .insert({
      caja_session_id: caja.id,
      type,
      amount,
      concept,
      staff_id: staff.id,
    })
    .select('id')
    .single();
  if (eErr || !entry) throw new Error(`seedCajaEntry: insert failed – ${eErr?.message}`);

  return entry.id as string;
}

/**
 * Seed a rappi_orders row with an optional linked tab.
 * Returns the rappiOrderId (row id, not external rappi_order_id).
 */
export async function seedRappiOrder(status = 'pending_acceptance'): Promise<string> {
  const admin = getServiceClient();

  const { data: staff } = await admin.from('profiles').select('id').limit(1).single();
  if (!staff) throw new Error('seedRappiOrder: no profile found');

  // Get tenant_id from first profile
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .single();
  if (!profile) throw new Error('seedRappiOrder: no profile found');

  // Use a deterministic external id
  const externalId = `E2E-RAPPI-${Date.now()}`;

  const { data: row, error: rErr } = await admin
    .from('rappi_orders')
    .insert({
      rappi_order_id: externalId,
      status,
      customer_name: 'Rappi Test Customer',
      delivery_address: '123 Test St',
      items: JSON.stringify([{ name: 'Corona', quantity: 1, unitPrice: 35 }]),
      subtotal: 35,
      rappi_total: 35,
      tenant_id: profile.id,
    })
    .select('id')
    .single();
  if (rErr || !row) throw new Error(`seedRappiOrder: insert failed – ${rErr?.message}`);

  return row.id as string;
}

/**
 * Set is_active on a product by name.
 */
export async function setProductActive(productName: string, active: boolean): Promise<void> {
  const admin = getServiceClient();
  const { error } = await admin
    .from('products')
    .update({ is_active: active })
    .eq('name', productName);
  if (error) throw new Error(`setProductActive failed: ${error.message}`);
}

/**
 * Set quantity_on_hand = 0 for the inventory row linked to the named product.
 */
export async function setStockToZero(productName: string): Promise<void> {
  const admin = getServiceClient();
  const { data: prod, error: pErr } = await admin
    .from('products')
    .select('id')
    .eq('name', productName)
    .maybeSingle();
  if (pErr || !prod) throw new Error(`setStockToZero: product "${productName}" not found`);

  const { error } = await admin
    .from('inventory')
    .update({ quantity_on_hand: 0 })
    .eq('product_id', prod.id);
  if (error) throw new Error(`setStockToZero failed: ${error.message}`);
}

/**
 * Seed a new staff member via Supabase Auth admin + profiles upsert.
 * Returns the userId.
 */
export async function seedNewStaffMember(
  name: string,
  pin: string,
  role: 'bartender' | 'manager' | 'admin'
): Promise<string> {
  const admin = getServiceClient();

  // Use name as deterministic email
  const email = `${name.toLowerCase().replace(/\s+/g, '-')}@e2e-test.local`;

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: `Test${pin}!`,
    email_confirm: true,
  });
  if (authErr || !authUser.user) throw new Error(`seedNewStaffMember: auth create failed – ${authErr?.message}`);

  const userId = authUser.user.id;

  const { error: profileErr } = await admin.from('profiles').upsert({
    id: userId,
    name,
    email,
    role,
    pin,
    is_active: true,
  });
  if (profileErr) throw new Error(`seedNewStaffMember: profile upsert failed – ${profileErr.message}`);

  return userId;
}

/**
 * Set stock_threshold on a product by name.
 * Pass null to clear the threshold.
 */
export async function setStockThreshold(productName: string, threshold: number | null): Promise<void> {
  const admin = getServiceClient();
  const { data: prod, error: pErr } = await admin
    .from('products')
    .select('id')
    .eq('name', productName)
    .maybeSingle();
  if (pErr || !prod) throw new Error(`setStockThreshold: "${productName}" not found`);
  const { error } = await admin
    .from('products')
    .update({ stock_threshold: threshold })
    .eq('id', prod.id);
  if (error) throw new Error(`setStockThreshold failed: ${error.message}`);
}

/**
 * Clear stock_threshold (set to null) on a product by name.
 */
export async function clearStockThreshold(productName: string): Promise<void> {
  await setStockThreshold(productName, null);
}

/**
 * Get the most recent stock_movements entry for a product by name with a given reason.
 * Returns null if no matching row exists.
 */
export async function getLatestInventoryLog(
  productName: string,
  reason: string
): Promise<{ quantity_delta: number; reason: string } | null> {
  const admin = getServiceClient();
  const { data: prod, error: pErr } = await admin
    .from('products')
    .select('id')
    .eq('name', productName)
    .maybeSingle();
  if (pErr || !prod) throw new Error(`getLatestInventoryLog: "${productName}" not found`);
  const { data, error } = await admin
    .from('stock_movements')
    .select('quantity_delta, reason')
    .eq('product_id', prod.id)
    .eq('reason', reason)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestInventoryLog failed: ${error.message}`);
  if (!data) return null;
  return { quantity_delta: Number(data.quantity_delta), reason: data.reason as string };
}

/**
 * Seed a pending food order item into an existing open tab.
 * Finds (or creates) a product in a food category (is_food = true),
 * creates an order for the tab, and inserts an order_item with kds_status = 'pending'.
 * Returns the orderId and itemId.
 */
export async function seedKdsFoodOrder(
  tabId: string
): Promise<{ orderId: string; itemId: string }> {
  const admin = getServiceClient();

  // Find a food category
  const { data: foodCat, error: catErr } = await admin
    .from('categories')
    .select('id')
    .eq('is_food', true)
    .limit(1)
    .maybeSingle();
  if (catErr || !foodCat) throw new Error(`seedKdsFoodOrder: no food category found – ${catErr?.message}`);

  // Find a product in that food category
  const { data: product, error: prodErr } = await admin
    .from('products')
    .select('id, base_price')
    .eq('category_id', foodCat.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (prodErr || !product) throw new Error(`seedKdsFoodOrder: no food product found – ${prodErr?.message}`);

  // Find a staff member
  const { data: staff } = await admin.from('profiles').select('id').limit(1).single();
  if (!staff) throw new Error('seedKdsFoodOrder: no profile found');

  // Create order
  const { data: order, error: oErr } = await admin
    .from('orders')
    .insert({ tab_id: tabId, staff_id: staff.id, status: 'pending' })
    .select('id')
    .single();
  if (oErr || !order) throw new Error(`seedKdsFoodOrder: order insert failed – ${oErr?.message}`);

  // Create order_item with kds_status = 'pending'
  const { data: item, error: iErr } = await admin
    .from('order_items')
    .insert({
      order_id: order.id,
      product_id: product.id,
      quantity: 1,
      unit_price: product.base_price,
      modifier_price_delta: 0,
      kds_status: 'pending',
    })
    .select('id')
    .single();
  if (iErr || !item) throw new Error(`seedKdsFoodOrder: order_item insert failed – ${iErr?.message}`);

  return { orderId: order.id as string, itemId: item.id as string };
}

/**
 * Query order_items.kds_status for the given item id.
 * Returns the kds_status string value.
 */
export async function getKdsItemStatus(itemId: string): Promise<string> {
  const admin = getServiceClient();
  const { data, error } = await admin
    .from('order_items')
    .select('kds_status')
    .eq('id', itemId)
    .single();
  if (error || !data) throw new Error(`getKdsItemStatus: query failed – ${error?.message}`);
  return data.kds_status as string;
}

/**
 * Delete a staff member from profiles and Supabase Auth by name.
 */
export async function deleteTestStaff(name: string): Promise<void> {
  const admin = getServiceClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('name', name)
    .maybeSingle();

  if (!profile) return; // already gone

  await admin.from('profiles').delete().eq('id', profile.id);
  await admin.auth.admin.deleteUser(profile.id as string);
}
