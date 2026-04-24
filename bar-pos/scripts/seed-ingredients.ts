/* eslint-disable */
/**
 * Seed script: core ingredients for dev database.
 *
 * Run from bar-pos/ directory:
 *   npx tsx scripts/seed-ingredients.ts
 *
 * Uses select-then-insert pattern (idempotent by name).
 *
 * Requires: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * WARNING: Uses service role key — do NOT import this in the renderer.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local from bar-pos/ directory
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config(); // fallback to .env
}

const SUPABASE_URL = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Service role client — bypasses RLS for seeding
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}) as any;

// Core ingredients covering the key categories used in Phase 3 testing
const INGREDIENTS = [
  {
    name: 'Corona 355ml',
    uom: 'unit',
    purchase_uom: 'case_24',
    purchase_to_base_factor: 24,
    cost_per_base_unit: 12.50,
    reorder_point: 48,
    category: 'beer-regular',
    is_prep: false,
    is_active: true,
    quantity_on_hand: 240,
  },
  {
    name: 'Modelo Especial 355ml',
    uom: 'unit',
    purchase_uom: 'case_24',
    purchase_to_base_factor: 24,
    cost_per_base_unit: 14.00,
    reorder_point: 48,
    category: 'beer-premium',
    is_prep: false,
    is_active: true,
    quantity_on_hand: 120,
  },
  {
    name: 'Wings (raw)',
    uom: 'g',
    purchase_uom: 'kg',
    purchase_to_base_factor: 1000,
    cost_per_base_unit: 0.095,
    reorder_point: 2000,
    category: 'food-protein',
    is_prep: false,
    is_active: true,
    quantity_on_hand: 5000,
  },
  {
    name: 'Lime',
    uom: 'unit',
    purchase_uom: null,
    purchase_to_base_factor: 1,
    cost_per_base_unit: 1.50,
    reorder_point: 50,
    category: 'produce',
    is_prep: false,
    is_active: true,
    quantity_on_hand: 100,
  },
  {
    name: 'Clamato 1L',
    uom: 'ml',
    purchase_uom: 'L',
    purchase_to_base_factor: 1000,
    cost_per_base_unit: 0.025,
    reorder_point: 2000,
    category: 'mixer',
    is_prep: false,
    is_active: true,
    quantity_on_hand: 4000,
  },
  {
    name: 'Salsa Mexicana',
    uom: 'portion',
    purchase_uom: null,
    purchase_to_base_factor: 1,
    cost_per_base_unit: 0.50,
    reorder_point: 20,
    category: 'prep',
    is_prep: true,
    is_active: true,
    quantity_on_hand: 30,
  },
];

async function main() {
  console.log('Seeding ingredients...');

  for (const ingredient of INGREDIENTS) {
    // Idempotent: check by name first
    const { data: existing } = await db
      .from('ingredients')
      .select('id, name')
      .eq('name', ingredient.name)
      .maybeSingle();

    if (existing) {
      console.log(`  [SKIP] ${ingredient.name} — already exists`);
      continue;
    }

    const { error } = await db.from('ingredients').insert(ingredient);
    if (error) {
      console.error(`  [ERROR] ${ingredient.name}: ${error.message}`);
    } else {
      console.log(`  [OK]   ${ingredient.name}`);
    }
  }

  console.log('Done.');
}

void main().catch(e => {
  console.error(e);
  process.exit(1);
});
