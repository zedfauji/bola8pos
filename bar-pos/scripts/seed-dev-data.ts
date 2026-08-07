/**
 * seed-dev-data.ts
 *
 * Baseline dev/E2E catalog data, ported from supabase/seed.sql (the local
 * `supabase start` seed) to the current remote schema: categories, products,
 * modifiers + product_modifiers, resources (pool_tables was renamed to
 * resources — table_type is now 'pool' | 'carom' | 'consumption' | 'floating'),
 * and inventory.
 *
 * Idempotent — matches by natural key (name for categories/products/modifiers/
 * inventory's product, number for resources) and only inserts what's missing;
 * updates in place on categories/products/modifiers so re-running picks up
 * content edits here, but NEVER touches an existing resources row (pool
 * tables carry live status/current_session_id — overwriting that would
 * clobber real occupancy state).
 *
 * Usage: cd bar-pos && npx tsx scripts/seed-dev-data.ts
 * Requires: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * WARNING: Uses service role key — do NOT import this in the renderer.
 */

/* eslint-disable */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const SUPABASE_URL = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertCategory(data: {
  name: string;
  routing: 'KITCHEN' | 'BAR' | 'NONE';
  sort_order: number;
  color?: string;
}): Promise<string> {
  const { data: existing } = await db
    .from('categories')
    .select('id')
    .eq('name', data.name)
    .maybeSingle();

  if (existing) {
    await db.from('categories').update(data).eq('id', existing.id);
    return existing.id as string;
  }

  const { data: inserted, error } = await db.from('categories').insert(data).select('id').single();
  if (error) {
    console.error(`Failed to insert category "${data.name}":`, error);
    process.exit(1);
  }
  return (inserted as { id: string }).id;
}

async function upsertProduct(data: {
  name: string;
  category_id: string;
  base_price: number;
  is_active: boolean;
}): Promise<string> {
  const { data: existing } = await db
    .from('products')
    .select('id')
    .eq('name', data.name)
    .maybeSingle();

  if (existing) {
    await db.from('products').update(data).eq('id', existing.id);
    return existing.id as string;
  }

  const { data: inserted, error } = await db.from('products').insert(data).select('id').single();
  if (error) {
    console.error(`Failed to insert product "${data.name}":`, error);
    process.exit(1);
  }
  return (inserted as { id: string }).id;
}

async function upsertModifier(data: { name: string; price_delta: number }): Promise<string> {
  const { data: existing } = await db
    .from('modifiers')
    .select('id')
    .eq('name', data.name)
    .maybeSingle();

  if (existing) {
    await db.from('modifiers').update(data).eq('id', existing.id);
    return existing.id as string;
  }

  const { data: inserted, error } = await db.from('modifiers').insert(data).select('id').single();
  if (error) {
    console.error(`Failed to insert modifier "${data.name}":`, error);
    process.exit(1);
  }
  return (inserted as { id: string }).id;
}

async function linkModifier(productId: string, modifierId: string): Promise<void> {
  const { data: existing } = await db
    .from('product_modifiers')
    .select('product_id')
    .eq('product_id', productId)
    .eq('modifier_id', modifierId)
    .maybeSingle();
  if (existing) return;

  const { error } = await db
    .from('product_modifiers')
    .insert({ product_id: productId, modifier_id: modifierId });
  if (error) {
    console.error(`Failed to link modifier ${modifierId} to product ${productId}:`, error);
    // Non-fatal — log and continue
  }
}

/** Create-only — never touch an existing resource, it may carry live occupancy state. */
async function ensureResource(data: {
  number: number;
  label: string;
  rate_per_hour: number;
  table_type: 'pool' | 'carom' | 'consumption' | 'floating';
}): Promise<void> {
  const { data: existing } = await db
    .from('resources')
    .select('id')
    .eq('number', data.number)
    .maybeSingle();
  if (existing) {
    console.log(`  resource #${data.number} already exists — leaving live state untouched`);
    return;
  }

  const { error } = await db.from('resources').insert({ ...data, status: 'available' });
  if (error) {
    console.error(`Failed to insert resource #${data.number}:`, error);
    process.exit(1);
  }
  console.log(`  created resource #${data.number}: ${data.label}`);
}

async function ensureInventory(productId: string, quantity: number, lowStockThreshold: number): Promise<void> {
  const { data: existing } = await db
    .from('inventory')
    .select('id')
    .eq('product_id', productId)
    .maybeSingle();
  if (existing) {
    // Don't overwrite quantity_on_hand — that's live stock, not fixture data.
    return;
  }

  const { error } = await db.from('inventory').insert({
    product_id: productId,
    quantity_on_hand: quantity,
    low_stock_threshold: lowStockThreshold,
  });
  if (error) {
    console.error(`Failed to insert inventory for product ${productId}:`, error);
    // Non-fatal — log and continue
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding baseline dev data...');

  console.log('Categories + products...');
  const beerCat = await upsertCategory({ name: 'Beer', routing: 'BAR', sort_order: 1 });
  const wineCat = await upsertCategory({ name: 'Wine', routing: 'BAR', sort_order: 2 });
  const cocktailsCat = await upsertCategory({ name: 'Cocktails', routing: 'BAR', sort_order: 3 });
  const spiritsCat = await upsertCategory({ name: 'Spirits', routing: 'BAR', sort_order: 4 });
  const snacksCat = await upsertCategory({ name: 'Snacks', routing: 'KITCHEN', sort_order: 5 });

  const budweiser = await upsertProduct({ name: 'Budweiser', category_id: beerCat, base_price: 6.5, is_active: true });
  const corona = await upsertProduct({ name: 'Corona', category_id: beerCat, base_price: 7.0, is_active: true });
  const ipaDraft = await upsertProduct({ name: 'IPA Draft', category_id: beerCat, base_price: 8.0, is_active: true });
  const houseRed = await upsertProduct({ name: 'House Red', category_id: wineCat, base_price: 9.0, is_active: true });
  const houseWhite = await upsertProduct({ name: 'House White', category_id: wineCat, base_price: 9.0, is_active: true });
  const margarita = await upsertProduct({ name: 'Margarita', category_id: cocktailsCat, base_price: 12.0, is_active: true });
  const mojito = await upsertProduct({ name: 'Mojito', category_id: cocktailsCat, base_price: 12.0, is_active: true });
  const oldFashioned = await upsertProduct({ name: 'Old Fashioned', category_id: cocktailsCat, base_price: 14.0, is_active: true });
  const whiskeyShot = await upsertProduct({ name: 'Whiskey Shot', category_id: spiritsCat, base_price: 8.0, is_active: true });
  const vodkaShot = await upsertProduct({ name: 'Vodka Shot', category_id: spiritsCat, base_price: 7.0, is_active: true });
  const nachos = await upsertProduct({ name: 'Nachos', category_id: snacksCat, base_price: 10.0, is_active: true });
  const wings = await upsertProduct({ name: 'Wings', category_id: snacksCat, base_price: 12.0, is_active: true });

  console.log('Modifiers...');
  const extraSalt = await upsertModifier({ name: 'Extra Salt', price_delta: 0.0 });
  const noIce = await upsertModifier({ name: 'No Ice', price_delta: 0.0 });
  const extraLime = await upsertModifier({ name: 'Extra Lime', price_delta: 0.5 });
  const doubleShot = await upsertModifier({ name: 'Double Shot', price_delta: 3.0 });
  const topShelf = await upsertModifier({ name: 'Top Shelf', price_delta: 5.0 });

  await linkModifier(margarita, extraSalt);
  await linkModifier(margarita, noIce);
  await linkModifier(margarita, extraLime);
  await linkModifier(mojito, noIce);
  await linkModifier(mojito, extraLime);
  await linkModifier(oldFashioned, doubleShot);
  await linkModifier(oldFashioned, topShelf);
  await linkModifier(whiskeyShot, doubleShot);
  await linkModifier(whiskeyShot, topShelf);
  await linkModifier(vodkaShot, doubleShot);
  await linkModifier(vodkaShot, topShelf);

  console.log('Resources (pool tables)...');
  await ensureResource({ number: 1, label: 'Table 1', rate_per_hour: 15.0, table_type: 'pool' });
  await ensureResource({ number: 2, label: 'Table 2', rate_per_hour: 15.0, table_type: 'pool' });
  await ensureResource({ number: 3, label: 'Table 3', rate_per_hour: 15.0, table_type: 'pool' });
  await ensureResource({ number: 4, label: 'Table 4', rate_per_hour: 20.0, table_type: 'pool' });
  await ensureResource({ number: 5, label: 'Table 5', rate_per_hour: 20.0, table_type: 'pool' });

  console.log('Inventory...');
  await ensureInventory(budweiser, 100, 20);
  await ensureInventory(corona, 80, 20);
  await ensureInventory(ipaDraft, 50, 15);
  await ensureInventory(houseRed, 30, 10);
  await ensureInventory(houseWhite, 30, 10);
  await ensureInventory(margarita, 999, 0);
  await ensureInventory(mojito, 999, 0);
  await ensureInventory(oldFashioned, 999, 0);
  await ensureInventory(whiskeyShot, 40, 10);
  await ensureInventory(vodkaShot, 40, 10);
  await ensureInventory(nachos, 25, 5);
  await ensureInventory(wings, 30, 5);

  console.log('Dev data seed complete.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
